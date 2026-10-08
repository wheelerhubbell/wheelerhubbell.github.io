import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { StandingClient, BuyerKey, MemoryPurchaseStore, StandingError, canonical, hashCanonical, signTransferAuthorization, eip3009Digest, recoverSigner, addressOf, authorizationNonce, DEFAULT_POLICY } from "../src/index.js";

const vec = JSON.parse(readFileSync(new URL("./vector.json", import.meta.url), "utf8"));
const domain = { name: "USD Coin", version: "2", chainId: "8453", verifyingContract: DEFAULT_POLICY.asset };

test("EIP-3009 signature matches the independent eth-account vector byte for byte", () => {
  assert.equal(addressOf(vec.key).toLowerCase(), vec.address.toLowerCase());
  const sig = signTransferAuthorization(vec.key, domain, vec.msg);
  assert.equal(sig.toLowerCase(), vec.signature.toLowerCase());
  assert.equal(recoverSigner(eip3009Digest(domain, vec.msg), sig).toLowerCase(), vec.address.toLowerCase());
});
test("canonical JSON: sorted keys, safe integers only", () => {
  assert.equal(canonical({ b: 1, a: [true, null, "x"] }), '{"a":[true,null,"x"],"b":1}');
  assert.throws(() => canonical({ a: 1.5 }), StandingError);
  assert.throws(() => canonical({ a: "\ud800" }), StandingError);
});
test("client proof is a valid Ed25519 seal bound to method/path/body", async () => {
  const k = BuyerKey.generate();
  const env = JSON.parse(Buffer.from(k.clientProof("POST", "/v1/evaluations", "{}", 1000), "base64").toString());
  assert.equal(env.protected.type, "WHP-CLIENT-PROOF-v1");
  assert.equal(env.payload.body_hash, createHash("sha256").update("{}").digest("hex"));
  assert.equal(env.payload.expires_at - env.payload.issued_at, 120);
  const { ed25519 } = await import("@noble/curves/ed25519");
  const pub = Buffer.from(k.publicKeyDer, "base64").subarray(12);
  const ok = ed25519.verify(Buffer.from(env.signature, "base64"), Buffer.from(canonical({ protected: env.protected, payload: env.payload })), pub);
  assert.ok(ok);
});

// ---- mock service ----
const ORIGIN = "https://standing-guard-service.lovable.app";
const ROOT = "c".repeat(64);
const NOW = 1791430000;
const template = { profile: { id: "P", version: "2.0.0", sha256: "d".repeat(64) }, object: { id: "o", version: "1", root: "e".repeat(64) }, bounds: { jurisdiction: "j", scope: "s", valid_from: NOW - 10, valid_until: NOW + 1000 }, requested_operation: "INFORM" };
const REF = "ref_0123456789abcdef";

function mock(opts: { payTo?: string; amount?: string; pending?: boolean; rejectPay?: boolean } = {}) {
  const calls: { method: string; path: string; pay?: any }[] = [];
  let paid = 0;
  const f = (async (url: string, init: any) => {
    const u = new URL(url); const path = u.pathname; const method = init?.method ?? "GET";
    const body: string = init?.body ?? ""; const hdr = init?.headers ?? {};
    const pay = hdr["payment-signature"] ? JSON.parse(Buffer.from(hdr["payment-signature"], "base64").toString()) : undefined;
    calls.push({ method, path, pay });
    const j = (s: number, o: unknown, h: Record<string, string> = {}) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", ...h } });
    if (path === "/v1/contract") return j(200, { root_pin: ROOT });
    if (path === "/v1/evaluations") {
      const s = JSON.parse(body);
      const id = hashCanonical({ domain: "WHP-STANDING-PURCHASE-v1", root_pin: ROOT, buyer_key: s.buyer_key, client_reference: s.client_reference });
      const req = { scheme: "exact", network: "eip155:8453", amount: opts.amount ?? "1000000", asset: DEFAULT_POLICY.asset, payTo: opts.payTo ?? DEFAULT_POLICY.payTo, maxTimeoutSeconds: 300, extra: { assetTransferMethod: "eip3009", paymentFlow: "authorization", name: "USD Coin", version: "2" } };
      const resource = { url: ORIGIN + "/v1/evaluations", description: "d", mimeType: "application/json" };
      const quote = { payload: { purchase_id: id, request_hash: hashCanonical(s), buyer_key: s.buyer_key, payment_requirements: req, resource, expires_at: NOW + 300 } };
      if (!pay) return j(402, { x402Version: 2, error: "Payment required", resource, accepts: [req], extensions: { "whp-standing": { info: { required: true, quote } } } });
      if (opts.rejectPay) return j(402, { error: "bad authorization" });
      paid++;
      if (opts.pending) return j(202, { state: "SETTLING" });
      return j(200, { payload: { purchase_id: id, submission_hash: hashCanonical(s) } }, { "payment-response": "receipt" });
    }
    const m = path.match(/^\/v1\/purchases\/([0-9a-f]{64})\/(result|recover)$/);
    if (m) { return paid && !opts.pending ? j(200, { payload: { purchase_id: m[1] } }) : paid ? (m[2] === "recover" ? j(200, { payload: { purchase_id: m[1] } }) : j(202, { state: "SETTLING" })) : j(404, {}); }
    return j(404, {});
  }) as unknown as typeof fetch;
  return { f, calls, paid: () => paid };
}
const mk = (m: ReturnType<typeof mock>, extra = {}) => new StandingClient({ evmPrivateKey: vec.key, fetch: m.f, clock: () => NOW, ...extra });

