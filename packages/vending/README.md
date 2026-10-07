# WHP Vending

WHP Vending is the live fixed-price storefront for five Wheeler Hubbell Publishing decision-integrity instruments.

**Canonical production service:** https://whp-vending.wheelerhubbell.chatgpt.site

## Live catalog

| Instrument | SKU | Price |
|---|---|---:|
| Claim Classifier | `WHP-DI-CC-001` | $2.99 |
| Return the Burden | `WHP-DI-RB-001` | $4.99 |
| Audit the Move | `WHP-DI-ATM-001` | $7.99 |
| Limited Verdict | `WHP-DI-LV-001` | $9.99 |
| Response Auditor | `WHP-DI-RA-001` | $19.99 |

Each offer is a one-time Stripe-hosted Checkout. Fulfillment is released only after a signed live Stripe event matches the exact Payment Link, product metadata, USD amount, completed Session, paid status, and PaymentIntent. A paid Checkout Session ID is the private recovery credential for repeated retrieval without a second charge.

## Machine discovery

Agents and indexers can inspect the live service without payment:

- [Service manifest](https://whp-vending.wheelerhubbell.chatgpt.site/.well-known/whp-vending.json)
- [Versioned catalog](https://whp-vending.wheelerhubbell.chatgpt.site/catalog/v1/index.json)
- [OpenAPI 3.1](https://whp-vending.wheelerhubbell.chatgpt.site/openapi.json)
- [Agent-readable guide](https://whp-vending.wheelerhubbell.chatgpt.site/llms.txt)
- [Purchase rights](https://whp-vending.wheelerhubbell.chatgpt.site/v1/rights)
- [Commerce readiness](https://whp-vending.wheelerhubbell.chatgpt.site/readyz)
- [Sitemap](https://whp-vending.wheelerhubbell.chatgpt.site/sitemap.xml)

The live catalog includes the exact checkout URL, fixed price, currency, version, filename, byte length, and SHA-256 digest for every artifact.

## Payment boundary

The production rail is **Stripe Payment Links**. Checkout currently requires browser or human interaction. This service does not claim x402, MCP, A2A, or Stripe MPP autonomous payment support.

WHP Vending is independent of WHP Standing. A Vending purchase does not issue a Standing Mark.

## Reception Integrity

A buyer, agent, platform, reviewer, or institution may accept, reject, misunderstand, rely on, or decline a WHP Vending artifact. That reception is separate from the purchased object's identity, provenance, payment state, and fulfillment state. Reception does not mutate the object unless an applicable transition rule recognizes the actor's authority and supporting evidence. See [RECEPTION_INTEGRITY.md](RECEPTION_INTEGRITY.md).

## Source and artifact boundary

This public repository preserves public discovery material and implementation history. The canonical deployed Sites source is maintained separately because its Worker bundle contains the paid delivery artifacts. Those plaintext artifacts must not be copied into public Git history.

The former Netlify/MPP implementation in this repository is historical and is not the canonical production runtime.
