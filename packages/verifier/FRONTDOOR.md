# Verifying front-door records

The paid doors (/v1/evaluate, /v1/patch, /v1/audit, /v1/ping, /v1/ept/core) return a **signed standing record**
(`type: WHP-FRONTDOOR-EVALUATION-v1`, `not_sealed_mark: true`). It is not a sealed WHP Standing Mark.
`verify_mark.py` is for sealed Marks only and rejects these records.

Envelope: `{record, record_hash, signature}`.

- `record_hash` = sha256 hex of the canonical record (JSON, sorted keys, no whitespace, UTF-8).
- `signature` = Ed25519 over those same canonical bytes. `public_key_b64url` and `value_b64url` are base64url.
- The service advertises its current front-door signing key at `GET /v1/evaluate` (and the other door paths) under `signer.public_key_b64url`.

Run:

    pip install cryptography
    python3 verify_frontdoor.py examples/frontdoor-selftest.json

The script checks the hash, the signature, and that the signing key equals the one the service advertises now
(`--offline` skips that last check). It does not check payment finality or current standing.
