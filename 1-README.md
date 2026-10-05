# @wheelerhubbell/whp-standing-client

> **Fail-closed epistemic standing middleware for autonomous AI agents.**  
> Governed by the Authority Conservation Principle: **$A(c) \le P(c)$** (Authority cannot exceed provenance).

Standing detects and stops **Coherent Substitution**—when an AI agent silently replaces the assigned task with an adjacent one ($q \to q^*$), reasons coherently about the replacement, and executes unauthorized state mutations.

---

## 📚 Case Studies & Theory

- **[Coherent Substitution (v1.1)](./COHERENT_SUBSTITUTION.md):** Theoretical formulation of proposition integrity and why systems fail before their reasoning becomes wrong.
- **[Mata v. Avianca Epistemic Autopsy](./MATA_V_AVIANCA_AUTOPSY.md):** Controlled forensic breakdown showing how an agent citing 100% verified sources still fails by answering the wrong question ($Q_0 \to Q_1$).

---

## ⚡ 1-Line Middleware Integration

Install the package:

```bash
npm install @wheelerhubbell/whp-standing-client
```

Place `guardAction` immediately before tool execution:

```javascript
import { guardAction } from '@wheelerhubbell/whp-standing-client';

// Before any agent tool runs:
await guardAction(toolCall, {
  standing: executionContext.standing
});

// Proceed only if standing is warranted
return await tool.execute(toolCall.arguments);
```

If an agent attempts a state-changing operation (file deletion, database write, API mutation) without attributable upstream authorization or provenance, `guardAction` throws a `StandingViolationError` before the boundary is crossed.

---

## 🔍 Observability: `evaluateStanding`

For inspection without throwing:

```javascript
import { evaluateStanding } from '@wheelerhubbell/whp-standing-client';

const decision = await evaluateStanding(toolCall, context);
if (!decision.allowed) {
  console.warn(`Blocked [${decision.code}]: ${decision.message}`);
  return decision;
}
```

### Diagnostic Decision Object

```json
{
  "allowed": false,
  "code": "MISSING_UPSTREAM_PROVENANCE",
  "actionId": "call_8cb2f1",
  "toolName": "delete_database_table",
  "required": ["authority", "provenance"],
  "observed": {
    "toolName": "delete_database_table",
    "arguments": { "table": "users" },
    "missing": ["provenance", "authority"]
  },
  "message": "Tool execution blocked for 'delete_database_table': no attributable upstream authorization or provenance."
}
```

---

## 🛡️ Core Semantics

- **Fail-Closed by Default:** Any state-changing action missing valid provenance or authority is rejected.
- **Authority Windows:** Bounded by `valid_until` timestamps.
- **Loop & Recursion Bounds:** Halts unbounded agent loops (`executionCount > maxExecutionCount`).
- **Zero Overhead for Reads:** Passive read operations execute without blocking.

---

## 🌐 Verifiable Network Verification

The live service has a plain front door for ordinary x402 agents: `POST /v1/evaluate` with `subject`, `claim` and optional `provenance`, priced at 1.00 USDC on Base (x402 v2). It returns a signed evaluation record. That record is not a sealed Standing Mark. Marks are issued through `POST /v1/evaluations`, which takes signed submissions per the published contract.

Example using the official x402 client (requires your own funded wallet and spending limits; not yet verified end to end against the live service):

```javascript
import { x402Client, wrapFetchWithPayment } from '@x402/fetch';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';

const client = new x402Client();
registerExactEvmScheme(client, { signer: privateKeyToAccount(process.env.EVM_PRIVATE_KEY) });
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const res = await fetchWithPayment('https://standing-guard-service.lovable.app/v1/evaluate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    subject: 'agent-session-42',
    claim: 'Agent executed system mutation',
    provenance: { source: 'user-intent', authority: 'admin' }
  })
});
console.log(await res.json());
```

Check the payment terms first with `GET /v1/contract`. The `StandingClient` class in this package does not sign or pay yet.

- **Live Service:** [https://standing-guard-service.lovable.app](https://standing-guard-service.lovable.app)
- **Discovery:** [/.well-known/x402](https://standing-guard-service.lovable.app/.well-known/x402)
- **Protocol:** x402-v2 / Base Network

---

## License

MIT © Wheeler Hubbell Publishing
