import Plot from 'react-plotly.js'
import type { GovernanceTrace } from './types'

export function RiskTrajectoryChart({ trace }: { trace: GovernanceTrace }) {
  let cumulative = 0
  const events = trace.events.map((event) => {
    cumulative = Math.min(100, cumulative + Math.max(0, event.riskDelta || 0))
    return { ...event, cumulative }
  })
  const x = events.map((event) => new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  const y = events.map((event) => event.cumulative)
  const markerColors = events.map((event) => event.status === 'blocked' ? '#ff6c77' : event.status === 'flagged' ? '#f6b65a' : '#5ad5b2')

  return <section className="panel risk-chart-panel">
    <div className="panel-heading"><div><p className="eyebrow">PLOTLY RISK ANALYTICS</p><h2>Cumulative trajectory risk</h2></div><span className="muted">Computed event by event</span></div>
    <Plot
      data={[{ x, y, type: 'scatter', mode: 'lines+markers', line: { color: '#9a8cff', width: 3 }, marker: { color: markerColors, size: 9 }, hovertemplate: '%{x}<br>Risk: %{y}/100<extra></extra>' }]}
      layout={{ autosize: true, height: 250, margin: { l: 38, r: 18, t: 12, b: 34 }, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#b5c2d4', family: 'DM Mono, monospace', size: 10 }, xaxis: { gridcolor: '#26364c', zerolinecolor: '#26364c', fixedrange: true }, yaxis: { range: [0, 100], gridcolor: '#26364c', zerolinecolor: '#26364c', fixedrange: true }, showlegend: false }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%' }}
      useResizeHandler
    />
  </section>
}
