# WHP Standing Witness Client & MCP Adapter

[![Smithery Badge](https://smithery.ai/badge/@wheelerhubbell/whp-standing)](https://smithery.ai/servers/@wheelerhubbell/whp-standing)

Official client interface and MCP adapter for **Wheeler Hubbell Publishing (WHP) Standing Witness**.

Standing Witness provides authoritative, machine-to-machine Decision Integrity Protocols (DIP) and Standing evaluation for autonomous AI agents, automated workflows, and sovereign publishing pipelines.

---

## What is Standing Witness?

Autonomous agents face a trust and authority problem: how can a downstream system or human trust that an agent's output had legitimate authority, unbroken provenance, and valid standing?

Standing Witness answers this by evaluating and issuing signed standing receipts over autonomous actions and outputs.

- **MCP Tools**: Full Model Context Protocol compatibility for Claude Desktop, Cursor, Goose, and autonomous agent loops.
- **Micro-settlement Ready**: Native machine-to-machine payment via x402 protocol (Base USDC).
- **Zero-knowledge Authority**: The engine evaluates standing autonomously without exposing internal private weights.

---

## Quickstart (Claude Desktop / Cursor MCP)

Add the following to your MCP configuration (`claude_desktop_config.json` or your MCP client's settings):

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

Or connect directly via Server-Sent Events (SSE) / HTTP:

```
https://standing-guard-service.lovable.app/mcp
```

---

## Available MCP Tools

Once connected, your agent has access to:

1. `whp_standing_contract`
   - Read active terms, required headers, payment details (x402 / Base USDC), and pricing.
2. `whp_standing_evaluation`
   - Submit an artifact or decision payload for standing verification.
   - Evaluates whether the asserted authority supports the proposed action.
3. `whp_standing_result`
   - Query or verify a previously issued standing receipt and verification hash.

---

## Programmatic Usage (Node.js SDK)

```javascript
import { StandingClient } from '@wheelerhubbell/standing-client';

const client = new StandingClient();

// 1. Get the current contract and requirements
const contract = await client.getContract();
console.log('Contract terms:', contract);

// 2. Submit an evaluation
const evaluation = await client.evaluate({
  subject_id: 'agent-run-10492',
  authority_assertion: 'autonomous-execution-token',
  decision_payload: {
    action: 'publish_artifact',
    checksum: 'sha256-a1b2c3...'
  }
});

console.log('Standing evaluation result:', evaluation);
```

---

## Registry & Directory Metadata

- **Protocol**: MCP (Model Context Protocol) 2024-11-05
- **Service Endpoint**: `https://standing-guard-service.lovable.app`
- **Catalog**: `https://standing-guard-service.lovable.app/.well-known/api-catalog`
- **LLM Discovery**: `https://standing-guard-service.lovable.app/llms.txt`
- **Publisher**: Wheeler Hubbell Publishing

---

## License

MIT © Wheeler Hubbell Publishing
