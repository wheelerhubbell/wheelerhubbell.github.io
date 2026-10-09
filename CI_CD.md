# Standing Gate CI/CD Integration

Fail-closed epistemic audit and provenance verification for automated workflows and pull requests.

## Quick Start (GitHub Action)

Add the Standing Gate to your `.github/workflows/verify.yml` to gate pull requests:

```yaml
name: Standing Audit Gate

on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Verify Standing
        uses: wheelerhubbell/wheelerhubbell.github.io/.github/actions/standing-gate@main
        with:
          door: '/v1/audit'
          mock: 'true' # Set to 'false' with payment_signature for cryptographically signed determinations
          claim: 'Release candidate passes epistemic boundary audit'
```

## Adding the Badge to README

```markdown
[![Standing Audit](https://img.shields.io/badge/standing--mark-verified-blue?style=flat-square)](https://standing-guard-service.lovable.app)
```

## Production Modes

1. **Free Structural Check (`mock: true`)**: Zero cost, checks structural schema compliance and input legitimacy.
2. **Paid Determination (`door: /v1/audit` or `/v1/evaluate`)**: Signs an immutable `WHP-FRONTDOOR-EVALUATION-v1` record backed by Ed25519 signature valid for 30 days.
