import { useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import type { AdapterResult } from '@connectio/source-adapters'
import type { EnvMonSiteSummary } from '@connectio/data-contracts'
import { envmonAdapter } from '../adapters/envmon-adapter.js'
import type { EnvMonNativeSwabResult } from '@connectio/data-contracts'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

const DEFAULT_PLANT = 'C061'
const DEFAULT_PERIOD_START = '2026-01-01'
const DEFAULT_PERIOD_END = '2026-05-18'
const DEFAULT_LIMIT = 100

const pageStyle: CSSProperties = {
  gridColumn: '1 / -1',
  display: 'grid',
  gap: 16,
  color: 'var(--shell-fg)',
}

const sectionStyle: CSSProperties = {
  border: '1px solid var(--shell-line)',
  borderRadius: 6,
  background: 'var(--shell-surface)',
  padding: 16,
  display: 'grid',
  gap: 12,
}

const inputStyle: CSSProperties = {
  minHeight: 32,
  padding: '5px 8px',
  border: '1px solid var(--shell-line)',
  borderRadius: 4,
  background: 'var(--shell-bg, #fff)',
  color: 'var(--shell-fg)',
  fontFamily: 'inherit',
}

const buttonStyle: CSSProperties = {
  minHeight: 32,
  padding: '5px 12px',
  border: '1px solid var(--shell-line)',
  borderRadius: 4,
  background: 'var(--shell-rail-active, #005776)',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: 'transparent',
  color: 'var(--shell-fg)',
}

export interface NativeMonitoringViewProps {
  readonly initialPlantId?: string
}

export function NativeMonitoringView({ initialPlantId }: NativeMonitoringViewProps = {}) {
  const [plantId, setPlantId] = useState(initialPlantId ?? DEFAULT_PLANT)
  const [periodStart, setPeriodStart] = useState(DEFAULT_PERIOD_START)
  const [periodEnd, setPeriodEnd] = useState(DEFAULT_PERIOD_END)
  const [limit, setLimit] = useState(DEFAULT_LIMIT)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState<EnvMonAdapterRequest | null>(null)
  const [summaryResult, setSummaryResult] = useState<AdapterResult<EnvMonSiteSummary> | null>(null)
  const [swabResult, setSwabResult] = useState<AdapterResult<EnvMonNativeSwabResult[]> | null>(null)
  const [selected, setSelected] = useState<EnvMonNativeSwabResult | null>(null)

  const rows = swabResult?.ok ? swabResult.data : []
  const indicators = useMemo(() => deriveIndicators(rows), [rows])

  async function runQuery(event?: FormEvent) {
    event?.preventDefault()
    const request = { plantId: plantId.trim(), periodStart, periodEnd, limit }
    setLoading(true)
    setSubmitted(request)
    setSelected(null)
    const [summary, swabs] = await Promise.all([
      envmonAdapter.getNativeSiteSummary(request),
      envmonAdapter.getNativeSwabResults(request),
    ])
    setSummaryResult(summary)
    setSwabResult(swabs)
    setLoading(false)
  }

  function resetDefaults() {
    setPlantId(DEFAULT_PLANT)
    setPeriodStart(DEFAULT_PERIOD_START)
    setPeriodEnd(DEFAULT_PERIOD_END)
    setLimit(DEFAULT_LIMIT)
  }

  return (
    <div data-testid="envmon-native-monitoring-screen" style={pageStyle}>
      <header style={{ display: 'grid', gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Environmental Monitoring</h1>
        <p style={{ margin: 0, color: 'var(--shell-fg-2)', fontSize: 13 }}>
          Read-only SAP QM monitoring view backed by native EnvMon Databricks routes. No mock fallback.
        </p>
      </header>

      <form onSubmit={runQuery} style={{ ...sectionStyle, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', alignItems: 'end' }}>
        <Field label="Plant ID">
          <input data-testid="envmon-input-plant" style={inputStyle} value={plantId} onChange={(e) => setPlantId(e.target.value)} />
        </Field>
        <Field label="Period start">
          <input data-testid="envmon-input-period-start" type="date" style={inputStyle} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </Field>
        <Field label="Period end">
          <input data-testid="envmon-input-period-end" type="date" style={inputStyle} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </Field>
        <Field label="Limit">
          <input data-testid="envmon-input-limit" type="number" min={1} max={500} style={inputStyle} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
        </Field>
        <button data-testid="envmon-run-query" type="submit" style={buttonStyle} disabled={loading}>
          {loading ? 'Loading...' : 'Run / Refresh'}
        </button>
        <button data-testid="envmon-reset-defaults" type="button" style={secondaryButtonStyle} onClick={resetDefaults}>
          Reset to test values
        </button>
      </form>

      <SourceLimitationsBanner />

      <section aria-label="Site Summary" style={sectionStyle}>
        <SectionTitle title="Site Summary" />
        {loading && !summaryResult ? <StatusText text="Loading site summary..." /> : null}
        {summaryResult && !summaryResult.ok ? <RouteError route="/api/envmon/site-summary" result={summaryResult} /> : null}
        {summaryResult?.ok ? <SiteSummary data={summaryResult.data} request={submitted} /> : null}
      </section>

      <section aria-label="Derived Indicators" style={sectionStyle}>
        <SectionTitle title="Derived Indicators" />
        <IndicatorGrid indicators={indicators} />
        {indicators.topFailingMics.length > 0 ? (
          <MiniList title="Top failing MICs" items={indicators.topFailingMics} />
        ) : (
          <StatusText text="No failing MICs in the returned swab results." />
        )}
        {indicators.failuresByLocation.length > 0 ? (
          <MiniList title="Failures by functional location" items={indicators.failuresByLocation} />
        ) : (
          <StatusText text="No failures by functional location in the returned swab results." />
        )}
      </section>

      <section aria-label="Swab Results Table" style={sectionStyle}>
        <SectionTitle title="Swab Results Table" />
        {loading && !swabResult ? <StatusText text="Loading swab results..." /> : null}
        {swabResult && !swabResult.ok ? <RouteError route="/api/envmon/swab-results" result={swabResult} /> : null}
        {swabResult?.ok && swabResult.data.length === 0 ? (
          <StatusText text="No EnvMon inspection results found for this plant and period. Check plant, date range, and inspection type 14/Z14." />
        ) : null}
        {swabResult?.ok && swabResult.data.length > 0 ? (
          <SwabTable rows={swabResult.data} selected={selected} onSelect={setSelected} />
        ) : null}
      </section>

      <section aria-label="Result Detail" style={sectionStyle}>
        <SectionTitle title="Result Detail" />
        {selected ? <ResultDetail row={selected} /> : <StatusText text="Select a swab result row to inspect source-backed details." />}
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--shell-fg-2)' }}>
      {label}
      {children}
    </label>
  )
}

function SectionTitle({ title }: { title: string }) {
  return <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
}

function StatusText({ text }: { text: string }) {
  return <p style={{ margin: 0, color: 'var(--shell-fg-2)', fontSize: 13 }}>{text}</p>
}

function SourceLimitationsBanner() {
  return (
    <section data-testid="envmon-source-limitations" style={{ ...sectionStyle, background: 'var(--shell-surface-2)' }}>
      <strong>Source and limitations</strong>
      <div style={{ display: 'grid', gap: 4, fontSize: 13, color: 'var(--shell-fg-2)' }}>
        <span>Source: SAP QM gold views: gold_inspection_lot, gold_inspection_point, gold_batch_quality_result_v.</span>
        <span>Routes: /api/envmon/site-summary and /api/envmon/swab-results. Execution: databricks-api. Inspection types: 14/Z14.</span>
        <span>CAPA is out of scope. Spatial floorplan, map, zone, heatmap, floorplan maintenance, and L4 zoning are planned/deferred.</span>
      </div>
    </section>
  )
}

function SiteSummary({ data, request }: { data: EnvMonSiteSummary; request: EnvMonAdapterRequest | null }) {
  const plantLabel = data.plantName || data.plantId || request?.plantId || 'Unknown plant'
  return (
    <div data-testid="envmon-site-summary" style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 13, color: 'var(--shell-fg-2)' }}>
        {plantLabel} | {request?.periodStart ?? 'start'} to {request?.periodEnd ?? 'end'}
      </div>
      <IndicatorGrid testId="envmon-site-summary-indicators" indicators={{
        total: data.zonesMonitored,
        fail: data.positiveCount,
        warning: data.zonesWithAlerts,
        pending: 0,
        pass: Math.max(0, data.zonesMonitored - data.zonesWithAlerts),
        lots: 0,
        points: data.zonesMonitored,
        locations: data.zonesMonitored,
        mics: 0,
        topFailingMics: [],
        failuresByLocation: [],
      }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, fontSize: 13 }}>
        <Metric label="Positive rate" value={`${data.positiveRate.toFixed(2)}%`} />
        <Metric label="Compliance rate" value={`${data.complianceRate.toFixed(2)}%`} />
        <Metric label="Risk status" value={data.riskStatus} />
        <Metric label="Highest severity" value={data.highestSeverity} />
        <Metric label="Confidence" value={data.confidence.toFixed(2)} />
      </div>
      <StatusText text="Corrective action fields, where present in the contract, are compatibility zeros only; CAPA is not implemented in this slice." />
    </div>
  )
}

function IndicatorGrid({ indicators, testId = 'envmon-derived-indicators' }: { indicators: DerivedIndicators; testId?: string }) {
  return (
    <div data-testid={testId} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
      <Metric label="Total results" value={indicators.total} />
      <Metric label="Fail" value={indicators.fail} />
      <Metric label="Warning" value={indicators.warning} />
      <Metric label="Pending" value={indicators.pending} />
      <Metric label="Pass" value={indicators.pass} />
      <Metric label="Inspection lots" value={indicators.lots} />
      <Metric label="Inspection points" value={indicators.points} />
      <Metric label="Functional locations" value={indicators.locations} />
      <Metric label="MICs" value={indicators.mics} />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ border: '1px solid var(--shell-line)', borderRadius: 4, padding: 10, display: 'grid', gap: 4, minHeight: 58 }}>
      <span style={{ fontSize: 11, color: 'var(--shell-fg-3)', textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
      <strong style={{ fontSize: 18 }}>{value}</strong>
    </div>
  )
}

function RouteError<T>({ route, result }: { route: string; result: AdapterResult<T> & { ok: false } }) {
  return (
    <div data-testid="envmon-route-error" style={{ border: '1px solid #D32F2F', borderRadius: 4, padding: 10, color: '#D32F2F', fontSize: 13 }}>
      {route}: {friendlyError(result.error.message)}
    </div>
  )
}

function friendlyError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('oauth') || normalized.includes('token') || normalized.includes('401')) return 'OAuth token not forwarded or user not authorised.'
  if (normalized.includes('permission') || normalized.includes('403')) return 'User lacks permission to query EnvMon gold sources.'
  if (normalized.includes('timeout') || normalized.includes('504')) return 'Query timed out; reduce date range or limit.'
  if (normalized.includes('query') || normalized.includes('502')) return 'Query/source problem.'
  return message
}

