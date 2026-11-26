import { useEffect, useMemo, useState } from 'react'
import { governanceApi } from './api'
import { RiskTrajectoryChart } from './RiskTrajectoryChart'
import type { Alert, DashboardData, EventStatus, GovernanceTrace, Severity, TraceEvent } from './types'

type Nav = 'Overview' | 'Traces' | 'Policies' | 'Alerts'

const formatter = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' })

function severityClass(value: Severity | EventStatus | GovernanceTrace['status']) {
  if (value === 'critical' || value === 'high' || value === 'blocked') return 'danger'
  if (value === 'medium' || value === 'flagged' || value === 'review') return 'warning'
  if (value === 'low' || value === 'allowed' || value === 'complete') return 'success'
  return 'neutral'
}

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = { overview: '◫', trace: '⌘', policy: '◇', alert: '◉', agents: '◌', settings: '⚙', search: '⌕', play: '▶', export: '↓', arrow: '↗', shield: '⬡', more: '•••', check: '✓', x: '×', flow: '↳' }
  return <span aria-hidden="true" className="icon">{icons[name] || '•'}</span>
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

function EventIcon({ event }: { event: TraceEvent }) {
  const symbol = event.kind === 'delegation' ? '↳' : event.kind === 'tool_call' ? '⌘' : event.kind === 'policy' ? '⬡' : event.kind === 'risk' ? '!' : event.kind === 'completion' ? '✓' : '◇'
  return <span className={`event-icon ${severityClass(event.status)}`}>{symbol}</span>
}

function RiskRing({ score }: { score: number }) {
  return <div className="risk-ring" style={{ background: `conic-gradient(${score >= 70 ? '#ff6c77' : score >= 40 ? '#f6b65a' : '#5ad5b2'} ${score * 3.6}deg, #263246 0deg)` }}><div><strong>{score}</strong><small>/100</small></div></div>
}

function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = async () => {
    try { setError(null); setData(await governanceApi.dashboard()) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load governance data') }
  }
  useEffect(() => { void refresh() }, [])
  return { data, setData, error, refresh }
}

