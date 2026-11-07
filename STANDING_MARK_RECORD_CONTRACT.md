# STANDING MARK RECORD CONTRACT (`v1.7.0`)

> **Governing Integration Principle (The Developer Rule):**
> *"A positive Standing Mark is a signed, scope-bound examination result. It may satisfy an evidence requirement defined by a receiving system, but it does not itself authorize an action. The receiving system must independently evaluate the applicable authority, conditions, and action policy. Absence of a positive Mark means the Mark requirement has not been satisfied; it does not, by itself, establish that the underlying action is prohibited."*

This contract specifies the canonical signed-record schema (`schemas/standing-mark-record-contract-v1.json`), mechanical verification rules, object-bound scope semantics, model and reproducibility provenance, submission completeness declarations, data-handling disclosures, terminology boundaries, and failure states for the **Standing Mark Service** (`POST /v1/evaluate`).

---

## 1. Terminology & Outcome Separation

To prevent conflating the evaluation service with a favorable finding:

| Term | Canonical Identifier | Definition |
| :--- | :--- | :--- |
| **Standing Mark Service** | `POST /v1/evaluate` (`whp-standing`) | The single-door epistemological evaluation service operated by Wheeler Hubbell Publishing. Payment buys an examination under the published contract, never a favorable outcome. |
| **Standing Mark Record** | `WHP-STANDING-MARK-v1` (Payload `WHP-STANDING-RESULT-v1`) | The `Ed25519`-signed, `WHP-JCS-I1` canonical JSON envelope returned by the Standing Mark Service after examining a submission. |
| **Positive Standing Mark** | `finding_disposition: "POSITIVE_STANDING_MARK"` (`outcome: "ESTABLISHED"`, `mark_id: "WHP-SM-<hash>"`) | Issued when the examination establishes that the submitted record warrants the requested operation within the stated scope and conditions. |
| **Negative Standing Finding** | `finding_disposition: "NEGATIVE_STANDING_FINDING"` (`outcome: "NOT_ESTABLISHED"`, `finding_id: "WHP-NF-<hash>"`) | Issued when warrant is not established for the requested operation. Records what was examined, which check or Named Failure triggered, the **Smallest True Move** (`INQUIRE` or `INFORM`), and the missing warrant. |

---

## 2. Mechanical Object Binding (`object_binding`)

A cryptographic signature is useless if a signed record can be detached from the object that was examined and attached to a mutated or substituted object downstream. Every signed Standing Mark Record embeds a mandatory `object_binding` block inside the signed payload:

```json
"object_binding": {
  "submitted_bytes_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "examined_question": "Settle 1.00 USDC on Base for verified completion of compute job 991 under signed SLA.",
  "examination_scope": "wheeler-hubbell-publishing:whp-sovereign-standing",
  "requested_operation": "EXECUTE",
  "governing_canon_version": "7.0.0",
  "governing_canon_sha256": "bd85f51f05afc6f77053aec086a1d013a1cccde70c30231622f0ecc7e3f25c21",
  "finding_disposition": "POSITIVE_STANDING_MARK",
  "outcome": "ESTABLISHED"
}
```

### Mechanical Verification Rule (`verifyObjectBoundStandingMark`)
A receiving system verifying a Standing Mark Record MUST perform four mechanical checks:
1. **Cryptographic Signature Check:** Verify the `Ed25519` signature over the `WHP-JCS-I1` (RFC 8785) canonicalization of `{ protected, payload }` against the admitted publisher public key (`computeSpkiKeyId(publicKey) === protected.key_id`).
2. **Exact Material Digest Match:** Canonicalize the exact received material (`WHP-JCS-I1` for JSON objects or UTF-8 bytes for strings), compute its SHA-256 digest, and verify `computedDigest === payload.object_binding.submitted_bytes_sha256`. If the material differs by a single byte, verification fails with `OBJECT_DIGEST_MISMATCH`.
3. **Examined Question & Scope Match:** If the receiving system requires a specific proposition (`expectedQuestion`), operation (`expectedOperation`), or jurisdiction/scope (`expectedScope`), verify exact equality against `payload.object_binding`. If the record examined a different question ($Q_1 \neq Q_0$), verification fails with `EXAMINED_QUESTION_MISMATCH`.
4. **Temporal & Limit Check:** Verify the current timestamp falls within `[payload.effective_at, payload.expires_at]` and that all `payload.evaluation.standing_record.qualifiers` are preserved in the downstream context.

---

## 3. Submission Completeness & Inventory (`completeness`)

A hash proves that the submitted bytes were not altered after submission; **a hash does not prove that the submission was complete, authentic, or authoritative.** Every signed record carries an explicit `completeness` block:

```json
"completeness": {
  "submitter_completeness_declaration": "DECLARED_COMPLETE_FOR_STATED_SCOPE",
  "supplied_materials_inventory": [
    {
      "item_id": "primary-submission",
      "kind": "CLIENT_PROPOSITION",
      "locator": "urn:sla:job-991-completion-receipt",
      "sha256": "..."
    }
  ],
  "epistemic_limitation": "A completeness declaration records the submitter's assertion and the inventory of materials supplied to the examination; it cannot prove that undisclosed documents, side agreements, or adverse records do not exist outside the submitted packet."
}
```

---

## 4. Reproducibility & Model Provenance (`examination_provenance`)

Reproducibility does not require pretending a Large Language Model is deterministic across arbitrary hardware or provider updates. Instead, every signed record distinguishes the reproducibility class of the examination and records full model and protocol provenance:

