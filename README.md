# Wheeler Hubbell Publishing

> Public brand, research layer, and canonical identity for the Decision Integrity Protocol, the Standing Mark Service, and the enforcing runtime behind autonomous decision safety.

Wheeler Hubbell Publishing is the public brand, publishing imprint, and canonical documentation layer for a broader decision-integrity ecosystem. This repository hosts the public research, protocol framing, and operational standards behind the Decision Integrity Protocol.

The canonical structure is:

- Wheeler Hubbell Publishing — public brand and research layer
- Decision Integrity Protocol — governing framework and ruleset
- Unilateral Integrity — doctrine that a claim or action may not exceed the authority and provenance that justify it
- Standing Mark Service — operational evaluation runtime
- Standing Gate — enforcement layer for CI/CD and autonomous execution
- Standing Mark / Standing Assessment — issued outcomes

## Decision Integrity Protocol

Wheeler Hubbell Publishing operates the Decision Integrity Protocol, a machine-verifiable framework for evaluating claims, authority, provenance, and scope before irreversible action is allowed. The protocol is designed for AI agents, autonomous systems, and software pipelines that must reason under authority and bounded scope rather than unchecked assertion.

The protocol distinguishes between:

- Standing Mark — ESTABLISHED: the claim is grounded, bounded, and supported by admissible authority and provenance
- Standing Assessment — NOT_ESTABLISHED: the claim is not sufficiently grounded or exceeds its evidence and authority
- Structural Dry Run — free validation of payload, schema, and input structure without a live determination
- Live Evaluation — paid evaluation under the protocol using the published rules

## Unilateral Integrity

The governing invariant is Unilateral Integrity:

A claim or action may not exceed the authority and provenance that justify it.

This principle prevents hollow authority, counterfeit provenance, escalated assumptions, and ungrounded automatic execution.

## Standing Mark Service

The Standing Mark Service is the live operational runtime that executes the protocol. It evaluates claims and issues either a Standing Mark or a Standing Assessment in accordance with the published rules.

It is intentionally distinct from the public brand and the enforcement layer:

- Wheeler Hubbell Publishing — public identity and standards surface
- Decision Integrity Protocol — rules and framework
- Standing Mark Service — live evaluation service
- Standing Gate — enforcement layer for automated execution and CI/CD

## Standing Gate

Standing Gate is the enforcement surface used in pipelines, repository checks, and agent workflows. It applies the protocol to real-world actions so that automated systems fail closed when a claim is not grounded.

## Canonical Terminology

Use these terms consistently across the ecosystem:

- Brand: Wheeler Hubbell Publishing
- Framework: Decision Integrity Protocol
- Principle: Unilateral Integrity
- Runtime: Standing Mark Service
- Enforcement: Standing Gate
- Positive result: Standing Mark
- Negative result: Standing Assessment
- Free validation: Structural Dry Run
- Paid evaluation: Live Evaluation

## Pricing and Terms

Pricing is workload-based and outcome-independent. Payment buys evaluation under published rules; it does not buy a favorable outcome.

A Standing Mark may only be issued when the claim is genuinely established under the protocol. A Standing Assessment is issued when the claim exceeds its authority, evidence, or admissible provenance.

## Machine Interfaces and Discovery

- MCP Server: https://api.wheelerhubbellpublishing.com/mcp
- API Catalog: /.well-known/api-catalog
- MCP Discovery: /.well-known/mcp.json
- OpenAPI: /openapi.json
- Capability Resolution: /.well-known/standing-capability.json
- LLM Context: /llms.txt

## Publications and Research

This repository also hosts the public literature, foundational texts, and research artifacts that ground the protocol and its doctrines.

## License

MIT © Wheeler Hubbell Publishing, Inc.
