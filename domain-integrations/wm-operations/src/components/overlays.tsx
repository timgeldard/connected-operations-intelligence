import type { ReactNode } from 'react'
import { useWmBatchMovements, useWmList, useWmOrderComponents } from '../adapters/wm-operations-queries.js'
import type { WmOperatorActivityItem } from '../adapters/wm-operations-adapter.js'
import { EmptyNote, LoadingRows, formatDate, formatQty } from './kerry.js'

function Overlay({ title, subtitle, onClose, children }: {
  readonly title: string
  readonly subtitle?: string
  readonly onClose: () => void
  readonly children: ReactNode
}) {
  return (
    <div className="kw-overlay-backdrop" onClick={onClose}>
      <div className="kw-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="kw-eyebrow">{subtitle ?? 'WM Operations'}</div>
            <h2 style={{ margin: '2px 0 12px', fontSize: 18, fontWeight: 700 }}>{title}</h2>
          </div>
          <button type="button" className="kw-viewnav-tab" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Screen 1 — component-level "why isn't this order ready?" drill-through. */
export function OrderDetailOverlay({ plantId, orderId, orderLabel, onClose, onOpenProcessOrder }: {
  readonly plantId: string
  readonly orderId: string
  readonly orderLabel?: string
  readonly onClose: () => void
  readonly onOpenProcessOrder?: (orderId: string) => void
}) {
  const result = useWmOrderComponents({ plantId, orderId })
  const rows = result.data?.ok ? result.data.data : []
  const error = result.data && !result.data.ok ? result.data.error : null

  return (
    <Overlay title={`Order ${orderId}`} subtitle={orderLabel ?? 'Component staging detail'} onClose={onClose}>
      {onOpenProcessOrder && (
        <div style={{ marginBottom: 10 }}>
          <button type="button" className="kw-viewnav-tab" onClick={() => onOpenProcessOrder(orderId)}>
            Open in Process Order Review →
          </button>
        </div>
      )}
      {error ? (
        <EmptyNote>Could not load components — {error.message}</EmptyNote>
      ) : result.isLoading ? (
        <LoadingRows rows={5} />
      ) : rows.length === 0 ? (
        <EmptyNote>No WM component reservations for this order.</EmptyNote>
      ) : (
        <div className="kw-table-wrap">
          <table className="kw-table">
            <thead>
              <tr>
                <th>Item</th><th>Op</th><th>Material</th><th>Batch</th><th>Required</th><th>Open</th>
                <th>PSA</th><th>TR coverage</th><th>Picked</th><th>Supplied</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(c => (
                <tr key={`${c.reservationId}-${c.reservationItem}`}>
                  <td className="kw-mono">{c.reservationItem}</td>
                  <td className="kw-mono">{c.operationNumber ?? '—'}</td>
                  <td title={c.materialId ?? undefined}>
                    {c.materialName ?? c.materialId ?? '—'}
                    {(c.materialComponentCount ?? 0) > 1 && (
                      <span className="kw-chip kw-chip--neutral" style={{ marginLeft: 6 }} title="Material appears on multiple components; TR/pick figures are shared">shared</span>
                    )}
                  </td>
                  <td className="kw-mono">{c.batchId ?? '—'}</td>
                  <td className="kw-num">{formatQty(c.requiredQty, c.uom)}</td>
                  <td className="kw-num">{formatQty(c.openQty, c.uom)}</td>
                  <td className="kw-mono">{c.productionSupplyArea ?? '—'}</td>
                  <td>
                    <span className={`kw-chip ${c.trCoverageStatus === 'FULL' ? 'kw-chip--complete' : c.trCoverageStatus === 'PARTIAL' ? 'kw-chip--parked' : 'kw-chip--neutral'}`}>
                      {c.trCoverageStatus ?? '—'}
                    </span>
                  </td>
                  <td>
                    {c.pickProgressFraction != null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="kw-progress" style={{ width: 56 }}>
                          <span style={{ width: `${Math.round(c.pickProgressFraction * 100)}%` }} />
                        </div>
                        <span className="kw-num" style={{ fontSize: 10.5 }}>{Math.round(c.pickProgressFraction * 100)}%</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td>
                    <span className={`kw-chip ${c.isSupplied ? 'kw-chip--complete' : 'kw-chip--neutral'}`}>
                      {c.isSupplied ? 'Supplied' : formatQty(c.psaSuppliedQty, c.uom)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Overlay>
  )
}

/** Outbound drill — open pick tasks for one delivery (confirmed picks age out of the
 * open-items gold, so shipped deliveries legitimately show none). */
export function DeliveryPicksOverlay({ plantId, deliveryId, customer, onClose }: {
  readonly plantId: string
  readonly deliveryId: string
  readonly customer?: string | null
  readonly onClose: () => void
}) {
  const result = useWmList<{
    plantId: string; taskId: string; itemNumber: string; materialId: string | null
    batchId: string | null; sourceStorageType: string | null; sourceStorageBin: string | null
    requestedQuantity: number | null; confirmedQuantity: number | null
    itemStatus: string | null; createdDatetime: string | null; createdByUser: string | null
  }>('/api/wm-operations/delivery-picks', { plant_id: plantId, delivery_id: deliveryId })
  const rows = result.data?.ok ? result.data.data : []

  return (
    <Overlay title={`Delivery ${deliveryId}`} subtitle={customer ?? 'Open pick tasks'} onClose={onClose}>
      {result.isLoading ? <LoadingRows rows={4} /> : rows.length === 0 ? (
        <EmptyNote>No open pick tasks — picking is complete or not yet created.</EmptyNote>
      ) : (
        <div className="kw-table-wrap">
          <table className="kw-table">
            <thead><tr><th>TO</th><th>Item</th><th>Material</th><th>Batch</th><th>From</th><th>Requested</th><th>Confirmed</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map(t => (
                <tr key={`${t.taskId}-${t.itemNumber}`}>
                  <td className="kw-mono">{t.taskId}</td>
                  <td className="kw-mono">{t.itemNumber}</td>
                  <td className="kw-mono">{t.materialId ?? String.fromCharCode(8212)}</td>
                  <td className="kw-mono">{t.batchId ?? String.fromCharCode(8212)}</td>
                  <td className="kw-mono">{t.sourceStorageType}/{t.sourceStorageBin}</td>
                  <td className="kw-num">{formatQty(t.requestedQuantity)}</td>
                  <td className="kw-num">{formatQty(t.confirmedQuantity)}</td>
                  <td><span className={`kw-chip ${t.itemStatus === 'Open' ? 'kw-chip--open' : 'kw-chip--in-progress'}`}>{t.itemStatus}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Overlay>
  )
}

/** Operators drill — one operator's daily activity (client-side over loaded rows). */
export function OperatorDetailOverlay({ operator, rows, onClose }: {
  readonly operator: string
  readonly rows: WmOperatorActivityItem[]
  readonly onClose: () => void
}) {
  const mine = rows
    .filter(r => r.operator === operator)
    .sort((a, b) => b.activityDate.localeCompare(a.activityDate))
  return (
    <Overlay title={operator} subtitle="Daily pick activity (window)" onClose={onClose}>
      {mine.length === 0 ? <EmptyNote>No activity in the window.</EmptyNote> : (
        <div className="kw-table-wrap">
          <table className="kw-table">
            <thead><tr><th>Date</th><th>Shift</th><th>Items</th><th>TOs</th><th>TRs</th><th>Materials</th></tr></thead>
            <tbody>
              {mine.map((r, i) => (
                <tr key={`${r.activityDate}-${i}`}>
                  <td className="kw-num">{formatDate(r.activityDate)}</td>
                  <td>{(r as { shift?: string | null }).shift ?? String.fromCharCode(8212)}</td>
                  <td className="kw-num">{(r.itemsConfirmed ?? 0).toLocaleString()}</td>
                  <td className="kw-num">{(r.transferOrders ?? 0).toLocaleString()}</td>
                  <td className="kw-num">{(r.transferRequirements ?? 0).toLocaleString()}</td>
                  <td className="kw-num">{(r.materials ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Overlay>
  )
}

/** Stock-explorer drill — recent goods movements for a material (+batch). */
export function BatchHistoryOverlay({ plantId, materialId, materialName, batchId, onClose }: {
  readonly plantId: string
  readonly materialId: string
  readonly materialName?: string | null
  readonly batchId?: string | null
  readonly onClose: () => void
}) {
  const result = useWmBatchMovements({ plantId, materialId, batchId: batchId ?? undefined, days: 31 })
  const rows = result.data?.ok ? result.data.data : []
  const error = result.data && !result.data.ok ? result.data.error : null

  return (
    <Overlay
      title={materialName ?? materialId}
      subtitle={`Movements · last 31 days${batchId ? ` · batch ${batchId}` : ''}`}
      onClose={onClose}
    >
      {error ? (
        <EmptyNote>Could not load movements — {error.message}</EmptyNote>
      ) : result.isLoading ? (
        <LoadingRows rows={5} />
      ) : rows.length === 0 ? (
        <EmptyNote>No goods movements in the last 31 days.</EmptyNote>
      ) : (
        <div className="kw-table-wrap">
          <table className="kw-table">
            <thead>
              <tr>
                <th>Date</th><th>Movement</th><th>Qty</th><th>Batch</th>
                <th>Order / Delivery</th><th>Document</th><th>By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => (
                <tr key={`${m.documentId}-${m.documentItem}-${i}`}>
                  <td className="kw-num">{formatDate(m.postingDate)}</td>
                  <td><span className="kw-mono">{m.movementType}</span> {m.movementLabel ?? ''}</td>
                  <td className="kw-num">{formatQty(m.quantity, m.uom)}</td>
                  <td className="kw-mono">{m.batchId ?? '—'}</td>
                  <td className="kw-mono">{m.orderId ?? m.deliveryId ?? '—'}</td>
                  <td className="kw-mono">{m.documentId ?? '—'}</td>
                  <td>{m.postedBy ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Overlay>
  )
}
