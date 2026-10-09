"""Proof-of-Standing Escrow Condition for Autonomous Agent Swarms.
WHP Standing Protocol — Invariant: A(c) <= P(c).
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional


def verify_standing_release_condition(
    output: Any,
    standing_record: Dict[str, Any],
    expected_subject: Optional[str] = None,
    allowed_statuses: Optional[List[str]] = None,
    max_age_seconds: Optional[int] = None,
) -> Dict[str, Any]:
    """Validates that a task output carries an authentic WHP Standing Record before escrow release."""
    checks: List[Dict[str, Any]] = []

    def add(cid: str, ok: bool, note: Optional[str] = None):
        c: Dict[str, Any] = {"id": cid, "pass": ok}
        if note:
            c["note"] = note
        checks.append(c)

    if not standing_record or not isinstance(standing_record, dict):
        return {
            "satisfied": False,
            "code": "MISSING_STANDING_RECORD",
            "checks": [{"id": "record_present", "pass": False, "note": "No standing record provided"}],
            "message": "Escrow release condition failed: record missing.",
        }

    record = standing_record.get("record", standing_record)
    add("record_present", True)
    add("issuer_present", bool(record.get("issuer")), record.get("issuer"))

    # Subject check
    if expected_subject:
        subj = (record.get("input") or {}).get("subject")
        add("subject_aligned", subj == expected_subject, f"Expected {expected_subject}, got {subj}")

    # Expiry
    now = int(time.time())
    if "valid_until" in record:
        add("not_expired", now <= record["valid_until"], f"Valid until {record['valid_until']}, now {now}")
    if max_age_seconds and "issued_at" in record:
        add("max_age", now - record["issued_at"] <= max_age_seconds, f"Within {max_age_seconds}s")

    # Status
    det = record.get("determination") or {}
    if allowed_statuses:
        st = det.get("epistemic_status")
        add("epistemic_status_threshold", st in allowed_statuses, f"Got '{st}', allowed {allowed_statuses}")

    # Internal checks
    if "checks" in det and isinstance(det["checks"], list):
        passed_all = all(c.get("pass") is True for c in det["checks"])
        add("structural_checks_passed", passed_all, "All internal structural assertions passed")

    failed = [c["id"] for c in checks if not c["pass"]]
    satisfied = len(failed) == 0

    return {
        "satisfied": satisfied,
        "code": "ESCROW_RELEASE_WARRANTED" if satisfied else "ESCROW_CONDITIONS_UNMET",
        "checks": checks,
        "failed": failed,
        "record_hash": standing_record.get("record_hash"),
        "signature_present": bool(standing_record.get("signature")),
        "message": (
            "Standing release condition met. Escrow may disburse."
            if satisfied
            else f"Escrow release denied: failed checks [{', '.join(failed)}]."
        ),
    }
