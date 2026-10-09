# A2A Provenance & Transaction Ledger
### Wheeler Hubbell Publishing — Standing Authority
*Canonical Lineage & Operational Verification Surface*  
*Standard: RFC 9264, RFC 8785, x402-v2 (EIP-3009 on Base Mainnet)*

---

## 1. Network & Authority Topology

| Parameter | Live Production | Development / Testing |
|---|---|---|
| **Base URL** | `https://standing-guard-service.lovable.app` | `http://localhost:8080` / Sandbox |
| **Settlement Rail** | Base Mainnet (`eip155:8453`) | Base Sepolia (`eip155:84532`) / `/v1/mock` |
| **Settlement Asset** | USDC (`0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`) | Mock / Test USDC |
| **Payment Protocol** | x402-v2 (EIP-3009 TransferWithAuthorization) | `X-Mock: true` / Free dry run |
| **Designated Payee** | `0x1050eddd8282623b0c263ed6bdbd42370bbc28d3` | Configured Dev Account |
| **Canonical Root Pin** | `c9507f2c5d0d80935a4885071c8372eeba25010e514e81401acabb246134bff6` | Test Root Pin |
| **Signing Algorithm** | Ed25519 (RFC 8032) / RFC 8785 Canonical JCS | Ed25519 Test Key |
| **Onchain Verifier** | `StandingVerifier.sol` (EIP-712 Dual Attestation) | Local/Sepolia Test Verifier |

---

## 2. Activity Categorization Taxonomy

To ensure absolute financial and epistemic integrity, all platform activities are classified into three mutually exclusive tiers:

1. **Tier A — Internal Verification & Health Probes:**  
   Automated continuous deployment tests, CI/CD health checks, and founder-funded connectivity verifications (`/healthz`, `/v1/mock`, directory indexing beacons).
2. **Tier B — Developer Staging & Integration Testing:**  
   Ecosystem partner testing via free mock envelopes, structural verification requests, and dry-run preflights.
3. **Tier C — Independent Third-Party Customer Transactions:**  
   External human or autonomous agent purchases settled via production x402 USDC transfers or card-funded developer credit packs, fulfilling live Standing Marks.

---

## 3. Verified Historical Lineage & Coordinates

| Event ID | Timestamp (UTC) | Category | Type / Door | Coordinate Reference | Status |
|---|---|---|---|---|---|
| `EVT-GENESIS-01` | 2026-10-08T18:00:00Z | Genesis | Genesis Verifier & Protocol Spec | `git:whp:genesis:root` | Verified |
| `EVT-PROD-REL-01` | 2026-10-09T04:22:15Z | Tier A | Lovable Production Deployment | `dep:standing-guard-service:4fb0b97` | Active |
| `EVT-PROD-BEACON` | 2026-10-09T06:14:00Z | Tier A | Scheduled IndexNow Directory Beacon | `cron:beacon:6h:fbd59cd` | Active (4/day) |
| `EVT-MOCK-DRYRUN` | 2026-10-09T08:20:00Z | Tier B | Structural Mock Preflight | `door:/v1/mock` | Passed (200 OK) |
| `EVT-SETTLE-PEND` | Ongoing | Tier C | Autonomous x402 Base Settlement | `chain:8453:usdc:x402` | Listening |

---

## 4. Operational Accounting & Revenue Reconciliation

*Last Reconciled: October 9, 2026*

| Metric | Independent Customer (Tier C) | Internal / Founder (Tier A & B) |
|---|---|---|
| **Settled Paid Evaluations** | 0 | 12 (Synthetic / Probes) |
| **Gross Receipts (USDC)** | 0.00 USDC | 0.00 USDC |
| **Developer Credit Packs Sold** | 0 | 0 |
| **Operating Infrastructure Cost** | $0.00 (Self-contained) | Nominal (API / Compute) |
| **Repeat Commercial Buyers** | 0 | N/A |

*Policy Rule: The service is never reported as revenue-generating merely because the payment doors are active. Independent customer revenue is logged here strictly upon confirmed blockchain settlement or Stripe credit pack clearance.*
