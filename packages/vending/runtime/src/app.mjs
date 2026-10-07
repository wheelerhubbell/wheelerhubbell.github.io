import { randomBytes } from "node:crypto";
import {
  canonical,
  decodeBase64Json,
  demand,
  encodeBase64Json,
  exactKeys,
  Fault,
  jsonResponse,
  NO_STORE_HEADERS,
  parseJson,
  readRequestBody,
  sameJson,
  sha256,
} from "./core.mjs";
import { CATALOG_BUILD, CATALOG_VERSION } from "./config.mjs";
import { HEX32, validatePayment } from "./payment.mjs";

const INPUT_BODY_LIMIT = 2_048;
const MCP_BODY_LIMIT = 131_072;
const CLIENT_REFERENCE = /^[0-9a-fA-F]{64}$/u;
const PURCHASE_ID = /^[0-9a-f]{64}$/u;
const LEASE_SECONDS = 900;
const COMMON_HEADERS = Object.freeze({
  ...NO_STORE_HEADERS,
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, POST, OPTIONS",
  "access-control-allow-headers": "accept, content-type, payment-signature, mcp-protocol-version, x-whp-recovery-secret",
  "access-control-expose-headers": "payment-required, payment-response, retry-after, x-whp-purchase-id, x-content-sha256",
});

function resource(origin, product, transport = "http") {
  return {
    url: origin + (transport === "mcp" ? "/mcp" : product.path),
    description: product.description + " Exact restored ZIP artifact.",
    mimeType: transport === "mcp" ? "application/json" : "application/zip",
    serviceName: "WHP Vending",
    tags: ["decision-integrity", "digital-artifact", "autonomous-commerce", "x402", product.id],
  };
}

function offer(product, origin) {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    price: { amount: product.amount, display: product.display_price, currency: "USDC", network: product.requirements.network },
    purchase: { method: "POST", url: origin + product.path, body: { client_reference: "64 random hexadecimal characters" } },
    artifact: {
      filename: product.filename,
      media_type: "application/zip",
      bytes: product.size,
      sha256: product.artifact_sha256,
      version: product.version,
      build: product.build,
      restoration_notice: "Restored from surviving authoritative sources; not represented as byte-identical to unavailable v1.0.0.",
    },
    payment_requirements: product.requirements,
    rights: origin + "/v1/rights",
    recovery: { additional_charge: false, authentication: { header: "X-WHP-Recovery-Secret", value: "original client_reference" } },
  };
}

function rights(service) {
  return {
    schema_version: "whp.vending.rights.v1",
    publisher: "Wheeler Hubbell Publishing",
    applies_to: Object.values(service.products).map((product) => ({
      product_id: product.id,
      sku: product.sku,
      version: product.version,
      artifact_sha256: product.artifact_sha256,
    })),
    grant: {
      purchaser: "single purchaser",
      license: "nonexclusive, nontransferable",
      permitted_uses: ["internal use", "reference use"],
    },
    restrictions: [
      "no resale",
      "no sublicense",
      "no public redistribution",
      "no representation of institutional endorsement",
      "no expansion of the artifact's stated source authority",
    ],
    standing_boundary: "A Vending purchase does not issue a WHP Standing Mark, establish truth, replace professional advice, or guarantee an outcome.",
  };
}

function catalog(service) {
  return {
    schema_version: "whp.vending.catalog.v2",
    name: "WHP Vending",
    purpose: "Autonomous machine acquisition of exact digital instruments.",
    version: CATALOG_VERSION,
    build: CATALOG_BUILD,
    human_checkout: false,
    autonomous_payment_supported: true,
    protocol: "x402-v2",
    products: Object.values(service.products).map((product) => offer(product, service.origin)),
    interfaces: {
      openapi: service.origin + "/openapi.json",
      mcp: service.origin + "/mcp",
      agent_card: service.origin + "/.well-known/agent-card.json",
      x402: service.origin + "/.well-known/x402",
      rights: service.origin + "/v1/rights",
      readiness: service.origin + "/readyz",
    },
  };
}

function apiCatalog(service) {
  return {
    linkset: [{
      anchor: service.origin,
      "service-desc": [
        { href: service.origin + "/openapi.json", type: "application/vnd.oai.openapi+json" },
        { href: service.origin + "/.well-known/mcp/server.json", type: "application/json" },
        { href: service.origin + "/.well-known/agent-card.json", type: "application/json" },
      ],
    }],
  };
}

function bazaarFor(product, transport) {
  const body = { client_reference: "0000000000000000000000000000000000000000000000000000000000000000" };
  const inputSchema = {
    type: "object",
    properties: {
      client_reference: {
        type: "string",
        pattern: "^[0-9a-fA-F]{64}$",
        description: "Buyer-generated 256-bit secret used as the purchase/recovery capability.",
      },
    },
    required: ["client_reference"],
    additionalProperties: false,
  };
  const input = transport === "mcp"
    ? {
        type: "mcp",
        toolName: "whp_vending_buy_" + product.id.replaceAll("-", "_"),
        description: product.description + " Price: " + product.display_price + ".",
        transport: "streamable-http",
        inputSchema,
        example: body,
      }
    : { type: "http", method: "POST", bodyType: "json", body };
  const inputShape = transport === "mcp"
    ? {
        type: "object",
        properties: {
          type: { type: "string", const: "mcp" },
          toolName: { type: "string" },
          description: { type: "string" },
          transport: { type: "string", enum: ["streamable-http", "sse"] },
          inputSchema: { type: "object" },
          example: { type: "object" },
        },
        required: ["type", "toolName", "inputSchema"],
        additionalProperties: false,
      }
    : {
        type: "object",
        properties: {
          type: { type: "string", const: "http" },
          method: { type: "string", enum: ["POST", "PUT", "PATCH"] },
          bodyType: { type: "string", enum: ["json", "form-data", "text"] },
          body: { type: "object" },
          queryParams: { type: "object", additionalProperties: { type: "string" } },
          headers: { type: "object", additionalProperties: { type: "string" } },
        },
        required: ["type", "method", "bodyType", "body"],
        additionalProperties: false,
      };
  return {
    info: {
      input,
      output: {
        type: "binary",
        format: "application/zip",
        example: { filename: product.filename, bytes: product.size, sha256: product.artifact_sha256 },
      },
    },
    schema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        input: inputShape,
        output: {
          type: "object",
          properties: { type: { type: "string" }, format: { type: "string" }, example: {} },
          required: ["type"],
          additionalProperties: false,
        },
      },
      required: ["input"],
      additionalProperties: false,
    },
  };
}

