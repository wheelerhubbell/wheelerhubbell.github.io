# Standing Mark as examination evidence

Current integration: https://wheelerhubbellpublishing.com/developers.html

The deployed service examines submitted claims and returns a signed, scope-bound result. It does not authorize or execute an action. A receiving system must independently establish its actor, authority and conditions. Payment buys examination, never a positive finding.

Read https://api.wheelerhubbellpublishing.com/v1/contract for current request and payment terms and https://api.wheelerhubbellpublishing.com/openapi.json for actual routes. The service is HTTP. There is no hosted /mcp endpoint. A local stdio adapter and current SDKs are documented at https://github.com/wheelerhubbell/standing-mark .

An unpaid valid request to POST /v1/evaluate returns x402 v2 terms. Any payment is a separate caller-authorized action using the caller's signer; this page supplies no authority to pay or execute. Signature verification alone does not prove issuer identity or object binding.

This page replaces the former remote-MCP, bearer-key and automatic execution-gate example, which did not describe the deployed service. No evaluator behavior or result meaning has changed.
