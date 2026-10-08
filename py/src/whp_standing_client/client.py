"""WHP Standing client: x402 (USDC on Base) with EIP-3009 signing. Mirrors @whp/standing-client."""
from __future__ import annotations

import base64
import hashlib
import json
import re
import secrets
import time
from dataclasses import dataclass, field, replace
from typing import Any, Awaitable, Callable, Dict, List, Optional, Protocol, Union

import httpx
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from eth_account import Account

Json = Any
DEFAULT_ORIGIN = "https://standing-guard-service.lovable.app"
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_ADDR = re.compile(r"^0x[0-9a-fA-F]{40}$")


class StandingError(Exception):
    """code: TERMS_REJECTED | SIGNATURE_FAILED | SETTLEMENT_REJECTED | PAYMENT_NOT_ACCEPTED | HTTP_ERROR |
    INVALID_RESPONSE | INVALID_INPUT | RESULT_MISMATCH"""

    def __init__(self, code: str, message: str, status: Optional[int] = None, detail: Any = None) -> None:
        super().__init__(message)
        self.code, self.status, self.detail = code, status, detail


def canonical(x: Any, depth: int = 0) -> str:
    """WHP-JCS-I1: RFC 8785 over an I-JSON subset. Safe integers only; decimals are strings."""
    if depth > 64:
        raise StandingError("INVALID_INPUT", "JSON too deep")
    if x is None:
        return "null"
    if x is True:
        return "true"
    if x is False:
        return "false"
    if isinstance(x, int):
        if abs(x) > 2**53 - 1:
            raise StandingError("INVALID_INPUT", "Only safe integers are allowed; send decimals as strings")
        return str(x)
    if isinstance(x, float):
        raise StandingError("INVALID_INPUT", "Only safe integers are allowed; send decimals as strings")
    if isinstance(x, str):
        try:
            x.encode("utf-8")
        except UnicodeEncodeError as e:
            raise StandingError("INVALID_INPUT", "Invalid Unicode in string") from e
        return _jstr(x)
    if isinstance(x, (list, tuple)):
        return "[" + ",".join(canonical(v, depth + 1) for v in x) + "]"
    if isinstance(x, dict):
        # RFC 8785 sorts by UTF-16 code units
        keys = sorted(x.keys(), key=lambda k: k.encode("utf-16-be"))
        return "{" + ",".join(canonical(k, depth + 1) + ":" + canonical(x[k], depth + 1) for k in keys) + "}"
    raise StandingError("INVALID_INPUT", "Unsupported JSON value")


def _jstr(s: str) -> str:
    out = ['"']
    for ch in s:
        o = ord(ch)
        if ch == '"': out.append('\\"')
        elif ch == "\\": out.append("\\\\")
        elif ch == "\b": out.append("\\b")
        elif ch == "\f": out.append("\\f")
        elif ch == "\n": out.append("\\n")
        elif ch == "\r": out.append("\\r")
        elif ch == "\t": out.append("\\t")
        elif o < 0x20: out.append("\\u%04x" % o)
        else: out.append(ch)
    out.append('"')
    return "".join(out)


def sha256_hex(b: Union[bytes, str]) -> str:
    return hashlib.sha256(b.encode("utf-8") if isinstance(b, str) else b).hexdigest()


def hash_canonical(x: Any) -> str:
    return sha256_hex(canonical(x))


_SPKI_PREFIX = bytes.fromhex("302a300506032b6570032100")


