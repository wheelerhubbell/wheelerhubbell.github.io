# WHP Attestation Registry

This directory contains two cryptographically signed Decision Integrity records issued by Wheeler Hubbell Publishing, preserved as issued. The field values below are transcribed from the records themselves. The commands shown check each record's hash and Ed25519 signature; running them is the reader's verification step, not a result asserted here. Settlement transaction hashes are reproduced from the records for independent checking on Base; this registry does not itself assert chain finality.

## Reference Records

### 1. Canonical Standing Mark (WHP-STANDING-MARK-v1, v1 generation)

* **Purchase ID:** f9449b31a9fc74458dfde4696f68c041a242194113b3936503fe3362854a073f
* **Mark ID:** WHP-SM-f9449b31a9fc74458dfde4696f68c041a242194113b3936503fe3362854a073f
* **Decision Outcome:** ESTABLISHED
* **Settlement Rail (as recorded):** Base (eip155:8453)
* **Asset (as recorded):** USDC (0x833589fcd6edb6e08f4c7c32d4f71b54bda02913)
* **Amount (as recorded):** 1.000000 USDC (1000000 units)
* **Recipient (as recorded):** 0x1050eddd8282623b0c263ed6bdbd42370bbc28d3
* **Base Block Number (as recorded):** 52220195
* **Base Transaction Hash (as recorded):** [0x751f288ece3cc39081a6c3873665af5f0f441bf6c2751374a95a1c40e6ccafdf](https://basescan.org/tx/0x751f288ece3cc39081a6c3873665af5f0f441bf6c2751374a95a1c40e6ccafdf)
* **Verification Command:**

  `python3 packages/verifier/bb8cb78205f1892dcbf00d845cf85e504a0efacf2a0d8a793313fa8c0e99b833.py attestations/genesis-mark.json --root-pin c9507f2c5d0d80935a4885071c8372eeba25010e514e81401acabb246134bff6`

  Checks performed by the command: record hash and Ed25519 signature over the canonical record, plus evaluator replay. The issuer's historical verification account (packages/verifier README, genesis self-test) records these checks passing at issuance on the original bytes.

  Notes: this is a v1-generation Mark; the current live generation is v2 and names its own content-addressed verifier. Its recorded validity window ended 2026-10-06T01:00:00Z, so it documents historical issuance, not current standing; resolving its purchase against the current registry returns not found. Its embedded provenance references the retired host `standing-guard-service.lovable.app`.

### 2. Frontdoor Evaluation Record (WHP-FRONTDOOR-EVALUATION-v1)

* **Record Key (as recorded):** D56_CIHZz-o8tXVISW-FYnajc6UMMl-9w8RfJqz5Fzw (record hash 4d7758e336a58d165904d086ac01cd8b33ecfd58baab92509f6363c7dfcaac78)
* **Signature Algorithm:** Ed25519
* **Verification Command:**

  `python3 packages/verifier/verify_frontdoor.py attestations/frontdoor-reference.json --offline`

  Checks performed by the command: record hash and Ed25519 signature over the canonical record.

  Notes: `--offline` is shown because issuer keys have rotated; the record's key is retired, and the issuer key currently advertised at `GET /v1/verification` differs. The record's provenance cites the retired host `standing-guard-service.lovable.app`. Its recorded payment names Base transaction 0x5d449b8348f655a37085b451825e366f56b91772d1b90ddec6341598e022a542 for independent checking.

## Protocol Invariants
- **No Mock or Simulated Attestations:** Mock simulations are not determinations and are never published to this registry.
- **Evaluation Independence:** Payment purchases evaluation under the Decision Integrity Protocol, never a predetermined outcome.
- **On-Chain Settlement:** All commercial marks verify against finalized Base receipts.