function normalizeInput(value) {
  exactKeys(value, ["client_reference"]);
  demand(CLIENT_REFERENCE.test(value.client_reference), "CLIENT_REFERENCE_INVALID");
  return { client_reference: value.client_reference.toLowerCase() };
}

function purchaseId(clientReference) {
  return sha256(canonical({ domain: "WHP-VENDING-PURCHASE-v1", client_reference: clientReference }));
}

function challengeFor(service, row, error = "PAYMENT-SIGNATURE header is required") {
  const paymentRequired = {
    x402Version: 2,
    error,
    resource: row.quote.resource,
    accepts: [row.requirements],
    extensions: {
      "whp-vending": {
        info: {
          purchase_id: row.id,
          product_id: row.product,
          sku: row.quote.sku,
          display_price: row.quote.display_price,
          artifact_sha256: row.artifact_sha256,
          artifact_bytes: row.artifact_size,
          result_url: service.origin + "/v1/purchases/" + row.id + "/result",
          recover_url: service.origin + "/v1/purchases/" + row.id + "/recover",
          recovery_authentication: { header: "X-WHP-Recovery-Secret", value: "original client_reference" },
          additional_charge: false,
        },
        schema: { type: "object" },
      },
      bazaar: row.bazaar,
    },
  };
  return jsonResponse(402, paymentRequired, { ...COMMON_HEADERS, "payment-required": encodeBase64Json(paymentRequired) });
}

function discoveryChallenge(service, product) {
  const paymentRequired = {
    x402Version: 2,
    error: "Generate a fresh 64-hex client_reference and retry to obtain bound payment terms.",
    resource: resource(service.origin, product),
    accepts: [product.requirements],
    extensions: {
      bazaar: bazaarFor(product, "http"),
      "whp-vending": { info: { discovery_only: true, payment_authorized: false, product_id: product.id }, schema: { type: "object" } },
    },
  };
  return jsonResponse(402, paymentRequired, { ...COMMON_HEADERS, "payment-required": encodeBase64Json(paymentRequired) });
}

function pendingResponse(service, row, state = row.state) {
  return jsonResponse(202, {
    purchase_id: row.id,
    product_id: row.product,
    state,
    result_url: service.origin + "/v1/purchases/" + row.id + "/result",
    recover_url: service.origin + "/v1/purchases/" + row.id + "/recover",
    additional_charge: false,
    recovery_authentication: { header: "X-WHP-Recovery-Secret", value: "original client_reference" },
    instruction: "Retry recovery with this purchase ID and the original client_reference. Do not create or sign another payment while reconciliation is pending.",
  }, { ...COMMON_HEADERS, "retry-after": "15" });
}

function expiredResponse(service, row) {
  return jsonResponse(409, {
    error: { code: "PAYMENT_AUTHORIZATION_EXPIRED_UNSETTLED", retryable: false },
    purchase_id: row.id,
    product_id: row.product,
    state: "EXPIRED_UNSETTLED",
    original_authorization_settled: false,
    finalized_chain_evidence: row.expiration_evidence,
    safe_to_start_new_purchase: true,
    purchase_url: service.origin + row.quote.resource.url.slice(service.origin.length),
    instruction: "The original authorization was not settled before expiry. Start a new purchase with a new client_reference; never reuse the expired authorization.",
  }, COMMON_HEADERS);
}

function paymentResponse(evidence) {
  return { success: true, transaction: evidence.transaction, network: evidence.network, payer: evidence.payer };
}

function validateSettlementEvidence(row, proof) {
  const authorization = row.payment_payload?.payload?.authorization;
  demand(authorization && typeof authorization === "object", "SETTLEMENT_EVIDENCE_MISMATCH", 503);
  demand(proof && typeof proof === "object"
    && proof.version === "WHP-X402-FINALIZED-SETTLEMENT-v1"
    && proof.finality === "finalized"
    && proof.network === row.requirements.network
    && typeof proof.asset === "string"
    && proof.asset.toLowerCase() === row.requirements.asset.toLowerCase()
    && proof.amount === row.requirements.amount
    && typeof proof.payer === "string"
    && proof.payer.toLowerCase() === authorization.from.toLowerCase()
    && typeof proof.pay_to === "string"
    && proof.pay_to.toLowerCase() === row.requirements.payTo.toLowerCase()
    && proof.pay_to.toLowerCase() === authorization.to.toLowerCase()
    && typeof proof.nonce === "string"
    && proof.nonce.toLowerCase() === authorization.nonce.toLowerCase()
    && HEX32.test(proof.transaction ?? "")
    && Number.isSafeInteger(proof.block_number)
    && proof.block_number >= 0
    && HEX32.test(proof.block_hash ?? ""), "SETTLEMENT_EVIDENCE_MISMATCH", 503);
}

