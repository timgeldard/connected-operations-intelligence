import { useMemo, useState } from 'react'
import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { useWmList } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate } from '../components/kerry.js'

interface QmLotStatus {
  plantId: string
  lotId: string
  inspectionLotOriginCode: string | null
  inspectionType: string | null
  materialId: string | null
  materialName: string | null
  batchId: string | null
  orderId: string | null
  lotCreatedDate: string | null
  inspectionStartDate: string | null
  inspectionEndDate: string | null
  lotQty: number | null
  lotUom: string | null
  hasUsageDecision: boolean | null
  lastUsageDecision: string | null
  lastUsageDecisionDate: string | null
  lastUsageDecisionBy: string | null
  qualityScore: string | null
  lotAgeDays: number | null
  udLeadTimeDays: number | null
  isOverdue: boolean | null
}

const ORIGIN_OPTIONS = [
  { value: '', label: 'All origins' },
  { value: '01', label: '01 GR inspection' },
  { value: '04', label: '04 Production' },
  { value: '05', label: '05 Other' },
  { value: '08', label: '08 Repeat inspection' },
  { value: '10', label: '10 Audit' },
]

/** ISO week string (yyyy-Www) for a date string. */
function isoWeek(dateStr: string): string {
  const d = new Date(dateStr)
  const thursday = new Date(d)
  thursday.setDate(d.getDate() - (d.getDay() + 6) % 7 + 3)
  const yearStart = new Date(thursday.getFullYear(), 0, 1)
  const weekNo = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${thursday.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export function QmCommandCentreView({
  request,
  onOpenProcessOrder,
}: {
  readonly request: WmOperationsAdapterRequest
  readonly onOpenProcessOrder?: (orderId: string) => void
}) {
  const [origin, setOrigin] = useState('')

  const lotsResult = useWmList<QmLotStatus>(
    '/api/wm-operations/qm-lot-status',
    {
      plant_id: request.plantId,
      open_only: false,
      ...(origin ? { origin } : {}),
      limit: 500,
    },
    Boolean(request.plantId),
  )

  const allLots = lotsResult.data?.ok ? lotsResult.data.data : []
  const error = lotsResult.data && !lotsResult.data.ok ? lotsResult.data.error : null

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const openLots = allLots.filter(r => !r.hasUsageDecision).length
  const overdueLots = allLots.filter(r => r.isOverdue).length
  const decidedLots = allLots.filter(r => r.hasUsageDecision && r.udLeadTimeDays != null)
  const medianUdLeadTime = useMemo(() => {
    if (decidedLots.length === 0) return null
    const sorted = [...decidedLots].map(r => r.udLeadTimeDays as number).sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  }, [decidedLots])
  const rejectedCount = allLots.filter(r => r.lastUsageDecision === 'Rejected').length

  // ── Open backlog by origin × age bucket ─────────────────────────────────────
  const openLotsList = allLots.filter(r => !r.hasUsageDecision)
  const byOriginAge = useMemo(() => {
    type Bucket = { lt7: number; d7_14: number; d14_30: number; gt30: number; total: number }
    const map = new Map<string, Bucket>()
    for (const r of openLotsList) {
      const key = r.inspectionLotOriginCode ?? '(unknown)'
      const cur = map.get(key) ?? { lt7: 0, d7_14: 0, d14_30: 0, gt30: 0, total: 0 }
      const age = r.lotAgeDays ?? 0
      cur.total++
      if (age < 7) cur.lt7++
      else if (age < 14) cur.d7_14++
      else if (age < 30) cur.d14_30++
      else cur.gt30++
      map.set(key, cur)
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total)
  }, [openLotsList])

  const maxOriginTotal = byOriginAge[0]?.[1].total ?? 1

  // ── UD lead-time weekly trend (decided lots only) ─────────────────────────
  const udTrend = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const r of decidedLots) {
      if (!r.lastUsageDecisionDate) continue
      const wk = isoWeek(r.lastUsageDecisionDate)
      const arr = map.get(wk) ?? []
      arr.push(r.udLeadTimeDays as number)
      map.set(wk, arr)
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([week, vals]) => {
        const sorted = [...vals].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
        return { week, median, count: vals.length }
      })
  }, [decidedLots])

  const maxTrendMedian = Math.max(...udTrend.map(t => t.median), 1)

  // ── Recent rejected lots ──────────────────────────────────────────────────
  const recentRejected = useMemo(
    () =>
      allLots
        .filter(r => r.lastUsageDecision === 'Rejected')
        .sort((a, b) => (b.lastUsageDecisionDate ?? '').localeCompare(a.lastUsageDecisionDate ?? ''))
        .slice(0, 30),
    [allLots],
  )

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Control"
        title="QM Command Centre"
        subtitle="Inspection lot backlog, usage-decision lead time, and rejected lots for the selected plant."
      />

      {/* Origin filter */}
      <div className="kw-filters" style={{ marginBottom: 16 }}>
        <select
          aria-label="Filter by lot origin"
          value={origin}
          onChange={e => setOrigin(e.target.value)}
        >
          {ORIGIN_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* KPI row */}
      <div className="kw-kpi-row">
        <KpiTile label="Open lots" value={openLots} tone={openLots > 50 ? 'alert' : openLots > 20 ? 'warn' : 'none'} />
        <KpiTile label="Overdue lots" value={overdueLots} tone={overdueLots > 0 ? 'alert' : 'none'} />
        <KpiTile
          label="Median UD lead time"
          value={medianUdLeadTime != null ? `${medianUdLeadTime.toFixed(1)} d` : '—'}
          tone={medianUdLeadTime != null && medianUdLeadTime > 14 ? 'warn' : 'none'}
        />
        <KpiTile label="Rejected lots" value={rejectedCount} tone={rejectedCount > 0 ? 'warn' : 'none'} />
      </div>

      {error ? (
        <EmptyNote>Could not load QM data — {error.message}</EmptyNote>
      ) : lotsResult.isLoading ? (
        <LoadingRows rows={6} />
      ) : allLots.length === 0 ? (
        <EmptyNote>No inspection lots for this plant (check QM gate configuration).</EmptyNote>
      ) : (
        <>
          {/* Open backlog by origin × age bucket */}
          <div className="kw-card" style={{ marginBottom: 16 }}>
            <div className="kw-card-title">Open backlog by lot origin × age</div>
            {openLotsList.length === 0 ? (
              <EmptyNote>No open lots.</EmptyNote>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {byOriginAge.map(([code, v]) => {
                  const barPct = Math.round((v.total / maxOriginTotal) * 100)
                  return (
                    <div key={code}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                        <span className="kw-mono">{code}</span>
                        <span className="kw-num" style={{ display: 'flex', gap: 8 }}>
                          {v.lt7 > 0 && <span style={{ color: 'var(--kw-success, #16a34a)' }}>&lt;7d: {v.lt7}</span>}
                          {v.d7_14 > 0 && <span style={{ color: 'var(--kw-accent-muted, #f87171)' }}>7–14d: {v.d7_14}</span>}
                          {v.d14_30 > 0 && <span style={{ color: 'var(--kw-warn, #d97706)' }}>14–30d: {v.d14_30}</span>}
                          {v.gt30 > 0 && <span style={{ color: 'var(--kw-accent, #e30613)' }}>&gt;30d: {v.gt30}</span>}
                          <span>total: {v.total}</span>
                        </span>
                      </div>
                      <div className="kw-bar" style={{ background: 'var(--kw-border, #e5e7eb)' }}>
                        <span style={{ display: 'block', width: `${barPct}%`, height: '100%', background: 'var(--kw-accent-muted, #f87171)', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* UD lead-time weekly trend */}
          {udTrend.length > 0 && (
            <div className="kw-card" style={{ marginBottom: 16 }}>
              <div className="kw-card-title">UD lead-time weekly trend (median days, last 12 weeks)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {udTrend.map(t => {
                  const pct = Math.round((t.median / maxTrendMedian) * 100)
                  return (
                    <div key={t.week}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                        <span className="kw-mono">{t.week}</span>
                        <span className="kw-num">{t.median.toFixed(1)} d · {t.count} lots</span>
                      </div>
                      <div className="kw-bar" style={{ background: 'var(--kw-border, #e5e7eb)' }}>
                        <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: t.median > 14 ? 'var(--kw-warn, #d97706)' : 'var(--kw-accent-muted, #f87171)', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent rejected lots */}
          <div className="kw-card">
            <div className="kw-card-title">Recent rejected lots (up to 30)</div>
            {recentRejected.length === 0 ? (
              <EmptyNote>No rejected lots.</EmptyNote>
            ) : (
              <div className="kw-table-wrap">
                <table className="kw-table">
                  <thead>
                    <tr>
                      <th>Lot</th><th>Material</th><th>Batch</th><th>Created</th>
                      <th>UD date</th><th>UD by</th><th>Lead time</th><th>Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRejected.map(r => (
                      <tr key={`${r.plantId}-${r.lotId}`}>
                        <td className="kw-mono">{r.lotId}</td>
                        <td title={r.materialId ?? undefined}>{r.materialName ?? r.materialId ?? '—'}</td>
                        <td className="kw-mono">{r.batchId ?? '—'}</td>
                        <td className="kw-num">{formatDate(r.lotCreatedDate)}</td>
                        <td className="kw-num">{formatDate(r.lastUsageDecisionDate)}</td>
                        <td style={{ fontSize: 11 }}>{r.lastUsageDecisionBy ?? '—'}</td>
                        <td className="kw-num">{r.udLeadTimeDays != null ? `${r.udLeadTimeDays}d` : '—'}</td>
                        <td>
                          {r.orderId && onOpenProcessOrder ? (
                            <button
                              type="button"
                              className="kw-viewnav-tab"
                              style={{ fontSize: 11, padding: '1px 6px' }}
                              onClick={() => onOpenProcessOrder(r.orderId!)}
                            >
                              {r.orderId}
                            </button>
                          ) : (
                            <span className="kw-mono">{r.orderId ?? '—'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
