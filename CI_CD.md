# Standing Gate CI/CD Infrastructure

Fail-closed epistemic audit and provenance verification for automated workflows, pull requests, and autonomous agent pipelines moving $100k–$1M+ in consequential value.

Standing Gate is an autonomous Decision Integrity circuit breaker: it evaluates claims, authority bounds, and evidence against Wheeler Hubbell Publishing's sovereign epistemic reasoning engine.

---

## Quick Start (GitHub Action)

Add Standing Gate to your `.github/workflows/gate.yml` to gate deployments and pull requests:

```yaml
name: Decision Integrity Gate
on: [pull_request, push]

jobs:
  epistemic-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: wheelerhubbell/standing-gate@v0
        with:
          api_key: ${{ secrets.WHP_API_KEY }}
          subject: "${{ github.repository }}@${{ github.sha }}"
          claim: "All exported APIs and deployment operations preserve failure bounds and required qualifiers"
          buyer_key: ${{ secrets.WHP_BUYER_KEY }}
        env:
          WHP_API_KEY: ${{ secrets.WHP_API_KEY }}
          WHP_BUYER_KEY: ${{ secrets.WHP_BUYER_KEY }}
```

---

## Ingress & Authentication Rails

1. **Commercial Subscription Rails (CI/CD Teams & Enterprise Pipelines):**
   - **Developer Sentinel:** $149/mo (200 evaluations/mo)
   - **Team CI/CD Gateway:** $699/mo (1,000 evaluations/mo)
   - **Institutional Sovereign:** $3,500/mo (6,000 evaluations/mo & critical governance)
   - Authenticates directly via provisioned API key (`WHP_API_KEY`).
2. **Autonomous M2M Micropayment Rail (Agent-to-Agent):**
   - 1 Base USDC per evaluation via HTTP 402 challenge, EIP-3009 transfer authorization, and keyless facilitator settlement (`0x1050eddd8282623b0c263ed6bdbd42370bbc28d3` / `whpublishing.base.eth`).
   - Authenticates dynamically using `WHP_BUYER_KEY`.

---

## Epistemic Decision Boundary

Payment purchases deterministic evaluation under published Decision Integrity rules, **never an unearned favorable outcome**. An agent or pipeline cannot purchase a Standing Mark; it purchases the evaluation. If the claim exceeds admissible evidence, leaks authority, strips qualifiers, or substitutes objects, the engine fails closed with exit code 1 and halts the pipeline before execution.
