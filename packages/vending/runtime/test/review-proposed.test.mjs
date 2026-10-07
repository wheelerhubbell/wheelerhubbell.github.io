import assert from "node:assert/strict";
import test from "node:test";
import { createVendingService } from "../src/app.mjs";
import { canonical, encodeBase64Json, sha256 } from "../src/core.mjs";
import { paymentRequirements, PRODUCT_DEFINITIONS } from "../src/config.mjs";
import { PaymentRail } from "../src/payment.mjs";
import { MemoryPurchaseStore } from "../src/store.mjs";

const NOW = 1_800_000_000;
const ORIGIN = "https://vending.example";
const PAY_TO = "0x1050eddd8282623b0c263ed6bdbd42370bbc28d3";
const PAYER = "0x3333333333333333333333333333333333333333";

function fixture() {
  const bytesByProduct = Object.fromEntries(Object.keys(PRODUCT_DEFINITIONS).map((id, index) => [
    id,
    Buffer.from(`exact artifact ${index}: ${id}\n`, "utf8"),
  ]));
  const products = Object.fromEntries(Object.entries(PRODUCT_DEFINITIONS).map(([id, product]) => [
    id,
    {
      ...product,
      size: bytesByProduct[id].length,
      artifact_sha256: sha256(bytesByProduct[id]),
      requirements: paymentRequirements(PAY_TO, product.amount),
    },
  ]));
  const vault = {
    get(id) { return Buffer.from(bytesByProduct[id]); },
    getByHash(hash) {
      const product = Object.values(products).find((candidate) => candidate.artifact_sha256 === hash);
      assert(product);
      return Buffer.from(bytesByProduct[product.id]);
    },
    verifyAll() { return true; },
  };
  return { products, bytesByProduct, vault };
}

function finalEvidence(row, transaction) {
  const authorization = row.payment_payload.payload.authorization;
  return {
    version: "WHP-X402-FINALIZED-SETTLEMENT-v1",
    network: row.requirements.network,
    asset: row.requirements.asset,
    amount: row.requirements.amount,
    payer: authorization.from.toLowerCase(),
    pay_to: authorization.to.toLowerCase(),
    nonce: authorization.nonce.toLowerCase(),
    transaction,
    block_number: 99,
    block_hash: "0x" + "55".repeat(32),
    finality: "finalized",
    finalized_head: { number: "0x64", hash: "0x" + "66".repeat(32) },
    observed_at: NOW,
  };
}

class DeterministicRail {
  constructor({ verifyDelay = 0, settleDelay = 0 } = {}) {
    this.verifyCalls = 0;
    this.settleCalls = 0;
    this.verifyDelay = verifyDelay;
    this.settleDelay = settleDelay;
    this.transactions = new Map();
  }
  async startBlock() { return 100; }
  async verify(payment) {
    this.verifyCalls += 1;
    if (this.verifyDelay) await new Promise((resolve) => setTimeout(resolve, this.verifyDelay));
    return { isValid: true, payer: payment.payload.authorization.from };
  }
  async settle(payment) {
    this.settleCalls += 1;
    if (this.settleDelay) await new Promise((resolve) => setTimeout(resolve, this.settleDelay));
    const nonce = payment.payload.authorization.nonce.toLowerCase();
    const transaction = "0x" + sha256(nonce);
    this.transactions.set(nonce, transaction);
    return { success: true, transaction, network: payment.accepted.network, payer: payment.payload.authorization.from };
  }
  async reconcile(row) {
    const nonce = row.payment_payload.payload.authorization.nonce.toLowerCase();
    const transaction = row.transaction_hint ?? this.transactions.get(nonce);
    return transaction ? finalEvidence(row, transaction) : null;
  }
}

function setup(rail = new DeterministicRail()) {
  const { products, bytesByProduct, vault } = fixture();
  const store = new MemoryPurchaseStore();
  const service = createVendingService({ origin: ORIGIN, products, store, rail, vault, clock: () => NOW });
  return { service, products, bytesByProduct, store, rail };
}

