import test from "node:test";
import assert from "node:assert/strict";
import { formatPaymentHeader, StandingClient } from "../index.mjs";

test("formatPaymentHeader handles various input formats", () => {
  assert.equal(formatPaymentHeader(null), "");
  assert.equal(formatPaymentHeader(""), "");

  // Object input -> Base64 encoded JSON
  const obj = { x402Version: 2, scheme: "exact" };
  const b64 = formatPaymentHeader(obj);
  assert.equal(Buffer.from(b64, "base64").toString("utf8"), JSON.stringify(obj));

  // Stringified JSON -> Base64 encoded JSON
  const strJson = JSON.stringify(obj);
  const b64FromStr = formatPaymentHeader(strJson);
  assert.equal(b64FromStr, b64);

  // Already Base64 -> untouched
  assert.equal(formatPaymentHeader(b64), b64);
});

test("StandingClient evaluate performs single-roundtrip M2M execution with proactive payment", async () => {
  let callCount = 0;
  let receivedHeaders = null;

  const mockFetch = async (url, options) => {
    callCount++;
    receivedHeaders = options.headers;
    return {
      status: 200,
      json: async () => ({
        standing_mark: { id: "test-mark-1", score: 0.95 },
        status: "EVALUATED"
      })
    };
  };

  const client = new StandingClient({ endpoint: "https://mock.api" });
  
  // Test with direct paymentSignature
  const directSig = { x402Version: 2, payload: { auth: "0x123" } };
  const res = await client.evaluate(
    { subject: "test", claim: "test claim", provenance: "test prov" },
    { fetch: mockFetch, paymentSignature: directSig }
  );

  assert.equal(callCount, 1, "Should complete in exactly 1 call without 402 challenge");
  assert.ok(receivedHeaders["PAYMENT-SIGNATURE"], "Should include PAYMENT-SIGNATURE header");
  assert.equal(
    Buffer.from(receivedHeaders["PAYMENT-SIGNATURE"], "base64").toString("utf8"),
    JSON.stringify(directSig)
  );
  assert.equal(res.status, "EVALUATED");
});
