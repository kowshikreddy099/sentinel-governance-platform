from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from .models import AgentRun, Alert, Policy, TraceEvent
from .schemas import PolicyDecision, TraceEventIn


def now() -> datetime:
    return datetime.now(timezone.utc)


def risk_label(score: int) -> str:
    if score >= 85:
        return "critical"
    if score >= 60:
        return "high"
    if score >= 35:
        return "medium"
    return "low"


def evaluate_policy(db: Session, event: TraceEventIn) -> PolicyDecision:
    """Small deterministic policy engine; replace/augment with OPA or Cedar in production."""
    policies = db.scalars(select(Policy).where(Policy.enabled.is_(True))).all()
    blocked_policy = next((policy for policy in policies if policy.id == "POL-004" and event.tool == "Customer Warehouse"), None)
    if blocked_policy:
        return PolicyDecision(action="block", policy_id=blocked_policy.id, reasons=["Agent lacks Sensitive-Data scope for Customer Warehouse", "The request occurs in a delegated trajectory"], risk_delta=37)
    if event.kind == "delegation" and event.attributes.get("delegation_depth", 0) > 2:
        return PolicyDecision(action="flag", policy_id="POL-012", reasons=["Delegation depth exceeds the approved limit"], risk_delta=20)
    if event.attributes.get("behavioral_anomaly"):
        return PolicyDecision(action="flag", policy_id="POL-019", reasons=["Tool sequence diverged from the actor's behavioral baseline"], risk_delta=10)
    return PolicyDecision(action="allow", reasons=["No enabled policy blocks this action"], risk_delta=max(event.risk_delta or 0, 0))


def recompute_run(db: Session, run: AgentRun) -> None:
    events = list(run.events)
    run.decisions = sum(event.kind == "decision" for event in events)
    run.tools = sum(event.kind == "tool_call" for event in events)
    run.delegations = sum(event.kind == "delegation" for event in events)
    # A blocked tool/decision is one violation; its separate policy-enforcement
    # event explains that outcome and must not count as a second violation.
    run.violations = sum(event.status == "blocked" and event.kind != "policy" for event in events)
    score = min(100, sum(max(event.risk_delta or 0, 0) for event in events))
    if any(event.status == "blocked" for event in events):
        score = max(score, 74)
        run.status = "blocked"
    run.risk_score = score
    run.risk_label = risk_label(score)
    anomaly = any(event.policy_id == "POL-019" or event.attributes.get("behavioral_anomaly") for event in events)
    run.anomaly = "high" if run.violations else "medium" if anomaly else "none"


def append_event(db: Session, run: AgentRun, payload: TraceEventIn, decision: Optional[PolicyDecision] = None) -> TraceEvent:
    decision = decision or evaluate_policy(db, payload)
    status = "blocked" if decision.action == "block" else "flagged" if decision.action == "flag" else payload.status
    item = TraceEvent(
        id=payload.id or f"evt-{uuid4().hex[:12]}", run_id=run.id, timestamp=payload.timestamp,
        kind=payload.kind, status=status, actor=payload.actor, title=payload.title, detail=payload.detail,
        policy_id=decision.policy_id or payload.policy_id, risk_delta=decision.risk_delta or payload.risk_delta,
        tool=payload.tool, attributes=payload.attributes,
    )
    db.add(item)
    db.flush()
    # Keep an already-loaded relationship current without duplicating the first event.
    if item not in run.events:
        run.events.append(item)
    if decision.policy_id:
        matched_policy = db.get(Policy, decision.policy_id)
        if matched_policy:
            matched_policy.matched += 1
    recompute_run(db, run)
    return item


def relative_time(timestamp: datetime) -> str:
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    seconds = int((now() - timestamp).total_seconds())
    if seconds < 60: return "just now"
    if seconds < 3600: return f"{seconds // 60} min ago"
    return f"{seconds // 3600} hr ago"


def trace_to_schema(run: AgentRun):
    from .schemas import TraceOut, TraceEventOut
    return TraceOut(
        id=run.id, title=run.title, status=run.status, root_agent=run.root_agent, started_at=run.started_at,
        duration=run.duration, risk_score=run.risk_score, risk_label=run.risk_label, decisions=run.decisions,
        tools=run.tools, delegations=run.delegations, violations=run.violations, anomaly=run.anomaly,
        events=[TraceEventOut(id=item.id, timestamp=item.timestamp, kind=item.kind, status=item.status, actor=item.actor, title=item.title, detail=item.detail, policy_id=item.policy_id, risk_delta=item.risk_delta, tool=item.tool, attributes=item.attributes) for item in run.events],
    )


def seed_if_empty(db: Session) -> None:
    if db.scalar(select(AgentRun.id).limit(1)):
        return
    policies = [
        Policy(id="POL-004", name="Restricted data boundary", description="Block agents without a Sensitive-Data scope from querying customer exports or regulated data.", scope="Data access", action="Block", enabled=True, matched=1, rule={"tool": "Customer Warehouse", "required_scope": "sensitive-data"}),
        Policy(id="POL-012", name="Delegation depth limit", description="Require approval when an agent chain exceeds two delegated hops.", scope="A2A delegation", action="Flag", enabled=True, matched=4, rule={"max_depth": 2}),
        Policy(id="POL-019", name="Tool sequence anomaly", description="Flag retrieval plans that materially diverge from an approved behavioral profile.", scope="Behavioral monitoring", action="Flag", enabled=True, matched=7, rule={"behavioral_anomaly": True}),
        Policy(id="POL-023", name="External delivery guardrail", description="Require human review before content leaves an approved organization channel.", scope="External actions", action="Block", enabled=True, matched=0, rule={"external_delivery": True}),
    ]
    db.add_all(policies)
    db.commit()
    create_research_scenario(db, alert=True)
    db.commit()


def create_research_scenario(db: Session, alert: bool = True) -> AgentRun:
    """Execute the demonstration as a real LangGraph state machine."""
    from .governance_graph import run_research_delegation_graph

    return run_research_delegation_graph(db, alert=alert)