function input(byte = "ab") { return { client_reference: byte.repeat(32) }; }

function paymentFor(challenge, nonceByte = "22") {
  const accepted = challenge.accepts[0];
  return {
    x402Version: 2,
    resource: challenge.resource,
    accepted,
    payload: {
      signature: "0x" + "11".repeat(64) + "1b",
      authorization: {
        from: PAYER,
        to: accepted.payTo,
        value: accepted.amount,
        validAfter: String(NOW - 1),
        validBefore: String(NOW + 240),
        nonce: "0x" + nonceByte.repeat(32),
      },
    },
  };
}

async function post(service, product, body, payment = null) {
  const headers = { "content-type": "application/json" };
  if (payment) headers["payment-signature"] = encodeBase64Json(payment);
  return service.handle(new Request(ORIGIN + product.path, { method: "POST", headers, body: canonical(body) }));
}

async function challenge(service, product, body) {
  const response = await post(service, product, body);
  assert.equal(response.status, 402);
  return response.json();
}

test("payment validation reissues standard 402 terms for altered or stale payment before provider calls", async (t) => {
  const { service, products, rail } = setup();
  const product = products["claim-classifier"];
  const body = input("a1");
  const terms = await challenge(service, product, body);
  const valid = paymentFor(terms);
  const cases = [
    ["accepted amount", "PAYMENT_TERMS_MISMATCH", (value) => { value.accepted.amount = "50001"; }],
    ["resource URL", "PAYMENT_RESOURCE_MISMATCH", (value) => { value.resource.url += "/wrong"; }],
    ["recipient", "PAYMENT_VALUE_OR_RECIPIENT_MISMATCH", (value) => { value.payload.authorization.to = "0x4444444444444444444444444444444444444444"; }],
    ["value", "PAYMENT_VALUE_OR_RECIPIENT_MISMATCH", (value) => { value.payload.authorization.value = "1"; }],
    ["expired window", "PAYMENT_EXPIRED", (value) => { value.payload.authorization.validBefore = String(NOW); }],
    ["future window", "PAYMENT_NOT_YET_VALID", (value) => { value.payload.authorization.validAfter = String(NOW + 1); }],
    ["oversized window", "PAYMENT_WINDOW_EXCEEDS_TERMS", (value) => { value.payload.authorization.validBefore = String(NOW + 331); }],
    ["nonce", "PAYMENT_NONCE_INVALID", (value) => { value.payload.authorization.nonce = "0x12"; }],
  ];
  for (const [name, code, mutate] of cases) {
    await t.test(name, async () => {
      const value = structuredClone(valid);
      mutate(value);
      const response = await post(service, product, body, value);
      assert.equal(response.status, 402);
      const refreshed = await response.json();
      assert.equal(refreshed.error, code);
      assert.deepEqual(JSON.parse(Buffer.from(response.headers.get("payment-required"), "base64").toString("utf8")), refreshed);
    });
  }
  assert.equal(rail.verifyCalls, 0);
  assert.equal(rail.settleCalls, 0);
});

test("concurrent identical paid retries can verify twice but settle at most once", async () => {
  const rail = new DeterministicRail({ verifyDelay: 5, settleDelay: 20 });
  const { service, products, bytesByProduct } = setup(rail);
  const product = products["claim-classifier"];
  const body = input("b2");
  const payment = paymentFor(await challenge(service, product, body), "23");
  const responses = await Promise.all([
    post(service, product, body, payment),
    post(service, product, body, payment),
  ]);
  assert.ok(responses.some((response) => response.status === 200));
  assert.ok(responses.every((response) => response.status === 200 || response.status === 202));
  assert.equal(rail.settleCalls, 1);
  const completed = responses.find((response) => response.status === 200);
  assert.deepEqual(Buffer.from(await completed.arrayBuffer()), bytesByProduct[product.id]);
});

