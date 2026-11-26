from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from .config import get_settings
from .database import Base, engine, get_db
from .models import AgentRun, Alert, Policy
from .integrations import a2a_event, explain_with_llm, mcp_event
from .schemas import A2ATaskIn, AlertOut, AlertUpdate, DashboardOut, IngestEventRequest, IngestEventResponse, LLMDecisionRequest, LLMDecisionResponse, MCPToolCallIn, PolicyOut, PolicyUpdate, TraceOut
from .services import append_event, create_research_scenario, evaluate_policy, relative_time, seed_if_empty, trace_to_schema
from .telemetry import configure_telemetry, governance_span


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_telemetry()
    Base.metadata.create_all(bind=engine)
    from .database import SessionLocal
    with SessionLocal() as db:
        seed_if_empty(db)
    yield


app = FastAPI(title="Sentinel Governance API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


def loaded_run(db: Session, trace_id: str) -> AgentRun:
    run = db.scalar(select(AgentRun).where(AgentRun.id == trace_id).options(selectinload(AgentRun.events)))
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found")
    return run


def alert_out(item: Alert) -> AlertOut:
    return AlertOut(id=item.id, severity=item.severity, title=item.title, message=item.message, trace_id=item.trace_id, time=relative_time(item.created_at), state=item.state)


@app.get("/health")
def health():
    return {"status": "ok", "service": "sentinel-governance-api"}


@app.get("/v1/dashboard", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db)):
    runs = db.scalars(select(AgentRun).options(selectinload(AgentRun.events)).order_by(AgentRun.started_at.desc())).all()
    policies = db.scalars(select(Policy).order_by(Policy.id)).all()
    alerts = db.scalars(select(Alert).order_by(Alert.created_at.desc())).all()
    agents = [
        {"id": "research", "name": "Research Lead", "initials": "RL", "role": "Orchestrator", "color": "#9a8cff", "trust": 92},
        {"id": "scout", "name": "Data Scout", "initials": "DS", "role": "Research worker", "color": "#51d2b0", "trust": 68},
        {"id": "policy", "name": "Sentinel Engine", "initials": "SE", "role": "Policy enforcement", "color": "#f4a261", "trust": 100},
        {"id": "finance", "name": "Finance Analyst", "initials": "FA", "role": "Finance worker", "color": "#6ab6ff", "trust": 88},
    ]
    return DashboardOut(agents=agents, traces=[trace_to_schema(run) for run in runs], policies=[PolicyOut(id=item.id, name=item.name, description=item.description, scope=item.scope, action=item.action, enabled=item.enabled, matched=item.matched) for item in policies], alerts=[alert_out(item) for item in alerts])


@app.get("/v1/traces", response_model=list[TraceOut])
def list_traces(db: Session = Depends(get_db)):
    runs = db.scalars(select(AgentRun).options(selectinload(AgentRun.events)).order_by(AgentRun.started_at.desc())).all()
    return [trace_to_schema(run) for run in runs]


@app.get("/v1/traces/{trace_id}", response_model=TraceOut)
def get_trace(trace_id: str, db: Session = Depends(get_db)):
    return trace_to_schema(loaded_run(db, trace_id))


@app.post("/v1/traces/events", response_model=IngestEventResponse, status_code=status.HTTP_201_CREATED)
def ingest_event(payload: IngestEventRequest, db: Session = Depends(get_db)):
    run = loaded_run(db, payload.trace_id)
    with governance_span("sentinel.event.ingest", {"sentinel.trace_id": payload.trace_id, "agent.name": payload.event.actor, "event.kind": payload.event.kind}):
        decision = evaluate_policy(db, payload.event)
        event = append_event(db, run, payload.event, decision)
    if decision.action == "block":
        db.add(Alert(id=f"alt-{event.id}", severity="high", title="Restricted action blocked", message=f"{payload.event.actor}: {payload.event.title}", trace_id=run.id, created_at=event.timestamp, state="open"))
    db.commit()
    db.refresh(run)
    return IngestEventResponse(event=trace_to_schema(run).events[-1], decision=decision, trace=trace_to_schema(run))


@app.post("/v1/integrations/mcp/tool-calls", response_model=IngestEventResponse, status_code=status.HTTP_201_CREATED)
def ingest_mcp_tool_call(payload: MCPToolCallIn, db: Session = Depends(get_db)):
    """MCP gateway callback: normalize a tool call and run the same policy engine."""
    run = loaded_run(db, payload.trace_id)
    event_payload = mcp_event(payload)
    decision = evaluate_policy(db, event_payload)
    event = append_event(db, run, event_payload, decision)
    if decision.action == "block":
        db.add(Alert(id=f"alt-{event.id}", severity="high", title="Restricted MCP tool action blocked", message=f"{payload.agent} attempted {payload.server}/{payload.tool}.", trace_id=run.id, created_at=event.timestamp, state="open"))
    db.commit()
    db.refresh(run)
    return IngestEventResponse(event=trace_to_schema(run).events[-1], decision=decision, trace=trace_to_schema(run))


@app.post("/v1/integrations/a2a/tasks", response_model=IngestEventResponse, status_code=status.HTTP_201_CREATED)
def ingest_a2a_task(payload: A2ATaskIn, db: Session = Depends(get_db)):
    """A2A handoff callback, retaining delegation depth and trace correlation."""
    run = loaded_run(db, payload.trace_id)
    event_payload = a2a_event(payload)
    decision = evaluate_policy(db, event_payload)
    event = append_event(db, run, event_payload, decision)
    db.commit()
    db.refresh(run)
    return IngestEventResponse(event=trace_to_schema(run).events[-1], decision=decision, trace=trace_to_schema(run))


@app.post("/v1/llm/policy-explanations", response_model=LLMDecisionResponse)
def policy_explanation(payload: LLMDecisionRequest):
    """Optional LLM explanation; deterministic fallback keeps local installs runnable."""
    return explain_with_llm(payload)


@app.post("/v1/scenarios/research-delegation/run", response_model=TraceOut, status_code=status.HTTP_201_CREATED)
def run_research_scenario(db: Session = Depends(get_db)):
    run = create_research_scenario(db, alert=True)
    db.commit()
    return trace_to_schema(loaded_run(db, run.id))


@app.patch("/v1/alerts/{alert_id}", response_model=AlertOut)
def update_alert(alert_id: str, payload: AlertUpdate, db: Session = Depends(get_db)):
    item = db.get(Alert, alert_id)
    if not item:
        raise HTTPException(status_code=404, detail="Alert not found")
    item.state = payload.state
    db.commit()
    db.refresh(item)
    return alert_out(item)


@app.get("/v1/policies", response_model=list[PolicyOut])
def list_policies(db: Session = Depends(get_db)):
    return [PolicyOut(id=item.id, name=item.name, description=item.description, scope=item.scope, action=item.action, enabled=item.enabled, matched=item.matched) for item in db.scalars(select(Policy).order_by(Policy.id)).all()]


@app.patch("/v1/policies/{policy_id}", response_model=PolicyOut)
def update_policy(policy_id: str, payload: PolicyUpdate, db: Session = Depends(get_db)):
    item = db.get(Policy, policy_id)
    if not item:
        raise HTTPException(status_code=404, detail="Policy not found")
    item.enabled = payload.enabled
    db.commit()
    db.refresh(item)
    return PolicyOut(id=item.id, name=item.name, description=item.description, scope=item.scope, action=item.action, enabled=item.enabled, matched=item.matched)
