# Verifying legacy front-door and EPT records

The five ordinary doors now return admitted `WHP-STANDING-MARK-v2` or `WHP-STANDING-ASSESSMENT-v2` envelopes. They do not return the legacy `WHP-FRONTDOOR-EVALUATION-v1` format documented here.

`verify_frontdoor.py` checks historical front-door records with envelope `{record, record_hash, signature}`. `record_hash` is SHA256 of canonical JSON (sorted keys, no whitespace, UTF-8); the Ed25519 signature covers those same bytes. The fields `public_key_b64url` and `value_b64url` are base64url. The matching current legacy/EPT signing key is advertised at `GET https://standing-guard-service.lovable.app/v1/ept/core`, under `signer.public_key_b64url`. `--offline` skips the live key comparison. Signature verification does not prove payment finality or present standing.

    pip install cryptography
    python3 verify_frontdoor.py examples/frontdoor-selftest.json

`/v1/ept/core` is an EPT asset delivery door, with a `WHP-EPT-ASSET-v1` record. It is not an ordinary evaluation or a sealed Mark. The script above only accepts the historical front-door evaluation type.

For ordinary v2 results, follow `GET /v1/evaluate`, its `verification` metadata and `/v1/ordinary/admission.json`. The ordinary verifier currently needs its companion modules; it is not a standalone Python verifier. Obtain the required proof packet rather than substituting the legacy verifier.

For sealed protocol Marks, use `/v1/verification` and the exact content-addressed verifier bound by the Mark. Immutable historical verifier bytes remain unchanged.

For free demonstrations, use `/v1/beacon/demo` discovery and its exact SHA256-pinned Python verifier. The demo uses a separate derived key. Do not substitute the legacy/EPT key or ordinary issuer key. A key advertised by a service does not by itself establish institutional trust.
