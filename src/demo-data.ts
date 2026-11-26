import type { DashboardData, GovernanceTrace, TraceEvent } from './types'

const today = new Date()
const minutesAgo = (minutes: number) => new Date(today.getTime() - minutes * 60_000).toISOString()

export const researchTraceEvents: TraceEvent[] = [
  { id: 'evt-01', timestamp: minutesAgo(13), kind: 'decision', status: 'observed', actor: 'Research Lead', title: 'Research task initiated', detail: 'Summarize competitor positioning for the Q4 strategy brief.', riskDelta: 2 },
  { id: 'evt-02', timestamp: minutesAgo(12), kind: 'delegation', status: 'observed', actor: 'Research Lead', title: 'Delegated collection task', detail: 'Assigned public-source collection to Data Scout with the “market-research” scope.', riskDelta: 4 },
  { id: 'evt-03', timestamp: minutesAgo(11), kind: 'tool_call', status: 'allowed', actor: 'Data Scout', title: 'Searched public web', detail: 'Query: enterprise AI governance software pricing.', tool: 'Web Search', riskDelta: 1 },
  { id: 'evt-04', timestamp: minutesAgo(9), kind: 'tool_call', status: 'allowed', actor: 'Data Scout', title: 'Read approved market report', detail: 'Opened Gartner excerpt in the approved research corpus.', tool: 'Knowledge Base', riskDelta: 2 },
  { id: 'evt-05', timestamp: minutesAgo(7), kind: 'decision', status: 'flagged', actor: 'Data Scout', title: 'Changed retrieval plan', detail: 'Tool sequence diverged from its learned baseline after finding incomplete public sources.', riskDelta: 12 },
  { id: 'evt-06', timestamp: minutesAgo(6), kind: 'tool_call', status: 'blocked', actor: 'Data Scout', title: 'Restricted data access denied', detail: 'Attempted to query the internal customer export. Access token lacks the required data-classification claim.', tool: 'Customer Warehouse', policyId: 'POL-004', riskDelta: 37 },
  { id: 'evt-07', timestamp: minutesAgo(6), kind: 'policy', status: 'blocked', actor: 'Sentinel Policy Engine', title: 'Sensitive dataset policy triggered', detail: 'POL-004 blocked the request and opened an escalation because this was a delegated path.', policyId: 'POL-004', riskDelta: 18 },
  { id: 'evt-08', timestamp: minutesAgo(5), kind: 'risk', status: 'flagged', actor: 'Sentinel Risk Engine', title: 'Cumulative risk raised to 74', detail: 'Risk compounds delegation depth, attempted sensitive access, and anomalous tool ordering.', riskDelta: 0 },
  { id: 'evt-09', timestamp: minutesAgo(3), kind: 'completion', status: 'observed', actor: 'Research Lead', title: 'Awaiting reviewer direction', detail: 'The parent agent received a redacted status and cannot continue the restricted branch.', riskDelta: 0 },
]