class BuyerKey:
    """Ed25519 identity for client proofs and the submission's buyer_key."""

    def __init__(self, seed: Optional[bytes] = None) -> None:
        self._sk = Ed25519PrivateKey.from_private_bytes(seed) if seed else Ed25519PrivateKey.generate()
        raw = self._sk.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
        der = _SPKI_PREFIX + raw
        self.public_key_der = base64.b64encode(der).decode()
        self.key_id = sha256_hex(der)

    @classmethod
    def from_seed_hex(cls, h: str) -> "BuyerKey":
        h = h.removeprefix("0x")
        if not re.fullmatch(r"[0-9a-fA-F]{64}", h):
            raise StandingError("INVALID_INPUT", "Buyer seed must be 32 bytes of hex")
        return cls(bytes.fromhex(h))

    def export_seed_hex(self) -> str:
        return self._sk.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw,
                                      serialization.NoEncryption()).hex()

    def seal(self, type_: str, payload: Json) -> Dict[str, Json]:
        prot = {"type": type_, "algorithm": "Ed25519", "canonicalization": "WHP-JCS-I1", "key_id": self.key_id}
        sig = self._sk.sign(canonical({"protected": prot, "payload": payload}).encode())
        return {"protected": prot, "payload": payload, "signature": base64.b64encode(sig).decode()}

    def client_proof(self, method: str, path: str, body: str, now: int) -> str:
        payload = {"method": method, "path": path, "body_hash": sha256_hex(body), "issued_at": now,
                   "expires_at": now + 120, "nonce": secrets.token_hex(16)}
        return base64.b64encode(canonical(self.seal("WHP-CLIENT-PROOF-v1", payload)).encode()).decode()


def address_of(private_key_hex: str) -> str:
    return str(Account.from_key(private_key_hex).address)


def sign_transfer_authorization(private_key_hex: str, domain: Dict[str, str], m: Dict[str, str]) -> str:
    """Gasless EIP-3009 TransferWithAuthorization signature (65 bytes, v=27/28), deterministic."""
    try:
        td = {
            "types": {
                "EIP712Domain": [{"name": "name", "type": "string"}, {"name": "version", "type": "string"},
                                 {"name": "chainId", "type": "uint256"}, {"name": "verifyingContract", "type": "address"}],
                "TransferWithAuthorization": [{"name": "from", "type": "address"}, {"name": "to", "type": "address"},
                                              {"name": "value", "type": "uint256"}, {"name": "validAfter", "type": "uint256"},
                                              {"name": "validBefore", "type": "uint256"}, {"name": "nonce", "type": "bytes32"}]},
            "primaryType": "TransferWithAuthorization",
            "domain": {"name": domain["name"], "version": domain["version"], "chainId": int(domain["chainId"]),
                       "verifyingContract": domain["verifyingContract"]},
            "message": {"from": m["from"], "to": m["to"], "value": int(m["value"]), "validAfter": int(m["validAfter"]),
                        "validBefore": int(m["validBefore"]), "nonce": m["nonce"]},
        }
        s = Account.sign_typed_data(private_key_hex, full_message=td)
        return "0x" + str(s.signature.hex()).removeprefix("0x")
    except Exception as e:  # noqa: BLE001
        raise StandingError("SIGNATURE_FAILED", f"EIP-3009 signing failed: {e}") from e


@dataclass(frozen=True)
class PaymentPolicy:
    network: str = "eip155:8453"
    asset: str = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"  # USDC on Base
    pay_to: str = "0x1050eddd8282623b0c263ed6bdbd42370bbc28d3"
    max_amount_per_purchase: str = "1000000"  # 1.00 USDC
    asset_name: str = "USD Coin"
    asset_version: str = "2"


DEFAULT_POLICY = PaymentPolicy()


@dataclass
class PurchaseOutcome:
    purchase_id: str
    state: str  # "VERIFIED" | "PENDING"
    result_text: Optional[str] = None
    result: Json = None
    payment_response: Optional[str] = None
    additional_charge: bool = False


class PurchaseStore(Protocol):
    def get(self, purchase_id: str) -> Optional[Dict[str, Any]]: ...
    def put(self, purchase_id: str, entry: Dict[str, Any]) -> None: ...


class MemoryPurchaseStore:
    def __init__(self) -> None:
        self._m: Dict[str, Dict[str, Any]] = {}

    def get(self, purchase_id: str) -> Optional[Dict[str, Any]]:
        return self._m.get(purchase_id)

    def put(self, purchase_id: str, entry: Dict[str, Any]) -> None:
        self._m[purchase_id] = entry


