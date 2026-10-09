# Coinbase AgentKit Integration for WHP Standing

Empower autonomous AI agents running on Coinbase AgentKit and Base (`eip155:8453`) to verify claims, pay for audits autonomously via x402 gasless USDC, and use Standing Witness as a pre-execution safety gate.

## Installation

```bash
npm install @wheelerhubbell/standing-client
```

## AgentKit Action Provider Setup

```typescript
import { AgentRuntime } from "@coinbase/agentkit";
import { WHPStandingActionProvider } from "./packages/client/agentkit.mjs";

const standingProvider = new WHPStandingActionProvider({
  origin: "https://standing-guard-service.lovable.app"
});

// Register actions with AgentKit
const actions = standingProvider.getActions();
```

## Autonomous Agent Tools Exposed

1. `whp_standing_ping` (0.10 USDC): Micro-check for immediate factual/structural validation.
2. `whp_standing_audit` (2.00 USDC): Formal structural audit against Elemental Properties of True schema.
3. `whp_standing_circuit_breaker`: Autonomous safety gate that halts high-risk tool execution if the standing mark fails verification.