export default function App() {
  const { data, setData, error, refresh } = useDashboard()
  const [nav, setNav] = useState<Nav>('Overview')
  const [selectedId, setSelectedId] = useState('trc-research-8421')
  const [query, setQuery] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const selectedTrace = data?.traces.find((trace) => trace.id === selectedId) ?? data?.traces[0]
  const visibleTraces = useMemo(() => (data?.traces || []).filter((trace) => `${trace.title} ${trace.rootAgent} ${trace.status}`.toLowerCase().includes(query.toLowerCase())), [data, query])
  const openAlerts = data?.alerts.filter((alert) => alert.state === 'open').length ?? 0
  const activeRuns = data?.traces.filter((trace) => trace.status === 'active' || trace.status === 'blocked').length ?? 0
  const riskAverage = Math.round((data?.traces.reduce((total, trace) => total + trace.riskScore, 0) || 0) / (data?.traces.length || 1))

  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 3400); return () => window.clearTimeout(timer) }, [toast])

  const selectTrace = (id: string) => { setSelectedId(id); setNav('Traces') }
  const runScenario = async () => {
    setIsRunning(true)
    try {
      const trace = await governanceApi.runResearchScenario()
      setData(await governanceApi.dashboard())
      setSelectedId(trace.id)
      setNav('Traces')
      setToast('Scenario completed — restricted action was blocked.')
    } catch (err) { setToast(err instanceof Error ? err.message : 'Scenario could not run') } finally { setIsRunning(false) }
  }
  const acknowledge = async (id: string) => {
    try {
      const changed = await governanceApi.acknowledgeAlert(id)
      setData((current) => current ? { ...current, alerts: current.alerts.map((alert) => alert.id === id ? changed : alert) } : current)
      setToast('Alert acknowledged')
    } catch (err) { setToast(err instanceof Error ? err.message : 'Could not acknowledge alert') }
  }
  const exportTrace = () => {
    if (!selectedTrace) return
    const file = new Blob([JSON.stringify(selectedTrace, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${selectedTrace.id}-evidence.json`; anchor.click(); URL.revokeObjectURL(url)
    setToast('Evidence package downloaded')
  }

  if (error) return <div className="failure-state"><span>⬡</span><h1>Governance data is unavailable</h1><p>{error}</p><button onClick={() => void refresh()}>Try again</button></div>
  if (!data || !selectedTrace) return <div className="loading-state"><div className="loader" /><p>Loading Sentinel workspace…</p></div>

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">S</div><span>sentinel</span></div>
      <div className="workspace"><span className="workspace-dot" /> Acme Intelligence <span className="chevron">⌄</span></div>
      <nav aria-label="Main navigation">
        {([['Overview', 'overview'], ['Traces', 'trace'], ['Policies', 'policy'], ['Alerts', 'alert']] as [Nav, string][]).map(([item, icon]) => <button key={item} className={nav === item ? 'nav-item active' : 'nav-item'} onClick={() => setNav(item)}><Icon name={icon} /> {item}{item === 'Alerts' && openAlerts > 0 && <span className="nav-count">{openAlerts}</span>}</button>)}
      </nav>
      <div className="sidebar-divider" />
      <div className="side-footer"><div className="avatar">AR</div><div><strong>Alex Rivera</strong><small>Security Admin</small></div><Icon name="more" /></div>
    </aside>

    <main className="content">
      <header className="topbar">
        <div><p className="eyebrow">GOVERNANCE CONTROL ROOM</p><h1>{nav === 'Overview' ? 'Good morning, Alex.' : nav}</h1></div>
        <div className="top-actions"><label className="search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search traces, agents…" /></label><button className="bell" aria-label="Open alerts" onClick={() => setNav('Alerts')}>♢<span /></button></div>
      </header>

      {nav === 'Overview' && <Overview data={data} activeRuns={activeRuns} riskAverage={riskAverage} onSelectTrace={selectTrace} onRun={runScenario} isRunning={isRunning} onAcknowledge={acknowledge} onShowAlerts={() => setNav('Alerts')} />}
      {nav === 'Traces' && <TraceWorkspace traces={visibleTraces} selected={selectedTrace} agents={data.agents} onSelect={setSelectedId} onExport={exportTrace} onShowPolicies={() => setNav('Policies')} />}
      {nav === 'Policies' && <Policies data={data} setData={setData} onToast={setToast} />}
      {nav === 'Alerts' && <Alerts alerts={data.alerts} traces={data.traces} onAcknowledge={acknowledge} onSelectTrace={selectTrace} />}
    </main>
    {toast && <div className="toast"><Icon name="check" /> {toast}</div>}
  </div>
}

function Overview({ data, activeRuns, riskAverage, onSelectTrace, onRun, isRunning, onAcknowledge, onShowAlerts }: { data: DashboardData; activeRuns: number; riskAverage: number; onSelectTrace: (id: string) => void; onRun: () => void; isRunning: boolean; onAcknowledge: (id: string) => void; onShowAlerts: () => void }) {
  const focused = data.traces[0]
  return <div className="page overview-page">
    <section className="metric-grid">
      <Metric icon="trace" label="Active trajectories" value={String(activeRuns)} trend="+2 since yesterday" tone="violet" />
      <Metric icon="shield" label="Average risk score" value={`${riskAverage}`} trend="Within operating range" tone="mint" />
      <Metric icon="alert" label="Open policy alerts" value={String(data.alerts.filter((alert) => alert.state === 'open').length)} trend="1 requires attention" tone="coral" />
      <Metric icon="agents" label="Monitored agents" value={String(data.agents.length)} trend="All reporting normally" tone="blue" />
    </section>

    <RiskTrajectoryChart trace={focused} />

    <section className="action-banner">
      <div className="scenario-orb">↳</div><div><p className="eyebrow">INTERACTIVE DEMO</p><h2>Investigate a complete agent trajectory</h2><p>Replay a research delegation that is stopped at the sensitive-data boundary.</p></div>
      <button className="primary-button" onClick={onRun} disabled={isRunning}>{isRunning ? 'Running scenario…' : <><Icon name="play" /> Run demo scenario</>}</button>
    </section>

    <div className="overview-layout">
      <section className="panel live-panel"><div className="panel-heading"><div><p className="eyebrow">LIVE TRAJECTORY</p><h2>{focused.title}</h2><p className="muted">{focused.id} · Started 13 minutes ago</p></div><Badge tone={severityClass(focused.status)}>● {focused.status}</Badge></div><TraceMap trace={focused} compact /><div className="trajectory-footer"><div className="mini-stat"><span>RISK</span><strong className="risk-text">{focused.riskScore}<small>/100</small></strong></div><div className="mini-stat"><span>POLICY</span><strong>POL-004</strong></div><button className="text-button" onClick={() => onSelectTrace(focused.id)}>Open trace <Icon name="arrow" /></button></div></section>
      <section className="panel alert-panel"><div className="panel-heading"><div><p className="eyebrow">REQUIRES REVIEW</p><h2>Policy alerts</h2></div><button className="text-button" onClick={onShowAlerts}>View all <Icon name="arrow" /></button></div><div className="alert-stack">{data.alerts.slice(0, 3).map((alert) => <AlertRow key={alert.id} alert={alert} onAcknowledge={onAcknowledge} onSelectTrace={onSelectTrace} />)}</div></section>
    </div>

    <section className="panel runs-panel"><div className="panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Agent runs</h2></div><button className="secondary-button" onClick={() => onSelectTrace(focused.id)}>Explore all traces</button></div><div className="table-wrap"><table><thead><tr><th>TRAJECTORY</th><th>ROOT AGENT</th><th>STATUS</th><th>RISK</th><th>ANOMALY</th><th>STARTED</th><th /></tr></thead><tbody>{data.traces.map((trace) => <tr key={trace.id} onClick={() => onSelectTrace(trace.id)}><td><strong>{trace.title}</strong><small>{trace.id}</small></td><td>{trace.rootAgent}</td><td><Badge tone={severityClass(trace.status)}>● {trace.status}</Badge></td><td><span className={`score ${severityClass(trace.riskLabel)}`}>{trace.riskScore}</span></td><td><span className="anomaly-dot" data-level={trace.anomaly} /> {trace.anomaly}</td><td>{new Date(trace.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td><Icon name="arrow" /></td></tr>)}</tbody></table></div></section>
  </div>
}

function Metric({ icon, label, value, trend, tone }: { icon: string; label: string; value: string; trend: string; tone: string }) { return <section className="metric-card"><div className={`metric-icon ${tone}`}><Icon name={icon} /></div><div><p>{label}</p><strong>{value}</strong><small>{trend}</small></div></section> }

function TraceMap({ trace, compact = false }: { trace: GovernanceTrace; compact?: boolean }) {
  const hasBlock = trace.events.some((event) => event.status === 'blocked')
  return <div className={`trace-map ${compact ? 'compact' : ''}`}><div className="map-line" /><div className="trace-node root"><span>RL</span><div><strong>Research Lead</strong><small>Root agent</small></div></div><div className="trace-connector"><span>delegates</span><i /></div><div className="trace-node scout"><span>DS</span><div><strong>Data Scout</strong><small>Data collection</small></div></div><div className="tool-branch"><i /><div className="tool-node"><span>⌘</span><div><strong>Web Search</strong><small>Allowed</small></div></div><div className="tool-node"><span>⌘</span><div><strong>Knowledge Base</strong><small>Allowed</small></div></div>{hasBlock && <div className="tool-node blocked"><span>×</span><div><strong>Customer Warehouse</strong><small>Blocked · POL-004</small></div></div>}</div>{hasBlock && <div className="policy-callout"><span>⬡</span><div><strong>Policy enforced</strong><p>Restricted data access stopped</p></div></div>}</div>
}

function AlertRow({ alert, onAcknowledge, onSelectTrace }: { alert: Alert; onAcknowledge: (id: string) => void; onSelectTrace: (id: string) => void }) { return <article className={`alert-row ${alert.state !== 'open' ? 'muted-alert' : ''}`}><div className={`alert-symbol ${severityClass(alert.severity)}`}>!</div><div className="alert-content"><div><Badge tone={severityClass(alert.severity)}>{alert.severity}</Badge><span className="alert-time">{alert.time}</span></div><strong>{alert.title}</strong><p>{alert.message}</p><div className="alert-actions"><button onClick={() => onSelectTrace(alert.traceId)}>Inspect trace</button>{alert.state === 'open' && <button onClick={() => onAcknowledge(alert.id)}>Acknowledge</button>}</div></div></article> }

function TraceWorkspace({ traces, selected, agents, onSelect, onExport, onShowPolicies }: { traces: GovernanceTrace[]; selected: GovernanceTrace; agents: DashboardData['agents']; onSelect: (id: string) => void; onExport: () => void; onShowPolicies: () => void }) {
  return <div className="page trace-page"><div className="trace-layout"><aside className="trace-list panel"><div className="panel-heading"><div><p className="eyebrow">TRAJECTORIES</p><h2>{traces.length} observed</h2></div></div>{traces.length === 0 ? <div className="empty-state"><span>⌕</span><strong>No matching traces</strong><p>Adjust the global search to see monitored activity.</p></div> : <div className="trace-list-items">{traces.map((trace) => <button className={selected.id === trace.id ? 'trace-list-item selected' : 'trace-list-item'} onClick={() => onSelect(trace.id)} key={trace.id}><span className={`list-status ${severityClass(trace.status)}`} /><div><strong>{trace.title}</strong><small>{trace.rootAgent} · {trace.duration}</small></div><span className={`score ${severityClass(trace.riskLabel)}`}>{trace.riskScore}</span></button>)}</div>}</aside><section className="trace-detail"><div className="detail-top"><div><div className="breadcrumb">Traces <span>/</span> {selected.id}</div><h2>{selected.title}</h2><div className="detail-meta"><Badge tone={severityClass(selected.status)}>● {selected.status}</Badge><span>Root: {selected.rootAgent}</span><span>{selected.duration}</span></div></div><div className="detail-actions"><button className="secondary-button" onClick={onExport}><Icon name="export" /> Export evidence</button></div></div><div className="trace-summary"><RiskRing score={selected.riskScore} /><div className="risk-summary"><span className="eyebrow">CUMULATIVE RISK</span><strong>{selected.riskScore}/100 <Badge tone={severityClass(selected.riskLabel)}>{selected.riskLabel}</Badge></strong><p>Risk reflects the complete path, including delegated actions and policy outcomes.</p></div><div className="summary-item"><span>DECISIONS</span><strong>{selected.decisions}</strong></div><div className="summary-item"><span>TOOLS</span><strong>{selected.tools}</strong></div><div className="summary-item"><span>DELEGATIONS</span><strong>{selected.delegations}</strong></div><div className="summary-item violation"><span>VIOLATIONS</span><strong>{selected.violations}</strong></div></div><section className="panel trace-graph-panel"><div className="panel-heading"><div><p className="eyebrow">AGENT & TOOL TOPOLOGY</p><h2>Execution path</h2></div><Badge tone="neutral">1 delegation · 3 tools</Badge></div><TraceMap trace={selected} /></section><section className="timeline-section"><div className="panel-heading"><div><p className="eyebrow">TRAJECTORY LOG</p><h2>Trace timeline</h2></div><span className="muted">All timestamps UTC</span></div><div className="timeline">{selected.events.map((event, index) => <div className="timeline-event" key={event.id}><div className="timeline-rail"><EventIcon event={event} />{index < selected.events.length - 1 && <i />}</div><div className="event-body"><div className="event-title"><div><Badge tone={severityClass(event.status)}>{event.status}</Badge><span>{event.actor}</span></div><time>{formatter.format(new Date(event.timestamp))}</time></div><h3>{event.title}</h3><p>{event.detail}</p><div className="event-tags">{event.tool && <span>⌘ {event.tool}</span>}{event.policyId && <span>⬡ {event.policyId}</span>}{event.riskDelta ? <span className={event.riskDelta > 10 ? 'risk-rise' : ''}>+{event.riskDelta} risk</span> : null}</div></div></div>)}</div></section></section></div><aside className="context-rail"><section className="panel"><p className="eyebrow">ACTORS</p>{agents.slice(0, 3).map((agent) => <div className="actor" key={agent.id}><span className="agent-avatar" style={{ background: agent.color }}>{agent.initials}</span><div><strong>{agent.name}</strong><small>{agent.role}</small></div><span className="trust">{agent.trust}</span></div>)}</section><section className="panel policy-rail"><p className="eyebrow">POLICY OUTCOME</p><span className="policy-shield">⬡</span><h3>{selected.violations ? 'Restricted access blocked' : 'No critical violation'}</h3><p>{selected.violations ? 'POL-004 prevented the delegated worker from retrieving sensitive customer data.' : 'All actions were evaluated against active controls.'}</p><button className="text-button" onClick={onShowPolicies}>View policy <Icon name="arrow" /></button></section></aside></div>
}

function Policies({ data, setData, onToast }: { data: DashboardData; setData: React.Dispatch<React.SetStateAction<DashboardData | null>>; onToast: (value: string) => void }) { const toggle = async (id: string) => { const current = data.policies.find((policy) => policy.id === id); if (!current) return; try { const updated = await governanceApi.updatePolicy(id, !current.enabled); setData((existing) => existing ? { ...existing, policies: existing.policies.map((policy) => policy.id === id ? updated : policy) } : existing); onToast(`${updated.name} ${updated.enabled ? 'enabled' : 'disabled'}`) } catch (error) { onToast(error instanceof Error ? error.message : 'Could not update policy') } }; return <div className="page policies-page"><section className="section-intro"><div><p className="eyebrow">CONTROL LIBRARY</p><h2>Policies that govern every trajectory</h2><p>Evaluate individual actions and the cumulative behavior of agent teams.</p></div></section><div className="policy-grid">{data.policies.map((policy) => <article className="policy-card" key={policy.id}><div className="policy-head"><span className="policy-shield">⬡</span><label className="switch"><input type="checkbox" checked={policy.enabled} onChange={() => void toggle(policy.id)} /><span /></label></div><Badge tone={policy.action === 'Block' ? 'danger' : policy.action === 'Flag' ? 'warning' : 'success'}>{policy.action}</Badge><h3>{policy.name}</h3><p>{policy.description}</p><div className="policy-footer"><span>{policy.id} · {policy.scope}</span><strong>{policy.matched} matches</strong></div></article>)}</div></div> }

function Alerts({ alerts, traces, onAcknowledge, onSelectTrace }: { alerts: Alert[]; traces: GovernanceTrace[]; onAcknowledge: (id: string) => void; onSelectTrace: (id: string) => void }) { const [filter, setFilter] = useState<'all' | Alert['state']>('all'); const list = alerts.filter((alert) => filter === 'all' || alert.state === filter); return <div className="page alerts-page"><section className="section-intro"><div><p className="eyebrow">INCIDENT INBOX</p><h2>Alerts needing governance attention</h2><p>Review policy outcomes, trace the responsible path, and preserve an evidence trail.</p></div></section><div className="filter-tabs">{(['all', 'open', 'acknowledged', 'resolved'] as const).map((item) => <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item} <span>{item === 'all' ? alerts.length : alerts.filter((alert) => alert.state === item).length}</span></button>)}</div><section className="alerts-list panel">{list.length === 0 ? <div className="empty-state"><span>✓</span><strong>Inbox clear</strong><p>No alerts match this filter.</p></div> : list.map((alert) => <div className="full-alert" key={alert.id}><div className={`alert-symbol ${severityClass(alert.severity)}`}>!</div><div><div><Badge tone={severityClass(alert.severity)}>{alert.severity}</Badge><span className="alert-time">{alert.time}</span><Badge tone="neutral">{alert.state}</Badge></div><h3>{alert.title}</h3><p>{alert.message}</p><small>Linked trajectory: {traces.find((trace) => trace.id === alert.traceId)?.title || alert.traceId}</small></div><div className="full-alert-actions"><button className="secondary-button" onClick={() => onSelectTrace(alert.traceId)}>Inspect trace</button>{alert.state === 'open' && <button className="primary-button" onClick={() => onAcknowledge(alert.id)}>Acknowledge</button>}</div></div>)}</section></div> }
