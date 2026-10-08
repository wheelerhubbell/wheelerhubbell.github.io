# whp-standing-client

Async Python client for WHP Standing (https://standing-guard-service.lovable.app). Answers the x402 v2 challenge (USDC on Base, `eip155:8453`) with a gasless EIP-3009 `TransferWithAuthorization` signed by a key you provide.

```python
from whp_standing_client import StandingClient, BuyerKey

client = StandingClient(PAYER_KEY, buyer_key=BuyerKey.from_seed_hex(BUYER_SEED))  # keep BUYER_SEED
contract = await client.get_contract()                       # free
out = await client.evaluate(client_reference, nodes, template)  # 1.00 USDC
again = await client.get_result(out.purchase_id)
same = await client.recover(out.purchase_id)                 # idempotent, never charges again
```

Same safety defaults and error codes as the TypeScript package: pinned policy (network, USDC, pay-to, 1.00 USDC cap, token domain, quote bound to your submission), optional `approve_payment` veto, and the signed payment is persisted before sending so retries never sign twice. The client does not verify the result's signature chain; give `result_text` to an independent verifier.
