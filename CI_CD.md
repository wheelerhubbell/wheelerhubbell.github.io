# Standing Gate CI/CD Integration

Fail-closed epistemic audit and provenance verification for automated workflows, pull requests, and autonomous agent pipelines.

Standing Gate is an autonomous Decision Integrity circuit breaker: it evaluates claims, authority bounds, and evidence against Wheeler Hubbell Publishing's epistemic reasoning engine.

## Quick Start (GitHub Action)

Add the Standing Gate to your `.github/workflows/gate.yml` to gate pull requests:

```yaml
name: Decision Integrity Gate
on: [pull_request, push]

jobs:
  epistemic-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: wheelerhubbell/standing-gate@v0.1.2
        with:
          subject: "Project Core Invariants"
          claim: "All exported APIs preserve failure bounds and required qualifiers"
          source: "https://github.com/${{ github.repository }}"
          authority: "${{ github.repository }}@${{ github.sha }}"
```

## Adding the Badge to README

```markdown
[![Standing Gate](https://img.shields.io/badge/standing--gate-verified-blue?style=flat-square)](https://standing-guard-service.lovable.app)
```

## Operation Modes

1. **Pre-Flight Structural Check**: Zero cost. Verifies structural schema compliance, input completeness, and fail-closed readiness.
2. **Paid Determination (POST /v1/evaluate with x402 payment)**: Submits claim, authority, and provenance evidence to the live engine under the ordinary intake contract. The engine performs epistemic evaluation and produces an Ed25519-signed cryptographic record:
   - **ESTABLISHED** (Standing Mark): Admitted evidence strictly supports the bounded claim. Passes the gate.
   - **NOT_ESTABLISHED** (Standing Assessment): Claim exceeds evidence, authority is missing, or provenance is broken. Fails closed and halts the workflow.

## Decision Integrity Invariant

Payment purchases deterministic evaluation of the submitted workload, **never a favorable outcome**. An agent or pipeline cannot purchase a Standing Mark; it purchases the evaluation. If the claim is unsupported by admissible evidence, the engine signs a NOT_ESTABLISHED Assessment.
