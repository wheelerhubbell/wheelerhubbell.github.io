import assert from "node:assert/strict";
import test from "node:test";
import { createVendingService } from "../src/app.mjs";
import { createArtifactVault } from "../src/artifacts.mjs";
import { canonical, encodeBase64Json, sha256 } from "../src/core.mjs";
import { paymentRequirements, PRODUCT_DEFINITIONS } from "../src/config.mjs";
import { MemoryPurchaseStore } from "../src/store.mjs";

const NOW = 1_800_000_000;
const PAY_TO = "0x1050eddd8282623b0c263ed6bdbd42370bbc28d3";
const PAYER = "0x3333333333333333333333333333333333333333";
const TX = "0x" + "44".repeat(32);
const ORIGIN = "https://vending.example";
const BYTES = Buffer.from("verified test artifact");

function fixtureProducts() {
  const products = Object.fromEntries(Object.entries(PRODUCT_DEFINITIONS).map(([id, product]) => [
    id,
    { ...product, requirements: paymentRequirements(PAY_TO, product.amount) },
  ]));
  products["claim-classifier"] = {
    ...products["claim-classifier"],
    size: BYTES.length,
    artifact_sha256: sha256(BYTES),
    filename: "fixture.zip",
  };
  return products;
}

class FakeRail {
  constructor() { this.verifyCalls = 0; this.settleCalls = 0; this.transaction = null; this.readinessCalls = 0; }
  async startBlock() { return 100; }
  async finalizedHead() { this.readinessCalls += 1; return { number: 100, hash: "0x" + "66".repeat(32), timestamp: NOW }; }
  async supported() { this.readinessCalls += 1; return { exact_base_mainnet: true, bazaar: true }; }
  async verify(payment) {
    this.verifyCalls += 1;
    return { isValid: true, payer: payment.payload.authorization.from };
  }
  async settle(payment) {
    this.settleCalls += 1;
    this.transaction = TX;
    return { success: true, transaction: TX, network: payment.accepted.network, payer: payment.payload.authorization.from };
  }
  async reconcile(row) {
    if (!row.transaction_hint && !this.transaction) return null;
    const a = row.payment_payload.payload.authorization;
    return {
      version: "WHP-X402-FINALIZED-SETTLEMENT-v1",
      network: row.requirements.network,
      asset: row.requirements.asset,
      amount: row.requirements.amount,
      payer: a.from.toLowerCase(),
      pay_to: a.to.toLowerCase(),
      nonce: a.nonce.toLowerCase(),
      transaction: TX,
      block_number: 99,
      block_hash: "0x" + "55".repeat(32),
      finality: "finalized",
      finalized_head: { number: "0x64", hash: "0x" + "66".repeat(32) },
      observed_at: NOW,
    };
  }
}

function setup() {
  const products = fixtureProducts();
  const store = new MemoryPurchaseStore();
  const rail = new FakeRail();
  const vault = {
    get(id) {
      assert.equal(id, "claim-classifier");
      return Buffer.from(BYTES);
    },
    getByHash(hash) {
      assert.equal(hash, sha256(BYTES));
      return Buffer.from(BYTES);
    },
    verifyAll() { return true; },
  };
  const service = createVendingService({ origin: ORIGIN, products, store, rail, vault, clock: () => NOW });
  return { service, products, store, rail };
}

function input(reference = "ab".repeat(32)) {
  return { client_reference: reference };
}

function paymentFor(challenge, nonce = "0x" + "22".repeat(32)) {
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
        nonce,
      },
    },
  };
}

async function post(service, product, body, payment = null) {
  const headers = { "content-type": "application/json" };
  if (payment) headers["payment-signature"] = encodeBase64Json(payment);
  return service.handle(new Request(ORIGIN + product.path, { method: "POST", headers, body: canonical(body) }));
}