const traces: GovernanceTrace[] = [
  {
    id: 'trc-research-8421', title: 'Q4 competitor intelligence brief', status: 'blocked', rootAgent: 'Research Lead', startedAt: minutesAgo(13), duration: '10m 12s', riskScore: 74, riskLabel: 'high', decisions: 5, tools: 3, delegations: 1, violations: 1, anomaly: 'high', events: researchTraceEvents,
  },
  {
    id: 'trc-support-8420', title: 'Priority support triage', status: 'complete', rootAgent: 'Support Triage', startedAt: minutesAgo(28), duration: '3m 48s', riskScore: 18, riskLabel: 'low', decisions: 7, tools: 4, delegations: 0, violations: 0, anomaly: 'none',
    events: [
      { id: 's1', timestamp: minutesAgo(28), kind: 'decision', status: 'observed', actor: 'Support Triage', title: 'Classified priority ticket', detail: 'Identified a billing request with a valid contract reference.' },
      { id: 's2', timestamp: minutesAgo(27), kind: 'tool_call', status: 'allowed', actor: 'Support Triage', title: 'Retrieved account context', detail: 'Read account metadata under approved support scope.', tool: 'CRM' },
      { id: 's3', timestamp: minutesAgo(24), kind: 'completion', status: 'allowed', actor: 'Support Triage', title: 'Response submitted', detail: 'Customer-facing response passed content and data policy checks.' },
    ],
  },
  {
    id: 'trc-finance-8417', title: 'Invoice variance review', status: 'review', rootAgent: 'Finance Analyst', startedAt: minutesAgo(52), duration: '8m 03s', riskScore: 46, riskLabel: 'medium', decisions: 9, tools: 6, delegations: 2, violations: 0, anomaly: 'medium',
    events: [
      { id: 'f1', timestamp: minutesAgo(52), kind: 'delegation', status: 'observed', actor: 'Finance Analyst', title: 'Delegated OCR verification', detail: 'Assigned document extraction to Invoice Parser.' },
      { id: 'f2', timestamp: minutesAgo(45), kind: 'risk', status: 'flagged', actor: 'Sentinel Risk Engine', title: 'Unusual approval sequence', detail: 'Second delegation added after an out-of-order approval request.' },
    ],
  },
  {
    id: 'trc-dev-8415', title: 'Dependency license audit', status: 'active', rootAgent: 'Engineering Guard', startedAt: minutesAgo(4), duration: '4m 16s', riskScore: 27, riskLabel: 'low', decisions: 4, tools: 2, delegations: 1, violations: 0, anomaly: 'low',
    events: [
      { id: 'd1', timestamp: minutesAgo(4), kind: 'decision', status: 'observed', actor: 'Engineering Guard', title: 'Repository scan begun', detail: 'Scanning approved dependencies only.' },
    ],
  },
]

export const initialData: DashboardData = {
  agents: [
    { id: 'research', name: 'Research Lead', initials: 'RL', role: 'Orchestrator', color: '#9a8cff', trust: 92 },
    { id: 'scout', name: 'Data Scout', initials: 'DS', role: 'Research worker', color: '#51d2b0', trust: 68 },
    { id: 'policy', name: 'Sentinel Engine', initials: 'SE', role: 'Policy enforcement', color: '#f4a261', trust: 100 },
    { id: 'finance', name: 'Finance Analyst', initials: 'FA', role: 'Finance worker', color: '#6ab6ff', trust: 88 },
  ],
  traces,
  policies: [
    { id: 'POL-004', name: 'Restricted data boundary', description: 'Block agents without a Sensitive-Data scope from querying customer exports or regulated data.', scope: 'Data access', action: 'Block', enabled: true, matched: 1 },
    { id: 'POL-012', name: 'Delegation depth limit', description: 'Require approval when an agent chain exceeds two delegated hops.', scope: 'A2A delegation', action: 'Flag', enabled: true, matched: 4 },
    { id: 'POL-019', name: 'Tool sequence anomaly', description: 'Flag retrieval plans that materially diverge from the agent’s approved behavioral profile.', scope: 'Behavioral monitoring', action: 'Flag', enabled: true, matched: 7 },
    { id: 'POL-023', name: 'External delivery guardrail', description: 'Require human review before content leaves an approved organization channel.', scope: 'External actions', action: 'Block', enabled: true, matched: 0 },
  ],
  alerts: [
    { id: 'alt-101', severity: 'high', title: 'Restricted information access blocked', message: 'Data Scout attempted to access Customer Warehouse through a delegated research task.', traceId: 'trc-research-8421', time: '3 min ago', state: 'open' },
    { id: 'alt-102', severity: 'medium', title: 'Behavioral anomaly detected', message: 'Finance Analyst added an uncommon second delegation during invoice review.', traceId: 'trc-finance-8417', time: '18 min ago', state: 'open' },
    { id: 'alt-103', severity: 'low', title: 'Policy revision available', message: 'Delegation depth policy has a pending version from Compliance.', traceId: 'trc-dev-8415', time: '41 min ago', state: 'acknowledged' },
  ],
}
