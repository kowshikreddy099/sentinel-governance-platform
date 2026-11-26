"""Adapters that normalize MCP, A2A and LLM runtime activity into trace events."""

from __future__ import annotations

from .config import get_settings
from .schemas import A2ATaskIn, LLMDecisionRequest, LLMDecisionResponse, MCPToolCallIn, TraceEventIn


def mcp_event(payload: MCPToolCallIn) -> TraceEventIn:
    return TraceEventIn(
        timestamp=payload.timestamp,
        kind="tool_call",
        status="observed",
        actor=payload.agent,
        title=f"MCP tool call: {payload.tool}",
        detail=f"{payload.server} received a tool request from {payload.agent}.",
        tool=payload.tool,
        attributes={"protocol": "mcp", "mcp.server": payload.server, "mcp.arguments": payload.arguments, "otel.trace_id": payload.trace_id or "", "otel.span_id": payload.span_id or ""},
    )


def a2a_event(payload: A2ATaskIn) -> TraceEventIn:
    return TraceEventIn(
        timestamp=payload.timestamp,
        kind="delegation",
        status="observed",
        actor=payload.from_agent,
        title=f"A2A task delegated to {payload.to_agent}",
        detail=payload.task,
        attributes={"protocol": "a2a", "a2a.to_agent": payload.to_agent, "delegation_depth": payload.delegation_depth, "otel.trace_id": payload.trace_id or ""},
    )


def explain_with_llm(payload: LLMDecisionRequest) -> LLMDecisionResponse:
    """Use OpenAI when configured; retain a deterministic local explanation otherwise."""
    settings = get_settings()
    fallback = (
        f"{payload.policy_id} evaluated the {payload.action} decision across the delegated path. "
        "The explanation is deterministic because no LLM provider credentials are configured."
    )
    if not settings.openai_api_key:
        return LLMDecisionResponse(explanation=fallback, provider="deterministic-fallback", model=None)

    from langchain_openai import ChatOpenAI

    model = ChatOpenAI(model=settings.openai_model, api_key=settings.openai_api_key, temperature=0)
    prompt = (
        "Explain this AI-governance policy decision in two concise sentences. Do not reveal sensitive data.\n"
        f"Policy: {payload.policy_id}\nAction: {payload.action}\nEvidence: {payload.evidence}"
    )
    response = model.invoke(prompt)
    return LLMDecisionResponse(explanation=str(response.content), provider="openai", model=settings.openai_model)