test("catalog exposes all five autonomous micro-offers", async () => {
  const { service } = setup();
  const response = await service.handle(new Request(ORIGIN + "/catalog/v1/index.json"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.products.length, 5);
  assert.deepEqual(body.products.map((product) => product.price.amount), ["50000", "50001", "100000", "100001", "300000"]);
  assert.equal(body.autonomous_payment_supported, true);
  assert.equal(body.human_checkout, false);
});

test("HTTP challenge header decodes to the exact standard 402 body", async () => {
  const { service, products } = setup();
  const response = await post(service, products["claim-classifier"], input());
  assert.equal(response.status, 402);
  const body = await response.json();
  const header = JSON.parse(Buffer.from(response.headers.get("payment-required"), "base64").toString("utf8"));
  assert.deepEqual(header, body);
  assert.equal(body.x402Version, 2);
  assert.equal(body.accepts[0].network, "eip155:8453");
  assert.equal(body.accepts[0].amount, "50000");
});

test("one authorization settles once, delivers exact bytes, and recovers without charge", async () => {
  const { service, products, rail } = setup();
  const product = products["claim-classifier"];
  const first = await post(service, product, input());
  const challenge = await first.json();
  const paid = await post(service, product, input(), paymentFor(challenge));
  assert.equal(paid.status, 200);
  assert.deepEqual(Buffer.from(await paid.arrayBuffer()), BYTES);
  assert.equal(paid.headers.get("x-content-sha256"), sha256(BYTES));
  assert.equal(rail.verifyCalls, 1);
  assert.equal(rail.settleCalls, 1);
  const purchaseId = paid.headers.get("x-whp-purchase-id");
  const recovered = await service.handle(new Request(ORIGIN + "/v1/purchases/" + purchaseId + "/result", {
    headers: { "x-whp-recovery-secret": input().client_reference },
  }));
  assert.equal(recovered.status, 200);
  assert.deepEqual(Buffer.from(await recovered.arrayBuffer()), BYTES);
  assert.equal(rail.verifyCalls, 1);
  assert.equal(rail.settleCalls, 1);
});

test("published purchase ID alone cannot retrieve the paid artifact", async () => {
  const { service, products } = setup();
  const product = products["claim-classifier"];
  const reference = input("ef".repeat(32));
  const challenge = await (await post(service, product, reference)).json();
  const paid = await post(service, product, reference, paymentFor(challenge));
  assert.equal(paid.status, 200);
  const purchaseId = paid.headers.get("x-whp-purchase-id");
  const unauthenticated = await service.handle(new Request(ORIGIN + "/v1/purchases/" + purchaseId + "/result"));
  assert.equal(unauthenticated.status, 401);
  assert.equal((await unauthenticated.json()).error.code, "RECOVERY_AUTHENTICATION_REQUIRED");
  const wrong = await service.handle(new Request(ORIGIN + "/v1/purchases/" + purchaseId + "/result", {
    headers: { "x-whp-recovery-secret": "01".repeat(32) },
  }));
  assert.equal(wrong.status, 403);
  assert.equal((await wrong.json()).error.code, "RECOVERY_AUTHENTICATION_FAILED");
});

test("public-chain payment replay with another secret cannot obtain the artifact", async () => {
  const { service, products, rail } = setup();
  const product = products["claim-classifier"];
  const first = await post(service, product, input("aa".repeat(32)));
  const payment = paymentFor(await first.json());
  assert.equal((await post(service, product, input("aa".repeat(32)), payment)).status, 200);
  const other = input("bb".repeat(32));
  const blocked = await post(service, product, other, payment);
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).error.code, "PAYMENT_REPLAY");
  assert.equal(rail.settleCalls, 1);
});

test("one client reference cannot silently change products", async () => {
  const { service, products } = setup();
  const body = input("cc".repeat(32));
  const challenge = await (await post(service, products["claim-classifier"], body)).json();
  assert.equal((await post(service, products["claim-classifier"], body, paymentFor(challenge))).status, 200);
  const conflict = await post(service, products["return-the-burden"], body);
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error.code, "IDEMPOTENCY_CONFLICT");
});

test("MCP initializes, lists every product tool, and returns directly parseable x402 terms", async () => {
  const { service } = setup();
  const rpc = async (value) => service.handle(new Request(ORIGIN + "/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: canonical(value),
  }));
  const initialized = await (await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })).json();
  assert.equal(initialized.result.serverInfo.name, "whp-vending");
  const listed = await (await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })).json();
  assert.equal(listed.result.tools.filter((tool) => tool.name.startsWith("whp_vending_buy_")).length, 5);
  const called = await (await rpc({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "whp_vending_buy_claim_classifier", arguments: input("dd".repeat(32)) },
  })).json();
  assert.equal(called.result.isError, true);
  assert.equal(called.result.structuredContent.x402Version, 2);
  assert.equal(called.result.structuredContent.accepts[0].amount, "50000");
  assert.equal(JSON.parse(called.result.content[0].text).x402Version, 2);
});

