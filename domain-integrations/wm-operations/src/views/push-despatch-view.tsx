import { useMemo, useState } from 'react'
import type { WmOperationsAdapterRequest, WmPushDespatchDeliveryItem, WmPushDespatchDailyItem } from '../adapters/wm-operations-adapter.js'
import { useWmPushDespatchDelivery, useWmPushDespatchDaily } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate } from '../components/kerry.js'

// ── Push Despatch — WMA-E-23 wall-display panel ───────────────────────────────
// Data scope in UAT bronze <= 2023-12-05 (UAT snapshot artefact; prod data is current).
// Four panels: KPI strip / throughput trend / push-vs-normal + 916 staged / overdue exceptions.

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${Math.round(value * 100)}%`
}

function fmtCount(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString()
}

function fmtWeight(value: number | null | undefined, unit: string | null | undefined): string {
  if (value == null) return '—'
  const u = unit ? ` ${unit}` : ''
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${u}`
}

function onTimeTone(pct: number | null): 'ok' | 'warn' | 'alert' | 'none' {
  if (pct == null) return 'none'
  if (pct >= 0.9) return 'ok'
  if (pct >= 0.75) return 'warn'
  return 'alert'
}

// ── KPI strip (Panel 1) ───────────────────────────────────────────────────────

interface PushKpiStripProps {
  readonly deliveries: WmPushDespatchDeliveryItem[]
  readonly daily: WmPushDespatchDailyItem[]
}

function PushKpiStrip({ deliveries, daily }: PushKpiStripProps) {
  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const shipmentsToday = daily
      .filter(r => r.goodsIssueDay != null && r.goodsIssueDay.slice(0, 10) === today)
      .reduce((s, r) => s + r.pushDeliveryCount, 0)

    const palletsPushed = daily
      .filter(r => r.goodsIssueDay != null && r.goodsIssueDay.slice(0, 10) === today)
      .reduce((s, r) => (r.palletsPushed != null ? s + r.palletsPushed : s), 0)

    const totalComplete = daily.reduce((s, r) => s + r.pgiCompleteCount, 0)
    const totalOnTime = daily.reduce((s, r) => s + r.onTimePgiCount, 0)
    const overallOnTimePct = totalComplete > 0 ? totalOnTime / totalComplete : null

    const openOverdueCount = deliveries.filter(r => r.isOverdue === true).length

    return { shipmentsToday, palletsPushed, overallOnTimePct, openOverdueCount }
  }, [deliveries, daily])

  return (
    <div className="kw-kpi-row">
      <KpiTile label="Push Shipments Today" value={kpis.shipmentsToday} />
      <KpiTile label="Pallets Pushed Today" value={kpis.palletsPushed > 0 ? kpis.palletsPushed : '—'} />
      <KpiTile
        label="On-Time Push %"
        value={fmtPct(kpis.overallOnTimePct)}
        tone={onTimeTone(kpis.overallOnTimePct)}
      />
      <KpiTile
        label="Open Push Issues"
        value={kpis.openOverdueCount}
        tone={kpis.openOverdueCount > 0 ? 'alert' : 'ok'}
      />
    </div>
  )
}

// ── Throughput trend (Panel 2) ─────────────────────────────────────────────────

interface ThroughputTrendProps {
  readonly daily: WmPushDespatchDailyItem[]
}

