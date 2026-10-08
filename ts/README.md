# @whp/standing-client

Client for WHP Standing (https://standing-guard-service.lovable.app). It answers the service's x402 v2 challenge (USDC on Base, `eip155:8453`) with a gasless EIP-3009 `TransferWithAuthorization` signed by a key you provide.

```ts
import { StandingClient, BuyerKey } from "@whp/standing-client";

const client = new StandingClient({
  evmPrivateKey: process.env.PAYER_KEY!,          // signs only; never transmitted
  buyerKey: BuyerKey.fromSeedHex(process.env.BUYER_SEED!), // keep this; it is needed to read results later
});
const contract = await client.getContract();               // free
const out = await client.evaluate(clientReference, nodes, { profile, object, bounds, requested_operation: "INFORM" }); // 1.00 USDC
const again = await client.getResult(out.purchaseId);
const same = await client.recover(out.purchaseId);          // idempotent, never charges again
```

Safety defaults: the client signs only if the terms match the pinned policy (network, USDC contract, pay-to address, per-purchase cap of 1.00 USDC, token domain, quote bound to your submission). Override with `policy`, veto with `approvePayment`. The signed payment is stored (pluggable `PurchaseStore`) before it is sent, so retries and `recover` never sign a second time.

Errors are `StandingError` with `code`: `TERMS_REJECTED`, `SIGNATURE_FAILED`, `PAYMENT_NOT_ACCEPTED`, `SETTLEMENT_REJECTED`, `HTTP_ERROR`, `INVALID_RESPONSE`, `INVALID_INPUT`, `RESULT_MISMATCH`.

Not done by this client: it does not verify the result's signature chain. Hand `resultText` to an independent verifier (see `/v1/verification`). The result states what the service signed; payment does not determine standing.
