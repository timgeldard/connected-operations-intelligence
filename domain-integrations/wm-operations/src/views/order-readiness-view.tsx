import { useState } from 'react'
import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { OrderDetailOverlay } from '../components/overlays.js'
import { setWorklistDeepLink } from '../state/deep-link.js'
import { useWmOrderReadiness } from '../adapters/wm-operations-queries.js'
import {
  ViewHeader,
  KpiTile,
  BandDot,
  EmptyNote,
  LoadingRows,
  formatQty,
  formatDate,
} from '../components/kerry.js'

export interface OrderReadinessViewProps {
  readonly request: WmOperationsAdapterRequest
  readonly onNavigateToView?: (viewId: string) => void
  readonly onOpenProcessOrder?: (orderId: string) => void
}

const COVERAGE_LABEL: Record<string, string> = {
  NONE: 'No TRs',
  PARTIAL: 'Partial',
  FULL: 'Full',
}

const SUPPLY_LABEL: Record<string, string> = {
  NOT_SUPPLIED: 'Not supplied',
  PARTIAL: 'Partial',
  SUPPLIED: 'Supplied',
}

const READINESS_LABEL: Record<string, string> = {
  SUPPLIED: 'Supplied to line',
  STAGING_PLANNED: 'Staging planned',
  PARTIALLY_PLANNED: 'Partially planned',
  NOT_STARTED: 'Not started',
  NO_WM_DEMAND: 'No WM demand',
}

const HORIZONS = [
  { value: '', label: 'All scheduled dates' },
  { value: '7', label: 'Next 7 days' },
  { value: '30', label: 'Next 30 days' },
] as const

export function OrderReadinessView({ request, onNavigateToView, onOpenProcessOrder }: OrderReadinessViewProps) {
  const [horizon, setHorizon] = useState('')
  const [drillOrder, setDrillOrder] = useState<{ orderId: string; label?: string } | null>(null)
  const result = useWmOrderReadiness({
    ...request,
    startFromDaysAgo: horizon ? 2 : undefined,
    startToDaysAhead: horizon ? Number(horizon) : undefined,
  })
  const orders = result.data?.ok ? result.data.data : []
  const error = result.data && !result.data.ok ? result.data.error : null

  const atRisk = orders.filter(o => o.readinessBand === 'red').length
  const watch = orders.filter(o => o.readinessBand === 'amber').length
  const ready = orders.filter(o => o.readinessBand === 'green').length

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Staging readiness"
        title="Order Readiness"
        subtitle="Released process orders, their transfer-requirement coverage and line-side supply — the cockpit traffic light, on one page."
      />

      <div className="kw-kpi-row">
        <KpiTile label="Released orders" value={orders.length} />
        <KpiTile label="At risk" value={atRisk} tone={atRisk > 0 ? 'alert' : 'none'} />
        <KpiTile label="Watch" value={watch} tone={watch > 0 ? 'warn' : 'none'} />
        <KpiTile label="Ready / supplied" value={ready} tone="ok" />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">
          Released orders by scheduled start
          <select
            aria-label="Schedule horizon"
            style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 12 }}
            value={horizon}
            onChange={e => setHorizon(e.target.value)}
          >
            {HORIZONS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </div>
        {error ? (
          <EmptyNote>Could not load order readiness — {error.message}</EmptyNote>
        ) : result.isLoading ? (
          <LoadingRows rows={6} />
        ) : orders.length === 0 ? (
          <EmptyNote>No released process orders for this scope.</EmptyNote>
        ) : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Order</th>
                  <th>Material</th>
                  <th>Qty</th>
                  <th>Start</th>
                  <th>Days</th>
                  <th></th>
                  <th>PSA</th>
                  <th>WM components</th>
                  <th>TR coverage</th>
                  <th>Line supply</th>
                  <th>Readiness</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={`${order.plantId}-${order.orderId}`}>
                    <td><BandDot band={order.readinessBand} /></td>
                    <td className="kw-mono">
                      <button type="button" className="kw-link" onClick={() => setDrillOrder({ orderId: order.orderId, label: order.materialName ?? undefined })}>{order.orderId}</button>
                    </td>
                    <td title={order.materialId ?? undefined}>
                      {order.materialName ?? order.materialId ?? '—'}
                    </td>
                    <td className="kw-num">{formatQty(order.orderQty, order.uom)}</td>
                    <td className="kw-num">{formatDate(order.scheduledStartDate)}</td>
                    <td className="kw-num">{order.daysToStart ?? '—'}</td>
                    <td>
                      {onNavigateToView && (order.trCount ?? 0) > 0 && (
                        <button type="button" className="kw-link" onClick={() => { setWorklistDeepLink({ reference: order.orderId }); onNavigateToView('staging-worklist') }}>TRs</button>
                      )}
                    </td>
                    <td className="kw-mono">{order.productionSupplyArea ?? '—'}</td>
                    <td className="kw-num">{order.wmComponentCount ?? 0}</td>
                    <td>
                      <span className={`kw-chip ${order.trCoverageStatus === 'FULL' ? 'kw-chip--complete' : order.trCoverageStatus === 'PARTIAL' ? 'kw-chip--parked' : 'kw-chip--neutral'}`}>
                        {COVERAGE_LABEL[order.trCoverageStatus] ?? order.trCoverageStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`kw-chip ${order.supplyStatus === 'SUPPLIED' ? 'kw-chip--complete' : order.supplyStatus === 'PARTIAL' ? 'kw-chip--parked' : 'kw-chip--neutral'}`}>
                        {SUPPLY_LABEL[order.supplyStatus] ?? order.supplyStatus}
                      </span>
                    </td>
                    <td>{READINESS_LABEL[order.readinessStatus] ?? order.readinessStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {drillOrder && request.plantId && (
        <OrderDetailOverlay
          plantId={request.plantId}
          orderId={drillOrder.orderId}
          orderLabel={drillOrder.label}
          onClose={() => setDrillOrder(null)}
          onOpenProcessOrder={onOpenProcessOrder}
        />
      )}
    </section>
  )
}
