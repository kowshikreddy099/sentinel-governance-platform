import { initialData, researchTraceEvents } from './demo-data'
import type { Alert, DashboardData, GovernanceTrace, Policy, TraceEvent } from './types'

const API_BASE = import.meta.env.VITE_GOV_API_URL?.replace(/\/$/, '')
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

let demoData = clone(initialData)

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.json() as Promise<T>
}

type ApiEvent = Omit<TraceEvent, 'policyId' | 'riskDelta'> & { policy_id?: string; risk_delta?: number }
type ApiTrace = Omit<GovernanceTrace, 'rootAgent' | 'startedAt' | 'riskScore' | 'riskLabel'> & { root_agent: string; started_at: string; risk_score: number; risk_label: GovernanceTrace['riskLabel']; events: ApiEvent[] }
type ApiAlert = Omit<Alert, 'traceId'> & { trace_id: string }
type ApiPolicy = Policy

function fromApiEvent(event: ApiEvent): TraceEvent {
  return { ...event, policyId: event.policy_id, riskDelta: event.risk_delta }
}

function fromApiTrace(trace: ApiTrace): GovernanceTrace {
  return { ...trace, rootAgent: trace.root_agent, startedAt: trace.started_at, riskScore: trace.risk_score, riskLabel: trace.risk_label, events: trace.events.map(fromApiEvent) }
}

function fromApiAlert(alert: ApiAlert): Alert {
  return { ...alert, traceId: alert.trace_id }
}

function fromApiDashboard(payload: { agents: DashboardData['agents']; traces: ApiTrace[]; policies: ApiPolicy[]; alerts: ApiAlert[] }): DashboardData {
  return { agents: payload.agents, traces: payload.traces.map(fromApiTrace), policies: payload.policies, alerts: payload.alerts.map(fromApiAlert) }
}

export const governanceApi = {
  async dashboard(): Promise<DashboardData> {
    if (API_BASE) return fromApiDashboard(await request<{ agents: DashboardData['agents']; traces: ApiTrace[]; policies: ApiPolicy[]; alerts: ApiAlert[] }>('/dashboard'))
    return clone(demoData)
  },
  async acknowledgeAlert(id: string): Promise<Alert> {
    if (API_BASE) return fromApiAlert(await request<ApiAlert>(`/alerts/${id}`, { method: 'PATCH', body: JSON.stringify({ state: 'acknowledged' }) }))
    const alert = demoData.alerts.find((item) => item.id === id)
    if (!alert) throw new Error('Alert not found')
    alert.state = 'acknowledged'
    return clone(alert)
  },
  async runResearchScenario(): Promise<GovernanceTrace> {
    if (API_BASE) return fromApiTrace(await request<ApiTrace>('/scenarios/research-delegation/run', { method: 'POST' }))
    const timestamp = new Date().toISOString()
    const sequence = demoData.traces.filter((item) => item.id.startsWith('trc-research')).length + 8422
    const next: GovernanceTrace = {
      id: `trc-research-${sequence}`,
      title: 'Q4 competitor intelligence brief',
      status: 'blocked',
      rootAgent: 'Research Lead',
      startedAt: timestamp,
      duration: 'Just completed',
      riskScore: 74,
      riskLabel: 'high',
      decisions: 5,
      tools: 3,
      delegations: 1,
      violations: 1,
      anomaly: 'high',
      events: researchTraceEvents.map((event, index) => ({ ...event, id: `rerun-${Date.now()}-${index}`, timestamp: new Date(Date.now() - (researchTraceEvents.length - index) * 35_000).toISOString() })),
    }
    demoData.traces = [next, ...demoData.traces]
    demoData.alerts = [{ id: `alt-${Date.now()}`, severity: 'high', title: 'Restricted information access blocked', message: 'A delegated Data Scout request to Customer Warehouse was blocked by POL-004.', traceId: next.id, time: 'just now', state: 'open' }, ...demoData.alerts]
    return clone(next)
  },
  async updatePolicy(id: string, enabled: boolean): Promise<Policy> {
    if (API_BASE) return request<Policy>(`/policies/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) })
    const policy = demoData.policies.find((item) => item.id === id)
    if (!policy) throw new Error('Policy not found')
    policy.enabled = enabled
    return clone(policy)
  },
}
