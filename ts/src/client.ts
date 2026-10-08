import { canonical, hashCanonical, type Json } from "./canonical.js";
import { BuyerKey, addressOf, signTransferAuthorization, type TransferAuthorization } from "./crypto.js";
import { StandingError } from "./errors.js";
import type { PaymentPolicy, PaymentRequired, PaymentRequirements, PurchaseOutcome, Submission, SubmissionTemplate, SignedNode } from "./types.js";

export const DEFAULT_ORIGIN = "https://standing-guard-service.lovable.app";
export const DEFAULT_POLICY: PaymentPolicy = {
  network: "eip155:8453",
  asset: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC on Base
  payTo: "0x1050eddd8282623b0c263ed6bdbd42370bbc28d3",
  maxAmountPerPurchase: "1000000", // 1.00 USDC
  assetName: "USD Coin",
  assetVersion: "2",
};

/** Persist the signed payment BEFORE it is sent. This is what makes recovery free of double charges. */
export interface PurchaseStore {
  get(purchaseId: string): Promise<StoredPurchase | undefined> | StoredPurchase | undefined;
  put(purchaseId: string, entry: StoredPurchase): Promise<void> | void;
}
export interface StoredPurchase { submission: Submission; payment?: Json; paymentSentAt?: number }
export class MemoryPurchaseStore implements PurchaseStore {
  readonly #m = new Map<string, StoredPurchase>();
  get(id: string) { return this.#m.get(id); }
  put(id: string, e: StoredPurchase) { this.#m.set(id, e); }
}

export interface StandingClientOptions {
  /** 32-byte hex secp256k1 key that pays (EIP-3009). Never sent anywhere; used only to sign. */
  evmPrivateKey: string;
  /** Ed25519 identity for client proofs and buyer_key. Generated if omitted; export and keep it to retrieve results later. */
  buyerKey?: BuyerKey;
  origin?: string;
  policy?: Partial<PaymentPolicy>;
  /** Pin the publisher root. If omitted it is read from the unauthenticated contract (trust-on-first-use). */
  rootPin?: string;
  store?: PurchaseStore;
  fetch?: typeof fetch;
  clock?: () => number; // unix seconds
  /** Last chance to refuse: called with the parsed terms after policy checks, before anything is signed. */
  approvePayment?: (t: PaymentRequirements) => boolean | Promise<boolean>;
  timeoutMs?: number;
}

const HEX64 = /^[0-9a-f]{64}$/;
const ADDR = /^0x[0-9a-fA-F]{40}$/;

export class StandingClient {
  readonly origin: string;
  readonly policy: PaymentPolicy;
  readonly buyerKey: BuyerKey;
  readonly payer: string;
  readonly #evmKey: string;
  readonly #o: StandingClientOptions;
  readonly #store: PurchaseStore;
  readonly #fetch: typeof fetch;
  readonly #clock: () => number;
  #rootPin: string | undefined;

  constructor(o: StandingClientOptions) {
    if (!/^(0x)?[0-9a-fA-F]{64}$/.test(o.evmPrivateKey ?? "")) throw new StandingError("INVALID_INPUT", "evmPrivateKey must be 32 bytes of hex");
    this.#o = o;
    this.#evmKey = o.evmPrivateKey;
    this.payer = addressOf(o.evmPrivateKey);
    this.buyerKey = o.buyerKey ?? BuyerKey.generate();
    this.origin = (o.origin ?? DEFAULT_ORIGIN).replace(/\/$/, "");
    if (!/^https:\/\//.test(this.origin) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(this.origin)) throw new StandingError("INVALID_INPUT", "origin must be https");
    this.policy = { ...DEFAULT_POLICY, ...o.policy };
    this.#rootPin = o.rootPin;
    this.#store = o.store ?? new MemoryPurchaseStore();
    this.#fetch = o.fetch ?? fetch;
    this.#clock = o.clock ?? (() => Math.floor(Date.now() / 1000));
  }

  async #http(method: "GET" | "POST", path: string, body = "", extra: Record<string, string> = {}, auth = true): Promise<Response> {
    const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json", ...extra };
    if (auth) headers["whp-client-proof"] = this.buyerKey.clientProof(method, path, body, this.#clock());
    try {
      return await this.#fetch(this.origin + path, { method, headers, ...(method === "POST" ? { body } : {}), redirect: "error", signal: AbortSignal.timeout(this.#o.timeoutMs ?? 30000) });
    } catch (e) {
      throw new StandingError("HTTP_ERROR", `Request failed: ${method} ${path}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  async #json(r: Response): Promise<{ text: string; json: Json }> {
    const text = await r.text();
    try { return { text, json: JSON.parse(text) as Json }; } catch { throw new StandingError("INVALID_RESPONSE", "Response was not JSON", { status: r.status, detail: text.slice(0, 300) }); }
  }
  #fail(r: Response, text: string, what: string): never {
    throw new StandingError("HTTP_ERROR", `${what}: HTTP ${r.status}`, { status: r.status, detail: text.slice(0, 500) });
  }

  /** GET /v1/contract. Unauthenticated machine-readable validation contract and criteria. */
  async getContract(): Promise<Record<string, Json>> {
    const r = await this.#http("GET", "/v1/contract", "", {}, false);
    const { text, json } = await this.#json(r);
    if (!r.ok) this.#fail(r, text, "getContract");
    const c = json as Record<string, Json>;
    if (this.#rootPin === undefined && typeof c["root_pin"] === "string" && HEX64.test(c["root_pin"])) this.#rootPin = c["root_pin"];
    return c;
  }
  async #pin(): Promise<string> {
    if (!this.#rootPin) await this.getContract();
    if (!this.#rootPin) throw new StandingError("INVALID_RESPONSE", "No root_pin available; pass rootPin explicitly");
    return this.#rootPin;
  }
  /** purchase_id is derived locally: SHA-256 over the canonical (domain, root_pin, buyer_key, client_reference). */
  async purchaseIdFor(clientReference: string): Promise<string> {
    return hashCanonical({ domain: "WHP-STANDING-PURCHASE-v1", root_pin: await this.#pin(), buyer_key: this.buyerKey.publicKeyDer, client_reference: clientReference });
  }

  /**
   * evaluate: submit the node graph, answer the 402 challenge once with a quote-bound EIP-3009 authorization,
   * and return the signed result ($1.00 USDC by default policy). Safe to call again with the same client_reference:
   * a stored payment is never re-signed.
   */
  async evaluate(clientReference: string, nodes: SignedNode[], template: SubmissionTemplate): Promise<PurchaseOutcome> {
    if (!/^[A-Za-z0-9_-]{16,96}$/.test(clientReference)) throw new StandingError("INVALID_INPUT", "client_reference must match [A-Za-z0-9_-]{16,96}");
    const s: Submission = { version: "WHP-STANDING-SUBMISSION-v1", client_reference: clientReference, buyer_key: this.buyerKey.publicKeyDer, profile: template.profile, object: template.object, bounds: template.bounds, requested_operation: template.requested_operation, nodes, transitions: template.transitions ?? [] };
    const body = canonical(s);
    const id = await this.purchaseIdFor(clientReference);
    const row = (await this.#store.get(id)) ?? { submission: s };
    if (row.payment) return this.recover(id); // already authorized once: recovery path, no new signature
    await this.#store.put(id, row);

    const unpaid = await this.#http("POST", "/v1/evaluations", body);
    const first = await this.#json(unpaid);
    if (unpaid.status === 200) return this.#accept(id, s, unpaid, first.text);
    if (unpaid.status !== 402) this.#fail(unpaid, first.text, "evaluate (challenge)");
    const terms = first.json as unknown as PaymentRequired;
    const { req, quotePayload } = this.#checkTerms(terms, id, s);
    if (this.#o.approvePayment && !(await this.#o.approvePayment(req))) throw new StandingError("TERMS_REJECTED", "approvePayment refused the terms");

    const at = this.#clock();
    const expiresAt = Number((quotePayload as Record<string, Json>)["expires_at"]);
    if (!(at < expiresAt)) throw new StandingError("TERMS_REJECTED", "Quote already expired");
    const auth: TransferAuthorization = {
      from: this.payer, to: req.payTo, value: req.amount,
      validAfter: String(at - 1), validBefore: String(Math.min(at + req.maxTimeoutSeconds, expiresAt)),
      nonce: authorizationNonce(quotePayload),
    };
    const signature = signTransferAuthorization(this.#evmKey, { name: req.extra.name, version: req.extra.version, chainId: req.network.slice(7), verifyingContract: req.asset }, auth);
    const payment: Json = { x402Version: 2, resource: terms.resource as unknown as Json, accepted: req as unknown as Json, payload: { signature, authorization: auth as unknown as Json } };
    await this.#store.put(id, { ...row, payment, paymentSentAt: at }); // persist BEFORE sending
    return this.#submitPaid(id, s, body, payment);
  }

  async #submitPaid(id: string, s: Submission, body: string, payment: Json): Promise<PurchaseOutcome> {
    const r = await this.#http("POST", "/v1/evaluations", body, { "payment-signature": Buffer.from(canonical(payment)).toString("base64") });
    const { text } = await this.#json(r);
    if (r.status === 200) return this.#accept(id, s, r, text);
    if (r.status === 202) return { purchaseId: id, state: "PENDING", additionalCharge: false };
    if (r.status === 402) throw new StandingError("PAYMENT_NOT_ACCEPTED", "Server rejected the payment authorization", { status: 402, detail: text.slice(0, 500) });
    if (r.status === 409 || r.status === 503) throw new StandingError("SETTLEMENT_REJECTED", `Settlement not completed (HTTP ${r.status}); use recover("${id}") - it never re-charges`, { status: r.status, detail: text.slice(0, 500) });
    return this.#fail(r, text, "evaluate (paid)");
  }

  #checkTerms(terms: PaymentRequired, id: string, s: Submission): { req: PaymentRequirements; quotePayload: Json } {
    const p = this.policy;
    const bad = (m: string) => new StandingError("TERMS_REJECTED", m, { detail: terms });
    if (terms?.x402Version !== 2 || !Array.isArray(terms.accepts) || terms.accepts.length !== 1) throw bad("Expected x402 v2 with exactly one accepted payment option");
    const req = terms.accepts[0] as PaymentRequirements;
    if (req.scheme !== "exact" || req.network !== p.network) throw bad(`Network/scheme not allowed: ${req.scheme} ${req.network}`);
    if (!ADDR.test(req.asset) || req.asset.toLowerCase() !== p.asset.toLowerCase()) throw bad("Asset is not the allowed USDC contract");
    if (!ADDR.test(req.payTo) || req.payTo.toLowerCase() !== p.payTo.toLowerCase()) throw bad("pay-to address is not the allowed recipient");
    if (!/^[1-9][0-9]*$/.test(req.amount) || BigInt(req.amount) > BigInt(p.maxAmountPerPurchase)) throw bad(`Amount ${req.amount} exceeds the per-purchase limit ${p.maxAmountPerPurchase}`);
    if (req.extra?.assetTransferMethod !== "eip3009" || req.extra?.paymentFlow !== "authorization" || req.extra.name !== p.assetName || req.extra.version !== p.assetVersion) throw bad("EIP-712 token domain not allowed");
    if (!Number.isSafeInteger(req.maxTimeoutSeconds) || req.maxTimeoutSeconds <= 0 || req.maxTimeoutSeconds > 300) throw bad("Timeout out of range");
    const info = (terms.extensions as Record<string, any> | undefined)?.["whp-standing"]?.info;
    const quote = info?.quote;
    if (info?.required !== true || !quote?.payload) throw bad("Missing WHP quote binding (required for payment)");
    const q = quote.payload as Record<string, Json>;
    if (q["purchase_id"] !== id || q["request_hash"] !== hashCanonical(s) || q["buyer_key"] !== s.buyer_key) throw bad("Quote does not match this submission");
    if (canonical((q["payment_requirements"] as Json)) !== canonical(req as unknown as Json)) throw bad("Quote payment requirements differ from the offered terms");
    if (canonical(q["resource"] as Json) !== canonical(terms.resource as unknown as Json) || terms.resource.url !== this.origin + "/v1/evaluations") throw bad("Resource mismatch");
    return { req, quotePayload: quote.payload as Json };
  }

  async #accept(id: string, s: Submission, r: Response, text: string): Promise<PurchaseOutcome> {
    let j: any;
    try { j = JSON.parse(text); } catch { throw new StandingError("INVALID_RESPONSE", "Result was not JSON"); }
    const p = j?.payload;
    if (!p || p.purchase_id !== id || p.submission_hash !== hashCanonical(s)) throw new StandingError("RESULT_MISMATCH", "Result does not belong to this purchase or submission", { detail: { purchase_id: p?.purchase_id } });
    return { purchaseId: id, state: "VERIFIED", resultText: text, result: j as Json, paymentResponse: r.headers.get("payment-response"), additionalCharge: false };
  }

  /** getResult: fetch an already-issued result by purchase id. Requires the same buyer key that made the purchase. */
  async getResult(purchaseId: string): Promise<PurchaseOutcome> {
    this.#id(purchaseId);
    const r = await this.#http("GET", `/v1/purchases/${purchaseId}/result`);
    const { text, json } = await this.#json(r);
    if (r.status === 200) {
      const p = (json as any)?.payload;
      if (!p || p.purchase_id !== purchaseId) throw new StandingError("RESULT_MISMATCH", "Result purchase_id differs from the request");
      return { purchaseId, state: "VERIFIED", resultText: text, result: json, paymentResponse: r.headers.get("payment-response"), additionalCharge: false };
    }
    if (r.status === 202) return { purchaseId, state: "PENDING", additionalCharge: false };
    return this.#fail(r, text, "getResult");
  }

  /**
   * recover: idempotent. Reads the result; if still pending, asks the service to resume the ORIGINAL purchase
   * (POST /recover). Never signs a new authorization and never charges again.
   */
  async recover(purchaseId: string): Promise<PurchaseOutcome> {
    this.#id(purchaseId);
    const got = await this.getResult(purchaseId);
    if (got.state === "VERIFIED") return got;
    const r = await this.#http("POST", `/v1/purchases/${purchaseId}/recover`);
    const { text, json } = await this.#json(r);
    if (r.status === 200) {
      const p = (json as any)?.payload;
      if (!p || p.purchase_id !== purchaseId) throw new StandingError("RESULT_MISMATCH", "Recovered result purchase_id differs");
      return { purchaseId, state: "VERIFIED", resultText: text, result: json, paymentResponse: r.headers.get("payment-response"), additionalCharge: false };
    }
    if (r.status === 202) return { purchaseId, state: "PENDING", additionalCharge: false };
    return this.#fail(r, text, "recover");
  }
  #id(id: string): void { if (!HEX64.test(id)) throw new StandingError("INVALID_INPUT", "purchaseId must be 64 lowercase hex characters"); }
}

/** Authorization nonce binds the payment to the quote: SHA-256 over canonical (domain, quote terms without expiry/timeout). */
export function authorizationNonce(quotePayload: Json): string {
  const { expires_at: _e, ...t } = quotePayload as Record<string, Json>;
  const { maxTimeoutSeconds: _m, ...pr } = t["payment_requirements"] as Record<string, Json>;
  return "0x" + hashCanonical({ domain: "WHP-STANDING-PURCHASE-BINDING-v2", quote_terms: { ...t, payment_requirements: pr } });
}