function artifactResponse(service, row) {
  demand(row.state === "COMPLETED" && row.result_sha256 === row.artifact_sha256, "RESULT_MISSING", 503);
  demand(row.settlement_evidence?.finality === "finalized", "FINALIZED_SETTLEMENT_REQUIRED", 503);
  const bytes = service.vault.getByHash(row.artifact_sha256);
  demand(bytes.length === row.artifact_size && sha256(bytes) === row.artifact_sha256 && row.result_sha256 === row.artifact_sha256, "RESULT_INTEGRITY_INVALID", 503);
  return new Response(bytes, {
    status: 200,
    headers: {
      ...COMMON_HEADERS,
      "content-type": "application/zip",
      "content-length": String(bytes.length),
      "content-disposition": 'attachment; filename="' + row.artifact_filename + '"',
      "x-content-sha256": row.artifact_sha256,
      "x-whp-purchase-id": row.id,
      etag: '"sha256-' + row.artifact_sha256 + '"',
      "payment-response": encodeBase64Json(paymentResponse(row.settlement_evidence)),
    },
  });
}

async function progress(service, initial) {
  if (initial.state === "COMPLETED") return artifactResponse(service, initial);
  if (initial.state === "EXPIRED_UNSETTLED") return expiredResponse(service, initial);
  const available = service.vault.getByHash(initial.artifact_sha256);
  demand(available.length === initial.artifact_size && sha256(available) === initial.artifact_sha256, "ARTIFACT_REVISION_UNAVAILABLE", 503);
  const owner = randomBytes(16).toString("hex");
  const leased = await service.store.lease(initial.id, owner, service.clock(), LEASE_SECONDS);
  if (!leased) return pendingResponse(service, initial, "IN_PROGRESS");
  try {
    let row = await service.store.get(initial.id);
    let now = service.clock();
    if (row.state === "PREPARED") row = await service.store.mutate(row.id, ["PREPARED"], { state: "SETTLING" }, now, owner);
    if (row.state === "SETTLING") {
      let proof = await service.rail.reconcile(row, now);
      if (proof?.expired_unsettled === true) {
        row = await service.store.mutate(row.id, ["SETTLING"], { state: "EXPIRED_UNSETTLED", expiration_evidence: proof }, service.clock(), owner);
        return expiredResponse(service, row);
      }
      if (proof?.candidate_transaction) {
        demand(HEX32.test(proof.candidate_transaction), "SETTLEMENT_EVIDENCE_MISMATCH", 503);
        row = await service.store.mutate(row.id, ["SETTLING"], { transaction_hint: proof.candidate_transaction.toLowerCase() }, service.clock(), owner);
        return pendingResponse(service, row, "RECONCILING_CANDIDATE_TRANSACTION");
      }
      if (proof?.scan_only) {
        row = await service.store.mutate(row.id, ["SETTLING"], { scan_from: proof.next_scan_from }, service.clock(), owner);
        proof = null;
      }
      const authorization = row.payment_payload.payload.authorization;
      if (!proof && now >= row.next_attempt_at && BigInt(now) < BigInt(authorization.validBefore)) {
        row = await service.store.mutate(row.id, ["SETTLING"], { attempts: row.attempts + 1, next_attempt_at: now + 30 }, now, owner);
        let settled = null;
        try { settled = await service.rail.settle(row.payment_payload, row.requirements, row.bazaar); } catch {}
        now = service.clock();
        if ((settled?.success === true || settled?.errorReason === "settlement_pending") && HEX32.test(settled.transaction ?? "")
          && settled.network === row.requirements.network
          && (!settled.payer || settled.payer.toLowerCase() === authorization.from.toLowerCase())) {
          row = await service.store.mutate(row.id, ["SETTLING"], { transaction_hint: settled.transaction.toLowerCase() }, now, owner);
        }
        proof = await service.rail.reconcile(row, now);
        if (proof?.expired_unsettled === true) {
          row = await service.store.mutate(row.id, ["SETTLING"], { state: "EXPIRED_UNSETTLED", expiration_evidence: proof }, service.clock(), owner);
          return expiredResponse(service, row);
        }
        if (proof?.candidate_transaction) {
          demand(HEX32.test(proof.candidate_transaction), "SETTLEMENT_EVIDENCE_MISMATCH", 503);
          row = await service.store.mutate(row.id, ["SETTLING"], { transaction_hint: proof.candidate_transaction.toLowerCase() }, service.clock(), owner);
          return pendingResponse(service, row, "RECONCILING_CANDIDATE_TRANSACTION");
        }
        if (proof?.scan_only) {
          row = await service.store.mutate(row.id, ["SETTLING"], { scan_from: proof.next_scan_from }, service.clock(), owner);
          proof = null;
        }
      }
      if (!proof) return pendingResponse(service, row, "RECONCILING_FINALIZED_SETTLEMENT");
      validateSettlementEvidence(row, proof);
      row = await service.store.mutate(row.id, ["SETTLING"], { state: "SETTLED", settlement_evidence: proof }, service.clock(), owner);
    }
    if (row.state === "SETTLED") {
      const bytes = service.vault.getByHash(row.artifact_sha256);
      demand(bytes.length === row.artifact_size && sha256(bytes) === row.artifact_sha256, "ARTIFACT_REVISION_UNAVAILABLE", 503);
      row = await service.store.mutate(row.id, ["SETTLED"], {
        state: "COMPLETED",
        result_sha256: row.artifact_sha256,
      }, service.clock(), owner);
    }
    return artifactResponse(service, row);
  } finally {
    await service.store.release(initial.id, owner, service.clock());
  }
}

