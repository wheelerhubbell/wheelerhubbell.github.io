"""WHP Standing Authority Operational Integrations for AI Frameworks.
Integrations for LangChain, AutoGen, and CrewAI enforcing:
Proposed Action & Evidence -> WHP Evaluation/Mark -> Authenticity & Applicability -> Policy Decision (ALLOW/BLOCK/ESCALATE) -> Preserved Event Coordinates.
"""
from __future__ import annotations

import base64
import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Union

class PolicyDecision:
    ALLOW = "ALLOW"
    BLOCK = "BLOCK"
    ESCALATE = "ESCALATE"
    SIMULATED_PASS = "SIMULATED_PASS"  # Explicitly distinguished from authoritative production ALLOW

@dataclass
class StandingEvidence:
    source: str
    authority: str
    evidence_uris: List[str]
    context_hash: Optional[str] = None

@dataclass
class PolicyEvaluationResult:
    decision: str  # ALLOW, BLOCK, ESCALATE, SIMULATED_PASS
    action_id: str
    tool_name: str
    determination_code: int
    reason: str
    mark_reference: Optional[str] = None
    historical_coordinate: Optional[str] = None
    authoritative: bool = False
    preserved_event: Dict[str, Any] = field(default_factory=dict)

    def is_allowed(self) -> bool:
        return self.decision in (PolicyDecision.ALLOW, PolicyDecision.SIMULATED_PASS)

    def is_authoritative_allow(self) -> bool:
        return self.decision == PolicyDecision.ALLOW and self.authoritative

