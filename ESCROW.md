# Standing escrow references: current limits

The repository contains a JavaScript condition helper and a Solidity escrow reference. Neither is a complete verifier of a canonical WHP Standing Mark or a fresh action-bound warrant. Do not use the JavaScript helper's `satisfied: true` as authorization to release funds.

## JavaScript helper

`packages/client/escrow.mjs` exports `verifyStandingReleaseCondition(output, standingRecord, options)`.

Its current checks are limited:

- the supplied record is present;
- the record contains a truthy `issuer` field;
- subject matches `expectedSubject`, only when that option is supplied;
- expiry is checked only if `valid_until` exists;
- age is checked only if both `maxAgeSeconds` and `issued_at` exist;
- epistemic status is checked only if `allowedStatuses` and a determination exist;
- internal checks are checked only if the record supplies a `determination.checks` array.

It does not verify the Ed25519 signature, canonical record hash, admitted issuer/root authority, exact deliverable binding, fresh registry status, revocation, permitted operation, or executable transaction entitlement. The `output` argument is not inspected. `signature_present` only reports whether a signature field exists; it does not validate that signature.

With default options, a fabricated object containing only `issuer` can return `satisfied: true`, `ESCROW_RELEASE_WARRANTED`, and a message recommending disbursement. Those returned labels are not proof that release is warranted. The helper must not be treated as a fail-closed standing gate in its current form.

`createStandingEscrowContract` returns a condition-description object. It does not deploy a contract, verify a receipt, or enforce the described `require_signed_record` setting.

## Solidity reference

`contracts/StandingEscrow.sol` holds a token balance and accepts an ECDSA personal-message attestation from its configured `whpAuthorizedVerifier` over `escrowId`, the stored `taskHash`, and a supplied `recordHash`. It checks agreement state and the escrow deadline before transferring funds.

The contract does not directly verify an Ed25519 WHP receipt, inspect its determination, or query fresh standing/revocation. It does not call `StandingVerifier.sol`. A separate authorized co-attestation process would have to establish the receipt's authority and exact release entitlement before signing. No complete deployed bridge is established by this reference code alone.

Ordinary `/v1/audit` and `/v1/ping` front-door records are source-attributed receipts, not sealed Marks or execution permission. Paying for an evaluation, possessing a signed record, or passing the limited helper checks does not authorize an escrow release.

## Status

These are references with known verification gaps, not an end-to-end production escrow protocol. Canonical receipt verification, current standing, exact action entitlement, settlement and contract release are separate checks. Until those checks are designed and implemented together, funds release must not rely on the JavaScript helper's favorable result.
