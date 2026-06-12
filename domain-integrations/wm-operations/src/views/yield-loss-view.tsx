import { useMemo, useState } from 'react'
import type { WmOperationsAdapterRequest, WmOrderYieldItem, WmComponentVarianceItem } from '../adapters/wm-operations-adapter.js'
import { useWmOrderYield, useWmComponentVariance } from '../adapters/wm-operations-queries.js'
import { setOrderJourneyDeepLink } from '../state/deep-link.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate, formatQty } from '../components/kerry.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${Math.round(value * 100)}%`
}

function fmtValue(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

// Yield tone: ok >= 95%, warn >= 85%, alert below
function yieldTone(yieldPct: number | null): 'ok' | 'warn' | 'alert' | 'none' {
  if (yieldPct == null) return 'none'
  if (yieldPct >= 0.95) return 'ok'
  if (yieldPct >= 0.85) return 'warn'
  return 'alert'
}

// ── KPI strip ─────────────────────────────────────────────────────────────────

interface YieldKpiStripProps {
  readonly items: WmOrderYieldItem[]
}

function YieldKpiStrip({ items }: YieldKpiStripProps) {
  const completedWithGr = items.filter(r => r.isComplete && r.hasGoodsReceipt)
  const yieldValues = completedWithGr.map(r => r.yieldPct).filter((v): v is number => v != null)
  const medianYield = useMemo(() => {
    if (yieldValues.length === 0) return null
    const sorted = [...yieldValues].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }, [yieldValues])

  const belowThresholdCount = completedWithGr.filter(r => (r.yieldPct ?? 1) < 0.95).length

  const varianceItems = items  // component variance KPI uses order count with positive variance
  // (Not queried here — we compute from the order yield data as a proxy)
  const ordersWithOverIssue = items.filter(r => r.hasGoodsReceipt).length

  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
      <KpiTile
        label="Median Yield %"
        value={medianYield != null ? pct(medianYield) : '—'}
        tone={yieldTone(medianYield)}
      />
      <KpiTile
        label="Orders Below 95%"
        value={belowThresholdCount}
        tone={belowThresholdCount > 0 ? 'warn' : 'ok'}
      />
      <KpiTile
        label="Orders with GR"
        value={ordersWithOverIssue}
        tone="none"
      />
    </div>
  )
}

// ── Order yield table ─────────────────────────────────────────────────────────

interface OrderYieldTableProps {
  readonly items: WmOrderYieldItem[]
  readonly isLoading: boolean
  readonly error: string | null
  readonly onOpenJourney?: (orderId: string) => void
}

type SortKey = 'yieldPct' | 'scheduledFinishDate' | 'plannedQty'
type SortDir = 'asc' | 'desc'

function OrderYieldTable({ items, isLoading, error, onOpenJourney }: OrderYieldTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('yieldPct')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    const copy = [...items]
    copy.sort((a, b) => {
      let av: number | string | null = null
      let bv: number | string | null = null
      if (sortKey === 'yieldPct') { av = a.yieldPct; bv = b.yieldPct }
      else if (sortKey === 'scheduledFinishDate') { av = a.scheduledFinishDate; bv = b.scheduledFinishDate }
      else if (sortKey === 'plannedQty') { av = a.plannedQty; bv = b.plannedQty }
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [items, sortKey, sortDir])

  function col(key: SortKey, label: string) {
    const arrow = sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''
    return (
      <th
        style={{ cursor: 'pointer', userSelect: 'none', padding: '6px 8px', fontWeight: 600, fontSize: 12, textAlign: 'left', borderBottom: '2px solid var(--kw-border, #e8e8e8)' }}
        onClick={() => handleSort(key)}
      >
        {label}{arrow}
      </th>
    )
  }

  if (error) return <EmptyNote>Could not load order yield data — {error}</EmptyNote>
  if (isLoading) return <LoadingRows rows={8} />
  if (sorted.length === 0) return <EmptyNote>No orders with yield data for the selected plant.</EmptyNote>

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ padding: '6px 8px', fontWeight: 600, fontSize: 12, textAlign: 'left', borderBottom: '2px solid var(--kw-border, #e8e8e8)' }}>Order</th>
            <th style={{ padding: '6px 8px', fontWeight: 600, fontSize: 12, textAlign: 'left', borderBottom: '2px solid var(--kw-border, #e8e8e8)' }}>Material</th>
            <th style={{ padding: '6px 8px', fontWeight: 600, fontSize: 12, textAlign: 'left', borderBottom: '2px solid var(--kw-border, #e8e8e8)' }}>Line</th>
            {col('plannedQty', 'Planned')}
            <th style={{ padding: '6px 8px', fontWeight: 600, fontSize: 12, textAlign: 'left', borderBottom: '2px solid var(--kw-border, #e8e8e8)' }}>Delivered</th>
            {col('yieldPct', 'Yield %')}
            {col('scheduledFinishDate', 'Sched. Finish')}
            <th style={{ padding: '6px 8px', fontWeight: 600, fontSize: 12, textAlign: 'left', borderBottom: '2px solid var(--kw-border, #e8e8e8)' }}>Status</th>
            {onOpenJourney && <th style={{ padding: '6px 8px', borderBottom: '2px solid var(--kw-border, #e8e8e8)' }} />}
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => {
            const tone = yieldTone(row.yieldPct)
            const yieldColor = tone === 'ok'
              ? 'var(--kw-success, #007a33)'
              : tone === 'warn'
                ? 'var(--kw-warning, #e07b00)'
                : tone === 'alert'
                  ? 'var(--kw-error, #c00)'
                  : 'var(--kw-text-muted, #888)'
            const status = row.isClosed ? 'Closed' : row.isComplete ? 'Complete' : row.isCompleted ? 'TECO' : row.isReleased ? 'Released' : 'Open'
            return (
              <tr key={`${row.plantId}-${row.orderId}`} style={{ borderBottom: '1px solid var(--kw-border, #e8e8e8)' }}>
                <td style={{ padding: '5px 8px' }}>
                  <span className="kw-mono" style={{ fontWeight: 700 }}>{row.orderId}</span>
                </td>
                <td style={{ padding: '5px 8px', color: 'var(--kw-text-secondary, #444)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.materialName ?? row.materialId ?? '—'}
                </td>
                <td style={{ padding: '5px 8px', color: 'var(--kw-text-muted, #888)' }}>
                  {row.productionLine ?? '—'}
                </td>
                <td style={{ padding: '5px 8px' }}>
                  {formatQty(row.plannedQty, row.uom)}
                </td>
                <td style={{ padding: '5px 8px' }}>
                  {row.hasGoodsReceipt ? formatQty(row.deliveredQty, row.uom) : <span style={{ color: 'var(--kw-text-muted, #888)' }}>No GR</span>}
                </td>
                <td style={{ padding: '5px 8px', fontWeight: 700, color: yieldColor }}>
                  {row.hasGoodsReceipt ? pct(row.yieldPct) : '—'}
                </td>
                <td style={{ padding: '5px 8px', color: 'var(--kw-text-muted, #888)' }}>
                  {formatDate(row.scheduledFinishDate)}
                </td>
                <td style={{ padding: '5px 8px', color: 'var(--kw-text-muted, #888)' }}>
                  {status}
                </td>
                {onOpenJourney && (
                  <td style={{ padding: '5px 8px' }}>
                    <button
                      type="button"
                      className="kw-viewnav-tab"
                      style={{ fontSize: 11, padding: '2px 6px' }}
                      onClick={() => onOpenJourney(row.orderId)}
                    >
                      Journey
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Component variance pareto list ───────────────────────────────────────────

interface ComponentVarianceListProps {
  readonly items: WmComponentVarianceItem[]
  readonly isLoading: boolean
  readonly error: string | null
}

function ComponentVarianceList({ items, isLoading, error }: ComponentVarianceListProps) {
  // Show only over-issued (loss) components, sorted by absolute variance descending
  const overIssued = useMemo(
    () => items
      .filter(r => (r.varianceQty ?? 0) > 0)
      .sort((a, b) => (b.varianceQty ?? 0) - (a.varianceQty ?? 0))
      .slice(0, 50),
    [items],
  )

  if (error) return <EmptyNote>Could not load component variance data — {error}</EmptyNote>
  if (isLoading) return <LoadingRows rows={6} />
  if (overIssued.length === 0) return <EmptyNote>No over-issued components for the selected plant.</EmptyNote>

  const totalEstLoss = overIssued.reduce((s, r) => s + (r.estLossValue ?? 0), 0)

  return (
    <div>
      {totalEstLoss > 0 && (
        <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--kw-text-secondary, #444)' }}>
          <span className="kw-eyebrow">Est. total loss value</span>{' '}
          <strong style={{ color: 'var(--kw-error, #c00)' }}>
            {totalEstLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </strong>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'left', borderBottom: '2px solid var(--kw-border, #e8e8e8)' }}>Order</th>
              <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'left', borderBottom: '2px solid var(--kw-border, #e8e8e8)' }}>Material</th>
              <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right', borderBottom: '2px solid var(--kw-border, #e8e8e8)' }}>Required</th>
              <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right', borderBottom: '2px solid var(--kw-border, #e8e8e8)' }}>Issued</th>
              <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right', borderBottom: '2px solid var(--kw-border, #e8e8e8)' }}>Variance</th>
              <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right', borderBottom: '2px solid var(--kw-border, #e8e8e8)' }}>Variance %</th>
              <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right', borderBottom: '2px solid var(--kw-border, #e8e8e8)' }}>Est. Loss</th>
            </tr>
          </thead>
          <tbody>
            {overIssued.map(row => (
              <tr key={`${row.plantId}-${row.orderId}-${row.reservationId}-${row.reservationItem}`} style={{ borderBottom: '1px solid var(--kw-border, #e8e8e8)' }}>
                <td style={{ padding: '5px 8px' }}>
                  <span className="kw-mono" style={{ fontWeight: 700 }}>{row.orderId}</span>
                </td>
                <td style={{ padding: '5px 8px', color: 'var(--kw-text-secondary, #444)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.materialName ?? row.materialId ?? '—'}
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                  {formatQty(row.requiredQty, row.uom)}
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                  {formatQty(row.issuedQty, row.uom)}
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--kw-error, #c00)', fontWeight: 600 }}>
                  +{formatQty(row.varianceQty, row.uom)}
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--kw-warning, #e07b00)' }}>
                  {pct(row.variancePct)}
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: row.estLossValue ? 'var(--kw-error, #c00)' : 'var(--kw-text-muted, #888)' }}>
                  {row.estLossValue != null ? fmtValue(row.estLossValue) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export interface YieldLossViewProps {
  readonly request: WmOperationsAdapterRequest
  readonly onNavigateToView?: (viewId: string) => void
}

export function YieldLossView({ request, onNavigateToView }: YieldLossViewProps) {
  const yieldResult = useWmOrderYield(request.plantId, 500, Boolean(request.plantId))
  const varianceResult = useWmComponentVariance(request.plantId, undefined, 500, Boolean(request.plantId))

  const yieldItems: WmOrderYieldItem[] = yieldResult.data?.ok ? yieldResult.data.data : []
  const varianceItems: WmComponentVarianceItem[] = varianceResult.data?.ok ? varianceResult.data.data : []

  const yieldError = yieldResult.data && !yieldResult.data.ok ? yieldResult.data.error.message : null
  const varianceError = varianceResult.data && !varianceResult.data.ok ? varianceResult.data.error.message : null

  function handleOpenJourney(orderId: string) {
    if (!onNavigateToView) return
    setOrderJourneyDeepLink({ plantId: request.plantId ?? undefined, orderId })
    onNavigateToView('order-journey')
  }

  if (!request.plantId) {
    return (
      <section>
        <ViewHeader eyebrow="Insight" title="Yield & Loss" subtitle="Select a plant to view order yield and component loss analytics." />
        <EmptyNote>No plant selected.</EmptyNote>
      </section>
    )
  }

  return (
    <section>
      <ViewHeader
        eyebrow="Insight"
        title="Yield & Loss"
        subtitle="Order yield vs planned, and component material variance (over-issue loss waterfall)."
      />

      <YieldKpiStrip items={yieldItems} />

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Order yield table */}
        <div className="kw-card" style={{ flex: '2 1 520px', minWidth: 320 }}>
          <div className="kw-card-title" style={{ marginBottom: 12 }}>Order Yield</div>
          <OrderYieldTable
            items={yieldItems}
            isLoading={yieldResult.isLoading}
            error={yieldError}
            onOpenJourney={onNavigateToView ? handleOpenJourney : undefined}
          />
        </div>

        {/* Component variance pareto */}
        <div className="kw-card" style={{ flex: '1 1 360px', minWidth: 280 }}>
          <div className="kw-card-title" style={{ marginBottom: 12 }}>Component Over-Issue (Loss)</div>
          <ComponentVarianceList
            items={varianceItems}
            isLoading={varianceResult.isLoading}
            error={varianceError}
          />
        </div>
      </div>
    </section>
  )
}