test("evaluate: intercepts 402, signs a quote-bound EIP-3009 authorization, returns the result", async () => {
  const m = mock(); const c = mk(m);
  const out = await c.evaluate(REF, [], template);
  assert.equal(out.state, "VERIFIED"); assert.equal(out.paymentResponse, "receipt");
  const pay = m.calls.find((x) => x.pay)!.pay;
  const a = pay.payload.authorization;
  assert.equal(a.from.toLowerCase(), vec.address.toLowerCase());
  assert.equal(a.to, DEFAULT_POLICY.payTo); assert.equal(a.value, "1000000");
  const quote = (await (await m.f(ORIGIN + "/v1/evaluations", { method: "POST", body: canonical({ version: "WHP-STANDING-SUBMISSION-v1", client_reference: REF, buyer_key: c.buyerKey.publicKeyDer, profile: template.profile, object: template.object, bounds: template.bounds, requested_operation: "INFORM", nodes: [], transitions: [] }), headers: {} } as any)).json()).extensions["whp-standing"].info.quote;
  assert.equal(a.nonce, authorizationNonce(quote.payload));
  assert.equal(recoverSigner(eip3009Digest(domain, a), pay.payload.signature).toLowerCase(), vec.address.toLowerCase());
});
test("evaluate refuses wrong pay-to, over-cap amount, and an approvePayment veto - nothing is signed", async () => {
  for (const o of [{ payTo: "0x" + "9".repeat(40) }, { amount: "1000001" }]) {
    const m = mock(o);
    await assert.rejects(mk(m).evaluate(REF, [], template), (e: any) => e instanceof StandingError && e.code === "TERMS_REJECTED");
    assert.equal(m.calls.filter((x) => x.pay).length, 0);
  }
  const m = mock();
  await assert.rejects(mk(m, { approvePayment: () => false }).evaluate(REF, [], template), (e: any) => e.code === "TERMS_REJECTED");
  assert.equal(m.calls.filter((x) => x.pay).length, 0);
});
test("rejected payment surfaces PAYMENT_NOT_ACCEPTED; a 202 is PENDING and a second evaluate never re-signs", async () => {
  await assert.rejects(mk(mock({ rejectPay: true })).evaluate(REF, [], template), (e: any) => e.code === "PAYMENT_NOT_ACCEPTED");
  const m = mock({ pending: true }); const store = new MemoryPurchaseStore(); const c = mk(m, { store });
  const out = await c.evaluate(REF, [], template);
  assert.equal(out.state, "PENDING"); assert.equal(out.additionalCharge, false);
  const again = await c.evaluate(REF, [], template);   // routes through recover
  assert.equal(again.state, "VERIFIED");
  assert.equal(m.calls.filter((x) => x.pay).length, 1, "exactly one payment authorization ever sent");
  assert.equal(m.paid(), 1);
});
test("getContract and getResult / recover input checks", async () => {
  const m = mock(); const c = mk(m);
  assert.equal((await c.getContract() as any).root_pin, ROOT);
  await assert.rejects(c.getResult("nothex"), (e: any) => e.code === "INVALID_INPUT");
  await assert.rejects(c.recover("zz"), (e: any) => e.code === "INVALID_INPUT");
  assert.throws(() => new StandingClient({ evmPrivateKey: "0x12" }), StandingError);
});
