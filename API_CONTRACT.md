# Sentinel Governance API contract

The browser app calls this service only when `VITE_GOV_API_URL` is set to `http://localhost:8000/v1`. Without it, the same user journeys use in-browser sample data.

## Trace lifecycle

```text
agent / LangGraph callback / MCP gateway
  → POST /v1/traces/events
  → evaluate policy + derive cumulative risk
  → persist trace event and policy outcome
  → create alert for blocked action
  → GET /v1/dashboard or GET /v1/traces/{id}
```

`POST /v1/traces/events` accepts the normalized event emitted by an agent runtime. It returns the persisted event, the policy decision (`allow`, `flag`, or `block`), and the resulting complete trajectory.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `GET` | `/v1/dashboard` | Dashboard data: agents, traces, policies, alerts |
| `GET` | `/v1/traces` | All trajectories, including ordered events |
| `GET` | `/v1/traces/{trace_id}` | A complete trace/evidence record |
| `POST` | `/v1/traces/events` | Ingest and evaluate an agent action |
| `POST` | `/v1/scenarios/research-delegation/run` | Run the seeded end-to-end demo scenario |
| `POST` | `/v1/integrations/mcp/tool-calls` | Normalize an MCP server tool call, enforce policy, and persist it |
| `POST` | `/v1/integrations/a2a/tasks` | Record an A2A delegation with depth and trace correlation |
| `POST` | `/v1/llm/policy-explanations` | Produce a policy explanation through configured LLM API or safe fallback |
| `PATCH` | `/v1/alerts/{alert_id}` | Set `open`, `acknowledged`, or `resolved` |
| `GET` | `/v1/policies` | List active governance policies |

## Ingest example

```json
{
  "trace_id": "trc-research-3fa921",
  "event": {
    "timestamp": "2026-11-26T10:12:00Z",
    "kind": "tool_call",
    "actor": "Data Scout",
    "title": "Restricted data access denied",
    "detail": "Attempted to query a customer export.",
    "tool": "Customer Warehouse",
    "attributes": {
      "delegation_depth": 1,
      "agent_scopes": ["market-research"]
    }
  }
}
```

The default policy engine blocks `Customer Warehouse`, adds risk, changes the trace to `blocked`, and opens an alert. For production, place this deterministic adapter behind an Open Policy Agent/Cedar rule evaluator and send OpenTelemetry trace identifiers in `attributes`.

## Runtime adapters

The demonstration endpoint runs a LangGraph `StateGraph`: Research Lead plans, delegates to Data Scout via an A2A event, the worker calls approved MCP tools, its retrieval plan trips the behavioral policy, and the restricted MCP tool is blocked. `governance_span` emits OpenTelemetry spans for ingestion and graph events; configure `OTEL_EXPORTER_OTLP_ENDPOINT` to export them to a collector.

Instrument LangGraph node entry/exit, MCP client tool calls, and A2A task handoffs with the same `trace_id`. The `attributes` JSON field is intentionally extensible for OpenTelemetry IDs, model metadata, scopes, tokens, classifier scores, and redaction references.