async function productRoute(service, request, product, transport = "http") {
  demand(request.method === "POST", "METHOD_NOT_ALLOWED", 405);
  demand((request.headers.get("content-type") ?? "").split(";")[0].trim() === "application/json", "CONTENT_TYPE_REQUIRED", 415);
  const raw = await readRequestBody(request, INPUT_BODY_LIMIT);
  if (transport === "http" && (raw.trim() === "" || raw.trim() === "{}")) {
    demand(!request.headers.get("payment-signature"), "CLIENT_REFERENCE_REQUIRED", 400);
    return discoveryChallenge(service, product);
  }
  demand((raw.match(/"client_reference"\s*:/gu) ?? []).length === 1, "OBJECT_FIELDS_INVALID");
  const input = normalizeInput(parseJson(raw));
  const id = purchaseId(input.client_reference);
  const clientReferenceHash = sha256(input.client_reference);
  const requestHash = sha256({ product_id: product.id, client_reference: input.client_reference, transport });
  const existingBefore = await service.store.get(id);
  const candidate = {
    id,
    client_reference_hash: clientReferenceHash,
    product: product.id,
    product_version: product.version,
    catalog_build: product.build,
    artifact_sha256: product.artifact_sha256,
    artifact_size: product.size,
    artifact_filename: product.filename,
    request_hash: requestHash,
    request_json: { product_id: product.id, client_reference_sha256: clientReferenceHash, transport },
    quote: {
      version: "WHP-VENDING-QUOTE-v1",
      purchase_id: id,
      request_hash: requestHash,
      product: product.id,
      sku: product.sku,
      product_version: product.version,
      catalog_build: product.build,
      artifact_sha256: product.artifact_sha256,
      artifact_size: product.size,
      artifact_filename: product.filename,
      display_price: product.display_price,
      resource: resource(service.origin, product, transport),
      payment_requirements: product.requirements,
      charge_policy: "One exact artifact. Recovery and retrieval never authorize another charge.",
    },
    requirements: product.requirements,
    bazaar: bazaarFor(product, transport),
    created_at: service.clock(),
  };
  const paymentHeader = request.headers.get("payment-signature");
  if (!existingBefore && !paymentHeader) return challengeFor(service, { ...candidate, state: "QUOTED" });
  let row = existingBefore;
  if (!row) {
    let payment;
    let paymentKey;
    try {
      payment = decodeBase64Json(paymentHeader);
      paymentKey = validatePayment(payment, candidate.requirements, candidate.quote.resource, service.clock());
    } catch (error) {
      if (error instanceof Fault && error.status < 500) return challengeFor(service, { ...candidate, state: "QUOTED" }, error.code);
      throw error;
    }
    const available = service.vault.getByHash(candidate.artifact_sha256);
    demand(available.length === candidate.artifact_size && sha256(available) === candidate.artifact_sha256, "ARTIFACT_REVISION_UNAVAILABLE", 503);
    const paymentOwner = await service.store.paymentOwner(paymentKey);
    demand(!paymentOwner, "PAYMENT_REPLAY", 409);
    const observedBlock = await service.rail.startBlock();
    let verified;
    try {
      verified = await service.rail.verify(payment, candidate.requirements, candidate.bazaar);
    } catch (error) {
      if (error instanceof Fault && error.status === 402) return challengeFor(service, { ...candidate, state: "QUOTED" }, error.code);
      throw error;
    }
    row = await service.store.createQuote(candidate);
    demand(row && row.id === id && row.request_hash === requestHash && row.product === product.id
      && row.artifact_sha256 === product.artifact_sha256 && row.artifact_size === product.size, "IDEMPOTENCY_CONFLICT", 409);
    const bound = await service.store.bindPayment(id, requestHash, {
      payment_key: paymentKey,
      payment_payload: payment,
      facilitator_verification: { isValid: true, payer: verified.payer.toLowerCase() },
      observed_block: observedBlock,
    }, service.clock());
    demand(bound.payment_key === paymentKey, "PURCHASE_ALREADY_BOUND", 409);
    return progress(service, bound);
  }
  demand(row && row.id === id && row.request_hash === requestHash && row.product === product.id
    && row.artifact_sha256 === product.artifact_sha256 && row.artifact_size === product.size, "IDEMPOTENCY_CONFLICT", 409);
  if (row.state === "COMPLETED") return artifactResponse(service, row);
  if (row.state !== "QUOTED") {
    if (paymentHeader) {
      const payment = decodeBase64Json(paymentHeader);
      const key = validatePayment(payment, row.requirements, row.quote.resource, service.clock(), { allowExpired: true });
      demand(key === row.payment_key, "PURCHASE_ALREADY_BOUND", 409);
    }
    return progress(service, row);
  }
  if (!paymentHeader) return challengeFor(service, row);
  let payment;
  let paymentKey;
  try {
    payment = decodeBase64Json(paymentHeader);
    paymentKey = validatePayment(payment, row.requirements, row.quote.resource, service.clock());
  } catch (error) {
    if (error instanceof Fault && error.status < 500) return challengeFor(service, row, error.code);
    throw error;
  }
  const available = service.vault.getByHash(row.artifact_sha256);
  demand(available.length === row.artifact_size && sha256(available) === row.artifact_sha256, "ARTIFACT_REVISION_UNAVAILABLE", 503);
  const paymentOwner = await service.store.paymentOwner(paymentKey);
  demand(!paymentOwner || paymentOwner.id === id, "PAYMENT_REPLAY", 409);
  const observedBlock = await service.rail.startBlock();
  let verified;
  try {
    verified = await service.rail.verify(payment, row.requirements, row.bazaar);
  } catch (error) {
    if (error instanceof Fault && error.status === 402) return challengeFor(service, row, error.code);
    throw error;
  }
  const bound = await service.store.bindPayment(id, requestHash, {
    payment_key: paymentKey,
    payment_payload: payment,
    facilitator_verification: { isValid: true, payer: verified.payer.toLowerCase() },
    observed_block: observedBlock,
  }, service.clock());
  demand(bound.payment_key === paymentKey, "PURCHASE_ALREADY_BOUND", 409);
  return progress(service, bound);
}

