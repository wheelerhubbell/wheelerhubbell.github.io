import type { Json } from "./canonical.js";
export type { Json };

/** One signed node of the passage graph (shape defined by the service's submission schema). */
export type SignedNode = Json;

export interface PaymentRequirements {
  scheme: "exact";
  network: string;           // CAIP-2, e.g. "eip155:8453"
  amount: string;            // atomic units (USDC has 6 decimals)
  asset: string;             // token contract
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { assetTransferMethod: "eip3009"; paymentFlow: "authorization"; name: string; version: string };
}
export interface PaymentRequired {
  x402Version: 2;
  error?: string;
  resource: { url: string; description?: string; mimeType?: string };
  accepts: PaymentRequirements[];
  extensions?: Record<string, unknown>;
}
export interface Submission {
  version: "WHP-STANDING-SUBMISSION-v1";
  client_reference: string;
  buyer_key: string;
  profile: { id: string; version: string; sha256: string };
  object: { id: string; version: string; root: string };
  bounds: { jurisdiction: string; scope: string; valid_from: number; valid_until: number };
  requested_operation: string;
  nodes: SignedNode[];
  transitions: Json[];
}
/** Everything except client_reference/buyer_key/nodes, which the client fills. */
export type SubmissionTemplate = Omit<Submission, "client_reference" | "buyer_key" | "nodes" | "version" | "transitions"> & { transitions?: Json[] };

export interface PaymentPolicy {
  network: string;              // default eip155:8453
  asset: string;                // default USDC on Base
  payTo: string;                // default WHP payTo
  maxAmountPerPurchase: string; // atomic units, default 1000000 = 1.00 USDC
  assetName: string;            // EIP-712 domain name, default "USD Coin"
  assetVersion: string;         // default "2"
}
export interface PurchaseOutcome {
  purchaseId: string;
  state: "VERIFIED" | "PENDING";
  /** Exact result bytes as served (keep these; they are what a verifier checks). */
  resultText?: string;
  result?: Json;
  paymentResponse?: string | null;   // x402 PAYMENT-RESPONSE header (settlement receipt) when present
  additionalCharge: false;
}