function SwabTable({ rows, selected, onSelect }: { rows: EnvMonNativeSwabResult[]; selected: EnvMonNativeSwabResult | null; onSelect: (row: EnvMonNativeSwabResult) => void }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table data-testid="envmon-swab-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1180 }}>
        <thead>
          <tr>
            {['Inspection lot', 'Point', 'Sample', 'Functional location', 'MIC', 'Result', 'Quant', 'Limits', 'UOM', 'Valuation/status', 'Inspector', 'Dates', 'Material/batch/order'].map((header) => (
              <th key={header} style={cellHeaderStyle}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isSelected = row === selected
            return (
              <tr key={`${row.inspectionLotId ?? 'lot'}-${row.inspectionPointId ?? 'point'}-${row.micId ?? 'mic'}-${index}`}>
                <td style={cellStyle}><button type="button" onClick={() => onSelect(row)} style={{ ...linkButtonStyle, fontWeight: isSelected ? 800 : 600 }}>{row.inspectionLotId ?? '-'}</button></td>
                <td style={cellStyle}>{row.inspectionPointId ?? '-'}</td>
                <td style={cellStyle}>{row.sampleId ?? '-'}</td>
                <td style={cellStyle}>{row.functionalLocation ?? '-'}</td>
                <td style={cellStyle}>{row.micName ?? '-'}{row.micCode ? ` / ${row.micCode}` : ''}</td>
                <td style={cellStyle}>{formatValue(row.result)}</td>
                <td style={cellStyle}>{formatValue(row.quantitativeResult)}</td>
                <td style={cellStyle}>{formatLimits(row)}</td>
                <td style={cellStyle}>{row.unitOfMeasure ?? '-'}</td>
                <td style={cellStyle}>{row.valuation ?? '-'} / {row.status}</td>
                <td style={cellStyle}>{row.inspector ?? '-'}</td>
                <td style={cellStyle}>{row.createdDate ?? '-'} / {row.inspectionEndDate ?? '-'}</td>
                <td style={cellStyle}>{row.materialId ?? '-'} / {row.batchId ?? '-'} / {row.processOrderId ?? '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const cellHeaderStyle: CSSProperties = {
  textAlign: 'left',
  borderBottom: '1px solid var(--shell-line)',
  padding: '8px 6px',
  color: 'var(--shell-fg-2)',
}

const cellStyle: CSSProperties = {
  borderBottom: '1px solid var(--shell-line)',
  padding: '8px 6px',
  verticalAlign: 'top',
}

const linkButtonStyle: CSSProperties = {
  border: 0,
  padding: 0,
  background: 'transparent',
  color: 'var(--shell-rail-active, #005776)',
  cursor: 'pointer',
}

function ResultDetail({ row }: { row: EnvMonNativeSwabResult }) {
  const fields = [
    ['Inspection lot', row.inspectionLotId],
    ['Inspection point', row.inspectionPointId],
    ['Operation', row.operationId],
    ['Sample', row.sampleId],
    ['Sample summary', row.sampleSummary],
    ['Sample hour', row.sampleHour],
    ['Functional location', row.functionalLocation],
    ['MIC ID', row.micId],
    ['MIC name', row.micName],
    ['MIC code', row.micCode],
    ['Result', row.result],
    ['Quantitative result', row.quantitativeResult],
    ['Qualitative result', row.qualitativeResult],
    ['Target', row.targetValue],
    ['Upper tolerance', row.upperTolerance],
    ['Lower tolerance', row.lowerTolerance],
    ['UOM', row.unitOfMeasure],
    ['Valuation', row.valuation],
    ['Status', row.status],
    ['Inspector', row.inspector],
    ['Inspection method', row.inspectionMethod],
    ['Material', row.materialId],
    ['Batch', row.batchId],
    ['Process order', row.processOrderId],
  ]
  return (
    <dl data-testid="envmon-result-detail" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, margin: 0 }}>
      {fields.map(([label, value]) => (
        <div key={label} style={{ borderBottom: '1px solid var(--shell-line)', paddingBottom: 6 }}>
          <dt style={{ fontSize: 11, color: 'var(--shell-fg-3)', textTransform: 'uppercase', fontWeight: 700 }}>{label}</dt>
          <dd style={{ margin: '3px 0 0', fontSize: 13 }}>{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

interface DerivedIndicators {
  readonly total: number
  readonly fail: number
  readonly warning: number
  readonly pending: number
  readonly pass: number
  readonly lots: number
  readonly points: number
  readonly locations: number
  readonly mics: number
  readonly topFailingMics: string[]
  readonly failuresByLocation: string[]
}

function deriveIndicators(rows: EnvMonNativeSwabResult[]): DerivedIndicators {
  const failRows = rows.filter((row) => row.status === 'fail')
  return {
    total: rows.length,
    fail: failRows.length,
    warning: rows.filter((row) => row.status === 'warning').length,
    pending: rows.filter((row) => row.status === 'pending').length,
    pass: rows.filter((row) => row.status === 'pass').length,
    lots: distinctCount(rows.map((row) => row.inspectionLotId)),
    points: distinctCount(rows.map((row) => row.inspectionPointId)),
    locations: distinctCount(rows.map((row) => row.functionalLocation)),
    mics: distinctCount(rows.map((row) => row.micId ?? row.micName)),
    topFailingMics: topCounts(failRows.map((row) => row.micName ?? row.micCode ?? row.micId)),
    failuresByLocation: topCounts(failRows.map((row) => row.functionalLocation)),
  }
}

function distinctCount(values: Array<string | null | undefined>): number {
  return new Set(values.filter(Boolean)).size
}

function topCounts(values: Array<string | null | undefined>): string[] {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([label, count]) => `${label}: ${count}`)
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <strong style={{ fontSize: 13 }}>{title}</strong>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  )
}

function formatLimits(row: EnvMonNativeSwabResult): string {
  const parts = [
    row.lowerTolerance === null ? null : `L ${row.lowerTolerance}`,
    row.targetValue === null ? null : `T ${row.targetValue}`,
    row.upperTolerance === null ? null : `U ${row.upperTolerance}`,
  ].filter(Boolean)
  return parts.length ? parts.join(' / ') : '-'
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}