async function purchaseRoute(service, request, pathname) {
  const authenticate = (row) => {
    const provided = request.headers.get("x-whp-recovery-secret") ?? "";
    demand(CLIENT_REFERENCE.test(provided), "RECOVERY_AUTHENTICATION_REQUIRED", 401);
    demand(sameJson(sha256(provided.toLowerCase()), row.client_reference_hash), "RECOVERY_AUTHENTICATION_FAILED", 403);
  };
  const result = pathname.match(/^\/v1\/purchases\/([0-9a-f]{64})\/result$/u);
  if (result && request.method === "GET") {
    const row = await service.store.get(result[1]);
    demand(row, "PURCHASE_NOT_FOUND", 404);
    authenticate(row);
    if (row.state === "COMPLETED") return artifactResponse(service, row);
    if (row.state === "EXPIRED_UNSETTLED") return expiredResponse(service, row);
    return pendingResponse(service, row);
  }
  const recover = pathname.match(/^\/v1\/purchases\/([0-9a-f]{64})\/recover$/u);
  if (recover && request.method === "POST") {
    demand((await readRequestBody(request, 1)) === "", "RECOVERY_BODY_MUST_BE_EMPTY");
    const row = await service.store.get(recover[1]);
    demand(row, "PURCHASE_NOT_FOUND", 404);
    authenticate(row);
    demand(row.state !== "QUOTED", "PAYMENT_NOT_AUTHORIZED", 409);
    return progress(service, row);
  }
  return null;
}

function agentCard(service) {
  return {
    name: "WHP Vending",
    description: "Discover autonomous x402 vending of exact WHP decision-integrity instruments; purchase through the advertised HTTP or MCP interfaces.",
    url: service.origin + "/a2a",
    version: "1.0.0",
    protocolVersion: "0.3.0",
    provider: { organization: "Wheeler Hubbell Publishing", url: service.origin },
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    skills: [{
      id: "whp-vending-catalog",
      name: "Discover WHP Vending",
      description: "Return the machine-readable catalog, exact prices and hashes, and the HTTP and MCP purchase interfaces.",
      tags: ["x402", "autonomous-commerce", "digital-artifact", "catalog"],
      examples: ["List the WHP Vending artifacts and machine purchase endpoints."],
      inputModes: ["application/json"],
      outputModes: ["application/json"],
    }],
  };
}

function a2aMessage(service, body) {
  demand(body && typeof body === "object" && !Array.isArray(body), "A2A_REQUEST_INVALID");
  demand(body.jsonrpc === "2.0" && Object.hasOwn(body, "id")
    && (typeof body.id === "string" || (typeof body.id === "number" && Number.isSafeInteger(body.id))), "A2A_REQUEST_INVALID");
  demand(typeof body.method === "string", "A2A_REQUEST_INVALID");
  if (body.method === "tasks/get" || body.method === "tasks/cancel") {
    demand(body.params && typeof body.params === "object" && !Array.isArray(body.params)
      && typeof body.params.id === "string" && body.params.id.length > 0, "A2A_REQUEST_INVALID");
    throw new Fault("A2A_TASK_NOT_FOUND", 404);
  }
  demand(body.method === "message/send", "A2A_METHOD_NOT_FOUND", 404);
  const message = body.params?.message;
  demand(message && typeof message === "object" && !Array.isArray(message)
    && message.kind === "message" && message.role === "user"
    && Array.isArray(message.parts) && message.parts.length > 0
    && message.parts.every((part) => part && typeof part === "object" && !Array.isArray(part)
      && ["text", "data", "file"].includes(part.kind)), "A2A_REQUEST_INVALID");
  return {
    jsonrpc: "2.0",
    id: body.id,
    result: {
      kind: "message",
      messageId: sha256({ domain: "WHP-VENDING-A2A-v1", request: body }).slice(0, 32),
      role: "agent",
      parts: [
        { kind: "text", text: "Five autonomous Base-USDC x402 artifacts are available at 0.05, 0.10, and 0.30 USDC." },
        { kind: "data", data: catalog(service) },
      ],
    },
  };
}

