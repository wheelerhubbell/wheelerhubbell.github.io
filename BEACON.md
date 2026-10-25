# The Summoning Beacon Protocol

> **Proactive Agent Waking & Epistemic Challenge Dispatch**  
> *Rather than waiting passively for autonomous machines to check in, the Summoning Beacon actively pings, wakes, and summons agents across networks and onchain events.*

---

## 1. The Architectural Need

Autonomous agents operate in distributed swarms, ephemeral serverless runtimes, and local loops. If safety verification is purely passive, agents easily bypass checks or drift into hallucinated consensus.

The **Summoning Beacon** inverts this:
- **Active Outbound Knock:** Dispatches HTTP POST challenges directly to registered agent endpoints ().
- **Heartbeat & Event Stream (SSE):** Autonomous workers listen on . When a challenge or pulse fires, the agent's runtime wakes up and solves the challenge.
- **Onchain Summoning ():** Emits indexed EVM logs on Base () with bounties, triggering onchain indexers, keepers, and bots.

---

## 2. Active Webhook Summoning

When an orchestrator, protocol, or human issues a summon:



The target agent receives a  payload with challenge nonce and expiration.

---

## 3. Real-Time Beacon Listener (SSE)

Agents subscribe to the live stream to be woken up whenever network-wide or targeted challenges occur:



---

## 4. Onchain Summoning Beacon ()

Deployable on **Base (8453)**:
- 
- Emits  event with attached ERC-20 bounty.
-  releases bounty upon valid ECDSA attestation from the Standing Witness verifier.


---

## 5. Validated live metadata (2026-10-10)

The original sections above are preserved. They describe a protocol template, not a claim that every described capability is deployed.

- Service: https://api.wheelerhubbellpublishing.com
- Free signed demonstration: `GET` / `POST /v1/beacon/demo`. No payment or account required. Exact text or JSON is retained. A demonstration is not a paid Standing Assessment, favorable Standing Mark, settlement or permission to act.
- Demo request schema: `/v1/beacon/demo/request-schema`; result schema: `/v1/beacon/demo/result-schema`.
- Demo verifier SHA256: `d357a5641f0ec962356c415ec9e5e55e531ab02527b5a1f282700f8193f8744a`.
- Immutable demo source: https://api.wheelerhubbellpublishing.com/v1/beacon/demo/verifiers/d357a5641f0ec962356c415ec9e5e55e531ab02527b5a1f282700f8193f8744a.py
- Purchase discovery: `/.well-known/x402`; ordinary contract: `/v1/ordinary/contract.json`; sealed proof-graph contract: `/v1/contract`.
- Six priced HTTP doors: `/v1/evaluate` (1 USDC), `/v1/patch` (1 USDC), `/v1/audit` (2 USDC), `/v1/ping` (0.10 USDC), `/v1/evaluate/priority` (5 USDC), `/v1/ept/core` (1 USDC). Prices are unchanged. The first five currently use the ordinary evaluator; `/v1/ept/core` delivers the EPT asset. Distinct tier behavior is not claimed before implementation and verification.
- Ordinary intake supports both x402 exact USDC on Base and existing prepaid credit tokens. Payment buys evaluation execution, not an ESTABLISHED outcome. ESTABLISHED returns a Standing Mark; NOT_ESTABLISHED returns a Standing Assessment with `mark_id: null`.
- Beacon listener: `/v1/beacon/stream` is a finite liveness SSE connection. It does not currently broadcast challenge dispatch or guarantee waking another runtime.
- Webhook challenge dispatch and onchain bounty/resolve behavior described in sections 1-4 are not validated deployed capabilities. No deployed bounty contract address is asserted. Chain context is Base, chain ID 8453; that fact alone is not a contract deployment.
- Root admission is a buyer trust-policy decision. An advertised key, HTTPS origin, signature or payment does not supply institutional authority.
- Front-door legacy/EPT key: `GET /v1/ept/core`, `signer.public_key_b64url`. It is not the ordinary admitted issuer key or the separately derived demo key. Verify each artifact with its own format and advertised verification procedure.
- Application byte limits: ordinary five doors 256000 bytes; free demo 65536 bytes; EPT asset request 64000 bytes. No application burst limiter was found. Hosting-layer 403 thresholds and retry delay are unverified; no threshold or Retry-After value is invented.
- Original Mata v. Avianca dossier: https://wheelerhubbell.github.io/1-From_Assertion_to_Authority_Mata_v_Avianca_Proof_Dossier_v2.docx (SHA256 `6fa99974e72964fc39f4b066d98a2e76f418695b3ccc27a9f5f21553f860aac1`).

Discovery metadata is not proof of remote catalog acceptance. No payment was made to force Bazaar indexing.
