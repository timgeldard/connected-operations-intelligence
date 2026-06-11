import { useMemo, useState } from 'react'
import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import type { WmDowntimeEvent, WmDowntimePareto } from '../adapters/wm-operations-adapter.js'
import { useWmList } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate, formatTs } from '../components/kerry.js'

const WINDOW_OPTIONS: Array<{ label: string; weeks: number }> = [
  { label: '4 weeks', weeks: 4 },
  { label: '12 weeks', weeks: 12 },
  { label: '26 weeks', weeks: 26 },
]

/** Returns the ISO date string for (maxWeekStart - N weeks). */
function weeksBack(maxWeekStart: string, n: number): string {
  const d = new Date(maxWeekStart)
  d.setDate(d.getDate() - n * 7)
  return d.toISOString().slice(0, 10)
}

export function ProductionHealthView({
  request,
  onOpenProcessOrder,
}: {
  readonly request: WmOperationsAdapterRequest
  readonly onOpenProcessOrder?: (orderId: string) => void
}) {
  const [windowWeeks, setWindowWeeks] = useState(12)
  const [selectedReason, setSelectedReason] = useState<string | null>(null)

  const paretoResult = useWmList<WmDowntimePareto>(
    '/api/wm-operations/downtime-pareto',
    { plant_id: request.plantId, limit: 1000 },
    Boolean(request.plantId),
  )
  const eventsResult = useWmList<WmDowntimeEvent>(
    '/api/wm-operations/downtime-events',
    { plant_id: request.plantId, limit: 200 },
    Boolean(request.plantId),
  )

  const allPareto = paretoResult.data?.ok ? paretoResult.data.data : []
  const allEvents = eventsResult.data?.ok ? eventsResult.data.data : []

  // Derive max week_start from data (NOT today's date — frozen snapshot)
  const maxWeekStart = useMemo(() => {
    if (allPareto.length === 0) return null
    return allPareto.reduce((max, r) => (r.weekStart > max ? r.weekStart : max), allPareto[0].weekStart)
  }, [allPareto])

  // Filter by selected window (client-side)
  const cutoff = maxWeekStart ? weeksBack(maxWeekStart, windowWeeks) : null
  const windowPareto = cutoff ? allPareto.filter(r => r.weekStart >= cutoff) : allPareto
  const windowEvents = cutoff
    ? allEvents.filter(r => r.startDatetime != null && r.startDatetime >= cutoff)
    : allEvents

  // Aggregate across weeks for pareto bars
  const byReason = useMemo(() => {
    const map = new Map<string, { description: string | null; totalMins: number; eventCount: number; orderCount: Set<string> }>()
    for (const r of windowPareto) {
      const key = r.downtimeReasonCode ?? '(unknown)'
      const cur = map.get(key) ?? { description: r.downtimeReasonDescription, totalMins: 0, eventCount: 0, orderCount: new Set() }
      cur.totalMins += r.totalDurationMinutes ?? 0
      cur.eventCount += r.eventCount ?? 0
      cur.description ??= r.downtimeReasonDescription
      map.set(key, cur)
    }
    return [...map.entries()].sort((a, b) => b[1].totalMins - a[1].totalMins)
  }, [windowPareto])

  const bySubReason = useMemo(() => {
    if (!selectedReason) return []
    const map = new Map<string, { description: string | null; totalMins: number; eventCount: number }>()
    for (const r of windowPareto) {
      if ((r.downtimeReasonCode ?? '(unknown)') !== selectedReason) continue
      const key = r.subReasonCode ?? '(none)'
      const cur = map.get(key) ?? { description: r.subReasonDescription, totalMins: 0, eventCount: 0 }
      cur.totalMins += r.totalDurationMinutes ?? 0
      cur.eventCount += r.eventCount ?? 0
      cur.description ??= r.subReasonDescription
      map.set(key, cur)
    }
    return [...map.entries()].sort((a, b) => b[1].totalMins - a[1].totalMins)
  }, [windowPareto, selectedReason])

  const byWorkCentre = useMemo(() => {
    const map = new Map<string, { lineDesc: string | null; totalMins: number; eventCount: number }>()
    for (const r of windowPareto) {
      const key = r.workCentreCode ?? '(unknown)'
      const cur = map.get(key) ?? { lineDesc: r.productionLineDescription, totalMins: 0, eventCount: 0 }
      cur.totalMins += r.totalDurationMinutes ?? 0
      cur.eventCount += r.eventCount ?? 0
      cur.lineDesc ??= r.productionLineDescription
      map.set(key, cur)
    }
    return [...map.entries()].sort((a, b) => b[1].totalMins - a[1].totalMins)
  }, [windowPareto])

  // KPI summary
  const totalHours = byReason.reduce((s, [, v]) => s + v.totalMins, 0) / 60
  const totalEvents = byReason.reduce((s, [, v]) => s + v.eventCount, 0)
  const topReason = byReason[0]
  const affectedOrders = new Set(windowEvents.map(e => e.orderNumber).filter(Boolean)).size

  const maxReasonMins = byReason[0]?.[1].totalMins ?? 1
  const maxSubMins = bySubReason[0]?.[1].totalMins ?? 1

  const recentEvents = [...windowEvents]
    .filter(e => e.startDatetime)
    .sort((a, b) => (b.startDatetime ?? '').localeCompare(a.startDatetime ?? ''))
    .slice(0, 50)

  const isLoading = paretoResult.isLoading || eventsResult.isLoading
  const error =
    (paretoResult.data && !paretoResult.data.ok ? paretoResult.data.error : null) ??
    (eventsResult.data && !eventsResult.data.ok ? eventsResult.data.error : null)

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Insight"
        title="Production Health"
        subtitle="Downtime Pareto by reason code — event counts, duration, and affected orders across the selected window."
      />

      {/* Window selector */}
      <div className="kw-filters" style={{ marginBottom: 16 }}>
        {WINDOW_OPTIONS.map(opt => (
          <button
            key={opt.weeks}
            type="button"
            className={`kw-viewnav-tab${windowWeeks === opt.weeks ? ' kw-viewnav-tab--active' : ''}`}
            onClick={() => setWindowWeeks(opt.weeks)}
          >
            {opt.label}
          </button>
        ))}
        {maxWeekStart && (
          <span className="kw-eyebrow" style={{ marginLeft: 8 }}>
            data through w/c {formatDate(maxWeekStart)}
          </span>
        )}
      </div>

      {/* KPI row */}
      <div className="kw-kpi-row">
        <KpiTile label={`Downtime hours (${windowWeeks}w)`} value={totalHours >= 1 ? `${totalHours.toFixed(1)} h` : `${Math.round(totalHours * 60)} min`} tone={totalHours > 40 ? 'alert' : totalHours > 10 ? 'warn' : 'none'} />
        <KpiTile label="Events" value={totalEvents} />
        <KpiTile label="Top reason" value={topReason ? (topReason[1].description ?? topReason[0]) : '—'} tone={topReason ? 'warn' : 'none'} />
        <KpiTile label="Affected orders" value={affectedOrders} />
      </div>

      {error ? (
        <EmptyNote>Could not load downtime data — {error.message}</EmptyNote>
      ) : isLoading ? (
        <LoadingRows rows={6} />
      ) : allPareto.length === 0 ? (
        <EmptyNote>No downtime data for this plant.</EmptyNote>
      ) : (
        <>
          {/* Reason Pareto */}
          <div className="kw-card" style={{ marginBottom: 16 }}>
            <div className="kw-card-title">Downtime by reason (sorted by total duration)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {byReason.map(([code, v]) => {
                const pct = Math.round((v.totalMins / maxReasonMins) * 100)
                const isSelected = selectedReason === code
                return (
                  <div
                    key={code}
                    style={{ cursor: 'pointer', padding: '4px 2px', borderRadius: 4, background: isSelected ? 'rgba(0,0,0,0.04)' : undefined }}
                    onClick={() => setSelectedReason(isSelected ? null : code)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setSelectedReason(isSelected ? null : code)}
                    aria-pressed={isSelected}
                    aria-label={`${code}: ${(v.totalMins / 60).toFixed(1)} hours`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span className="kw-mono" title={v.description ?? undefined}>{code} {v.description ? `— ${v.description}` : ''}</span>
                      <span className="kw-num">{(v.totalMins / 60).toFixed(1)} h · {v.eventCount} events</span>
                    </div>
                    <div className="kw-bar" style={{ background: 'var(--kw-border, #e5e7eb)' }}>
                      <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: isSelected ? 'var(--kw-accent, #e30613)' : 'var(--kw-accent-muted, #f87171)', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sub-reason breakdown */}
          {selectedReason && bySubReason.length > 0 && (
            <div className="kw-card" style={{ marginBottom: 16 }}>
              <div className="kw-card-title">Sub-reason breakdown — {selectedReason}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bySubReason.map(([code, v]) => {
                  const pct = Math.round((v.totalMins / maxSubMins) * 100)
                  return (
                    <div key={code}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span className="kw-mono" title={v.description ?? undefined}>{code} {v.description ? `— ${v.description}` : ''}</span>
                        <span className="kw-num">{(v.totalMins / 60).toFixed(1)} h · {v.eventCount} events</span>
                      </div>
                      <div className="kw-bar" style={{ background: 'var(--kw-border, #e5e7eb)' }}>
                        <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: 'var(--kw-accent-muted, #f87171)', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Work centre / line table */}
          <div className="kw-card" style={{ marginBottom: 16 }}>
            <div className="kw-card-title">By work centre</div>
            <div className="kw-table-wrap">
              <table className="kw-table">
                <thead>
                  <tr>
                    <th>Work centre</th><th>Production line</th><th>Events</th><th>Total duration</th>
                  </tr>
                </thead>
                <tbody>
                  {byWorkCentre.map(([code, v]) => (
                    <tr key={code}>
                      <td className="kw-mono">{code}</td>
                      <td>{v.lineDesc ?? '—'}</td>
                      <td className="kw-num">{v.eventCount}</td>
                      <td className="kw-num">{(v.totalMins / 60).toFixed(1)} h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent events */}
          <div className="kw-card">
            <div className="kw-card-title">Recent events (up to 50 most recent)</div>
            {recentEvents.length === 0 ? (
              <EmptyNote>No events in selected window.</EmptyNote>
            ) : (
              <div className="kw-table-wrap">
                <table className="kw-table">
                  <thead>
                    <tr>
                      <th>Start</th><th>Work centre</th><th>Reason</th><th>Sub-reason</th>
                      <th>Duration</th><th>Order</th><th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEvents.map((e, i) => (
                      <tr key={`${e.startDatetime ?? i}-${e.orderNumber ?? i}-${i}`}>
                        <td className="kw-num" style={{ fontSize: 11 }}>{formatTs(e.startDatetime)}</td>
                        <td className="kw-mono">{e.workCentreCode ?? '—'}</td>
                        <td className="kw-mono">{e.downtimeReasonCode ?? '—'}</td>
                        <td className="kw-mono">{e.subReasonCode ?? '—'}</td>
                        <td className="kw-num">{e.durationMinutes != null ? `${e.durationMinutes.toFixed(0)} min` : '—'}</td>
                        <td>
                          {e.orderNumber && onOpenProcessOrder ? (
                            <button
                              type="button"
                              className="kw-viewnav-tab"
                              style={{ fontSize: 11, padding: '1px 6px' }}
                              onClick={() => onOpenProcessOrder(e.orderNumber!)}
                            >
                              {e.orderNumber}
                            </button>
                          ) : (
                            <span className="kw-mono">{e.orderNumber ?? '—'}</span>
                          )}
                        </td>
                        <td style={{ fontSize: 11 }}>{e.reportedByUser ?? '—'}</td>
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