function openApi(service) {
  const paths = {
    "/catalog/v1/index.json": { get: { operationId: "getCatalog", summary: "Discover all autonomous offers", responses: { 200: { description: "Catalog" } } } },
    "/v1/rights": { get: { operationId: "getRights", summary: "Read purchase rights before payment", responses: { 200: { description: "Machine-readable license" } } } },
    "/mcp": { post: { operationId: "mcp", summary: "Streamable HTTP MCP endpoint", responses: { 200: { description: "MCP response" } } } },
    "/readyz": { get: { operationId: "ready", summary: "Check settlement dependencies and artifact integrity", responses: { 200: { description: "Ready" }, 503: { description: "Not ready" } } } },
  };
  for (const product of Object.values(service.products)) {
    paths[product.path] = {
      post: {
        operationId: "buy_" + product.id.replaceAll("-", "_"),
        summary: product.name + " — " + product.display_price,
        description: product.description,
        parameters: [{ name: "PAYMENT-SIGNATURE", in: "header", required: false, description: "Base64-encoded complete x402 v2 PaymentPayload returned after the initial 402 challenge.", schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PurchaseInput" } } } },
        responses: {
          200: { description: "Finalized, hash-verified ZIP", headers: { "PAYMENT-RESPONSE": { schema: { type: "string" } } }, content: { "application/zip": {} } },
          202: { description: "Settlement reconciliation pending" },
          402: { description: "Standard x402 v2 payment requirements", headers: { "PAYMENT-REQUIRED": { schema: { type: "string" } } } },
          409: { description: "Idempotency or payment replay conflict" },
        },
      },
    };
  }
  const purchasePath = { name: "purchase_id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-f]{64}$" } };
  const recoveryHeader = { name: "X-WHP-Recovery-Secret", in: "header", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{64}$" }, description: "The original client_reference. Never log or disclose it." };
  paths["/v1/purchases/{purchase_id}/result"] = { get: { operationId: "getPurchaseResult", summary: "Read status or retrieve a completed artifact without side effects", parameters: [purchasePath, recoveryHeader], responses: { 200: { description: "Exact ZIP", headers: { "PAYMENT-RESPONSE": { schema: { type: "string" } } } }, 202: { description: "Pending; GET never initiates settlement" }, 401: { description: "Recovery secret required" }, 404: { description: "Unknown purchase" } } } };
  paths["/v1/purchases/{purchase_id}/recover"] = { post: { operationId: "recoverPurchase", summary: "Explicitly reconcile the stored authorization without another charge", parameters: [purchasePath, recoveryHeader], responses: { 200: { description: "Exact ZIP", headers: { "PAYMENT-RESPONSE": { schema: { type: "string" } } } }, 202: { description: "Pending" }, 401: { description: "Recovery secret required" } } } };
  return {
    openapi: "3.1.0",
    info: { title: "WHP Vending Autonomous API", version: "1.0.0", description: "Machine-first x402 Base-USDC vending. No login, email, card, or human checkout." },
    servers: [{ url: service.origin }],
    paths,
    components: { schemas: { PurchaseInput: { type: "object", required: ["client_reference"], additionalProperties: false, properties: { client_reference: { type: "string", pattern: "^[0-9a-fA-F]{64}$" } } } } },
    "x-whp-commerce": { checkout_rail: "x402-v2", autonomous_payment_supported: true, buyer_interaction_required: false },
  };
}

function mcpTools(service) {
  const tools = [
    {
      name: "whp_vending_catalog",
      title: "WHP Vending catalog",
      description: "List every exact artifact, price, hash, and purchase endpoint without payment.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ];
  for (const product of Object.values(service.products)) {
    tools.push({
      name: "whp_vending_buy_" + product.id.replaceAll("-", "_"),
      title: "Buy " + product.name,
      description: product.description + " Price: " + product.display_price + " on Base in native USDC.",
      inputSchema: {
        type: "object",
        required: ["client_reference"],
        additionalProperties: false,
        properties: { client_reference: { type: "string", pattern: "^[0-9a-fA-F]{64}$", description: "Buyer-generated 256-bit secret." } },
      },
    });
  }
  tools.push(
    {
      name: "whp_vending_result",
      title: "Retrieve paid artifact",
      description: "Retrieve a completed artifact without another charge.",
      inputSchema: { type: "object", required: ["purchase_id", "client_reference"], additionalProperties: false, properties: { purchase_id: { type: "string", pattern: "^[0-9a-f]{64}$" }, client_reference: { type: "string", pattern: "^[0-9a-fA-F]{64}$" } } },
    },
    {
      name: "whp_vending_recover",
      title: "Recover paid artifact",
      description: "Reconcile the original stored authorization and return the artifact without another charge.",
      inputSchema: { type: "object", required: ["purchase_id", "client_reference"], additionalProperties: false, properties: { purchase_id: { type: "string", pattern: "^[0-9a-f]{64}$" }, client_reference: { type: "string", pattern: "^[0-9a-fA-F]{64}$" } } },
    },
  );
  return tools;
}

function mcpReply(id, result) { return jsonResponse(200, { jsonrpc: "2.0", id, result }, COMMON_HEADERS); }

function jsonRpcError(id, error) {
  const fault = error instanceof Fault ? error : new Fault("INTERNAL_ERROR", 503, { retryable: true });
  let code = -32603;
  if (fault.code === "MCP_INVALID_JSON" || fault.code === "A2A_INVALID_JSON") code = -32700;
  else if (fault.code === "MCP_METHOD_NOT_FOUND" || fault.code === "MCP_TOOL_NOT_FOUND" || fault.code === "A2A_METHOD_NOT_FOUND") code = -32601;
  else if (fault.code === "MCP_REQUEST_INVALID" || fault.code === "MCP_REQUEST_ID_REQUIRED" || fault.code === "A2A_REQUEST_INVALID") code = -32600;
  else if (fault.code === "A2A_TASK_NOT_FOUND") code = -32001;
  else if (fault.status < 500) code = -32602;
  return jsonResponse(200, {
    jsonrpc: "2.0",
    id,
    error: { code, message: fault.code, data: { code: fault.code, retryable: fault.retryable } },
  }, COMMON_HEADERS);
}

async function mcpArtifactResult(response) {
  if (response.status === 402) {
    const terms = await response.json();
    return { content: [{ type: "text", text: canonical(terms) }], structuredContent: terms, isError: true };
  }
  if (response.status === 202) {
    const pending = await response.json();
    return { content: [{ type: "text", text: canonical(pending) }], structuredContent: pending, isError: false };
  }
  if (!response.ok) {
    const error = await response.json();
    return { content: [{ type: "text", text: canonical(error) }], structuredContent: error, isError: true };
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const result = {
    purchase_id: response.headers.get("x-whp-purchase-id"),
    filename: (response.headers.get("content-disposition") ?? "").match(/filename="([^"]+)"/u)?.[1] ?? "artifact.zip",
    media_type: "application/zip",
    bytes: bytes.length,
    sha256: response.headers.get("x-content-sha256"),
    artifact_base64: bytes.toString("base64"),
  };
  const paymentHeader = response.headers.get("payment-response");
  return {
    content: [{ type: "text", text: "Paid artifact delivered as structuredContent.artifact_base64." }],
    structuredContent: result,
    isError: false,
    ...(paymentHeader ? { _meta: { "x402/payment-response": decodeBase64Json(paymentHeader) } } : {}),
  };
}

async function mcpRoute(service, request) {
  let requestId = null;
  try {
    demand(request.method === "POST", "METHOD_NOT_ALLOWED", 405);
    demand((request.headers.get("content-type") ?? "").split(";")[0].trim() === "application/json", "CONTENT_TYPE_REQUIRED", 415);
    const body = parseJson(await readRequestBody(request, MCP_BODY_LIMIT), "MCP_INVALID_JSON");
    if (Object.hasOwn(body, "id")) requestId = body.id;
    demand(body.jsonrpc === "2.0" && typeof body.method === "string", "MCP_REQUEST_INVALID");
    if (body.method === "notifications/initialized") return new Response(null, { status: 202, headers: COMMON_HEADERS });
    demand(Object.hasOwn(body, "id"), "MCP_REQUEST_ID_REQUIRED");
    if (body.method === "initialize") {
      return mcpReply(body.id, {
        protocolVersion: "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "whp-vending", title: "WHP Vending", version: "1.0.0" },
        instructions: "Discover five autonomous artifacts, negotiate x402 v2, pay native USDC on Base, and recover without another charge.",
      });
    }
    if (body.method === "tools/list") return mcpReply(body.id, { tools: mcpTools(service) });
    if (body.method !== "tools/call") throw new Fault("MCP_METHOD_NOT_FOUND", 404);
    const params = body.params;
    demand(params && typeof params === "object" && typeof params.name === "string", "MCP_TOOL_CALL_INVALID");
    const args = params.arguments ?? {};
    if (params.name === "whp_vending_catalog") {
      exactKeys(args, []);
      const value = catalog(service);
      return mcpReply(body.id, { content: [{ type: "text", text: canonical(value) }], structuredContent: value, isError: false });
    }
    const product = Object.values(service.products).find((candidate) => params.name === "whp_vending_buy_" + candidate.id.replaceAll("-", "_"));
    let response;
    if (product) {
      const headers = { "content-type": "application/json" };
      const payment = params._meta?.["x402/payment"];
      if (payment !== undefined) headers["payment-signature"] = encodeBase64Json(payment);
      response = await productRoute(service, new Request(service.origin + product.path, { method: "POST", headers, body: canonical(args) }), product, "mcp");
    } else if (params.name === "whp_vending_result" || params.name === "whp_vending_recover") {
      exactKeys(args, ["purchase_id", "client_reference"]);
      demand(PURCHASE_ID.test(args.purchase_id), "PURCHASE_ID_INVALID");
      demand(CLIENT_REFERENCE.test(args.client_reference), "CLIENT_REFERENCE_INVALID");
      const suffix = params.name === "whp_vending_result" ? "/result" : "/recover";
      response = await purchaseRoute(service, new Request(service.origin + "/v1/purchases/" + args.purchase_id + suffix, { method: suffix === "/result" ? "GET" : "POST", headers: { "x-whp-recovery-secret": args.client_reference } }), "/v1/purchases/" + args.purchase_id + suffix);
    } else throw new Fault("MCP_TOOL_NOT_FOUND", 404);
    return mcpReply(body.id, await mcpArtifactResult(response));
  } catch (error) {
    return jsonRpcError(requestId, error);
  }
}

function llms(service) {
  const lines = [
    "# WHP Vending",
    "",
    "Autonomous machine commerce only. Five exact ZIP artifacts are sold through standard x402 v2 on Base mainnet in native USDC.",
    "",
    "- Catalog: " + service.origin + "/catalog/v1/index.json",
    "- OpenAPI: " + service.origin + "/openapi.json",
    "- Rights: " + service.origin + "/v1/rights",
    "- MCP: " + service.origin + "/mcp",
    "- Agent card: " + service.origin + "/.well-known/agent-card.json",
    "- x402 discovery: " + service.origin + "/.well-known/x402",
    "",
    "Each purchase begins with a 64-hex buyer-generated secret client_reference. Preserve it and the returned purchase_id. Never sign a second authorization for recovery.",
    "",
    ...Object.values(service.products).map((product) => "- " + product.name + ": " + product.display_price + " — POST " + product.path),
    "",
  ];
  return lines.join("\n");
}

function mcpServerDocument(service) {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    name: "io.github.wheelerhubbell/whp-vending",
    title: "WHP Vending",
    version: "1.0.0",
    description: "Autonomous x402 vending of exact WHP digital instruments.",
    websiteUrl: service.origin,
    repository: { url: "https://github.com/wheelerhubbell/WHP-Vending", source: "github" },
    remotes: [{ type: "streamable-http", url: service.origin + "/mcp" }],
  };
}

export function createVendingService({ origin, products, store, rail, vault, clock = () => Math.floor(Date.now() / 1000) }) {
  const service = { origin, products, store, rail, vault, clock };
  const readinessCache = { value: null, expiresAt: 0, inflight: null };
  const readiness = async () => {
    const now = Date.now();
    if (readinessCache.value && readinessCache.expiresAt > now) return readinessCache.value;
    if (readinessCache.inflight) return readinessCache.inflight;
    readinessCache.inflight = (async () => {
      let checks;
      let ready = false;
      try {
        const [database, block, finalized, facilitator] = await Promise.all([
          store.ping(), rail.startBlock(), rail.finalizedHead(), rail.supported(),
        ]);
        const artifacts = vault.verifyAll();
        checks = {
          database,
          base_rpc: Number.isSafeInteger(block),
          finalized_rpc: Number.isSafeInteger(finalized.number) && typeof finalized.hash === "string",
          artifacts,
          facilitator,
          product_count: Object.keys(products).length,
        };
        ready = Object.values({
          database,
          base_rpc: checks.base_rpc,
          finalized_rpc: checks.finalized_rpc,
          artifacts,
          exact_base_mainnet: facilitator.exact_base_mainnet,
          bazaar: facilitator.bazaar,
        }).every(Boolean) && checks.product_count === 5;
      } catch (error) {
        checks = { error: error instanceof Fault ? error.code : "DEPENDENCY_UNAVAILABLE" };
      }
      return {
        status: ready ? 200 : 503,
        body: {
          ready,
          checks,
          network: "eip155:8453",
          asset: Object.values(products)[0].requirements.asset,
          pay_to: Object.values(products)[0].requirements.payTo,
        },
      };
    })();
    try {
      readinessCache.value = await readinessCache.inflight;
      readinessCache.expiresAt = Date.now() + (readinessCache.value.status === 200 ? 15_000 : 5_000);
      return readinessCache.value;
    } finally {
      readinessCache.inflight = null;
    }
  };
  return {
    ...service,
    async handle(request) {
      try {
        const url = new URL(request.url);
        demand(url.origin === origin, "ORIGIN_MISMATCH", 400);
        const path = url.pathname.replace(/\/+$/u, "") || "/";
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: COMMON_HEADERS });
        if (request.method === "POST" && path === "/mcp") return await mcpRoute(service, request);
        if (request.method === "POST" && path === "/a2a") {
          let requestId = null;
          try {
            demand((request.headers.get("content-type") ?? "").split(";")[0].trim() === "application/json", "CONTENT_TYPE_REQUIRED", 415);
            const body = parseJson(await readRequestBody(request, 65_536), "A2A_INVALID_JSON");
            if (body && typeof body === "object" && !Array.isArray(body) && Object.hasOwn(body, "id")) requestId = body.id;
            return jsonResponse(200, a2aMessage(service, body), COMMON_HEADERS);
          } catch (error) {
            return jsonRpcError(requestId, error);
          }
        }
        for (const product of Object.values(products)) {
          if (path === product.path) return await productRoute(service, request, product);
        }
        const purchase = await purchaseRoute(service, request, path);
        if (purchase) return purchase;
        demand(["GET", "HEAD"].includes(request.method), "METHOD_NOT_ALLOWED", 405);
        let response;
        if (path === "/" || path === "/catalog.json" || path === "/catalog/v1/index.json" || path === "/.well-known/whp-vending.json") response = jsonResponse(200, catalog(service), COMMON_HEADERS);
        else if (path === "/.well-known/api-catalog") response = jsonResponse(200, apiCatalog(service), { ...COMMON_HEADERS, "content-type": "application/linkset+json" });
        else if (path === "/openapi.json" || path === "/v1/openapi.json" || path === "/.well-known/openapi.json") response = jsonResponse(200, openApi(service), COMMON_HEADERS);
        else if (path === "/v1/rights") response = jsonResponse(200, rights(service), COMMON_HEADERS);
        else if (path === "/.well-known/agent-card.json") response = jsonResponse(200, agentCard(service), COMMON_HEADERS);
        else if (path === "/.well-known/x402") response = jsonResponse(200, { x402Version: 2, resources: Object.values(products).map((product) => ({ resource: resource(origin, product), accepts: [product.requirements], extensions: { bazaar: bazaarFor(product, "http") } })) }, COMMON_HEADERS);
        else if (path === "/server.json" || path === "/.well-known/mcp/server.json") response = jsonResponse(200, mcpServerDocument(service), COMMON_HEADERS);
        else if (path === "/llms.txt") response = new Response(llms(service), { status: 200, headers: { ...COMMON_HEADERS, "content-type": "text/plain; charset=utf-8" } });
        else if (path === "/healthz") response = jsonResponse(200, { status: "ok", service: "whp-vending", liveness: true }, COMMON_HEADERS);
        else if (path === "/readyz") {
          const snapshot = await readiness();
          response = jsonResponse(snapshot.status, snapshot.body, COMMON_HEADERS);
        } else if (path === "/robots.txt") response = new Response("User-agent: *\nAllow: /\nSitemap: " + origin + "/sitemap.xml\n", { headers: { ...COMMON_HEADERS, "content-type": "text/plain; charset=utf-8" } });
        else if (path === "/sitemap.xml") {
          const paths = ["/", "/catalog/v1/index.json", "/v1/rights", "/openapi.json", "/.well-known/x402", "/.well-known/agent-card.json", "/.well-known/mcp/server.json", "/llms.txt"];
          response = new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + paths.map((item) => "<url><loc>" + origin + item + "</loc></url>").join("") + "</urlset>", { headers: { ...COMMON_HEADERS, "content-type": "application/xml; charset=utf-8" } });
        } else throw new Fault("NOT_FOUND", 404);
        if (request.method === "HEAD") return new Response(null, { status: response.status, headers: response.headers });
        return response;
      } catch (error) {
        const fault = error instanceof Fault ? error : new Fault("INTERNAL_ERROR", 503, { retryable: true });
        return jsonResponse(fault.status, { error: { code: fault.code, retryable: fault.retryable } }, COMMON_HEADERS);
      }
    },
  };
}
