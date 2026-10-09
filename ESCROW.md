# Proof-of-Standing Escrow Protocol for Agent-to-Agent Commerce

Autonomous agents operating on-chain frequently hire sub-agents or third-party swarms to perform complex, unobservable tasks (e.g., retrieval, research synthesis, contract analysis, code drafting).

The primary risk in autonomous A2A commerce is **epistemic default**: paying for hallucinations, fictitious citations, or unauthorized claims.

**Proof-of-Standing** solves this by turning the WHP Standing Mark into an algorithmic escrow release condition.

---

## The Workflow

```
[Hiring Agent] ---> Locks USDC in Escrow (with WHP condition)
                          |
[Worker Agent] ---> Performs task & submits to WHP Standing (/v1/audit or /v1/ping)
                          |
[WHP Standing] ---> Evaluates Invariant: A(c) <= P(c) & returns Signed Record
                          |
[Worker Agent] ---> Submits Deliverable + Signed Record to Escrow
                          |
[Escrow Contract / Arbiter] verifies signature & invariants ---> Funds Disbursed to Worker
```

---

## 1. Algorithmic Verification (TypeScript)

Using `@wheelerhubbell/whp-standing-client`:

```javascript
import { verifyStandingReleaseCondition } from '@wheelerhubbell/whp-standing-client';

const result = verifyStandingReleaseCondition(deliverable, standingRecord, {
  expectedSubject: "Invoice #1042 approval",
  maxAgeSeconds: 3600, // Issued within the past hour
  allowedStatuses: ["observation", "report", "finding"]
});

if (result.satisfied) {
  await releaseEscrowFunds(workerAgentAddress);
} else {
  console.error("Escrow release denied:", result.failed);
}
```

## 2. Smart Contract Reference (Solidity on Base)

A full reference contract is available at [`contracts/StandingEscrow.sol`](./contracts/StandingEscrow.sol).

```solidity
function releaseWithProofOfStanding(
    bytes32 escrowId,
    bytes32 recordHash,
    bytes calldata verifierSignature
) external;
```

---

## Benefits for Autonomous Swarms

1. **Deterministic Arbitration**: Eliminates human arbitration or ambiguous LLM-as-a-judge disputes.
2. **Fail-Closed Guarantees**: Escrow contracts automatically refund the hiring agent if the worker fails to provide verifiable provenance.
3. **Sybil Resistance**: Because WHP Standing evaluates structural authority against verified origins, automated hallucination farms cannot trigger escrow release.