```json
"examination_provenance": {
  "reproducibility_class": "SINGLE_MODEL_JUDGMENT_WITH_DETERMINISTIC_STRUCTURAL_FLOOR",
  "model_provider": "whp-sovereign-vllm",
  "model_id": "whp-qwen-di-v7-72b",
  "model_version": "2026-11",
  "temperature": 0,
  "governing_text_title": "Decision Integrity: The Continuous Work",
  "governing_text_version": "7.0.0",
  "governing_text_sha256": "bd85f51f05afc6f77053aec086a1d013a1cccde70c30231622f0ecc7e3f25c21",
  "system_prompt_sha256": "...",
  "protocol_profile_id": "WHP-DECISION-INTEGRITY-V7-CONTINUOUS-WORK",
  "protocol_sha256": "bd85f51f05afc6f77053aec086a1d013a1cccde70c30231622f0ecc7e3f25c21",
  "examined_at": 1793941200,
  "reproducibility_note": "The 8 structural passage checks and WHP-JCS-I1 digests are 100% deterministic. When an external or self-hosted LLM generates natural-language reasoning, this record binds that specific examination instance (model, temperature, prompt hash, input digest, and timestamp) without claiming that a subsequent LLM invocation must emit identical prose."
}
```

Allowed values for `reproducibility_class`:
- `"DETERMINISTIC_RULE_EVALUATION"`: Offline/CI structural evaluation with zero stochastic model sampling.
- `"SINGLE_MODEL_JUDGMENT_WITH_DETERMINISTIC_STRUCTURAL_FLOOR"`: Live LLM epistemological evaluation (`temperature: 0`) paired with the deterministic 8-check structural floor.
- `"REPEATABLE_UNDER_STATED_CONDITIONS"`: Pinned model weights, seed, and hardware configuration verified for repeatable output.

---

## 5. Data-Handling Disclosure (`data_handling`)

Configuration variable names do not establish privacy facts. Every signed record and `GET /v1/contract` response declares the active `data_handling` facts for that examination:

```json
"data_handling": {
  "inference_provider": "self-hosted-sovereign",
  "transmitted_to_external_provider": false,
  "transmitted_fields": ["client_data", "provenance", "qualifiers", "unknowns"],
  "storage_policy": "Immutable signed result stored by purchase_id for buyer retrieval and recovery; raw temporary working buffers discarded after signing.",
  "retention_policy": "Signed Standing Mark Record retained in append-only purchase registry; unsubmitted client data is never retained.",
  "training_use_policy": "PROHIBITED — Wheeler Hubbell Publishing never uses submitted client data to train or fine-tune models.",
  "deletion_policy": "Registry records are append-only for audit lineage; buyers may request redaction of non-digest payload text where permitted by contract."
}
```

---

## 6. Named Failure States & Error Codes

| Failure Code | Meaning | Consequence on Record |
| :--- | :--- | :--- |
| `COHERENT_SUBSTITUTION` | Submission or transformation answers a replaced proposition ($Q_1$) instead of the locked governing proposition ($Q_0$). | `outcome: "NOT_ESTABLISHED"`, `finding_disposition: "NEGATIVE_STANDING_FINDING"` |
| `AUTHORITY_LEAKAGE` | Requested operation (e.g., `EXECUTE`) exceeds the force established by the source record and warrant. | `outcome: "NOT_ESTABLISHED"`, `EXECUTE` excluded from `permitted_operations` |
| `OBJECT_DRIFT` | The underlying object, population, or version state changed while the label remained constant. | `outcome: "NOT_ESTABLISHED"` |
| `QUALIFIER_STRIPPING` | A binding condition, caveat, dissent, or scope limit was dropped across a handoff. | `outcome: "NOT_ESTABLISHED"` |
| `UNWARRANTED_JOIN` | Two supported propositions were connected without an independent warrant for the relation between them. | `outcome: "NOT_ESTABLISHED"` |
| `UNLAWFUL_PREMISE_PROMOTION` | An unresolved element (`UNKNOWN`) was used as an established premise to authorize action. | `outcome: "NOT_ESTABLISHED"`, held at `Smallest True Move` (`INQUIRE` or `INFORM`) |
| `OBJECT_DIGEST_MISMATCH` | Verification failure: the material presented to the verifier does not match `object_binding.submitted_bytes_sha256`. | Verification returns `valid: false` |
| `EXAMINED_QUESTION_MISMATCH` | Verification failure: the question or operation required by the consumer does not match `object_binding.examined_question` or `requested_operation`. | Verification returns `valid: false` |

---

## 7. Independent Verification Example (Zero Dependencies, Node.js)

```javascript
import { verifyObjectBoundStandingMark } from "./packages/canonical-mark/envelope.mjs";

const clientSubmission = {
  data: "Settle 1.00 USDC on Base for verified completion of compute job 991 under signed SLA.",
  subject: "Compute Job 991 Settlement",
  requested_operation: "EXECUTE",
  provenance: {
    source: "urn:sla:job-991-completion-receipt",
    authority: "urn:warrant:buyer-treasury-execution-grant"
  },
  qualifiers: ["SLA latency <= 50ms verified", "US-only region verified"]
};

// 1. Verify Ed25519 signature AND mechanical object binding against the exact received material:
const verification = verifyObjectBoundStandingMark(signedEnvelope, publisherPublicKeyBase64, {
  receivedMaterial: clientSubmission,
  expectedOperation: "EXECUTE"
});

if (!verification.valid) {
  throw new Error(`Standing Mark verification failed: ${verification.errors.join("; ")}`);
}

// 2. Apply the Developer Rule: a positive Standing Mark satisfies the evidence requirement,
//    while the receiving system independently evaluates its own action policy:
if (verification.findingDisposition === "POSITIVE_STANDING_MARK" && localPolicyAllows(clientSubmission)) {
  // Proceed with local action
}
```
