import base64, hashlib, json, pathlib
import httpx, pytest
from whp_standing_client import (BuyerKey, MemoryPurchaseStore, StandingClient, StandingError, address_of,
                                 authorization_nonce, canonical, hash_canonical, sign_transfer_authorization, DEFAULT_POLICY)

vec = json.loads((pathlib.Path(__file__).parent / "vector.json").read_text())
DOMAIN = {"name": "USD Coin", "version": "2", "chainId": "8453", "verifyingContract": DEFAULT_POLICY.asset}
ORIGIN, ROOT, NOW, REF = "https://standing-guard-service.lovable.app", "c" * 64, 1791430000, "ref_0123456789abcdef"
TEMPLATE = {"profile": {"id": "P", "version": "2.0.0", "sha256": "d" * 64}, "object": {"id": "o", "version": "1", "root": "e" * 64},
            "bounds": {"jurisdiction": "j", "scope": "s", "valid_from": NOW - 10, "valid_until": NOW + 1000}, "requested_operation": "INFORM"}


def test_eip3009_matches_independent_vector():
    assert address_of(vec["key"]).lower() == vec["address"].lower()
    assert sign_transfer_authorization(vec["key"], DOMAIN, vec["msg"]).lower() == vec["signature"].lower()


def test_canonical():
    assert canonical({"b": 1, "a": [True, None, "x"]}) == '{"a":[true,null,"x"],"b":1}'
    assert canonical({"z": [1, {"b": "é", "a": None}], "a": "x"}) == '{"a":"x","z":[1,{"a":null,"b":"é"}]}'
    with pytest.raises(StandingError):
        canonical({"a": 1.5})


def test_client_proof_is_valid_seal():
    k = BuyerKey()
    env = json.loads(base64.b64decode(k.client_proof("POST", "/v1/evaluations", "{}", 1000)))
    assert env["payload"]["body_hash"] == hashlib.sha256(b"{}").hexdigest()
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    pub = Ed25519PublicKey.from_public_bytes(base64.b64decode(k.public_key_der)[12:])
    pub.verify(base64.b64decode(env["signature"]), canonical({"protected": env["protected"], "payload": env["payload"]}).encode())


def mock(payTo=None, amount="1000000", pending=False, reject=False):
    st = {"calls": [], "paid": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        path, body = req.url.path, req.content.decode()
        pay = json.loads(base64.b64decode(req.headers["payment-signature"])) if "payment-signature" in req.headers else None
        st["calls"].append((req.method, path, pay))
        if path == "/v1/contract":
            return httpx.Response(200, json={"root_pin": ROOT})
        if path == "/v1/evaluations":
            s = json.loads(body)
            pid = hash_canonical({"domain": "WHP-STANDING-PURCHASE-v1", "root_pin": ROOT, "buyer_key": s["buyer_key"], "client_reference": s["client_reference"]})
            r = {"scheme": "exact", "network": "eip155:8453", "amount": amount, "asset": DEFAULT_POLICY.asset, "payTo": payTo or DEFAULT_POLICY.pay_to,
                 "maxTimeoutSeconds": 300, "extra": {"assetTransferMethod": "eip3009", "paymentFlow": "authorization", "name": "USD Coin", "version": "2"}}
            res = {"url": ORIGIN + "/v1/evaluations", "description": "d", "mimeType": "application/json"}
            q = {"payload": {"purchase_id": pid, "request_hash": hash_canonical(s), "buyer_key": s["buyer_key"], "payment_requirements": r, "resource": res, "expires_at": NOW + 300}}
            if not pay:
                return httpx.Response(402, json={"x402Version": 2, "resource": res, "accepts": [r], "extensions": {"whp-standing": {"info": {"required": True, "quote": q}}}})
            if reject:
                return httpx.Response(402, json={"error": "bad"})
            st["paid"] += 1
            if pending:
                return httpx.Response(202, json={"state": "SETTLING"})
            return httpx.Response(200, json={"payload": {"purchase_id": pid, "submission_hash": hash_canonical(s)}}, headers={"payment-response": "receipt"})
        import re
        m = re.match(r"^/v1/purchases/([0-9a-f]{64})/(result|recover)$", path)
        if m:
            if st["paid"] and (not pending or m.group(2) == "recover"):
                return httpx.Response(200, json={"payload": {"purchase_id": m.group(1)}})
            return httpx.Response(202 if st["paid"] else 404, json={})
        return httpx.Response(404, json={})

    return st, httpx.AsyncClient(transport=httpx.MockTransport(handler))


def mk(http, **kw):
    return StandingClient(vec["key"], http=http, clock=lambda: NOW, **kw)


async def test_evaluate_intercepts_402_and_signs():
    st, http = mock()
    c = mk(http)
    out = await c.evaluate(REF, [], TEMPLATE)
    assert out.state == "VERIFIED" and out.payment_response == "receipt"
    pay = next(p for _, _, p in st["calls"] if p)
    a = pay["payload"]["authorization"]
    assert a["from"].lower() == vec["address"].lower() and a["to"] == DEFAULT_POLICY.pay_to and a["value"] == "1000000"
    expected = sign_transfer_authorization(vec["key"], DOMAIN, a)
    assert pay["payload"]["signature"] == expected


@pytest.mark.parametrize("kw", [{"payTo": "0x" + "9" * 40}, {"amount": "1000001"}])
async def test_refuses_bad_terms(kw):
    st, http = mock(**kw)
    with pytest.raises(StandingError) as e:
        await mk(http).evaluate(REF, [], TEMPLATE)
    assert e.value.code == "TERMS_REJECTED" and not any(p for _, _, p in st["calls"])


async def test_veto_and_rejected_payment():
    st, http = mock()
    with pytest.raises(StandingError) as e:
        await mk(http, approve_payment=lambda t: False).evaluate(REF, [], TEMPLATE)
    assert e.value.code == "TERMS_REJECTED" and not any(p for _, _, p in st["calls"])
    _, http2 = mock(reject=True)
    with pytest.raises(StandingError) as e2:
        await mk(http2).evaluate(REF, [], TEMPLATE)
    assert e2.value.code == "PAYMENT_NOT_ACCEPTED"


async def test_pending_then_no_resign():
    st, http = mock(pending=True)
    c = mk(http, store=MemoryPurchaseStore())
    assert (await c.evaluate(REF, [], TEMPLATE)).state == "PENDING"
    assert (await c.evaluate(REF, [], TEMPLATE)).state == "VERIFIED"
    assert sum(1 for _, _, p in st["calls"] if p) == 1 and st["paid"] == 1


async def test_contract_and_input_checks():
    _, http = mock()
    c = mk(http)
    assert (await c.get_contract())["root_pin"] == ROOT
    for bad in ("nothex", "zz"):
        with pytest.raises(StandingError):
            await c.get_result(bad)
    with pytest.raises(StandingError):
        StandingClient("0x12")
