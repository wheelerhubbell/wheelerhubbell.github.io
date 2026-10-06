# WHP Standing verifier

Independent verifier for WHP Standing v1. This repository contains only the standalone Python verifier and its dependency pins, not the service engine.

## Check the source

`verify_mark.py` is published byte-for-byte from the source identified by the live service's signed profile authorization. Expected SHA-256:

```
bb8cb78205f1892dcbf00d845cf85e504a0efacf2a0d8a793313fa8c0e99b833
```

Verify the file hash before running it. The verifier checks its own source hash against the authorization supplied with a Mark. A hash match establishes byte identity, not endorsement of code or admission of a trust root.

## Run

Python 3.11 or later. Install the pinned dependencies in an isolated environment:

```
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
sha256sum verify_mark.py
python3 verify_mark.py mark.json --root-pin YOUR_ADMITTED_ROOT_SHA256 --registry registry.json
```

Use the exact original UTF-8 Mark bytes, not reserialized JSON. Supply a fresh signed registry snapshot and an independently admitted SHA-256 pin of the root Ed25519 SPKI DER. Do not substitute a payment address or accept an embedded root as trust.

Run downloaded verifier code in a no-network, read-only, least-privilege sandbox. For a separate chain settlement recheck, `--rpc` takes an independently trusted HTTPS Base RPC; that check needs network access. Test-environment verification requires the explicit `--allow-test` flag.

The verifier embeds its wire schemas and imports no producer modules. Cryptographic integrity, current registry standing, and chain settlement are separate outputs. Outside-buyer relationships and commercial adoption are not established by this verifier.

## Source and scope

Ratified source: https://standing-guard-service.lovable.app/verification/bb8cb78205f1892dcbf00d845cf85e504a0efacf2a0d8a793313fa8c0e99b833.py

Service verification information: https://standing-guard-service.lovable.app/v1/verification

No engine files, keys, payment authorizations, customer records, or private repository history are included. Publication does not add a software license or grant broader rights.
