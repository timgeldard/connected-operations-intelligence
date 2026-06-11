import { useState } from 'react'
import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { useWmOutbound } from '../adapters/wm-operations-queries.js'
import { DeliveryPicksOverlay } from '../components/overlays.js'
import { BandDot, EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate, formatQty } from '../components/kerry.js'

/** Screen 4 — outbound delivery picking board (gold_delivery_pick_status + live bands). */
export function OutboundView({ request }: { readonly request: WmOperationsAdapterRequest }) {
  const [includeShipped, setIncludeShipped] = useState(false)
  const [drill, setDrill] = useState<{ deliveryId: string; customer?: string | null } | null>(null)
  const result = useWmOutbound({ ...request, includeShipped })
  const rows = result.data?.ok ? result.data.data : []
  const error = result.data && !result.data.ok ? result.data.error : null

  const atRisk = rows.filter(r => r.riskBand === 'red').length
  const watch = rows.filter(r => r.riskBand === 'amber').length
  const dueToday = rows.filter(r => r.daysToGoodsIssue === 0).length

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Outbound"
        title="Outbound Picking"
        subtitle="Open outbound deliveries, pick progress, and goods-issue risk. Inbound (EL/ELST) deliveries were previously included here and are now shown on the Inbound &amp; Putaway screen — KPI counts dropped ~65%, which is the fix."
      />

      <div className="kw-kpi-row">
        <KpiTile label="Open deliveries" value={rows.length} />
        <KpiTile label="At risk" value={atRisk} tone={atRisk > 0 ? 'alert' : 'none'} />
        <KpiTile label="Watch" value={watch} tone={watch > 0 ? 'warn' : 'none'} />
        <KpiTile label="GI due today" value={dueToday} />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">
          Deliveries by planned goods issue
          <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 400 }}>
            <input type="checkbox" checked={includeShipped} onChange={e => setIncludeShipped(e.target.checked)} />
            Include shipped
          </label>
        </div>
        {error ? (
          <EmptyNote>Could not load deliveries — {error.message}</EmptyNote>
        ) : result.isLoading ? (
          <LoadingRows rows={6} />
        ) : rows.length === 0 ? (
          <EmptyNote>No open deliveries for this scope.</EmptyNote>
        ) : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead>
                <tr>
                  <th></th><th>Delivery</th><th>Customer</th><th>Lines</th><th>Qty</th>
                  <th>Picked</th><th>Progress</th><th>Planned GI</th><th>Days</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(d => (
                  <tr key={`${d.plantId}-${d.deliveryId}`}>
                    <td><BandDot band={d.riskBand} /></td>
                    <td className="kw-mono">
                      <button type="button" className="kw-link" onClick={() => setDrill({ deliveryId: d.deliveryId, customer: d.shipToCustomerName })}>{d.deliveryId}</button>
                    </td>
                    <td>{d.shipToCustomerName ?? d.shipToCustomerId ?? '—'}</td>
                    <td className="kw-num">{d.lineCount ?? '—'}</td>
                    <td className="kw-num">{formatQty(d.deliveryQty, d.hasMixedBaseUom ? null : undefined)}</td>
                    <td className="kw-num">{formatQty(d.pickedQty)}</td>
                    <td>
                      {d.pickFraction != null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="kw-progress" style={{ width: 64 }}>
                            <span style={{ width: `${Math.min(100, Math.round(d.pickFraction * 100))}%` }} />
                          </div>
                          <span className="kw-num" style={{ fontSize: 10.5 }}>{Math.round(d.pickFraction * 100)}%</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="kw-num">{formatDate(d.plannedGoodsIssueDate)}</td>
                    <td className="kw-num">{d.daysToGoodsIssue ?? '—'}</td>
                    <td>
                      <span className={`kw-chip ${d.isShipped ? 'kw-chip--complete' : 'kw-chip--open'}`}>
                        {d.isShipped ? 'Shipped' : 'Open'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {drill && request.plantId && (
        <DeliveryPicksOverlay
          plantId={request.plantId}
          deliveryId={drill.deliveryId}
          customer={drill.customer}
          onClose={() => setDrill(null)}
        />
      )}
    </section>
  )
}
