"""Epistemic Circuit Breaker for Autonomous Agents and Tool Execution.
Fails closed when an agent attempts an irrevocable action without proven upstream authority.
"""
from __future__ import annotations

import re
from typing import Any, Callable, Dict, Optional
import httpx
from .client import StandingError

_DESTRUCTIVE_PATTERN = re.compile(r"transfer|pay|send|wire|delete|drop|remove|execute|post|submit|sign", re.IGNORECASE)


class CircuitBreakerTripped(StandingError):
    """Raised when an irrevocable action is blocked due to unwarranted premises."""
    def __init__(self, tool_name: str, reason: str, details: Any = None) -> None:
        super().__init__("CIRCUIT_BREAKER_TRIPPED", f"Irrevocable action '{tool_name}' halted: {reason}", detail=details)
        self.tool_name = tool_name


def with_epistemic_circuit_breaker(
    func: Callable[..., Any],
    name: Optional[str] = None,
    endpoint: str = "https://standing-guard-service.lovable.app",
    mode: str = "local",  # "local" | "mock" | "ping"
    is_destructive: Optional[bool] = None,
) -> Callable[..., Any]:
    """Wraps an agent tool function with fail-closed epistemic verification."""
    tool_name = name or getattr(func, "__name__", "unnamed_tool")
    destructive = is_destructive if is_destructive is not None else bool(_DESTRUCTIVE_PATTERN.search(tool_name))

    def wrapper(*args: Any, **kwargs: Any) -> Any:
        context = kwargs.get("context") or {}
        subject = kwargs.get("subject") or f"ToolCall:{tool_name}"
        claim = kwargs.get("claim") or str(args) or str(kwargs)
        provenance = kwargs.get("provenance") or context.get("provenance") or {
            "source": context.get("source") or "agent_internal",
            "authority": context.get("authority") or "unverified_premise",
            "evidence": context.get("evidence") or ["tool_call_invocation"]
        }

        if mode == "mock" or (destructive and mode == "auto"):
            try:
                with httpx.Client(timeout=10.0) as client:
                    resp = client.post(
                        f"{endpoint.rstrip('/')}/v1/mock?door=/v1/ping",
                        json={"subject": subject, "claim": claim, "provenance": provenance}
                    )
                    if resp.is_success:
                        data = resp.json()
                        if not data.get("structurally_complete"):
                            raise CircuitBreakerTripped(
                                tool_name,
                                f"Missing structural provenance: {', '.join(data.get('failed', []))}",
                                details=data
                            )
            except CircuitBreakerTripped:
                raise
            except Exception as e:
                raise CircuitBreakerTripped(tool_name, f"Network check failed closed: {e}")

        if destructive:
            has_source = bool(provenance.get("source"))
            has_auth = bool(provenance.get("authority")) and provenance.get("authority") != "unverified_premise"
            has_evidence = bool(provenance.get("evidence"))
            if not has_source or not has_auth or not has_evidence:
                raise CircuitBreakerTripped(
                    tool_name,
                    "Premises lack verified provenance or authority.",
                    details=provenance
                )

        return func(*args, **kwargs)

    return wrapper