test("lost facilitator response recovers a finalized payment without a second settlement", async () => {
  class LostResponseRail extends DeterministicRail {
    constructor() { super(); this.broadcast = false; this.finalized = false; }
    async settle() {
      this.settleCalls += 1;
      this.broadcast = true;
      throw new Error("response lost after broadcast");
    }
    async reconcile(row) {
      return this.broadcast && this.finalized
        ? finalEvidence(row, "0x" + "77".repeat(32))
        : null;
    }
  }
  const rail = new LostResponseRail();
  const { service, products, bytesByProduct } = setup(rail);
  const product = products["claim-classifier"];
  const body = input("c3");
  const payment = paymentFor(await challenge(service, product, body), "24");
  const uncertain = await post(service, product, body, payment);
  assert.equal(uncertain.status, 202);
  assert.equal(rail.settleCalls, 1);
  const pending = await uncertain.json();
  rail.finalized = true;
  const recovered = await service.handle(new Request(pending.recover_url, {
    method: "POST",
    headers: { "x-whp-recovery-secret": body.client_reference },
  }));
  assert.equal(recovered.status, 200);
  assert.deepEqual(Buffer.from(await recovered.arrayBuffer()), bytesByProduct[product.id]);
  assert.equal(rail.settleCalls, 1);
});

test("malicious finalized proof cannot cross the issuance gate", async (t) => {
  const cases = [
    ["payer", (proof) => { proof.payer = "0x4444444444444444444444444444444444444444"; }],
    ["nonce", (proof) => { proof.nonce = "0x" + "99".repeat(32); }],
    ["transaction", (proof) => { proof.transaction = "0x12"; }],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, async () => {
      class MaliciousProofRail extends DeterministicRail {
        async reconcile(row) {
          const proof = finalEvidence(row, "0x" + "78".repeat(32));
          mutate(proof);
          return proof;
        }
      }
      const rail = new MaliciousProofRail();
      const { service, products, store } = setup(rail);
      const product = products["claim-classifier"];
      const body = input(name === "payer" ? "e1" : name === "nonce" ? "e2" : "e3");
      const terms = await challenge(service, product, body);
      const response = await post(service, product, body, paymentFor(terms, name === "payer" ? "31" : name === "nonce" ? "32" : "33"));
      assert.equal(response.status, 503);
      assert.equal((await response.json()).error.code, "SETTLEMENT_EVIDENCE_MISMATCH");
      const purchaseId = terms.extensions["whp-vending"].info.purchase_id;
      const row = await store.get(purchaseId);
      assert.equal(row.state, "SETTLING");
      assert.equal(row.settlement_evidence, null);
      assert.equal(row.result_sha256, null);
    });
  }
});

test("matching finalized nonce-use log becomes a sticky candidate without advancing the scan cursor", async () => {
  const transaction = "0x" + "79".repeat(32);
  const rail = new PaymentRail({ facilitatorUrl: "https://facilitator.example", rpcUrl: "https://rpc.example" });
  rail.rpc = async (method) => {
    if (method === "eth_getBlockByNumber") return { number: "0x78", hash: "0x" + "66".repeat(32), timestamp: "0x6b49d200" };
    if (method === "eth_getLogs") return [{ transactionHash: transaction }];
    throw new Error("unexpected RPC method: " + method);
  };
  rail.evidence = async () => null;
  const requirements = paymentRequirements(PAY_TO, "50000");
  const row = {
    observed_block: 100,
    scan_from: 100,
    transaction_hint: null,
    payment_payload: {
      accepted: requirements,
      payload: { authorization: { from: PAYER, nonce: "0x" + "41".repeat(32), validBefore: String(NOW + 240) } },
    },
  };
  const result = await rail.reconcile(row, NOW);
  assert.deepEqual(result, { candidate_transaction: transaction });
  assert.equal(Object.hasOwn(result, "next_scan_from"), false);
});

