# Local source gate, October 7, 2026

- Clean public clone started at b29dde3ad3044fd9ee770ac25ef17359366014ef.
- TypeScript: nine passing test groups, Node 22.23.3.
- Python: nine passing test groups, Python 3.10.12; CI targets Python 3.11.
- Synthetic Ed25519/EVM keys and mocked transport only. No funded SDK purchase or wallet access.
- Packed npm: package.json, README.md, dist/index.js, dist/index.d.ts only.
- Wheel: four whp_standing modules plus distribution metadata. Sdist: same source modules, README, pyproject, PKG-INFO and reviewed SDK-local .gitignore only.
- Existing historical genesis fixture verified with its own bb8cb782... verifier generation.
- Actual October 7 1.0.1 self-test Mark verified from separately installed npm/wheel artifacts with 0980eb6... verifier. Signed registry observed at Unix 1791369727 returned EXPIRED; historical integrity/replay/issuance VERIFIED. That is a recorded check, not an ongoing current-status claim.
- Offline runner exposes no RPC/network: payment chain finality NOT_RECHECKED. Outside-buyer relationship NOT_ESTABLISHED_BY_THIS_VERIFIER; live_completion_verified false.
- Wrong roots, changed verifier bytes, changed signed quote/request fields, expiry, wrong payment destinations/amount/network, unsafe JSON and repeated ambiguous wallet signing refused.
- Journal persists reservation before signing and authorized payment before submission. Recovery and result retrieval contain no signer calls. Explicit replay preserves exact submission bytes and identical payment authorization.
- All three verifier file digests remained unchanged. Static public source/path gates and negative private-reference/path-escape checks passed.

Not yet established: fresh funded SDK transaction, five-minute cold integration usability, all supported OS/runtimes, package-registry publication, registry name ownership, license choice, dependency advisory review or remote CI execution. Local sandbox execution is Linux bubblewrap only and fails closed if unavailable.
- Original October 7 resolution and ACTIVE registry passed at their recorded 5:52 snapshot time in both installed clients. The same snapshots fail RESOLUTION_STALE at present time. This verifies expiry discipline, not a current ACTIVE claim.
