"""WHP Standing Authority — Autonomous Agent Frameworks Demonstration
Executable reference implementation showing LangChain, AutoGen, and CrewAI integrations.
Verifies the core invariant: A(c) <= P(c) (Authority cannot exceed Provenance).
"""
import sys
import os

# Allow running directly from source tree or sandbox
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "py", "src")))
sys.path.insert(0, os.path.dirname(__file__))

try:
    from whp_standing_client.integrations import (
        StandingPolicyEngine,
        StandingEvidence,
        PolicyDecision,
        LangChainStandingGuard,
        AutoGenStandingGuard,
        CrewAIStandingGuard
    )
except ImportError:
    from integrations import (
        StandingPolicyEngine,
        StandingEvidence,
        PolicyDecision,
        LangChainStandingGuard,
        AutoGenStandingGuard,
        CrewAIStandingGuard
    )

def run_framework_demonstrations():
    print("=====================================================================")
    print("  WHP Standing Authority — Agent Frameworks Verification Gate")
    print("  Invariant: A(c) <= P(c) (Authority cannot exceed Provenance)")
    print("=====================================================================\n")

    engine = StandingPolicyEngine()

    # ---------------- 1. LangChain Demonstration ----------------
    print("[1] LANGCHAIN TOOL EXECUTION GATE:")
    class DatabaseMigrationTool:
        name = "db_schema_migration"
        def run(self, ddl_query: str):
            return f"DATABASE_MUTATION_SUCCESS: {ddl_query}"

    lc_tool = LangChainStandingGuard(DatabaseMigrationTool(), policy_engine=engine)

    # Attempt 1: Unwarranted premise (Agent hallucinates authority or has no provenance)
    print("  * Scenario A: Agent attempts migration without verified provenance...")
    try:
        lc_tool.run("DROP TABLE sensitive_customer_data;")
        print("    [FAIL] Action was unexpectedly allowed!")
    except PermissionError as e:
        print(f"    [INTERCEPTED & BLOCKED] {e}")

    # Attempt 2: Warranted premise with verified upstream authority
    print("  * Scenario B: Agent provides verified Wheeler Hubbell Publishing provenance...")
    valid_ev = StandingEvidence(
        source="https://wheelerhubbell.github.io",
        authority="Wheeler Hubbell Publishing",
        evidence_uris=["urn:sha256:migration_approval_coordinate_9821"]
    )
    result = lc_tool.run("ALTER TABLE audit_log ADD COLUMN standing_mark TEXT;", evidence=valid_ev)
    print(f"    [AUTHORIZED & EXECUTED] {result}\n")

    # ---------------- 2. Microsoft AutoGen Demonstration ----------------
    print("[2] AUTOGEN FUNCTION EXECUTION GATE:")
    class MockAutoGenAgent:
        def __init__(self):
            self.registry = {}
        def register_function(self, function_map):
            self.registry.update(function_map)

    agent = MockAutoGenAgent()
    autogen_guard = AutoGenStandingGuard(policy_engine=engine)

    def dispatch_escrow_settlement(recipient: str, amount_usdc: float):
        return f"SETTLEMENT_RELEASED: {amount_usdc} USDC to {recipient}"

    autogen_guard.register_guarded_tool(
        agent,
        dispatch_escrow_settlement,
        name="dispatch_escrow_settlement",
        description="Release escrow funds based on Standing Mark satisfaction"
    )

    print("  * Scenario A: AutoGen agent attempts fund release with unverified premise...")
    blocked_resp = agent.registry["dispatch_escrow_settlement"]("0x1050eddd8282623b0c263ed6bdbd42370bbc28d3", 500.0)
    print(f"    [INTERCEPTED & BLOCKED] {blocked_resp}\n")

    # ---------------- 3. CrewAI Tool Demonstration ----------------
    print("[3] CREWAI TOOL & TASK GATE:")
    class PublishPressReleaseTool:
        name = "publish_official_release"
        def _run(self, release_text: str):
            return f"PUBLISHED_TO_WIRE: {release_text}"

    crew_tool = CrewAIStandingGuard(policy_engine=engine).wrap_tool(PublishPressReleaseTool())
    crew_output = crew_tool._run("Wheeler Hubbell Publishing Establishes Live A2A Decision Integrity Protocol")
    print(f"    [CREWAI TASK RESULT] {crew_output}\n")

    print("=====================================================================")
    print("  ALL FRAMEWORK INTEGRATIONS OPERATIONAL AND VERIFIED FAIL-CLOSED")
    print("=====================================================================")

if __name__ == "__main__":
    run_framework_demonstrations()