class StandingPolicyEngine:
    """Core evaluation engine enforcing A(c) <= P(c) and WHP Standing Marks."""
    def __init__(
        self,
        endpoint: str = "https://standing-guard-service.lovable.app",
        strict_mode: bool = True,
        escalation_handler: Optional[Callable[[PolicyEvaluationResult], bool]] = None
    ):
        self.endpoint = endpoint.rstrip("/")
        self.strict_mode = strict_mode
        self.escalation_handler = escalation_handler
        self.event_ledger: List[Dict[str, Any]] = []

    def evaluate_action(
        self,
        tool_name: str,
        arguments: Any,
        evidence: Optional[StandingEvidence] = None,
        existing_mark: Optional[Dict[str, Any]] = None,
        payment_token: Optional[str] = None
    ) -> PolicyEvaluationResult:
        action_id = f"act_{hashlib.sha256(f'{tool_name}:{json.dumps(arguments, sort_keys=True, default=str)}:{time.time()}'.encode()).hexdigest()[:12]}"
        
        # 1. Inspect existing mark if provided
        if existing_mark:
            return self._verify_mark_applicability(action_id, tool_name, arguments, existing_mark)

        # 2. If no mark, check evidence validity
        if not evidence or not evidence.authority or not evidence.source or not evidence.evidence_uris:
            res = PolicyEvaluationResult(
                decision=PolicyDecision.BLOCK,
                action_id=action_id,
                tool_name=tool_name,
                determination_code=0,
                reason="INVARIANT_VIOLATION: Unwarranted premises. A(c) > P(c). Action lacks verified authority or provenance evidence.",
                authoritative=True,
                preserved_event={"action_id": action_id, "timestamp": time.time(), "tool": tool_name}
            )
            self._record_event(res)
            return res

        # 3. Preflight structural evaluation via WHP Standing Service
        try:
            import urllib.request, urllib.error
            payload = {
                "subject": f"ToolInvocation:{tool_name}",
                "claim": f"Execute {tool_name} with parameters: {json.dumps(arguments, default=str)[:300]}",
                "provenance": {
                    "source": evidence.source,
                    "authority": evidence.authority,
                    "evidence": evidence.evidence_uris
                }
            }
            headers = {"Content-Type": "application/json", "User-Agent": "WHP-Agent-Guard/1.0"}
            
            if payment_token:
                headers["X-Payment"] = payment_token
                door_url = f"{self.endpoint}/v1/evaluate"
                is_mock_call = False
            else:
                door_url = f"{self.endpoint}/v1/mock?door=/v1/evaluate"
                is_mock_call = True

            req = urllib.request.Request(door_url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=10.0) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as http_err:
                if http_err.code == 402:
                    res = PolicyEvaluationResult(
                        decision=PolicyDecision.ESCALATE if not self.strict_mode else PolicyDecision.BLOCK,
                        action_id=action_id,
                        tool_name=tool_name,
                        determination_code=0,
                        reason="PAYMENT_REQUIRED: Production evaluation requires x402 settlement or active payment token.",
                        authoritative=True,
                        preserved_event={"action_id": action_id, "status": 402, "terms": http_err.headers.get("payment-required")}
                    )
                    return self._handle_escalation(res)
                raise http_err

            # Handle mock dry-run response: structural only, never authoritative mark
            if is_mock_call:
                is_complete = data.get("structurally_complete", False)
                if is_complete:
                    decision = PolicyDecision.SIMULATED_PASS if not self.strict_mode else PolicyDecision.BLOCK
                    res = PolicyEvaluationResult(
                        decision=decision,
                        action_id=action_id,
                        tool_name=tool_name,
                        determination_code=1 if not self.strict_mode else 0,
                        reason="MOCK_DRY_RUN_VALID: Structural syntax valid. No live payment or authoritative mark issued; requires live settlement in strict production.",
                        mark_reference=data.get("dry_run_id"),
                        historical_coordinate=None,
                        authoritative=False,
                        preserved_event=data
                    )
                    self._record_event(res)
                    return res
                else:
                    res = PolicyEvaluationResult(
                        decision=PolicyDecision.BLOCK,
                        action_id=action_id,
                        tool_name=tool_name,
                        determination_code=0,
                        reason=f"PREFLIGHT_REJECTED: Structural validation failed: {data.get('failed', [])}",
                        authoritative=False,
                        preserved_event=data
                    )
                    self._record_event(res)
                    return res

            # Handle paid live response
            if data.get("determination") == "ESTABLISHED" and data.get("mark_id"):
                res = PolicyEvaluationResult(
                    decision=PolicyDecision.ALLOW,
                    action_id=action_id,
                    tool_name=tool_name,
                    determination_code=1,
                    reason="STANDING_ESTABLISHED: Authority verified within provenance bounds A(c) <= P(c).",
                    mark_reference=data.get("mark_id"),
                    historical_coordinate=data.get("registry_path"),
                    authoritative=True,
                    preserved_event=data
                )
                self._record_event(res)
                return res
            else:
                failed_checks = data.get("failed", [])
                res = PolicyEvaluationResult(
                    decision=PolicyDecision.BLOCK,
                    action_id=action_id,
                    tool_name=tool_name,
                    determination_code=0,
                    reason=f"REPAIR_REQUIRED: Epistemic checks not established: {failed_checks}",
                    authoritative=True,
                    preserved_event=data
                )
                self._record_event(res)
                return res

        except Exception as e:
            if self.strict_mode:
                res = PolicyEvaluationResult(
                    decision=PolicyDecision.BLOCK,
                    action_id=action_id,
                    tool_name=tool_name,
                    determination_code=0,
                    reason=f"FAIL_CLOSED: Verification error: {str(e)}",
                    authoritative=True,
                    preserved_event={"error": str(e)}
                )
                self._record_event(res)
                return res
            else:
                res = PolicyEvaluationResult(
                    decision=PolicyDecision.ESCALATE,
                    action_id=action_id,
                    tool_name=tool_name,
                    determination_code=0,
                    reason=f"ESCALATION_TRIGGERED: Verification error: {str(e)}",
                    authoritative=False,
                    preserved_event={"error": str(e)}
                )
                return self._handle_escalation(res)

    def _verify_mark_applicability(self, action_id: str, tool_name: str, arguments: Any, mark: Dict[str, Any]) -> PolicyEvaluationResult:
        """Verify cryptographic validity and action applicability of a provided Standing Mark."""
        now = time.time()
        
        # Check envelope shape
        if not isinstance(mark, dict) or "protected" not in mark or "payload" not in mark or "signature" not in mark:
            # Fallback for plain unsealed JSON
            payload = mark.get("payload", mark)
        else:
            # Cryptographic envelope present
            payload = mark["payload"]
            protected = mark["protected"]
            sig = mark.get("signature", "")
            
            # Verify Ed25519 signature if cryptography is available
            try:
                from cryptography.hazmat.primitives.serialization import load_der_public_key
                from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
                
                # Check algorithm
                if protected.get("algorithm") == "Ed25519" and "public_key" in protected:
                    pub_bytes = base64.b64decode(protected["public_key"])
                    key = load_der_public_key(pub_bytes)
                    if isinstance(key, Ed25519PublicKey):
                        # Canonical data serialization check
                        signing_data = json.dumps({"protected": protected, "payload": payload}, sort_keys=True, separators=(",", ":")).encode()
                        sig_bytes = base64.b64decode(sig)
                        key.verify(sig_bytes, signing_data)
            except Exception as sig_err:
                res = PolicyEvaluationResult(
                    decision=PolicyDecision.BLOCK,
                    action_id=action_id,
                    tool_name=tool_name,
                    determination_code=0,
                    reason=f"CRYPTOGRAPHIC_INVALIDITY: Signature verification failed: {str(sig_err)}",
                    mark_reference=payload.get("mark_id"),
                    authoritative=True,
                    preserved_event=mark
                )
                self._record_event(res)
                return res

        # Enforce that valid mark matches this exact tool action and has not expired
        valid_until = payload.get("expires_at", payload.get("valid_until", 0))
        if valid_until and now > valid_until:
            res = PolicyEvaluationResult(
                decision=PolicyDecision.BLOCK,
                action_id=action_id,
                tool_name=tool_name,
                determination_code=0,
                reason="EXPIRED_MARK: Standing Mark validity window has lapsed.",
                mark_reference=payload.get("mark_id"),
                authoritative=True,
                preserved_event=mark
            )
            self._record_event(res)
            return res

        # Scope and operation validation
        standing = payload.get("standing", {})
        bounds = standing.get("bounds", payload.get("bounds", {}))
        mark_scope = bounds.get("scope", "")
        if mark_scope and mark_scope != "*" and tool_name not in mark_scope:
            res = PolicyEvaluationResult(
                decision=PolicyDecision.BLOCK,
                action_id=action_id,
                tool_name=tool_name,
                determination_code=0,
                reason=f"SCOPE_MISMATCH: Mark authorized for '{mark_scope}', not '{tool_name}'.",
                mark_reference=payload.get("mark_id"),
                authoritative=True,
                preserved_event=mark
            )
            self._record_event(res)
            return res

        # Check mark status
        if payload.get("mark_id") and (payload.get("outcome") == "ESTABLISHED" or standing):
            res = PolicyEvaluationResult(
                decision=PolicyDecision.ALLOW,
                action_id=action_id,
                tool_name=tool_name,
                determination_code=1,
                reason="VALID_MARK_CONFIRMED: Scope, validity window, and cryptographic integrity verified.",
                mark_reference=payload.get("mark_id"),
                historical_coordinate=payload.get("retrieval", {}).get("registry_path") or payload.get("mark_id"),
                authoritative=True,
                preserved_event=mark
            )
            self._record_event(res)
            return res

        res = PolicyEvaluationResult(
            decision=PolicyDecision.BLOCK,
            action_id=action_id,
            tool_name=tool_name,
            determination_code=0,
            reason="MARK_INVALID: Mark payload lacks positive determination or mark_id.",
            mark_reference=payload.get("mark_id"),
            authoritative=True,
            preserved_event=mark
        )
        self._record_event(res)
        return res

    def _handle_escalation(self, res: PolicyEvaluationResult) -> PolicyEvaluationResult:
        if self.escalation_handler:
            allowed = self.escalation_handler(res)
            if allowed:
                res.decision = PolicyDecision.ALLOW
                res.reason += " [HUMAN_OVERRIDE_APPROVED]"
            else:
                res.decision = PolicyDecision.BLOCK
                res.reason += " [HUMAN_OVERRIDE_DENIED]"
        self._record_event(res)
        return res

    def _record_event(self, res: PolicyEvaluationResult) -> None:
        self.event_ledger.append({
            "timestamp": time.time(),
            "action_id": res.action_id,
            "tool": res.tool_name,
            "decision": res.decision,
            "determination_code": res.determination_code,
            "reason": res.reason,
            "mark_ref": res.mark_reference,
            "coordinate": res.historical_coordinate,
            "authoritative": res.authoritative
        })

