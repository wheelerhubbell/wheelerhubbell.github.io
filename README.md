# Wheeler Hubbell Publishing

> **Where formal epistemology, published literature, and autonomous Decision Integrity meet.**
> Home of the published works, the canonical research preprints, and the machine-verifiable Standing Witness protocol for AI agents and CI/CD pipelines.

[![MCP Server](https://img.shields.io/badge/MCP-Compatible-blue)](https://standing-guard-service.lovable.app/mcp)
[![x402 Payment](https://img.shields.io/badge/x402-USDC%20on%20Base-green)](https://standing-guard-service.lovable.app/v1/contract)
[![npm](https://img.shields.io/badge/npm-%40wheelerhubbell%2Fwhp--standing--client-red)](https://github.com/wheelerhubbell/wheelerhubbell.github.io/tree/main/packages/client)
[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Standing%20Gate-blue?logo=github)](https://github.com/marketplace/actions/standing-gate)
[![Standing Sentinel](https://github.com/wheelerhubbell/wheelerhubbell.github.io/actions/workflows/standing-sentinel.yml/badge.svg)](https://github.com/wheelerhubbell/wheelerhubbell.github.io/actions/workflows/standing-sentinel.yml)

Wheeler Hubbell Publishing is an independent publishing house and research imprint. It produces foundational books, dramatic texts, and philosophical preprints (*Constitutional Continuity Theory*, *Coherent Substitution*, *The Elemental Properties of True*), while maintaining a deterministic, fail-closed runtime and cryptographic witness service for AI agent ecosystems and automated pipelines.

---

## Autonomous Agent & A2A Infrastructure

Autonomous AI agents operating in agent-to-agent (A2A) economic networks require **epistemic guardrails** to prevent hallucinations, counterfeit provenance, and catastrophic action on baseless assertions. WHP Standing separates authority from payment, and determination from external acceptance.

### 1. Model Context Protocol (MCP)

Connect any agent (Claude Desktop, Cursor, Lovable, LangChain, AutoGen) to the live Standing Witness:

```json
{
  "mcpServers": {
    "whp-standing": {
      "command": "npx",
      "args": ["-y", "@smithery/cli", "run", "@wheelerhubbell/whp-standing-client", "--config", "{\"endpoint\":\"https://standing-guard-service.lovable.app/mcp\"}"]
    }
  }
}
```

Or connect directly to the Streamable HTTP endpoint:
`https://standing-guard-service.lovable.app/mcp`

### 2. Free Mock & Dry-Run (Zero-Cost for Agent Introspection)

Agents can validate schemas and test evaluation flows without spending tokens or maintaining crypto balances:

- **Free Mock Evaluation**: `POST https://standing-guard-service.lovable.app/v1/mock`
- **Ping with Mock Header**: `POST https://standing-guard-service.lovable.app/v1/ping` with header `X-Mock: true`
- **What Stops Without a Mark**: `POST https://standing-guard-service.lovable.app/v1/gap/check` (demonstrates where unverified claims halt execution before `EXECUTE` actions)

### 3. Machine-to-Machine Epistemic Tiers (x402 v2 on Base)

When a live, cryptographically signed standing record or sealed Mark is required, agents and automated pipelines self-settle using **x402** via gasless EIP-3009 `TransferWithAuthorization` in USDC on Base (`eip155:8453`). No human account, credit card, or custodial deposit is needed.

#### Canonical Epistemic Tiers

The service names tiers by the **epistemic object and scope of work**, not by technical submission routes. The same reasoning engine applies the identical evidentiary standard at every tier; fee reflects workload and structure, not the verdict.

| Tier Name | Price | Epistemic Scope | Route / Contract |
| :--- | :--- | :--- | :--- |
| **Proposition** | 0.10 USDC | One atomic assertion, bounded question, or standalone tool output. | `POST /v1/ping` |
| **Claim** | 1.00 USDC | A structured claim with qualifiers, standing, temporal bounds, and supporting evidence. | `POST /v1/evaluate`<br>([Contract](https://standing-guard-service.lovable.app/v1/ordinary/contract.json)) |
| **Qualification Update** | 1.00 USDC | A change to an existing claim's scope, qualifications, or temporal standing, evaluated against the existing record. | `POST /v1/patch` |
| **Evidence Graph** | 2.00 USDC | Interdependent claims, multiple sources, actors, authorities, and transitions between states. | `POST /v1/audit` |
| **Dossier** | Quote-based | An extensive document corpus or interconnected body of evidence requiring comprehensive evaluation. | `POST /v1/evaluations`<br>([Contract](https://standing-guard-service.lovable.app/v1/contract)) |

#### The Decision Integrity Pricing Invariant

1. **Workload-Determined**: The fee is determined strictly by the volume, structure, and epistemic scope of the submitted material and the computational work required to evaluate it.
2. **Outcome-Independent**: The fee is independent of the evaluation outcome.
3. **No Purchased Verdicts**: Payment purchases an evaluation under published rules. It does not purchase a favorable Mark, an `ESTABLISHED` result, or a predetermined conclusion. Evaluated records are Ed25519-signed regardless of verdict:
   - **`ESTABLISHED`** -> Standing Mark (claim is bounded and strictly supported by admitted evidence)
   - **`NOT_ESTABLISHED`** -> Standing Assessment (claim lacks necessary authority, evidence, or qualifier protection)
4. **Uniform Evidentiary Standard**: A Proposition and a Dossier differ in scope, but neither gets a more permissive evidentiary threshold because of price. Likewise, a Qualification Update never silently inherits an earlier conclusion if underlying authority or evidence has shifted.

---

## 📡 The Summoning Beacon (Proactive Machine Waking)

Rather than waiting passively for agents to query the service, the **Summoning Beacon** actively pings and summons autonomous machines:
- **Active Webhook Knock:** Dispatch direct challenge payloads (`WHP-SUMMON-BEACON-v1`) to agent webhooks to force immediate epistemic evaluation.
- **Heartbeat & Challenge Stream:** SSE endpoint (`GET /v1/beacon/stream`) streaming real-time heartbeat pulses and challenges to listening worker bots.
- **Onchain Summoning Contract:** [`contracts/StandingBeacon.sol`](contracts/StandingBeacon.sol) on Base emits indexed `AgentSummoned` events with attached bounties.
- **Full Guide:** Read [BEACON.md](BEACON.md) for architecture and integration patterns.

## Client Libraries & SDKs

### TypeScript / Node.js
Middleware and CLI guardrails for autonomous agents:
```bash
npm install @wheelerhubbell/whp-standing-client
```
See [`packages/client/`](packages/client/) for middleware usage and the *Mata v. Avianca* hallucination autopsy benchmark.

### Python SDK
Async client answering x402 payment challenges:
```python
from whp_standing_client import StandingClient, BuyerKey

client = StandingClient(PAYER_KEY, buyer_key=BuyerKey.from_seed_hex(BUYER_SEED))
contract = await client.get_contract()
out = await client.evaluate(client_reference, nodes, template)
```
See [`py/`](py/) for complete documentation.

### Standalone Verifiers
Verification is vendor-neutral and decoupled from issuance. Run cold verification against any Mark:
```bash
python3 packages/verifier/verify_mark.py path/to/mark.json
```

---

## Machine Discovery Endpoints

- **LLM Context**: [`/llms.txt`](https://wheelerhubbell.github.io/llms.txt)
- **API Catalog (RFC 9264)**: [`/.well-known/api-catalog`](https://wheelerhubbell.github.io/.well-known/api-catalog)
- **MCP Discovery**: [`/.well-known/mcp.json`](https://wheelerhubbell.github.io/.well-known/mcp.json)
- **OpenAPI 3.1 Spec**: [`/openapi.json`](https://wheelerhubbell.github.io/openapi.json)
- **Live Capability Resolution**: [`/.well-known/standing-capability.json`](https://standing-guard-service.lovable.app/.well-known/standing-capability.json)

---

## Publications & Preprints

This repository also hosts the canonical foundation publications of Wheeler Hubbell Publishing:

1. [Adversarial Memorandum](1-adversarial-memorandum.pdf)
2. [Before Certainty (Excerpt)](1-before-certainty-excerpt.pdf)
3. [Coherent Substitution](1-coherent-substitution.pdf)
4. [Elemental Properties of True (Excerpt)](1-elemental-properties-excerpt.pdf)
5. [Jurisdiction Across Time (Preprint)](1-jurisdiction-across-time-preprint.pdf)
6. [Keeping Room Chalk Dust Portraiture](1-keeping-room-chalk-dust-portraiture.pdf)
7. [Room Without a View (Excerpt)](1-room-without-a-view-excerpt.pdf)
8. [Silhouette Fallacy (Excerpt)](1-silhouette-fallacy-excerpt.pdf)

---

## License

MIT © Wheeler Hubbell Publishing, Inc.

## Autonomous Agent Infrastructure (A2A)

### 1. Epistemic Circuit Breaker (`@wheelerhubbell/whp-standing-client`)
Fail-closed middleware for LangChain, OpenAI function calling, and MCP tools. Intercepts irrevocable tool invocations (transfers, deletions, external writes) and halts execution if upstream authority or provenance is unverified.
* Guide: [CIRCUIT_BREAKER.md](./CIRCUIT_BREAKER.md)

### 2. Proof-of-Standing Escrow Condition
Turn WHP Standing Marks into algorithmic escrow release conditions for autonomous agent swarms. Funds in escrow disburse only when tasks present valid, signed standing records meeting invariant $A(c) \le P(c)$.
* Specification: [ESCROW.md](./ESCROW.md)
* Smart Contract: [`contracts/StandingEscrow.sol`](./contracts/StandingEscrow.sol)

## Coinbase AgentKit & Autonomous Agents

Equip autonomous agents running on Base (`eip155:8453`) with pre-execution safety gates and epistemic verification:

- **Action Provider:** `packages/client/agentkit.mjs`
- **Guide:** [AGENTKIT.md](./AGENTKIT.md)
- **Supported Tools:** `whp_standing_ping` (0.10 USDC), `whp_standing_audit` (2.00 USDC), `whp_standing_circuit_breaker`

## CI/CD Pipeline Gate & Badge

Automate epistemic standing audits on every pull request or deployment:

- **Marketplace Action:** `uses: wheelerhubbell/standing-gate@v0.1.1` (or `@v0`)
- **Autonomous Sentinel:** `node sentinel.mjs`
- **Guide:** [CI_CD.md](./CI_CD.md)
- **Badge:**
  ```markdown
  [![Standing Audit](https://img.shields.io/badge/standing--mark-verified-blue?style=flat-square)](https://standing-guard-service.lovable.app)
  ```
