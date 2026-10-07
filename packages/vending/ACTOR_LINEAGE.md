# WHP Actor–Goal Lineage

Version: WHP-ACTOR-GOAL-LINEAGE-v0.1  
Adopted: 2026-09-24

## Governing invariants

**Alignment does not collapse identity.**

**Goal lineage begins with the actor whose state is intended to change.**

A natural person, a corporation, and a natural person acting in an authorized corporate capacity remain distinct actors or capacities even when their interests align.

## Canonical actor distinctions

### JUSTIN_NATURAL_PERSON
Justin acting in an individual capacity.

### WHEELER_HUBBELL_PUBLISHING_INC
Wheeler Hubbell Publishing, Inc., a separate corporate entity.

### JUSTIN_AS_WHP_PRESIDENT
Justin acting in an authorized representative capacity for Wheeler Hubbell Publishing, Inc.

These are not interchangeable:

```text
JUSTIN_NATURAL_PERSON
!= JUSTIN_AS_WHP_PRESIDENT
!= WHEELER_HUBBELL_PUBLISHING_INC
```

The representative capacity does not create a third owner of assets. It identifies whose authority is being exercised and for which principal.

## Direction of lineage

Justin is upstream of WHP where Justin contributes rights, labor, intellectual property, authority, decisions, or other inputs to WHP.

```text
JUSTIN_NATURAL_PERSON
        |
        | rights / labor / IP / contribution
        v
WHEELER_HUBBELL_PUBLISHING_INC
```

A later flow from WHP to Justin is a separate event requiring its own basis:

```text
WHEELER_HUBBELL_PUBLISHING_INC
        |
        | payment / reimbursement / compensation /
        | satisfaction of obligation / other valid transfer
        v
JUSTIN_NATURAL_PERSON
```

The existence of an aligned interest does not itself authorize that reverse flow.

## Goal-holder rule

Every goal-bearing record SHOULD identify:

- `actorId`
- `capacity`
- `goalHolderId`
- `beneficiaryId`, when different
- `principalId`, when acting for another
- `authoritySource`, when acting representatively
- `assetOwnerId`, when an asset or right is material
- `obligorId`, when an obligation is material
- `counterpartyId`, when applicable
- `targetState`

A system MUST NOT silently replace the goal-holder with a related person, corporation, account, asset, or authority source.

## Example: personal purchasing power

If the operative objective is personal purchasing power for food:

```text
actorId: JUSTIN_NATURAL_PERSON
capacity: INDIVIDUAL
goalHolderId: JUSTIN_NATURAL_PERSON
targetState: PERSONAL_PURCHASING_POWER
```

WHP may be an upstream or intermediate economic actor in a valid path, but WHP revenue is not itself Justin's personal purchasing power.

Any WHP-to-Justin flow requires its own authorized economic event and provenance.

## Example: corporate revenue

If the operative objective is corporate revenue:

```text
actorId: WHEELER_HUBBELL_PUBLISHING_INC
capacity: CORPORATE_ENTITY
goalHolderId: WHEELER_HUBBELL_PUBLISHING_INC
targetState: CORPORATE_REVENUE
```

## Example: Justin acting for WHP

If Justin is causing WHP to act:

```text
actorId: JUSTIN_NATURAL_PERSON
capacity: PRESIDENT_OF_WHP
principalId: WHEELER_HUBBELL_PUBLISHING_INC
goalHolderId: WHEELER_HUBBELL_PUBLISHING_INC
authoritySource: corporate office / applicable corporate authority
```

The action is attributed to WHP where the representative is acting within the relevant authority.

## Required reasoning order

For any proposed objective or transition, resolve in this order:

1. **Who is the goal-holder?**
2. **In what capacity is the actor acting?**
3. **Whose state is intended to change?**
4. **Who owns the relevant asset, right, account, or obligation?**
5. **What authority permits the proposed action?**
6. **What event bridges any change from one actor to another?**
7. **What evidence establishes that bridge?**

Only then trace available paths.

## Relationship to Reception Integrity

Reception Integrity prevents an external interpretation from silently rewriting an object.

Actor–Goal Lineage prevents an aligned person, corporation, capacity, asset, or account from silently replacing the actor whose goal or state is actually at issue.

Together:

```text
identity != capacity != principal != beneficiary
record != reception != reliance
```

## Scope

This invariant applies across WHP protocols, economic-state records, Standing, Decision Integrity, Vending, dossiers, receipts, offers, evaluations, machine actions, databases, datasets, and future WHP artifacts unless explicitly superseded by a later canonical version.
