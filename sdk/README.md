# WHP Standing integration source

Two sealed-contract clients are developed here. Neither is published from this commit. The TypeScript package source is `sdk/typescript`; the Python package source is `sdk/python`. Package metadata is a build target, not evidence of a registry release or reservation.

These clients support quote admission, buyer Ed25519 proof, owner-policy wallet authorization, exact-byte paid replay, and signer-free recovery. The wallet signer is supplied by the buyer. Owner approval and source authority remain prerequisites. Payment purchases assessment, including a negative assessment, not approval or an execution grant.

Full result replay is performed by the unchanged independently implemented Python verifier, pinned to the result's signed source hash and a caller-admitted root. It runs in a read-only, no-network Linux bubblewrap sandbox with a caller-prepared Python environment. It does not import SDK or producer modules. A successful historical replay alone does not establish fresh standing or payment-chain finality. The SDK offline runner reports finality as not rechecked and never enables network as a convenience fallback.

## Build/test without production keys or payments

From a clean clone of this public repository:

```sh
python3 -m venv /tmp/whp-verifier-runtime
/tmp/whp-verifier-runtime/bin/pip install -r requirements.txt
/tmp/whp-verifier-runtime/bin/pip install build hatchling 'eth-account>=0.13,<0.14'
export WHP_PUBLIC_CHECKOUT="$PWD"
export WHP_VERIFIER_RUNTIME=/tmp/whp-verifier-runtime
cd sdk/typescript
npm ci --ignore-scripts
npm test
npm pack
cd ../python
PYTHONPATH=src /tmp/whp-verifier-runtime/bin/python -m unittest discover -s tests -v
/tmp/whp-verifier-runtime/bin/python -m build
```

Requires Linux bubblewrap, Node >=22, and Python >=3.10. The verifier's documented supported Python target remains 3.11+. Tests here include synthetic keys and transport responses; those are not live sale evidence. Existing historical public fixture replay checks no current standing without a fresh registry.

## Boundaries

- Only public checkout contents may be used by SDK build/pack workflows. No private producer modules, private repository checkout, workspace links or private artifact fallback.
- Never edit the standalone verifier or immutable historical verifier artifacts to make an SDK test pass.
- Dependency/build provenance proves linkage, not admission of WHP authority, validity of customer claims, or authority to execute/spend.
- Each SDK's packed-file allowlist is reviewed. Client journals contain payment authorization material and must remain private, outside the repo.
- Source publication adds no blanket license to verifier/engine files. SDK license choice and registry publication remain separate review gates.

## Known delivery limits

No funded SDK purchase has been performed. This source gate is not a five-minute live adoption claim. The SDK does not create admitted source/transition authority or grant an unknown buyer a positive Mark. Buyer keys need secure durable custody; journals must be private, durable and never cleared to reset a spending cap. A reserved or ambiguous wallet signing attempt requires manual reconciliation, not retry signing.