test("unpaid HTTP and MCP discovery remains stateless", async () => {
  const { service, products, store } = setup();
  const url = ORIGIN + products["claim-classifier"].path;
  const discovery = await service.handle(new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
  assert.equal(discovery.status, 402);
  const advertised = await discovery.json();
  assert.equal(advertised.extensions["whp-vending"].info.discovery_only, true);
  assert.equal(advertised.extensions.bazaar.info.input.body.client_reference.length, 64);
  assert.deepEqual(JSON.parse(Buffer.from(discovery.headers.get("payment-required"), "base64").toString("utf8")), advertised);
  const invalidPaidDiscovery = await service.handle(new Request(url, { method: "POST", headers: { "content-type": "application/json", "payment-signature": "invalid" }, body: "{}" }));
  assert.equal(invalidPaidDiscovery.status, 400);
  assert.equal((await post(service, products["claim-classifier"], input("31".repeat(32)))).status, 402);
  assert.equal((await post(service, products["return-the-burden"], input("32".repeat(32)))).status, 402);
  const mcp = await service.handle(new Request(ORIGIN + "/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: canonical({ jsonrpc: "2.0", id: 9, method: "tools/call", params: {
      name: "whp_vending_buy_audit_the_move",
      arguments: input("33".repeat(32)),
    } }),
  }));
  assert.equal(mcp.status, 200);
  assert.equal((await mcp.json()).result.structuredContent.x402Version, 2);
  assert.deepEqual(await store.counts(), { total: 0, completed: 0 });
});

test("MCP and A2A failures use numeric JSON-RPC errors", async () => {
  const { service } = setup();
  for (const path of ["/mcp", "/a2a"]) {
    const response = await service.handle(new Request(ORIGIN + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }));
    assert.equal(response.status, 200);
    const rpc = await response.json();
    assert.equal(rpc.jsonrpc, "2.0");
    assert.equal(rpc.error.code, -32700);
  }
});

test("retained artifact revisions survive catalog replacement", async () => {
  const current = Buffer.from("current revision");
  const historical = Buffer.from("historical revision");
  const currentHash = sha256(current);
  const historicalHash = sha256(historical);
  const vault = createArtifactVault({
    one: { id: "one", size: current.length, artifact_sha256: currentHash },
  }, { one: current.toString("base64") });
  vault.verifyAll();
  const store = new MemoryPurchaseStore();
  await store.retainArtifacts([{ sha256: historicalHash, size: historical.length, filename: "old.zip", bytes_base64: historical.toString("base64") }]);
  for (const record of await store.listArtifacts()) vault.retain(record);
  assert.deepEqual(vault.getByHash(historicalHash), historical);
  assert.deepEqual(vault.getByHash(currentHash), current);
});

test("public readiness is cached and does not scan purchases", async () => {
  const { service, store, rail } = setup();
  store.counts = async () => { throw new Error("readiness must not scan purchases"); };
  const [first, second, third] = await Promise.all([
    service.handle(new Request(ORIGIN + "/readyz")),
    service.handle(new Request(ORIGIN + "/readyz")),
    service.handle(new Request(ORIGIN + "/readyz")),
  ]);
  assert.deepEqual([first.status, second.status, third.status], [200, 200, 200]);
  assert.equal(rail.readinessCalls, 2);
  const body = await first.json();
  assert.equal(body.ready, true);
  assert.equal(Object.hasOwn(body.checks, "purchases"), false);
});

test("A2A v0.3 advertises catalog discovery without claiming paid delivery", async () => {
  const { service } = setup();
  const card = await (await service.handle(new Request(ORIGIN + "/.well-known/agent-card.json"))).json();
  assert.equal(card.protocolVersion, "0.3.0");
  assert.equal(card.skills.length, 1);
  assert.deepEqual(card.defaultOutputModes, ["application/json"]);
  const sent = await service.handle(new Request(ORIGIN + "/a2a", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: canonical({ jsonrpc: "2.0", id: 11, method: "message/send", params: {
      message: { kind: "message", role: "user", messageId: "buyer-1", parts: [{ kind: "text", text: "catalog" }] },
    } }),
  }));
  assert.equal(sent.status, 200);
  assert.equal((await sent.json()).result.parts[1].data.products.length, 5);
  const missing = await service.handle(new Request(ORIGIN + "/a2a", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: canonical({ jsonrpc: "2.0", id: 12, method: "tasks/get", params: { id: "missing" } }),
  }));
  assert.equal((await missing.json()).error.code, -32001);
});

test("API catalog is an RFC linkset discovery document", async () => {
  const { service } = setup();
  const response = await service.handle(new Request(ORIGIN + "/.well-known/api-catalog"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/linkset+json");
  const body = await response.json();
  assert.equal(body.linkset[0].anchor, ORIGIN);
  assert.equal(body.linkset[0]["service-desc"].some((link) => link.href === ORIGIN + "/openapi.json"), true);
});
