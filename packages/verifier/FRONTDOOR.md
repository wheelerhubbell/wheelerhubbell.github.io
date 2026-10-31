# Verifying front-door evaluation records

The ordinary front door is a single door, `POST https://api.wheelerhubbellpublishing.com/v1/evaluate`. It returns signed `WHP-FRONTDOOR-EVALUATION-v1` records. The earlier ordinary doors (`/v1/patch`, `/v1/audit`, `/v1/ping`, `/v1/evaluate/priority`, `/v1/ept/core`, `/v1/mock`, `/v1/credits`, the beacon doors and the `/v1/ordinary/*` discovery files) are retired: they are absent from the service's current published OpenAPI specification, and GET requests to them return 404 at the time of writing. Records issued under them remain verifiable as historical records.

`verify_frontdoor.py` checks front-door records with envelope `{record, record_hash, signature}`. `record_hash` is SHA256 of canonical JSON (sorted keys, no whitespace, UTF-8); the Ed25519 signature covers those same bytes. The fields `public_key_b64url` and `value_b64url` are base64url. Signature verification does not prove payment finality or present standing.

    pip install cryptography
    python3 verify_frontdoor.py examples/frontdoor-selftest.json

Unless `--offline` is given, the script also compares the record's signing key with the issuer key the service advertises now at `GET /v1/verification` (`authoritative_public_key`) and `GET /v1/evaluate` (`signer`). Issuer keys rotate. A historical record signed under a retired key still verifies its hash and signature while `key_matches_service` is false; that is expected, not a failure of the record. A key advertised by a service does not by itself establish institutional trust.

For sealed protocol Marks, use `/v1/verification` and the exact content-addressed verifier bound by each Mark's signed profile authorization. Historical v1-generation verifier bytes remain available unchanged; the current v2 generation names its own verifier by hash. Do not substitute the front-door issuer key for a sealed-Mark root, or one generation's verifier for another's.