function ThroughputTrend({ daily }: ThroughputTrendProps) {
  // Aggregate across weight_unit/destination dims to get a per-day delivery count.
  const byDay = useMemo(() => {
    const acc = new Map<string, { count: number; pallets: number | null }>()
    for (const r of daily) {
      const day = r.goodsIssueDay ?? 'unknown'
      const existing = acc.get(day) ?? { count: 0, pallets: 0 }
      acc.set(day, {
        count: existing.count + r.pushDeliveryCount,
        pallets: r.palletsPushed != null
          ? (existing.pallets ?? 0) + r.palletsPushed
          : existing.pallets,
      })
    }
    return [...acc.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30) // last 30 goods-issue days
  }, [daily])

  const maxCount = Math.max(...byDay.map(([, v]) => v.count), 1)

  return (
    <div className="kw-card">
      <div className="kw-card-title">Throughput Trend — Push Deliveries per Day (last 30 days)</div>
      {byDay.length === 0 ? (
        <EmptyNote>No goods-issued push deliveries in scope.</EmptyNote>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, padding: '8px 0' }}>
          {byDay.map(([day, v]) => (
            <div
              key={day}
              title={`${day}: ${v.count} deliveries${v.pallets != null ? `, ${v.pallets} pallets` : ''}`}
              style={{
                flex: 1,
                minWidth: 6,
                height: `${Math.round((v.count / maxCount) * 100)}%`,
                background: 'var(--kw-color-primary, #2563eb)',
                borderRadius: 2,
              }}
            />
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--kw-color-muted, #6b7280)', marginTop: 2 }}>
        <span>{byDay[0]?.[0] ?? ''}</span>
        <span>{byDay[byDay.length - 1]?.[0] ?? ''}</span>
      </div>
    </div>
  )
}

// ── Push vs Normal share + 916 staging context (Panel 3) ──────────────────────
// NOTE: push-vs-normal share computed from the daily aggregate (push_delivery_count
// vs total outbound is NOT yet available as a separate KPI — add when total-outbound
// daily aggregate is surfaced). Displayed as push count with context note.
// 916 loading-bay staging signal: available from transfer_order NLTYP/VLTYP='916'
// in silver — feeding a separate dataset (future: wm_operations.916_staged).
// Not yet wired to an API endpoint; the panel shows a scope note.

interface StagingContextProps {
  readonly daily: WmPushDespatchDailyItem[]
}

function StagingContext({ daily }: StagingContextProps) {
  const totals = useMemo(() => {
    const totalPush = daily.reduce((s, r) => s + r.pushDeliveryCount, 0)
    const totalPallets = daily.reduce((s, r) => (r.palletsPushed != null ? s + r.palletsPushed : s), 0)
    return { totalPush, totalPallets }
  }, [daily])

  return (
    <div className="kw-card">
      <div className="kw-card-title">Push Share &amp; In-Transit Context</div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '8px 0' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--kw-color-muted, #6b7280)' }}>Total Push Deliveries</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{fmtCount(totals.totalPush)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--kw-color-muted, #6b7280)' }}>Total Pallets (HU count)</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{totals.totalPallets > 0 ? fmtCount(totals.totalPallets) : '—'}</div>
        </div>
      </div>
      <p style={{ fontSize: 11, color: 'var(--kw-color-muted, #6b7280)', margin: '4px 0 0' }}>
        916 loading-bay staging count: available from transfer_order (NLTYP/VLTYP=&apos;916&apos;) — not yet wired to
        a dedicated endpoint (ZPUSH_DISPATCH not replicated; pallet SSCC grain deferred — see ingestion_requests.md §5).
      </p>
    </div>
  )
}

// ── Overdue exceptions (Panel 4) ──────────────────────────────────────────────

interface OverdueExceptionsProps {
  readonly deliveries: WmPushDespatchDeliveryItem[]
}

function OverdueExceptions({ deliveries }: OverdueExceptionsProps) {
  const overdue = useMemo(
    () => deliveries.filter(r => r.isOverdue === true)
      .sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0)),
    [deliveries],
  )

  return (
    <div className="kw-card">
      <div className="kw-card-title">
        Overdue Push Deliveries
        {overdue.length > 0 && (
          <span style={{ marginLeft: 8, color: 'var(--kw-color-alert, #dc2626)', fontWeight: 600 }}>
            {overdue.length}
          </span>
        )}
      </div>
      {overdue.length === 0 ? (
        <EmptyNote>No overdue push deliveries.</EmptyNote>
      ) : (
        <div className="kw-table-wrap">
          <table className="kw-table">
            <thead>
              <tr>
                <th>Delivery</th>
                <th>Plant</th>
                <th>Destination</th>
                <th>Planned GI</th>
                <th>Days Overdue</th>
                <th>Lines</th>
                <th>Pallets</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              {overdue.map(d => (
                <tr key={`${d.plantId}-${d.deliveryId}`}>
                  <td className="kw-mono">{d.deliveryId}</td>
                  <td>{d.plantId}</td>
                  <td>{d.destinationCustomer ?? '—'}</td>
                  <td className="kw-num">{formatDate(d.plannedGoodsIssueDate)}</td>
                  <td className="kw-num" style={{ color: 'var(--kw-color-alert, #dc2626)', fontWeight: 600 }}>
                    {d.daysOverdue != null ? `+${d.daysOverdue}d` : '—'}
                  </td>
                  <td className="kw-num">{fmtCount(d.lineCount)}</td>
                  <td className="kw-num">{d.palletCount != null ? fmtCount(d.palletCount) : <span title="Pallet count unavailable — HU table absent">—</span>}</td>
                  <td className="kw-num">{fmtWeight(d.totalNetWeight, d.weightUnit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

/** Push Despatch operations panel (Spec 14, WMA-E-23). */
export function PushDespatchView({ request }: { readonly request: WmOperationsAdapterRequest }) {
  const [showAll, setShowAll] = useState(false)
  const deliveryResult = useWmPushDespatchDelivery(request.plantId, 1000)
  const dailyResult = useWmPushDespatchDaily(request.plantId, 500)

  const deliveries = deliveryResult.data?.ok ? (deliveryResult.data.data as WmPushDespatchDeliveryItem[]) : []
  const daily = dailyResult.data?.ok ? (dailyResult.data.data as WmPushDespatchDailyItem[]) : []
  const deliveryError = deliveryResult.data && !deliveryResult.data.ok ? deliveryResult.data.error : null
  const dailyError = dailyResult.data && !dailyResult.data.ok ? dailyResult.data.error : null

  const visibleDeliveries = useMemo(
    () => (showAll ? deliveries : deliveries.slice(0, 200)),
    [deliveries, showAll],
  )

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Outbound"
        title="Push Despatch"
        subtitle={
          'Unplanned RF-driven plant→DC repositioning moves (SDABW=ZPUS, WMA-E-23). ' +
          'Segregated from customer-facing outbound KPIs. ' +
          'UAT data scope: ≤ 2023-12-05 (bronze snapshot artefact; prod data is current).'
        }
      />

      {/* Panel 1: KPI strip */}
      {deliveryError ? (
        <EmptyNote>Could not load push deliveries — {deliveryError.message}</EmptyNote>
      ) : deliveryResult.isLoading ? (
        <LoadingRows rows={1} />
      ) : (
        <PushKpiStrip deliveries={deliveries} daily={daily} />
      )}

      {/* Panel 2: Throughput trend */}
      {dailyError ? (
        <div className="kw-card"><EmptyNote>Could not load daily aggregate — {dailyError.message}</EmptyNote></div>
      ) : dailyResult.isLoading ? (
        <div className="kw-card"><LoadingRows rows={4} /></div>
      ) : (
        <ThroughputTrend daily={daily} />
      )}

      {/* Panel 3: Push share + in-transit context */}
      {dailyResult.isLoading ? (
        <div className="kw-card"><LoadingRows rows={2} /></div>
      ) : (
        <StagingContext daily={daily} />
      )}

      {/* Panel 4: Overdue exceptions */}
      {deliveryError ? (
        <div className="kw-card"><EmptyNote>Could not load exceptions — {deliveryError.message}</EmptyNote></div>
      ) : deliveryResult.isLoading ? (
        <div className="kw-card"><LoadingRows rows={4} /></div>
      ) : (
        <OverdueExceptions deliveries={visibleDeliveries} />
      )}

      {deliveries.length > 200 && !showAll && (
        <div style={{ textAlign: 'center', margin: '12px 0' }}>
          <button type="button" className="kw-link" onClick={() => setShowAll(true)}>
            Show all {deliveries.length} deliveries
          </button>
        </div>
      )}
    </section>
  )
}
