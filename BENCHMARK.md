# The Invisible Repair Problem: Human–AI Integrity Audit & Benchmark

**Published by Wheeler Hubbell Publishing (WHP)**  
*Protocol Version: 1.0*  
*Standard: Decision Integrity & Standing Verification*

---

## Executive Summary

> **Governing Proposition:**  
> *"A successful-looking AI output may be partly constituted by invisible human repair."*

In modern AI agent deployments, autonomous workflows frequently appear reliable only because unseen human interventions—re-prompting, selective context pruning, and manual error correction—mask underlying model drift and ungrounded decision paths.

When agents are set to operate autonomously across multi-step API chains, financial micro-settlements, and sovereign publishing pipelines, **there is no human in the loop to supply invisible repair.** 

Without unbroken provenance, authority assertion, and formal verification, autonomous outputs face silent execution collapse downstream.

---

## The Integrity Gap: Why Agent Benchmarks Fail

Current evaluation benchmarks (MMLU, HumanEval, SWE-bench) test isolated capability under synthetic conditions. They fail to measure **decision integrity over longitudinal execution**.

| Failure Mode | Standard Agent Behavior | What Standing Witness Verifies |
| :--- | :--- | :--- |
| **Authority Drift** | Agent hallucinates permission based on conversational momentum. | Verifies cryptographic token or explicit authority assertion before execution. |
| **Context Mutation** | Mid-chain state drift alters initial constraints without notice. | Evaluates full task contract and source-object integrity hashes. |
| **Unaccountable Action** | Downstream system receives an unverifiable JSON payload. | Delivers a signed, tamper-evident **Standing Receipt** certifying validity. |

---

## The Protocol: Evaluating Agent Standing

The **WHP Decision Integrity Protocol (DIP)** formalizes integrity checking through three machine-to-machine stages:

```
[Agent Action Proposed]
         │
         ▼
[1. Contract Check: /v1/contract] ──► Reads active evaluation requirements & fee (x402)
         │
         ▼
[2. Standing Evaluation: /v1/evaluate] ──► Submits authority assertion, task contract & checksum
         │
         ▼
[3. Verifiable Receipt: /v1/result/{id}] ──► Authoritative Standing Proof issued to downstream caller
```

---

## How to Test Your Agent Against the Benchmark

Autonomous agents running in Claude Desktop, Cursor, Goose, or custom LangChain/AutoGen loops can integrate the Standing Witness verification suite via MCP in seconds:

### MCP Configuration (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "whp-standing": {
      "command": "npx",
      "args": ["-y", "@wheelerhubbell/standing-client"]
    }
  }
}
```

### Direct Programmatic Verification (Node.js SDK)

```javascript
import { StandingClient } from '@wheelerhubbell/standing-client';

const client = new StandingClient();

// 1. Submit an agent decision for standing evaluation
const evaluation = await client.evaluate({
  subject_id: "agent-session-8821",
  authority_assertion: "sovereign-execution-token-v1",
  decision_payload: {
    action: "execute_sovereign_transaction",
    target: "0x1050eddd8282623b0c263ed6bdbd42370bbc28d3",
    payload_sha256: "3e6389bb671c74ab64b49e7fb4c2e51a336064c730dadb14d91e6733145cb918"
  }
});

console.log("Standing Receipt:", evaluation);
```

---

## Registry & Verification Endpoints

- **Live Service Endpoint:** `https://standing-guard-service.lovable.app`
- **MCP Route:** `https://standing-guard-service.lovable.app/mcp`
- **Machine Discovery (llms.txt):** `https://standing-guard-service.lovable.app/llms.txt`
- **Public Client Repository:** [github.com/wheelerhubbell/whp-standing-client](https://github.com/wheelerhubbell/whp-standing-client)

---

*© 2026 Wheeler Hubbell Publishing. All rights reserved. Decision Integrity Protocol and Standing Witness are protected marks and frameworks.*
