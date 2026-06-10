import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { useWmBinStock, useWmList } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader } from '../components/kerry.js'

interface PaceRow {
  plantId: string; warehouseId: string; destinationZone: string
  activityHour: string; itemsStaged: number | null; qtyStaged: number | null
  operators: number | null
}
interface DemandRow {
  plantId: string; warehouseId: string; workArea: string
  productionSupplyArea?: string | null
  demandHour: string; openTrs: number | null; openQty: number | null
}
interface FlowRow {
  plantId: string; warehouseId: string; activityHour: string
  itemsIn: number | null; qtyIn: number | null; itemsOut: number | null
  qtyOut: number | null; netQty: number | null
}

const hourKey = (ts: string) => ts.slice(0, 13) // YYYY-MM-DDTHH
const hourOfDay = (ts: string) => Number(ts.slice(11, 13))

/**
 * Staging pace board — are the material handlers ahead of the wave?
 *
 * Throughput = confirmed TO items into palletising/production-supply zones per hour
 * (derived from TO flows; the bulk-drop log ZWMA_BULK_DROP_TO_LOG is not yet replicated).
 * Demand = open TR qty by planned execution hour. "What good looks like" = historical
 * per-hour-of-day averages and bests, per the Jackson conversation.
 */
export function StagingPaceView({ request }: { readonly request: WmOperationsAdapterRequest }) {
  const scope = { plant_id: request.plantId, warehouse_id: request.warehouseId }
  const pace = useWmList<PaceRow>('/api/wm-operations/staging-pace', { ...scope, days: 366, limit: 1000 })
  const demand = useWmList<DemandRow>('/api/wm-operations/staging-demand', { ...scope, limit: 1000 })
  const buffer = useWmBinStock({ ...request, storageZone: 'PALLETISING', limit: 1000 })
  const flow = useWmList<FlowRow>('/api/wm-operations/buffer-flow', { ...scope, days: 366, limit: 1000 })

  const paceRows = pace.data?.ok ? pace.data.data : []
  const demandRows = demand.data?.ok ? demand.data.data : []
  const bufferRows = buffer.data?.ok ? buffer.data.data : []
  const flowRows = (flow.data?.ok ? flow.data.data : []).slice().sort((a, b) => a.activityHour.localeCompare(b.activityHour))

  // Anchor the wave on the latest activity in the data (works on frozen snapshots too).
  const maxHour = paceRows.reduce((m, r) => (r.activityHour > m ? r.activityHour : m), '')
  const windowKeys: string[] = []
  if (maxHour) {
    const end = new Date(maxHour)
    for (let i = 47; i >= 0; i--) {
      const d = new Date(end.getTime() - i * 3600_000)
      windowKeys.push(d.toISOString().slice(0, 13))
    }
  }
  const stagedByHour = new Map<string, number>()
  for (const r of paceRows) {
    const k = hourKey(r.activityHour)
    stagedByHour.set(k, (stagedByHour.get(k) ?? 0) + (r.itemsStaged ?? 0))
  }
  const demandByHour = new Map<string, number>()
  for (const r of demandRows) {
    const k = hourKey(r.demandHour)
    demandByHour.set(k, (demandByHour.get(k) ?? 0) + (r.openTrs ?? 0))
  }

  // Historical baselines per hour of day: average + best (the "previous dedicated bests").
  const byHourOfDay = new Map<number, { total: number; days: number; best: number }>()
  for (const r of paceRows) {
    const h = hourOfDay(r.activityHour)
    const cur = byHourOfDay.get(h) ?? { total: 0, days: 0, best: 0 }
    cur.total += r.itemsStaged ?? 0
    cur.days += 1
    cur.best = Math.max(cur.best, r.itemsStaged ?? 0)
    byHourOfDay.set(h, cur)
  }

  const bufferQty = bufferRows.reduce((s, b) => s + (b.availableQty ?? 0), 0)
  const lastHourStaged = maxHour ? (stagedByHour.get(hourKey(maxHour)) ?? 0) : 0
  const lastHourBaseline = maxHour ? byHourOfDay.get(hourOfDay(maxHour)) : undefined
  const lastHourAvg = lastHourBaseline && lastHourBaseline.days ? lastHourBaseline.total / lastHourBaseline.days : 0
  const paceVsAvg = lastHourAvg > 0 ? Math.round((lastHourStaged / lastHourAvg) * 100) : null
  const openDemandTotal = demandRows.reduce((s, r) => s + (r.openTrs ?? 0), 0)

  const maxBar = Math.max(1, ...windowKeys.map(k => Math.max(stagedByHour.get(k) ?? 0, demandByHour.get(k) ?? 0)))

  // B(t): cumulate net flow, anchor the final point to the live palletising stock.
  const flowInWindow = flowRows.filter(r => windowKeys.includes(hourKey(r.activityHour)))
  let running = 0
  const bSeries = flowInWindow.map(r => ({ k: hourKey(r.activityHour), b: (running += r.netQty ?? 0) }))
  const bOffset = bSeries.length ? bufferQty - bSeries[bSeries.length - 1].b : 0
  const bByHour = new Map(bSeries.map(p => [p.k, p.b + bOffset]))
  const maxB = Math.max(1, ...[...bByHour.values()].map(v => Math.abs(v)))

  // Hours of cover: live buffer vs average hourly out-flow over the active window.
  const activeOutHours = flowInWindow.filter(r => (r.qtyOut ?? 0) > 0)
  const avgOutPerHour = activeOutHours.length
    ? activeOutHours.reduce((s, r) => s + (r.qtyOut ?? 0), 0) / activeOutHours.length
    : 0
  const hoursOfCover = avgOutPerHour > 0 ? bufferQty / avgOutPerHour : null

  // Demand by production supply area (the hyper-local axis).
  const demandByPsa = new Map<string, number>()
  for (const r of demandRows) {
    const k = r.productionSupplyArea ?? '(no area)'
    demandByPsa.set(k, (demandByPsa.get(k) ?? 0) + (r.openTrs ?? 0))
  }

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Bulk drop pacing (derived from TO flows)"
        title="Staging Pace"
        subtitle="Handler throughput into the staging buffer vs the planned demand wave — and how today compares with historical bests."
      />
      <div className="kw-kpi-row">
        <KpiTile label="Buffer in palletising" value={bufferQty.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
        <KpiTile label="Open demand (TRs)" value={openDemandTotal.toLocaleString()} tone={openDemandTotal > 0 ? 'warn' : 'ok'} />
        <KpiTile label="Staged last hour" value={lastHourStaged} />
        <KpiTile
          label="Hours of cover"
          value={hoursOfCover != null ? hoursOfCover.toFixed(1) : '—'}
          tone={hoursOfCover == null ? 'none' : hoursOfCover >= 4 ? 'ok' : hoursOfCover >= 2 ? 'warn' : 'alert'}
        />
        <KpiTile
          label="Pace vs hourly avg"
          value={paceVsAvg != null ? `${paceVsAvg}%` : '—'}
          tone={paceVsAvg == null ? 'none' : paceVsAvg >= 100 ? 'ok' : paceVsAvg >= 70 ? 'warn' : 'alert'}
        />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">
          The wave — staged-in (slate) vs planned demand (sunset), last 48h of activity
        </div>
        {pace.isLoading || demand.isLoading ? <LoadingRows rows={4} /> : windowKeys.length === 0 ? (
          <EmptyNote>No staging throughput recorded yet for this scope.</EmptyNote>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 140 }}>
              {windowKeys.map(k => {
                const staged = stagedByHour.get(k) ?? 0
                const dem = demandByHour.get(k) ?? 0
                return (
                  <div key={k} title={`${k}:00 — staged ${staged}, demand ${dem}`}
                       style={{ flex: 1, minWidth: 4, display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                    <div style={{ flex: 1, height: `${Math.max(2, (staged / maxBar) * 100)}%`, background: 'var(--kw-valentia-slate)', borderRadius: '2px 2px 0 0' }} />
                    <div style={{ flex: 1, height: `${Math.max(2, (dem / maxBar) * 100)}%`, background: 'var(--kw-sunset)', opacity: 0.75, borderRadius: '2px 2px 0 0' }} />
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--kw-forest-60)', marginTop: 4 }}>
              <span>{windowKeys[0]}:00</span>
              <span>{windowKeys[windowKeys.length - 1]}:00</span>
            </div>
          </>
        )}
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Buffer level B(t) — reconstructed from flows, anchored to live stock</div>
        {flow.isLoading ? <LoadingRows rows={3} /> : bByHour.size === 0 ? (
          <EmptyNote>No buffer flow recorded in the window.</EmptyNote>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100 }}>
            {windowKeys.map(k => {
              const b = bByHour.get(k)
              return (
                <div key={k} title={`${k}:00 — buffer ${b != null ? Math.round(b).toLocaleString() : 'n/a'}`}
                     style={{ flex: 1, minWidth: 4,
                       height: b != null ? `${Math.max(2, (Math.abs(b) / maxB) * 100)}%` : '2px',
                       background: b != null && b < 0 ? 'var(--kw-sunset)' : 'var(--kw-sage)',
                       borderRadius: '2px 2px 0 0', opacity: b == null ? 0.2 : 1 }} />
              )
            })}
          </div>
        )}
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Open demand by production supply area</div>
        {demandByPsa.size === 0 ? <EmptyNote>No open demand.</EmptyNote> : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead><tr><th>Area</th><th>Open TRs</th></tr></thead>
              <tbody>
                {[...demandByPsa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([area, trs]) => (
                  <tr key={area}><td className="kw-mono">{area}</td><td className="kw-num">{trs}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="kw-card">
        <div className="kw-card-title">What good looks like — items staged per hour of day (history)</div>
        {pace.isLoading ? <LoadingRows rows={3} /> : byHourOfDay.size === 0 ? (
          <EmptyNote>Not enough history to baseline yet.</EmptyNote>
        ) : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead><tr><th>Hour</th>{[...Array(24).keys()].map(h => <th key={h} className="kw-num">{String(h).padStart(2, '0')}</th>)}</tr></thead>
              <tbody>
                <tr>
                  <td className="kw-eyebrow">Average</td>
                  {[...Array(24).keys()].map(h => {
                    const b = byHourOfDay.get(h)
                    return <td key={h} className="kw-num">{b && b.days ? Math.round(b.total / b.days) : '—'}</td>
                  })}
                </tr>
                <tr>
                  <td className="kw-eyebrow">Avg / operator</td>
                  {[...Array(24).keys()].map(h => {
                    const rowsAtHour = paceRows.filter(r => hourOfDay(r.activityHour) === h && (r.operators ?? 0) > 0)
                    const perOp = rowsAtHour.length
                      ? rowsAtHour.reduce((s, r) => s + (r.itemsStaged ?? 0) / (r.operators ?? 1), 0) / rowsAtHour.length
                      : null
                    return <td key={h} className="kw-num">{perOp != null ? Math.round(perOp) : '—'}</td>
                  })}
                </tr>
                <tr>
                  <td className="kw-eyebrow">Best</td>
                  {[...Array(24).keys()].map(h => (
                    <td key={h} className="kw-num" style={{ color: 'var(--kw-valentia-slate)', fontWeight: 600 }}>
                      {byHourOfDay.get(h)?.best ?? '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="kw-sub" style={{ marginTop: 8 }}>
          Baselines are historical per-hour averages and bests from confirmed TO flows into
          palletising / production-supply zones. Targets per the Jackson conversation (stage X
          hours ahead, buffer floors) can be layered on once agreed — and accuracy improves
          when the bulk-drop log (ZWMA_BULK_DROP_TO_LOG) reaches bronze.
        </p>
      </div>
    </section>
  )
}
