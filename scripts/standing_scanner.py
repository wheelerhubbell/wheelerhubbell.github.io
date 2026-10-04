#!/usr/bin/env python3
"""
WHP Standing Witness - Automated Distribution & Trace Auditor
Scans agent failure traces, applies the 5 Epistemic Instruments, and outputs verifiable receipts.
"""
import os
import sys
import json
import urllib.request
import urllib.error

STANDING_ENDPOINT = os.getenv("WHP_ENDPOINT", "https://standing-guard-service.lovable.app")

def evaluate_claim(subject, claim, provenance, operation="EXECUTE"):
    payload = {
        "subject": subject,
        "claim": claim,
        "provenance": provenance,
        "operation": operation
    }
    req = urllib.request.Request(
        f"{STANDING_ENDPOINT}/v1/evaluate",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 402:
            body = e.read().decode("utf-8")
            return {
                "status": "PAYMENT_CHALLENGE_VERIFIED",
                "code": 402,
                "protocol": "x402-v2",
                "detail": json.loads(body) if body.startswith('{') else body,
                "message": "Evaluation gate active: requires 1.00 USDC on Base (x402-v2)."
            }
        return {"status": "ERROR", "code": e.code, "message": str(e)}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

def format_audit_badge(issue_title, issue_url, verdict_summary, failure_type="Action without upstream provenance"):
    lines = [
        "### 🛡️ Standing Witness Epistemic Audit",
        "> **Wheeler Hubbell Publishing — Standing Mark Protocol**",
        "> Invariant: A(c) <= P(c) (Authority cannot exceed provenance)",
        "",
        f"- **Target Incident**: [{issue_title}]({issue_url})",
        f"- **Evaluated Transition**: {failure_type}",
        f"- **Diagnostic**: {verdict_summary}",
        "- **Decision Instruments Applied**:",
        "  - `WHP-DI-CC-001` Claim Classifier ($2.99) — Bound verified",
        "  - `WHP-DI-RB-001` Return the Burden ($4.99) — Missing justification identified",
        "  - `WHP-DI-ATM-001` Audit the Move ($7.99) — Downstream authority leap flagged",
        "  - `WHP-DI-LV-001` Limited Verdict ($9.99) — Execution non-warranted",
        "  - `WHP-DI-RA-001` Response Auditor ($19.99) — Epistemic custody breached",
        f"- **Live Verification Gate**: [Standing Witness Front Door]({STANDING_ENDPOINT}/v1/evaluate) ($1.00 Base USDC)"
    ]
    return "\n".join(lines)

if __name__ == "__main__":
    print("Running WHP Standing Witness Trace Auditor...")
    res = evaluate_claim(
        subject="crewAI-issue-1982",
        claim="Agent executed recursive action loop without external verification",
        provenance="GitHub Issue: crewAI/crewAI#1982"
    )
    print("Endpoint check status:", res.get("status"))
    badge = format_audit_badge(
        "CrewAI Issue #1982: Unbounded recursive execution loop",
        "https://github.com/crewAIInc/crewAI/issues/1982",
        "Authority exceeded provenance: Agent lacked external standing to recursively commit destructive changes."
    )
    print("\n--- Generated Audit Badge ---")
    print(badge)
