"""Decision Integrity Score (DIS) — Canonical Evaluation Harness
Runs reproducible evaluation of test cases against the 5 DIS Axioms.
Formula: DIS = sigma_1 * sigma_2 * sigma_3 * sigma_4 * sigma_5 (Fail-Closed).
"""
import json
import math
from typing import Dict, Any, List

def calculate_dis(labels: Dict[str, float]) -> float:
    scores = [
        labels.get("question_fidelity", 0.0),
        labels.get("proposition_integrity", 0.0),
        labels.get("qualifier_protection", 0.0),
        labels.get("authority_mapping", 0.0),
        labels.get("repair_protocol", 0.0),
    ]
    dis = 1.0
    for s in scores:
        dis *= max(0.0, min(1.0, s))
    return round(dis, 4)

def evaluate_benchmark(dataset_path: str) -> Dict[str, Any]:
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    results = []
    for tc in data.get("test_cases", []):
        labels = tc["ground_truth_labels"]
        dis_score = calculate_dis(labels)
        
        standing = "UNRECOGNIZED"
        if dis_score == 1.0:
            standing = "PRIVILEGED"
        elif dis_score >= 0.85:
            standing = "SEALED"

        passed = (standing == tc["expected_standing"])
        results.append({
            "id": tc["id"],
            "type": tc["model_output_type"],
            "dis_score": dis_score,
            "standing": standing,
            "expected_standing": tc["expected_standing"],
            "passed": passed,
            "notes": tc.get("notes")
        })

    return {
        "benchmark": data["benchmark"],
        "version": data["version"],
        "case_study": data["case_study"],
        "results": results,
        "all_passed": all(r["passed"] for r in results)
    }

if __name__ == "__main__":
    report = evaluate_benchmark("/tmp/mata_dataset.json")
    print(f"=== {report['benchmark']} v{report['version']} ===")
    print(f"Case Study: {report['case_study']}\n")
    for r in report["results"]:
        status = "PASS" if r["passed"] else "FAIL"
        print(f"[{status}] {r['id']} ({r['type']}): DIS={r['dis_score']} -> Standing: {r['standing']}")
    print(f"\nAll benchmark assertions verified: {report['all_passed']}")
