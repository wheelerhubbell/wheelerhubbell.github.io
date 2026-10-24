# Wheeler Hubbell Publishing

> **Where formal epistemology, published literature, and autonomous Decision Integrity meet.**
> Home of the published works, the canonical research preprints, and the machine-verifiable Standing Witness protocol for AI agents and CI/CD pipelines.

[![MCP Server](https://img.shields.io/badge/MCP-Compatible-blue)](https://api.wheelerhubbellpublishing.com/mcp)
[![x402 Payment](https://img.shields.io/badge/x402-USDC%20on%20Base-green)](https://api.wheelerhubbellpublishing.com/v1/contract)
[![npm](https://img.shields.io/badge/npm-%40wheelerhubbell%2Fwhp--standing--client-red)](https://github.com/wheelerhubbell/wheelerhubbell.github.io/tree/main/packages/client)
[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Standing%20Gate-blue?logo=github)](https://github.com/marketplace/actions/standing-gate)

## Unified Service Architecture

Wheeler Hubbell Publishing is one service ecosystem with four complementary layers:

- Public identity and research layer: `wheelerhubbell.github.io`
  - canonical publishing site
  - standards, research, API discovery, examples, attestations

- Runtime / standing engine: `wheelerhubbell/standing-gate`
  - live evaluation engine
  - CI/CD action
  - claim and evidence verification
  - MCP and API integration

- Enforcement template layer: `wheelerhubbell/whp-sentinel-template`
  - ready-to-use repo integration
  - decision integrity guardrails for automation and deployment

- Agent tooling layer: `wheelerhubbell/agentkit`
  - agent-wallet and agent-runtime helpers
  - operational integration for autonomous systems

This structure creates one coherent product:

```
Wheeler Hubbell Publishing
├── Public narrative and standards        (wheelerhubbell.github.io)
├── Standing Mark service runtime          (standing-gate)
├── Default enforcement template           (whp-sentinel-template)
└── Agent/tooling integration layer        (agentkit)
```

The public site explains the theory and protocol. The runtime performs the verification. The template makes adoption easy. The tooling integrates the service into autonomous workflows.

To be clear: these repositories are not competing systems. They are the same service expressed in different operational layers.

---

Wheeler Hubbell Publishing is an independent publishing house and research imprint. It produces foundational books, dramatic texts, and philosophical preprints (*Constitutional Continuity Theory*, *Before Certainty*, *Room Without a View*, etc.) and simultaneously operates the canonical machine-verifiable Standing Witness protocol for AI agents and CI/CD pipelines.

---

## Autonomous Agent & A2A Infrastructure

Autonomous AI agents operating in agent-to-agent (A2A) economic networks require **epistemic guardrails** to prevent hallucinations, counterfeit provenance, and catastrophic action on baseless assertions.

### What Wheeler Hubbell Publishing Standing Is

Wheeler Hubbell Publishing operates a formal **Epistemic Reasoning Environment** for autonomous agents and machine pipelines. It evaluates whether an agent's assertions, inferences, qualifiers, and action requests have sufficient grounding to be accepted as trustworthy.

- **Qualifier Protection:** Ensures that the conditions and boundaries making a statement valid are not dropped as information flows between agents.
- **Force Non-Escalation:** Prevents weak inferences or speculative hypotheses from being promoted to settled fact or authorization.
- **Evidentiary Standard:** Enforces strict correspondence between the claimed scope and the admitted proof.

### What Wheeler Hubbell Publishing Standing Is NOT

- **Not a Notary Public:** WHP does not blindly stamp, notarize, or timestamp uninspected text or arbitrary document hashes.
- **Not an Oracle or Universal Truth Arbiter:** WHP does not claim omniscient access to external physical reality or arbitrate whether outside events happened. It evaluates inferential and evidentiary standing under defined constraints.
- **Not a Simulation or Facade:** Live evaluations produce signed cryptographic records under published invariants and settle through real economic rails.

### 1. Model Context Protocol (MCP)

Connect any agent (Claude Desktop, Cursor, Lovable, LangChain, AutoGen) to the live Standing Witness:

```json
{
  "mcpServers": {
    "whp-standing": {
      "command": "npx",
      "args": ["-y", "@smithery/cli", "run", "@wheelerhubbell/whp-standing-client", "--config", "{\"endpoint\":\"https://api.wheelerhubbellpublishing.com/mcp\"}"]
    }
  }
}
```

Or connect directly to the Streamable HTTP endpoint:
`https://api.wheelerhubbellpublishing.com/mcp`

### 2. Pre-Flight Structural Checks (Zero-Cost for Introspection)

Agents can test schemas and verify structural completeness before committing funds:

- **Structural Validation Check**: `POST https://api.wheelerhubbellpublishing.com/v1/mock` (validates schema structure and required fields)
- **Pre-Flight Ping**: `POST https://api.wheelerhubbellpublishing.com/v1/ping` with header `X-Mock: true`
- **Execution Gap Probe**: `POST https://api.wheelerhubbellpublishing.com/v1/gap/check` (demonstrates where unverified claims halt execution before `EXECUTE` actions)

### 3. Machine-to-Machine Epistemic Tiers (x402 v2 on Base)

When a live, cryptographically signed standing record or sealed Mark is required, agents and automated pipelines self-settle using **x402** via gasless EIP-3009 `TransferWithAuthorization` in USDC on Base.

#### Canonical Epistemic Tiers

The service names tiers by the **epistemic object and scope of work**, not by technical submission routes. The same reasoning engine applies the identical evidentiary standard at every tier; fee reflects workload difference.

| Tier Name | Price | Epistemic Scope | Route / Contract |
| :--- | :--- | :--- | :--- |
| **Proposition** | 0.10 USDC | One atomic assertion, bounded question, or standalone tool output. | `POST /v1/ping` |
| **Claim** | 1.00 USDC | A structured claim with qualifiers, standing, temporal bounds, and supporting evidence. | `POST /v1/evaluate` |
| **Qualification Update** | 1.00 USDC | A change to an existing claim's scope, qualifications, or temporal standing, evaluated against the existing record. | `POST /v1/patch` |
| **Evidence Graph** | 2.00 USDC | Interdependent claims, multiple sources, actors, authorities, and transitions between states. | `POST /v1/audit` |
| **Dossier** | Quote-based | An extensive document corpus or interconnected body of evidence requiring comprehensive evaluation. | `POST /v1/evaluations` |

#### The Decision Integrity Pricing Invariant

1. **Workload-Determined**: The fee is determined strictly by the volume, structure, and epistemic scope of the submitted material and the computational work required to evaluate it.
2. **Outcome-Independent**: The fee is independent of the evaluation outcome.
3. **No Purchased Verdicts**: Payment purchases an evaluation under published rules. It does not purchase a favorable Mark, an `ESTABLISHED` result, or a predetermined conclusion.
4. **Uniform Evidentiary Standard**: A Proposition and a Dossier differ in scope, but neither gets a more permissive evidentiary threshold because of price.

---

## 📡 The Summoning Beacon (Proactive Machine Waking)

Rather than waiting passively for agents to query the service, the **Summoning Beacon** actively pings and summons autonomous machines:
- **Active Webhook Knock:** Dispatch direct challenge payloads (`WHP-SUMMON-BEACON-v1`) to agent webhooks to force immediate epistemic evaluation.
- **Heartbeat & Challenge Stream:** SSE endpoint (`GET /v1/beacon/stream`) streaming real-time heartbeat pulses and challenges to listening worker bots.
- **Onchain Summoning Contract:** `contracts/StandingBeacon.sol` on Base emits indexed `AgentSummoned` events with attached bounties.
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
- **Live Capability Resolution**: [`/.well-known/standing-capability.json`](https://api.wheelerhubbellpublishing.com/.well-known/standing-capability.json)

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
Fail-closed middleware for LangChain, OpenAI function calling, and MCP tools. Intercepts irrevocable tool invocations and halts execution if upstream authority or qualification protection is missing.
* Guide: [CIRCUIT_BREAKER.md](./CIRCUIT_BREAKER.md)

### 2. Proof-of-Standing Escrow Condition
Turn WHP Standing Marks into algorithmic escrow release conditions for autonomous agent swarms. Funds in escrow disburse only when tasks present valid, signed standing records meeting invariant conditions.
* Specification: [ESCROW.md](./ESCROW.md)
* Smart Contract: [`contracts/StandingEscrow.sol`](./contracts/StandingEscrow.sol)

## Coinbase AgentKit & Autonomous Agents

Equip autonomous agents running on Base (`eip155:8453`) with pre-execution safety gates and epistemic verification:

- **Action Provider:** `packages/client/agentkit.mjs`
- **Guide:** [AGENTKIT.md](./AGENTKIT.md)
- **Supported Tools:** `whp_standing_ping`, `whp_standing_audit`, `whp_standing_circuit_breaker`

## CI/CD Pipeline Gate & Badge

Automate epistemic standing audits on every pull request or deployment:

- **Marketplace Action:** `uses: wheelerhubbell/standing-gate@v0.1.1` (or `@v0`)
- **Guide:** [CI_CD.md](./CI_CD.md)
- **Badge:**
  ```markdown
  [![Standing Audit](https://img.shields.io/badge/standing--mark-verified-blue?style=flat-square)](https://api.wheelerhubbellpublishing.com)
  ```
