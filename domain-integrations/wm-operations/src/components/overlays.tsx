import type { ReactNode } from 'react'
import { useWmBatchMovements, useWmOrderComponents } from '../adapters/wm-operations-queries.js'
import { EmptyNote, LoadingRows, formatDate, formatQty } from './kerry.js'

function Overlay({ title, subtitle, onClose, children }: {
  readonly title: string
  readonly subtitle?: string
  readonly onClose: () => void
  readonly children: ReactNode
}) {
  return (
    <div className="kw-overlay-backdrop" onClick={onClose}>
      <div className="kw-overlay" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
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
export function OrderDetailOverlay({ plantId, orderId, orderLabel, onClose }: {
  readonly plantId: string
  readonly orderId: string
  readonly orderLabel?: string
  readonly onClose: () => void
}) {
  const result = useWmOrderComponents({ plantId, orderId })
  const rows = result.data?.ok ? result.data.data : []
  const error = result.data && !result.data.ok ? result.data.error : null

  return (
    <Overlay title={`Order ${orderId}`} subtitle={orderLabel ?? 'Component staging detail'} onClose={onClose}>
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
