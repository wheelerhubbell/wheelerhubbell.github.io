# A2A Provenance & Operational Ledger
### Wheeler Hubbell Publishing — Standing Authority
*Canonical Lineage, Operational Status & Audit Surface*  
*Standard: RFC 9264, RFC 8785, x402-v2 (EIP-3009 on Base Mainnet)*

---

## 1. Network & Authority Topology

| Parameter | Live Production | Development / Testing |
|---|---|---|
| **Base URL** |  |  / Sandbox |
| **Settlement Rail** | Base Mainnet () | Base Sepolia () /  |
| **Settlement Asset** | USDC () | Mock / Test USDC |
| **Payment Protocol** | x402-v2 (EIP-3009 TransferWithAuthorization) |  / Free dry run |
| **Designated Payee** |  | Configured Dev Account |
| **Canonical Root Pin** |  | Test Root Pin |
| **Signing Algorithm** | Ed25519 (RFC 8032) / RFC 8785 Canonical JCS | Ed25519 Test Key |
| **Onchain Verifier** |  (EIP-712 Dual Attestation; artifact compiled in , Base mainnet deployment pending) | Reference contract / ABI |

---

## 2. Activity Categorization Taxonomy

To ensure absolute financial and epistemic integrity, all platform activities are classified into three mutually exclusive tiers:

1. **Tier A — Internal Verification & Health Probes:**  
   Continuous deployment tests, CI/CD health checks, and founder-funded connectivity verifications (, , IndexNow directory indexing announcements).
2. **Tier B — Developer Staging & Integration Testing:**  
   Ecosystem partner testing via free mock envelopes, structural verification requests, and dry-run preflights. Non-authoritative; does not issue signed production Standing Marks.
3. **Tier C — Independent Third-Party Customer Transactions:**  
   External human or autonomous agent purchases settled via production x402 USDC transfers on Base or card-funded developer credit packs, fulfilling live Standing Marks.

---

## 3. Verified Historical Lineage & Real Repository Records

| Git Commit / Event | Timestamp (UTC) | Repository | Description | Status |
|---|---|---|---|---|
|  | 2026-10-08T08:18:17Z |  | Canonical host wrapper source and protocol spec | Verified |
|  | 2026-10-09T06:15:11Z |  | Add CI/CD standing-gate composite GitHub Action | Verified |
|  | 2026-10-09T08:51:14Z |  | Initial publication of provenance and accounting ledger | Verified |
|  | 2026-10-09T08:51:26Z |  | Mirror authoritative  on Pages | Verified |
|  | 2026-10-09T09:12:00Z | Live Service | IndexNow API accepts 17 public/paid URLs with HTTP 202 | Accepted |
|  | 2026-10-09T06:53:24Z |  | Standing Witness action provider submission (PR #1546) | Pending review |

---

## 4. Operational Accounting & Revenue Reconciliation

*Last Reconciled: October 9, 2026 09:15 UTC*

| Metric | Independent Customer (Tier C) | Internal / Developer Probes (Tier A & B) |
|---|---|---|
| **Settled Paid Evaluations** | **0** | Probing / Discovery active |
| **Gross Receipts (USDC)** | **bash.00** | bash.00 |
| **Gross Receipts (Card / Stripe)** | **bash.00** | bash.00 |
| **Unique Independent Buyers** | **0** | N/A |
| **Repeat Buyers** | **0** | N/A |
| **Fulfillment Rate** | N/A | N/A |

*Note: In accordance with production integrity standards, Wheeler Hubbell Publishing explicitly does not claim customer revenue or live sales volume prior to observing and independently verifying bona fide external buyer settlements on Base Mainnet or via Stripe.*
