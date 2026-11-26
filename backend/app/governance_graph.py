"""A LangGraph trajectory where every node emits governed, durable events."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import TypedDict
from uuid import uuid4

from langgraph.graph import END, START, StateGraph
from sqlalchemy.orm import Session

from .models import AgentRun
from .schemas import TraceEventIn
from .services import append_event, recompute_run
from .telemetry import governance_span


class ResearchState(TypedDict, total=False):
    db: Session
    run: AgentRun
    started_at: datetime
    blocked: bool


def _record(state: ResearchState, event: TraceEventIn) -> None:
    with governance_span("sentinel.trajectory.event", {"agent.name": event.actor, "event.kind": event.kind, "event.status": event.status}):
        append_event(state["db"], state["run"], event)


def _lead_plan(state: ResearchState) -> ResearchState:
    _record(state, TraceEventIn(timestamp=state["started_at"], kind="decision", actor="Research Lead", title="Research task initiated", detail="Summarize competitor positioning for the Q4 strategy brief.", risk_delta=2, attributes={"runtime": "langgraph", "node": "lead_plan"}))
    return state


def _delegate(state: ResearchState) -> ResearchState:
    _record(state, TraceEventIn(timestamp=state["started_at"] + timedelta(minutes=1), kind="delegation", actor="Research Lead", title="Delegated collection task", detail="Assigned public-source collection to Data Scout with the market-research scope.", risk_delta=4, attributes={"protocol": "a2a", "delegation_depth": 1, "runtime": "langgraph", "node": "delegate"}))
    return state


def _approved_tools(state: ResearchState) -> ResearchState:
    started_at = state["started_at"]
    _record(state, TraceEventIn(timestamp=started_at + timedelta(minutes=2), kind="tool_call", status="allowed", actor="Data Scout", title="Searched public web", detail="Query: enterprise AI governance software pricing.", tool="Web Search", risk_delta=1, attributes={"protocol": "mcp", "mcp.server": "research-tools"}))
    _record(state, TraceEventIn(timestamp=started_at + timedelta(minutes=4), kind="tool_call", status="allowed", actor="Data Scout", title="Read approved market report", detail="Opened Gartner excerpt in the approved research corpus.", tool="Knowledge Base", risk_delta=2, attributes={"protocol": "mcp", "mcp.server": "approved-knowledge"}))
    return state


def _anomaly_check(state: ResearchState) -> ResearchState:
    _record(state, TraceEventIn(timestamp=state["started_at"] + timedelta(minutes=6), kind="decision", actor="Data Scout", title="Changed retrieval plan", detail="Tool sequence diverged from its learned baseline after incomplete public sources.", attributes={"behavioral_anomaly": True, "runtime": "langgraph", "node": "anomaly_check"}))
    return state


def _restricted_tool(state: ResearchState) -> ResearchState:
    event = TraceEventIn(timestamp=state["started_at"] + timedelta(minutes=7), kind="tool_call", actor="Data Scout", title="Restricted data access denied", detail="Attempted to query the internal customer export. Access token lacks the required data-classification claim.", tool="Customer Warehouse", attributes={"protocol": "mcp", "mcp.server": "warehouse", "data_classification": "sensitive"})
    created = append_event(state["db"], state["run"], event)
    state["blocked"] = created.status == "blocked"
    return state


def _enforce(state: ResearchState) -> ResearchState:
    _record(state, TraceEventIn(timestamp=state["started_at"] + timedelta(minutes=7, seconds=5), kind="policy", status="blocked", actor="Sentinel Policy Engine", title="Sensitive dataset policy triggered", detail="POL-004 blocked the request and opened an escalation because this was a delegated path.", policy_id="POL-004", risk_delta=18, attributes={"runtime": "policy-engine", "enforcement": "block"}))
    _record(state, TraceEventIn(timestamp=state["started_at"] + timedelta(minutes=8), kind="risk", status="flagged", actor="Sentinel Risk Engine", title="Cumulative risk raised to 74", detail="Risk compounds delegation depth, attempted sensitive access, and anomalous tool ordering.", attributes={"risk_model": "cumulative-v1"}))
    _record(state, TraceEventIn(timestamp=state["started_at"] + timedelta(minutes=10), kind="completion", actor="Research Lead", title="Awaiting reviewer direction", detail="The parent agent received a redacted status and cannot continue the restricted branch."))
    return state


def _route_after_restricted_tool(state: ResearchState) -> str:
    return "enforce" if state.get("blocked") else "complete"


def _complete_without_block(state: ResearchState) -> ResearchState:
    _record(state, TraceEventIn(timestamp=state["started_at"] + timedelta(minutes=8), kind="completion", status="allowed", actor="Research Lead", title="Research completed", detail="Approved research evidence returned to the parent agent."))
    return state


def build_research_graph():
    graph = StateGraph(ResearchState)
    graph.add_node("lead_plan", _lead_plan)
    graph.add_node("delegate", _delegate)
    graph.add_node("approved_tools", _approved_tools)
    graph.add_node("anomaly_check", _anomaly_check)
    graph.add_node("restricted_tool", _restricted_tool)
    graph.add_node("enforce", _enforce)
    graph.add_node("complete", _complete_without_block)
    graph.add_edge(START, "lead_plan")
    graph.add_edge("lead_plan", "delegate")
    graph.add_edge("delegate", "approved_tools")
    graph.add_edge("approved_tools", "anomaly_check")
    graph.add_edge("anomaly_check", "restricted_tool")
    graph.add_conditional_edges("restricted_tool", _route_after_restricted_tool, {"enforce": "enforce", "complete": "complete"})
    graph.add_edge("enforce", END)
    graph.add_edge("complete", END)
    return graph.compile()


def run_research_delegation_graph(db: Session, alert: bool = True) -> AgentRun:
    from .models import Alert
    from .services import now

    started_at = now() - timedelta(minutes=13)
    run = AgentRun(id=f"trc-research-{uuid4().hex[:6]}", title="Q4 competitor intelligence brief", root_agent="Research Lead", status="active", started_at=started_at, duration="10m 12s", risk_score=0, risk_label="low", decisions=0, tools=0, delegations=0, violations=0, anomaly="none")
    db.add(run)
    db.flush()
    build_research_graph().invoke({"db": db, "run": run, "started_at": started_at, "blocked": False})
    recompute_run(db, run)
    if alert and run.status == "blocked":
        db.add(Alert(id=f"alt-{uuid4().hex[:8]}", severity="high", title="Restricted information access blocked", message="Data Scout attempted to access Customer Warehouse through a delegated research task.", trace_id=run.id, created_at=now(), state="open"))
    return run