def authorization_nonce(quote_payload: Dict[str, Any]) -> str:
    t = {k: v for k, v in quote_payload.items() if k != "expires_at"}
    t["payment_requirements"] = {k: v for k, v in t["payment_requirements"].items() if k != "maxTimeoutSeconds"}
    return "0x" + hash_canonical({"domain": "WHP-STANDING-PURCHASE-BINDING-v2", "quote_terms": t})


class StandingClient:
    def __init__(self, evm_private_key: str, *, buyer_key: Optional[BuyerKey] = None, origin: str = DEFAULT_ORIGIN,
                 policy: PaymentPolicy = DEFAULT_POLICY, root_pin: Optional[str] = None,
                 store: Optional[PurchaseStore] = None, http: Optional[httpx.AsyncClient] = None,
                 clock: Callable[[], int] = lambda: int(time.time()),
                 approve_payment: Optional[Callable[[Dict[str, Any]], Union[bool, Awaitable[bool]]]] = None,
                 timeout: float = 30.0) -> None:
        if not re.fullmatch(r"(0x)?[0-9a-fA-F]{64}", evm_private_key or ""):
            raise StandingError("INVALID_INPUT", "evm_private_key must be 32 bytes of hex")
        self._evm_key = evm_private_key
        self.payer = address_of(evm_private_key)
        self.buyer_key = buyer_key or BuyerKey()
        self.origin = origin.rstrip("/")
        if not re.match(r"^https://", self.origin) and not re.match(r"^http://(127\.0\.0\.1|localhost)(:\d+)?$", self.origin):
            raise StandingError("INVALID_INPUT", "origin must be https")
        self.policy, self._root_pin = policy, root_pin
        self._store: PurchaseStore = store or MemoryPurchaseStore()
        self._http = http or httpx.AsyncClient(timeout=timeout, follow_redirects=False)
        self._clock, self._approve = clock, approve_payment

    async def aclose(self) -> None:
        await self._http.aclose()

    async def _req(self, method: str, path: str, body: str = "", extra: Optional[Dict[str, str]] = None,
                   auth: bool = True) -> httpx.Response:
        headers = {"content-type": "application/json", "accept": "application/json", **(extra or {})}
        if auth:
            headers["whp-client-proof"] = self.buyer_key.client_proof(method, path, body, self._clock())
        try:
            return await self._http.request(method, self.origin + path, headers=headers,
                                            content=body.encode() if method == "POST" else None)
        except httpx.HTTPError as e:
            raise StandingError("HTTP_ERROR", f"Request failed: {method} {path}: {e}") from e

    @staticmethod
    def _json(r: httpx.Response) -> Json:
        try:
            return r.json()
        except ValueError as e:
            raise StandingError("INVALID_RESPONSE", "Response was not JSON", r.status_code, r.text[:300]) from e

    @staticmethod
    def _fail(r: httpx.Response, what: str) -> StandingError:
        return StandingError("HTTP_ERROR", f"{what}: HTTP {r.status_code}", r.status_code, r.text[:500])

    async def get_contract(self) -> Dict[str, Any]:
        r = await self._req("GET", "/v1/contract", auth=False)
        if not r.is_success:
            raise self._fail(r, "get_contract")
        c: Dict[str, Any] = self._json(r)
        if self._root_pin is None and isinstance(c.get("root_pin"), str) and _HEX64.match(c["root_pin"]):
            self._root_pin = c["root_pin"]
        return c

    async def _pin(self) -> str:
        if not self._root_pin:
            await self.get_contract()
        if not self._root_pin:
            raise StandingError("INVALID_RESPONSE", "No root_pin available; pass root_pin explicitly")
        return self._root_pin

    async def purchase_id_for(self, client_reference: str) -> str:
        return hash_canonical({"domain": "WHP-STANDING-PURCHASE-v1", "root_pin": await self._pin(),
                               "buyer_key": self.buyer_key.public_key_der, "client_reference": client_reference})

    async def evaluate(self, client_reference: str, nodes: List[Json], template: Dict[str, Any]) -> PurchaseOutcome:
        """Submit the node graph, answer the 402 once with a quote-bound EIP-3009 authorization, return the signed
        result ($1.00 USDC by default policy). Repeating with the same client_reference never re-signs."""
        if not re.fullmatch(r"[A-Za-z0-9_-]{16,96}", client_reference):
            raise StandingError("INVALID_INPUT", "client_reference must match [A-Za-z0-9_-]{16,96}")
        s = {"version": "WHP-STANDING-SUBMISSION-v1", "client_reference": client_reference,
             "buyer_key": self.buyer_key.public_key_der, "profile": template["profile"], "object": template["object"],
             "bounds": template["bounds"], "requested_operation": template["requested_operation"], "nodes": nodes,
             "transitions": template.get("transitions", [])}
        body = canonical(s)
        pid = await self.purchase_id_for(client_reference)
        row = self._store.get(pid) or {"submission": s}
        if row.get("payment"):
            return await self.recover(pid)
        self._store.put(pid, row)
        unpaid = await self._req("POST", "/v1/evaluations", body)
        if unpaid.status_code == 200:
            return self._accept(pid, s, unpaid)
        if unpaid.status_code != 402:
            raise self._fail(unpaid, "evaluate (challenge)")
        terms = self._json(unpaid)
        req, quote = self._check_terms(terms, pid, s)
        if self._approve is not None:
            ok = self._approve(req)
            if hasattr(ok, "__await__"):
                ok = await ok
            if not ok:
                raise StandingError("TERMS_REJECTED", "approve_payment refused the terms")
        at = self._clock()
        expires = int(quote["expires_at"])
        if not at < expires:
            raise StandingError("TERMS_REJECTED", "Quote already expired")
        auth = {"from": self.payer, "to": req["payTo"], "value": req["amount"], "validAfter": str(at - 1),
                "validBefore": str(min(at + req["maxTimeoutSeconds"], expires)), "nonce": authorization_nonce(quote)}
        sig = sign_transfer_authorization(self._evm_key, {"name": req["extra"]["name"], "version": req["extra"]["version"],
                                                         "chainId": req["network"][7:], "verifyingContract": req["asset"]}, auth)
        payment = {"x402Version": 2, "resource": terms["resource"], "accepted": req,
                   "payload": {"signature": sig, "authorization": auth}}
        self._store.put(pid, {**row, "payment": payment, "payment_sent_at": at})  # persist BEFORE sending
        r = await self._req("POST", "/v1/evaluations", body,
                            {"payment-signature": base64.b64encode(canonical(payment).encode()).decode()})
        if r.status_code == 200:
            return self._accept(pid, s, r)
        if r.status_code == 202:
            return PurchaseOutcome(pid, "PENDING")
        if r.status_code == 402:
            raise StandingError("PAYMENT_NOT_ACCEPTED", "Server rejected the payment authorization", 402, r.text[:500])
        if r.status_code in (409, 503):
            raise StandingError("SETTLEMENT_REJECTED", f'Settlement not completed (HTTP {r.status_code}); '
                                f'use recover("{pid}") - it never re-charges', r.status_code, r.text[:500])
        raise self._fail(r, "evaluate (paid)")

    def _check_terms(self, terms: Dict[str, Any], pid: str, s: Dict[str, Any]) -> "tuple[Dict[str, Any], Dict[str, Any]]":
        p = self.policy

        def bad(m: str) -> StandingError:
            return StandingError("TERMS_REJECTED", m, detail=terms)

        accepts = terms.get("accepts")
        if terms.get("x402Version") != 2 or not isinstance(accepts, list) or len(accepts) != 1:
            raise bad("Expected x402 v2 with exactly one accepted payment option")
        req = accepts[0]
        if req.get("scheme") != "exact" or req.get("network") != p.network:
            raise bad(f"Network/scheme not allowed: {req.get('scheme')} {req.get('network')}")
        if not _ADDR.match(str(req.get("asset"))) or req["asset"].lower() != p.asset.lower():
            raise bad("Asset is not the allowed USDC contract")
        if not _ADDR.match(str(req.get("payTo"))) or req["payTo"].lower() != p.pay_to.lower():
            raise bad("pay-to address is not the allowed recipient")
        amt = str(req.get("amount"))
        if not re.fullmatch(r"[1-9][0-9]*", amt) or int(amt) > int(p.max_amount_per_purchase):
            raise bad(f"Amount {amt} exceeds the per-purchase limit {p.max_amount_per_purchase}")
        ex = req.get("extra") or {}
        if ex.get("assetTransferMethod") != "eip3009" or ex.get("paymentFlow") != "authorization" or \
                ex.get("name") != p.asset_name or ex.get("version") != p.asset_version:
            raise bad("EIP-712 token domain not allowed")
        t = req.get("maxTimeoutSeconds")
        if not isinstance(t, int) or t <= 0 or t > 300:
            raise bad("Timeout out of range")
        info = ((terms.get("extensions") or {}).get("whp-standing") or {}).get("info") or {}
        q = (info.get("quote") or {}).get("payload")
        if info.get("required") is not True or not q:
            raise bad("Missing WHP quote binding (required for payment)")
        if q.get("purchase_id") != pid or q.get("request_hash") != hash_canonical(s) or q.get("buyer_key") != s["buyer_key"]:
            raise bad("Quote does not match this submission")
        if canonical(q.get("payment_requirements")) != canonical(req):
            raise bad("Quote payment requirements differ from the offered terms")
        if canonical(q.get("resource")) != canonical(terms.get("resource")) or \
                (terms.get("resource") or {}).get("url") != self.origin + "/v1/evaluations":
            raise bad("Resource mismatch")
        return req, q

    def _accept(self, pid: str, s: Dict[str, Any], r: httpx.Response) -> PurchaseOutcome:
        j = self._json(r)
        p = (j or {}).get("payload") or {}
        if p.get("purchase_id") != pid or p.get("submission_hash") != hash_canonical(s):
            raise StandingError("RESULT_MISMATCH", "Result does not belong to this purchase or submission")
        return PurchaseOutcome(pid, "VERIFIED", r.text, j, r.headers.get("payment-response"))

    @staticmethod
    def _check_id(pid: str) -> None:
        if not _HEX64.match(pid or ""):
            raise StandingError("INVALID_INPUT", "purchase_id must be 64 lowercase hex characters")

    async def get_result(self, purchase_id: str) -> PurchaseOutcome:
        self._check_id(purchase_id)
        r = await self._req("GET", f"/v1/purchases/{purchase_id}/result")
        if r.status_code == 200:
            j = self._json(r)
            if ((j or {}).get("payload") or {}).get("purchase_id") != purchase_id:
                raise StandingError("RESULT_MISMATCH", "Result purchase_id differs from the request")
            return PurchaseOutcome(purchase_id, "VERIFIED", r.text, j, r.headers.get("payment-response"))
        if r.status_code == 202:
            return PurchaseOutcome(purchase_id, "PENDING")
        raise self._fail(r, "get_result")

    async def recover(self, purchase_id: str) -> PurchaseOutcome:
        """Idempotent: read the result; if pending ask the service to resume the ORIGINAL purchase. Never re-signs."""
        self._check_id(purchase_id)
        got = await self.get_result(purchase_id)
        if got.state == "VERIFIED":
            return got
        r = await self._req("POST", f"/v1/purchases/{purchase_id}/recover")
        if r.status_code == 200:
            j = self._json(r)
            if ((j or {}).get("payload") or {}).get("purchase_id") != purchase_id:
                raise StandingError("RESULT_MISMATCH", "Recovered result purchase_id differs")
            return PurchaseOutcome(purchase_id, "VERIFIED", r.text, j, r.headers.get("payment-response"))
        if r.status_code == 202:
            return PurchaseOutcome(purchase_id, "PENDING")
        raise self._fail(r, "recover")
