# WHP Reception Integrity

Version: WHP-RECEPTION-INTEGRITY-v0.2  
Adopted: 2026-09-24

## Governing invariant

**Reception does not mutate the object.**

No actor's interpretation, refusal, acceptance, critique, reliance decision, underwriting decision, AI output, institutional response, counterparty position, defensive posture, suspicion, or external standard changes the status of a recorded claim merely by being expressed.

A reception may affect state only when it supplies an authorized, evidence-linked event that satisfies the applicable transition rule.

## Fair-ingress rule

**Outside authority does not become inside truth by assertion.**

No actor may replace a subject's canonical record with an inferred version of that subject merely by treating its own standard, suspicion, defensive model, or interpretation as fact.

An evaluator MAY:

- reject a record for its own purpose;
- require additional evidence;
- apply a stricter reliance threshold;
- state a legal or policy position;
- supply contrary evidence;
- decline to transact or participate.

But those acts MUST remain accurately typed as the evaluator's requirement, interpretation, position, evidence, or decision.

They MUST NOT be silently promoted into source facts about the subject.

## Projection control

WHP Reception Integrity treats the following as distinct from source facts unless independently established by the subject record or later authorized evidence:

- inferred concealment;
- inferred self-interest;
- inferred overclaiming;
- inferred manipulation;
- inferred unreliability;
- imported institutional norms;
- defensive assumptions;
- conventional expectations;
- purpose-specific due-diligence requirements;
- reviewer-created reconstructions of the claim.

A reviewer may legitimately hold any of these views. The system's duty is classification, not suppression: the view is recorded as reception rather than allowed to overwrite the subject.

## Universal invariants

### WHP-RI-001 — Source invariance
A source remains what its source artifact establishes. A later description of the source is a new record, not a rewrite of the source.

### WHP-RI-002 — Interpretation separation
An interpretation, acceptance, rejection, critique, reliance decision, refusal, suspicion, or defensive assessment is recorded as a reception event separate from its subject.

### WHP-RI-003 — Authority-bounded force
A reception event has no state-changing force unless the applicable protocol recognizes the actor's authority and the evidence required for that transition.

### WHP-RI-004 — Traceable divergence
Where a receiver's interpretation differs from the canonical claim, silently substitutes a different claim, or omits a recorded limitation, that divergence is recorded explicitly. The divergence does not silently become the canonical claim.

### WHP-RI-005 — Append-only disagreement
Challenges, refusals, corrections, contrary evidence, reliance conditions, defensive assessments, and later determinations are appended to lineage. They do not erase prior provenance or silently overwrite prior states.

### WHP-RI-006 — Burden attribution
The burden created by an evaluator's own inference, standard, or reconstructed premise remains attributable to that evaluator. The subject is not deemed to have made, concealed, or failed a claim that the subject record does not establish.

## Required separation

WHP systems SHALL distinguish:

1. the source artifact;
2. the evidence-classified record;
3. the bounded determination;
4. the canonical state;
5. the reception event;
6. the receiver's interpretation;
7. the external reliance or decision event; and
8. any later authorized state transition.

`Record != Reception != Interpretation != Reliance`.

Each transition between those layers requires its own evidence and authority.

## Reception event minimum record

When a WHP system records an external reception, it SHOULD retain at least:

- reception identifier;
- subject object identifier and digest;
- subject state digest when applicable;
- receiver identity or declared receiver class;
- time received or recorded;
- the exact interpretation or assertions made;
- standards, suspicions, risk models, or requirements invoked;
- decision or response;
- comparison to the canonical record;
- unsupported substitutions;
- omitted limitations;
- imported assumptions;
- contrary evidence, if any;
- whether the actor possesses recognized state-changing authority;
- the applicable transition type, if any;
- evidence supplied with the reception;
- resulting effect on the underlying object and state.

Default effect:

```text
objectMutated: false
stateMutated: false
externalDecisionRecorded: true
```

## Interpretation delta

Where determinable, WHP systems SHOULD preserve the distance between:

1. what the canonical record actually claimed;
2. what the receiver represented it as claiming;
3. what standards, suspicions, or assumptions the receiver added; and
4. what decision the receiver made on that basis.

This delta is evidence about the reception. It is not itself evidence that the subject made the substituted claim.

## Unknowns

Declared unknowns remain unknowns. They are not silently promoted into favorable facts, adverse facts, omissions, concealment, unreliability, or failures.

## Legal and factual events

This invariant does not make a WHP record immune from reality or law. A payment, executed assignment, amendment, court order, authenticated counterparty act, contradictory evidence, or other legally or factually operative event may require a new state when the applicable transition conditions are met.

Such an event creates or supports a new state. It does not retroactively alter the provenance of the earlier record.

## Reception lineage

WHP systems MAY maintain two related but distinct histories:

- **Object lineage:** what happened to the object.
- **Reception lineage:** what actors believed, asserted, rejected, accepted, relied upon, misunderstood, suspected, required, reconstructed, or declined concerning the object.

The two histories interact only through an event carrying the authority and evidence required by the applicable transition rule.

## Human rule

A reader is free to distrust, reject, refuse, or impose its own threshold.

The system asks only that the reader's game not silently erase the subject's game.

A rejection may be valid as a decision without being valid as a description of the subject.

## Scope

This invariant applies across WHP protocols, evaluators, standing systems, vending systems, dossiers, receipts, offers, APIs, schemas, verifier outputs, audit records, and future WHP machine-readable artifacts unless a later canonical protocol version explicitly supersedes it.
