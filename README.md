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

## Historical worked example: genesis self-test

[`examples/examples/genesis-selftest.mark.json`](examples/examples/genesis-selftest.mark.json) is the original signed receipt for the publisher's own self-test, not an outside customer's purchase. It contains the submitted provenance, payment terms and authorization, signed assessment, and settlement evidence.

Base transaction: `0x751f288ece3cc39081a6c3873665af5f0f441bf6c2751374a95a1c40e6ccafdf`, block `52220195`, 1.000000 USDC. Check the transaction independently on Base.

For reproduction, the operator-supplied root pin is:

```
c9507f2c5d0d80935a4885071c8372eeba25010e514e81401acabb246134bff6
```

This pin is a declared trust assumption, not proof that the issuer has institutional authority. A reader must independently decide whether to admit that root.

```
python3 verify_mark.py examples/examples/genesis-selftest.mark.json --root-pin c9507f2c5d0d80935a4885071c8372eeba25010e514e81401acabb246134bff6
```

With that explicit pin, the historical example verifies its cryptographic integrity and evaluator replay. This command does not check current standing or independently recheck the chain.

The example's validity ended on October 6, 2026 at 01:00 UTC (October 5 at 9:00 PM New York). Expiry is expected: historical signatures and replay can still verify while current standing is EXPIRED. Current standing needs a fresh signed registry snapshot, not yesterday's cached state. Resolve the current service through the Mark's `discovery.resolution_url`, then fetch that resolution's registry template for this purchase ID. Supply them with `--resolution` and `--registry`; optionally use `--rpc` with your own trusted Base HTTPS RPC to recheck settlement.

This example does not prove an outside buyer, ordinary-wallet completion on `/v1/evaluate`, current active standing, or commercial adoption. No free-tier endpoint is implied.
