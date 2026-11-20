# Standing Mark developer entry point

Standing Mark is an independent examination service operated by Wheeler Hubbell Publishing, Inc. Payment buys an examination, not a favorable result. A signature establishes what was signed, not substantive correctness or permission to act.

- [Developer onboarding](https://wheelerhubbellpublishing.com/developers.html)
- [Current developer repository](https://github.com/wheelerhubbell/standing-mark)
- [Live contract](https://decisionintegrity.wheelerhubbellpublishing.com/v1/contract)
- [Live OpenAPI](https://decisionintegrity.wheelerhubbellpublishing.com/openapi.json)
- [Quick-start](https://github.com/wheelerhubbell/standing-mark/blob/main/docs/quick-start.md)
- [Independent verification](https://github.com/wheelerhubbell/standing-mark/blob/main/docs/verification.md)
- [Local MCP adapter setup](https://github.com/wheelerhubbell/standing-mark/blob/main/mcp/README.md)

The current service speaks HTTP. MCP is available through a local stdio adapter, not a hosted `/mcp` endpoint. The A2A description is not a native A2A endpoint. Payment uses x402 v2 `exact` (exactly 1.00 USDC on Base, an EIP-3009 authorization the caller signs; the facilitator submits the transaction, so no customer ETH gas is required).

## Legacy material in this repository

Older SDKs, package clients, workflow integrations and demonstrations remain available as historical implementation material. A host correction does not make their old authentication, payment or record expectations compatible with the current service. New integrations should use the linked developer repository and live contract. No current end-to-end compatibility is claimed for the legacy clients.

This repository also hosts the publishing site and research archive. Existing literature is not the current API contract.