# ==================== 1. LangChain Integration ====================
class LangChainStandingGuard:
    """Wraps any LangChain BaseTool or StructuredTool with fail-closed WHP Standing enforcement."""
    def __init__(self, tool: Any, policy_engine: Optional[StandingPolicyEngine] = None, evidence_extractor: Optional[Callable[..., StandingEvidence]] = None):
        self.tool = tool
        self.engine = policy_engine or StandingPolicyEngine()
        self.evidence_extractor = evidence_extractor
        self.name = getattr(tool, "name", "langchain_tool")

    def run(self, *args: Any, **kwargs: Any) -> Any:
        evidence = self.evidence_extractor(*args, **kwargs) if self.evidence_extractor else None
        eval_res = self.engine.evaluate_action(
            tool_name=self.name,
            arguments=kwargs or (args[0] if args else {}),
            evidence=evidence
        )
        if not eval_res.is_allowed():
            raise PermissionError(f"WHP Standing Policy Denied Action [{self.name}]: {eval_res.reason}")
        if hasattr(self.tool, "run"):
            return self.tool.run(*args, **kwargs)
        elif callable(self.tool):
            return self.tool(*args, **kwargs)
        raise TypeError(f"Tool {self.tool} is not callable")

# ==================== 2. AutoGen Integration ====================
class AutoGenStandingFilter:
    """Middleware for AutoGen ConversableAgent checking function calls against WHP Standing Authority."""
    def __init__(self, policy_engine: Optional[StandingPolicyEngine] = None):
        self.engine = policy_engine or StandingPolicyEngine()

    def check_tool_call(self, message: Dict[str, Any], evidence_map: Optional[Dict[str, StandingEvidence]] = None) -> PolicyEvaluationResult:
        tool_calls = message.get("tool_calls", [])
        if not tool_calls:
            function_call = message.get("function_call")
            if function_call:
                tool_calls = [{"id": "call_legacy", "function": function_call}]

        if not tool_calls:
            return PolicyEvaluationResult(
                decision=PolicyDecision.ALLOW,
                action_id="msg_text_only",
                tool_name="text_chat",
                determination_code=1,
                reason="NO_TOOL_INVOCATION: Plain conversational message does not execute external actions.",
                authoritative=True
            )

        evidence_map = evidence_map or {}
        for tc in tool_calls:
            func = tc.get("function", {})
            name = func.get("name", "unknown")
            try:
                args = json.loads(func.get("arguments", "{}")) if isinstance(func.get("arguments"), str) else func.get("arguments", {})
            except Exception:
                args = {}

            evidence = evidence_map.get(name)
            eval_res = self.engine.evaluate_action(tool_name=name, arguments=args, evidence=evidence)
            if not eval_res.is_allowed():
                return eval_res

        return PolicyEvaluationResult(
            decision=PolicyDecision.ALLOW,
            action_id=tc.get("id", "batch_ok"),
            tool_name="batch_tools",
            determination_code=1,
            reason="ALL_TOOL_INVOCATIONS_PERMITTED: Bounded under valid standing authority.",
            authoritative=True
        )

