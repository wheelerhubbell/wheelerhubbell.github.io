# WHP Vending autonomous runtime

Machine-only x402 v2 vending for five exact Wheeler Hubbell Publishing ZIP artifacts.

The public runtime contains catalog metadata, payment validation, finalized Base-chain settlement verification, idempotency, recovery, and discovery. Paid artifact bytes are injected as private deployment variables and are never committed to this repository.

The neutral x402 rail invariants were deliberately ported from WHP's separately controlled Standing implementation. Vending has no runtime dependency on Standing and keeps its catalog, product identifiers, payment records, MCP tools, artifact vault, and deployment isolated.

## Interfaces

- `GET /catalog/v1/index.json` — free catalog
- `POST /v1/products/{product_id}/artifact` — x402 purchase boundary
- `GET /v1/purchases/{purchase_id}/result` — durable retrieval
- `POST /v1/purchases/{purchase_id}/recover` — settlement reconciliation without another authorization
- `POST /mcp` — MCP initialize, tools/list, catalog, purchase, result, and recovery tools
- `GET /.well-known/x402` — x402 resource discovery
- `GET /.well-known/agent-card.json` and `POST /a2a` — A2A discovery
- `GET /readyz` — dependency and artifact readiness

The purchase request body is exactly `{ "client_reference": "<64 random hex characters>" }`. A buyer must preserve that secret and the derived purchase ID. Recovery never requires or permits a second payment authorization.

## Safety boundary

Artifact delivery requires a finalized Base mainnet receipt whose canonical transaction calldata and USDC `AuthorizationUsed` and `Transfer` logs exactly match the bound EIP-3009 authorization. Facilitator success alone cannot release an artifact.

Each SKU uses a distinct atomic USDC amount, including one-micro-USDC separation where two offers share the same displayed cent tier. This binds the signed EIP-3009 value to one SKU instead of allowing two products to share identical signed terms. The recipient is code-pinned to the canonical WHP address; rotating it requires a reviewed source revision.

Every historical artifact revision with an in-flight or completed entitlement remains in one private, append-only Postgres object table keyed by SHA-256. Purchase rows hold only entitlements and hashes, not duplicate artifact bytes. On every start the runtime verifies all current env-backed bytes, inserts unseen immutable revisions, reloads retained revisions, and checks the frozen revision before verification, before settlement, and again before delivery.

The service uses native USDC on `eip155:8453`. It does not implement card checkout, accounts, email collection, or a human storefront.
