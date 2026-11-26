export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type EventStatus = 'allowed' | 'blocked' | 'flagged' | 'observed'
export type EventKind = 'decision' | 'delegation' | 'tool_call' | 'policy' | 'risk' | 'completion'

export interface TraceEvent {
  id: string
  timestamp: string
  kind: EventKind
  status: EventStatus
  actor: string
  title: string
  detail: string
  policyId?: string
  riskDelta?: number
  tool?: string
}

export interface Agent {
  id: string
  name: string
  initials: string
  role: string
  color: string
  trust: number
}

export interface GovernanceTrace {
  id: string
  title: string
  status: 'active' | 'blocked' | 'complete' | 'review'
  rootAgent: string
  startedAt: string
  duration: string
  riskScore: number
  riskLabel: Severity
  decisions: number
  tools: number
  delegations: number
  violations: number
  anomaly: 'none' | 'low' | 'medium' | 'high'
  events: TraceEvent[]
}

export interface Policy {
  id: string
  name: string
  description: string
  scope: string
  action: 'Block' | 'Flag' | 'Allow'
  enabled: boolean
  matched: number
}

export interface Alert {
  id: string
  severity: Severity
  title: string
  message: string
  traceId: string
  time: string
  state: 'open' | 'acknowledged' | 'resolved'
}

export interface DashboardData {
  agents: Agent[]
  traces: GovernanceTrace[]
  policies: Policy[]
  alerts: Alert[]
}