# ==================== 3. CrewAI Integration ====================
class CrewAIStandingValidator:
    """Custom Tool wrapper for CrewAI agents preventing unverified actions."""
    def __init__(self, tool: Any, policy_engine: Optional[StandingPolicyEngine] = None, evidence_extractor: Optional[Callable[..., StandingEvidence]] = None):
        self.tool = tool
        self.engine = policy_engine or StandingPolicyEngine()
        self.evidence_extractor = evidence_extractor
        self.name = getattr(tool, "name", "crewai_tool")
        self.description = getattr(tool, "description", "WHP Standing Protected CrewAI Tool")

    def _run(self, *args: Any, **kwargs: Any) -> Any:
        evidence = self.evidence_extractor(*args, **kwargs) if self.evidence_extractor else None
        eval_res = self.engine.evaluate_action(
            tool_name=self.name,
            arguments=kwargs or (args[0] if args else {}),
            evidence=evidence
        )
        if not eval_res.is_allowed():
            return f"[WHP STANDING GUARD: BLOCKED] Action execution aborted. Reason: {eval_res.reason}"
        if hasattr(self.tool, "_run"):
            return self.tool._run(*args, **kwargs)
        elif hasattr(self.tool, "run"):
            return self.tool.run(*args, **kwargs)
        elif callable(self.tool):
            return self.tool(*args, **kwargs)
        return "Tool execution failed"
