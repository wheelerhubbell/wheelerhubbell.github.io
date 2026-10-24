# Wheeler Hubbell Publishing

> Home of the Decision Integrity Protocol, the Standing Mark Service, and the public research and standards layer for machine-verifiable decision integrity.

Wheeler Hubbell Publishing is the public brand, publishing imprint, and canonical documentation layer for a broader decision-integrity ecosystem. This repository presents the published research, canonical interfaces, and operational architecture behind the Decision Integrity Protocol.

The canonical structure is:

- Wheeler Hubbell Publishing — the public brand and publishing layer
- Decision Integrity Protocol — the governing framework and ruleset
- Unilateral Integrity — the core doctrine: a claim or action may not exceed the authority and provenance that justify it
- Standing Mark Service — the operational evaluation runtime
- Standing Gate — the enforcement layer for CI/CD and autonomous execution
- Standing Mark / Standing Assessment — the outcome artifacts

## Decision Integrity Protocol

Wheeler Hubbell Publishing operates the Decision Integrity Protocol, a machine-verifiable framework for evaluating claims, authority, provenance, and scope before irreversible action is allowed. The protocol is designed for AI agents, autonomous systems, and software pipelines that must reason under bounded authority rather than unchecked assertion.

The protocol governs when a claim is admitted, bounded, and warranted. It distinguishes between:

- Standing Mark — ESTABLISHED: the claim is grounded, bounded, and supported by admissible authority and provenance
- Standing Assessment — NOT_ESTABLISHED: the claim is not sufficiently grounded or exceeds its evidence and authority
- Structural Dry Run — free validation of payload, schema, and input structure without a live determination
- Live Evaluation — paid evaluation under the protocol using the published rules

## Underlying Principle

The governing invariant is Unilateral Integrity:

A claim or action may not exceed the authority and provenance that justify it.

This principle prevents hollow authority, counterfeit provenance, escalated assumptions, and ungrounded automatic execution.

## Standing Mark Service

The Standing Mark Service is the live operational runtime that executes the protocol. It evaluates claims and issues either a Standing Mark or a Standing Assessment in accordance with the published rules.

It is intentionally distinct from the public brand and the enforcement layer:

- Wheeler Hubbell Publishing — the public identity and standards surface
- Decision Integrity Protocol — the rules and framework
- Standing Mark Service — the live evaluation service
- Standing Gate — the enforcement layer for automated execution and CI/CD

## Standing Gate

Standing Gate is the enforcement surface used in pipelines, repository checks, and agent workflows. It applies the protocol to real-world actions so that automated systems fail closed when a claim is not grounded.

## Canonical Terminology

Use the following terms consistently across the ecosystem:

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

A Standing Mark may only be issued when the claim is genuinely established under the protocol. A claim may also receive a Standing Assessment when it lacks sufficient authority, evidence, or admissible provenance.

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
