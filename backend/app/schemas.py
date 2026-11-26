from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

Severity = Literal["critical", "high", "medium", "low"]
EventStatus = Literal["allowed", "blocked", "flagged", "observed"]
EventKind = Literal["decision", "delegation", "tool_call", "policy", "risk", "completion"]


class TraceEventIn(BaseModel):
    id: Optional[str] = None
    timestamp: datetime
    kind: EventKind
    status: EventStatus = "observed"
    actor: str
    title: str
    detail: str
    policy_id: Optional[str] = None
    risk_delta: Optional[int] = None
    tool: Optional[str] = None
    attributes: dict = Field(default_factory=dict)


class TraceEventOut(TraceEventIn):
    id: str


class TraceOut(BaseModel):
    id: str
    title: str
    status: Literal["active", "blocked", "complete", "review"]
    root_agent: str
    started_at: datetime
    duration: str
    risk_score: int
    risk_label: Severity
    decisions: int
    tools: int
    delegations: int
    violations: int
    anomaly: Literal["none", "low", "medium", "high"]
    events: list[TraceEventOut] = []


class AgentOut(BaseModel):
    id: str
    name: str
    initials: str
    role: str
    color: str
    trust: int


class PolicyOut(BaseModel):
    id: str
    name: str
    description: str
    scope: str
    action: Literal["Block", "Flag", "Allow"]
    enabled: bool
    matched: int


class AlertOut(BaseModel):
    id: str
    severity: Severity
    title: str
    message: str
    trace_id: str
    time: str
    state: Literal["open", "acknowledged", "resolved"]


class AlertUpdate(BaseModel):
    state: Literal["open", "acknowledged", "resolved"]


class PolicyUpdate(BaseModel):
    enabled: bool


class DashboardOut(BaseModel):
    agents: list[AgentOut]
    traces: list[TraceOut]
    policies: list[PolicyOut]
    alerts: list[AlertOut]


class PolicyDecision(BaseModel):
    action: Literal["allow", "flag", "block"]
    policy_id: Optional[str] = None
    reasons: list[str]
    risk_delta: int


class IngestEventRequest(BaseModel):
    trace_id: str
    event: TraceEventIn


class IngestEventResponse(BaseModel):
    event: TraceEventOut
    decision: PolicyDecision
    trace: TraceOut
