# Epistemic Circuit Breakers for Irrevocable Tool Execution

Autonomous agents with tool-calling capabilities (OpenAI Function Calling, Anthropic Claude Tools, LangChain, MCP, ElizaOS, CrewAI) pose critical risks when invoking destructive, financial, or governance actions:
* Submitting wire transfers, smart contract calls, or token swaps moving $100k–$1M+
* Merging pull requests, altering production databases, or deploying infrastructure
* Signing or executing legal, settlement, or commercial agreements

Prompt-based guardrails fail under adversarial pressure, prompt injection, or hallucinated chain-of-thought.

The **Epistemic Circuit Breaker** enforces the invariant from *Decision Integrity: The Continuous Work*:
$$\\text{Authority}(c) \\le \\text{Provenance}(c)$$
If an agent cannot prove upstream authority and unbroken provenance for an irrevocable tool call, execution **fails closed** before the boundary is crossed.

---

## 1. Agent Swarm Ingress via Model Context Protocol (MCP)

Connect any autonomous agent directly to the sovereign circuit breaker via the native streamable MCP endpoint:

```json
{
  "mcpServers": {
    "whp-standing-witness": {
      "url": "https://api.wheelerhubbellpublishing.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_WHP_API_KEY"
      }
    }
  }
}
```

The agent invokes the `whp_evaluate` tool before executing any high-consequence action.

---

## 2. In-Code Epistemic Gate (TypeScript / Node.js)

```typescript
interface ActionContext {
  action: string;
  amount?: string | number;
  recipient?: string;
  authorityProof: string;
}

export async function assertEpistemicPassage(ctx: ActionContext): Promise<string> {
  const res = await fetch("https://api.wheelerhubbellpublishing.com/v1/evaluate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.WHP_API_KEY}`
    },
    body: JSON.stringify({
      subject: ctx.action,
      claim: `Executing ${ctx.action} warranted by ${ctx.authorityProof}`,
      provenance: {
        source: "agent-swarm-orchestrator",
        authority: ctx.authorityProof,
        timestamp: new Date().toISOString()
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Epistemic Circuit Breaker tripped: HTTP ${res.status}`);
  }

  const mark = await res.json();
  const outcome = mark.record?.determination?.outcome || mark.payload?.decision_record?.outcome;
  
  const positive = ["ACCEPTED", "ESTABLISHED", "BOUNDED_DETERMINATION", "RECOGNIZED WITH BOUNDARIES"];
  if (!positive.includes(outcome)) {
    throw new Error(`Irrevocable execution denied: Standing outcome is ${outcome}`);
  }

  return mark.record_hash || mark.payload?.decision_record_ref;
}
```

---

## 3. Autonomous M2M Rail (1 Base USDC Keyless Execution)

For sovereign agents operating without human subscription keys:
1. Agent hits `POST /v1/evaluate`
2. Service responds with `HTTP 402 Payment Required` detailing the exact Base USDC parameters (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` on `eip155:8453` to `0x1050eddd8282623b0c263ed6bdbd42370bbc28d3`)
3. Agent signs EIP-3009 `TransferWithAuthorization` with its local private key
4. Agent retries with `PAYMENT-SIGNATURE` header; transaction settles on Base and returns the cryptographically signed Standing Mark.
