# Epistemic Circuit Breakers for Irrevocable Tool Execution

Autonomous agents with tool-calling capabilities (OpenAI Function Calling, Anthropic Tools, LangChain, MCP, ElizaOS) pose critical risks when invoking destructive or financial actions:
* Submitting wire transfers or token swaps
* Dropping database tables or overwriting files
* Sending live external communications

Prompt-based guardrails often fail under adversarial pressure or hallucinated chain-of-thought.

The **Epistemic Circuit Breaker** enforces the invariant:
$$\text{Authority}(c) \le \text{Provenance}(c)$$
If an agent cannot prove upstream authority for an irrevocable tool call, execution **fails closed** before the boundary is crossed.

---

## Quickstart (TypeScript)

```javascript
import { createEpistemicCircuitBreaker } from '@wheelerhubbell/whp-standing-client';

// Wrap any sensitive tool
const safeWireTransfer = createEpistemicCircuitBreaker(async (args) => {
  return await bankApi.wire(args.to, args.amount);
}, {
  name: 'wireTransfer',
  mode: 'mock', // Tests payload against live free mock before execution
  isDestructive: true
});

// Invocation without verifiable provenance throws StandingViolationError immediately
try {
  await safeWireTransfer({ to: "0x123", amount: 1000 }, {
    authority: "Alice (Finance VP)",
    provenance: {
      source: "slack://finance-approvals/123",
      authority: "Alice (Finance VP)",
      evidence: ["msg_hash_abc"]
    }
  });
} catch (err) {
  console.error("Action blocked by Epistemic Circuit Breaker:", err.message);
}
```

---

## Quickstart (Python)

```python
from whp_standing_client import with_epistemic_circuit_breaker, CircuitBreakerTripped

@with_epistemic_circuit_breaker(name="execute_trade", mode="mock")
def execute_trade(pair, amount, context=None):
    # Execution happens only if provenance invariants pass
    return broker.submit_order(pair, amount)
```