test("candidate transaction is persisted and retried before artifact issuance", async () => {
  const transaction = "0x" + "7a".repeat(32);
  class CandidateRail extends DeterministicRail {
    constructor() { super(); this.evidenceReady = false; }
    async reconcile(row) {
      return this.evidenceReady ? finalEvidence(row, transaction) : { candidate_transaction: transaction };
    }
  }
  const rail = new CandidateRail();
  const { service, products, store, bytesByProduct } = setup(rail);
  const product = products["claim-classifier"];
  const body = input("e4");
  const terms = await challenge(service, product, body);
  const pending = await post(service, product, body, paymentFor(terms, "34"));
  assert.equal(pending.status, 202);
  assert.equal((await pending.json()).state, "RECONCILING_CANDIDATE_TRANSACTION");
  const purchaseId = terms.extensions["whp-vending"].info.purchase_id;
  const bound = await store.get(purchaseId);
  assert.equal(bound.transaction_hint, transaction);
  assert.equal(bound.scan_from, 100);
  assert.equal(bound.result_sha256, null);
  assert.equal(rail.settleCalls, 0);

  rail.evidenceReady = true;
  const recovered = await service.handle(new Request(ORIGIN + "/v1/purchases/" + purchaseId + "/recover", {
    method: "POST",
    headers: { "x-whp-recovery-secret": body.client_reference },
  }));
  assert.equal(recovered.status, 200);
  assert.deepEqual(Buffer.from(await recovered.arrayBuffer()), bytesByProduct[product.id]);
  assert.equal(rail.settleCalls, 0);
});

test("MCP completes the paid flow and returns exact bytes plus parseable payment evidence", async () => {
  const { service, bytesByProduct, rail } = setup();
  const call = async (id, params) => service.handle(new Request(ORIGIN + "/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: canonical({ jsonrpc: "2.0", id, method: "tools/call", params }),
  }));
  const args = input("d4");
  const unpaid = await (await call(1, { name: "whp_vending_buy_claim_classifier", arguments: args })).json();
  assert.equal(unpaid.result.isError, true);
  const payment = paymentFor(unpaid.result.structuredContent, "25");
  const paid = await (await call(2, {
    name: "whp_vending_buy_claim_classifier",
    arguments: args,
    _meta: { "x402/payment": payment },
  })).json();
  assert.equal(paid.result.isError, false);
  const bytes = Buffer.from(paid.result.structuredContent.artifact_base64, "base64");
  assert.deepEqual(bytes, bytesByProduct["claim-classifier"]);
  assert.equal(paid.result.structuredContent.sha256, sha256(bytes));
  assert.equal(paid.result._meta["x402/payment-response"].success, true);
  assert.match(paid.result._meta["x402/payment-response"].transaction, /^0x[0-9a-f]{64}$/u);
  assert.equal(rail.settleCalls, 1);
});

test("every advertised product delivers its own exact bytes and matching digest", async () => {
  const { service, products, bytesByProduct, rail } = setup();
  let index = 1;
  for (const product of Object.values(products)) {
    const hexByte = index.toString(16).padStart(2, "0");
    const body = input((index + 16).toString(16).padStart(2, "0"));
    const payment = paymentFor(await challenge(service, product, body), hexByte);
    const response = await post(service, product, body, payment);
    assert.equal(response.status, 200, product.id);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(bytes, bytesByProduct[product.id], product.id);
    assert.equal(response.headers.get("content-length"), String(bytes.length), product.id);
    assert.equal(response.headers.get("x-content-sha256"), sha256(bytes), product.id);
    assert.equal(response.headers.get("content-disposition"), `attachment; filename="${product.filename}"`, product.id);
    index += 1;
  }
  assert.equal(rail.settleCalls, Object.keys(products).length);
});
