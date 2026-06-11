import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { useWmList } from '../adapters/wm-operations-queries.js'
import { BandDot, EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate, formatQty } from '../components/kerry.js'

interface InboundLine {
  plantId: string; poId: string; poItem: string; docType: string | null
  vendorId: string | null; storageLoc: string | null; materialId: string | null
  materialName: string | null; orderedQty: number | null; uom: string | null
  poDate: string | null; oldestPoAgeDays: number | null
  inboundBacklogRiskBand: 'red' | 'amber' | 'green' | 'grey' | null
}
interface HuSummary {
  plantId: string; warehouseId: string; handlingUnitStatus: string
  referenceDocumentCategory: string; huItemCount: number | null
  distinctSsccCount: number | null; distinctHuCount: number | null
  linkedDeliveryCount: number | null; distinctMaterialCount: number | null
  totalGrossWeight: number | null
}
interface InboundDelivery {
  plantId: string; warehouseId: string | null; deliveryId: string
  deliveryType: string | null; shippingPoint: string | null
  lineCount: number | null; deliveryQty: number | null; receivedQty: number | null
  receiptFraction: number | null; hasMixedBaseUom: boolean | null
  wmStatusCode: string | null; expectedReceiptDate: string | null
  actualReceiptDate: string | null; isReceived: boolean | null
  daysUntilExpectedReceipt: number | null; receiptBand: 'red' | 'amber' | 'green' | 'grey' | null
}

/** Screen: inbound PO backlog + expected SAP deliveries + handling-unit (SSCC) putaway summary. */
export function InboundView({ request }: { readonly request: WmOperationsAdapterRequest }) {
  const scope = { plant_id: request.plantId, warehouse_id: request.warehouseId }
  const backlog = useWmList<InboundLine>('/api/wm-operations/inbound', { plant_id: request.plantId, limit: 200 })
  const deliveries = useWmList<InboundDelivery>('/api/wm-operations/inbound-deliveries', { plant_id: request.plantId, warehouse_id: request.warehouseId, limit: 300 })
  const hus = useWmList<HuSummary>('/api/wm-operations/handling-units', scope)
  const qm = useWmList<{ openLotCount: number | null; lotOriginCode: string | null }>('/api/wm-operations/qm-lots', { plant_id: request.plantId, limit: 1000 })

  const lines = backlog.data?.ok ? backlog.data.data : []
  const deliveryRows = deliveries.data?.ok ? deliveries.data.data : []
  const huRows = hus.data?.ok ? hus.data.data : []
  const error = backlog.data && !backlog.data.ok ? backlog.data.error : null
  const deliveriesError = deliveries.data && !deliveries.data.ok ? deliveries.data.error : null
  const husError = hus.data && !hus.data.ok ? hus.data.error : null

  const aged = lines.filter(l => l.inboundBacklogRiskBand === 'red').length
  const watch = lines.filter(l => l.inboundBacklogRiskBand === 'amber').length
  const ssccTotal = huRows.reduce((s, h) => s + (h.distinctSsccCount ?? 0), 0)
  const qmRows = qm.data?.ok ? qm.data.data : []
  const openGrLots = qmRows.filter(l => l.lotOriginCode === '01' && (l.openLotCount ?? 0) > 0).length

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Receiving"
        title="Inbound & Putaway"
        subtitle="Open purchase-order lines awaiting goods receipt, with handling-unit evidence of what has physically arrived."
      />
      <div className="kw-kpi-row">
        <KpiTile label="Open PO lines" value={lines.length} />
        <KpiTile label="Aged ≥30d" value={aged} tone={aged > 0 ? 'alert' : 'none'} />
        <KpiTile label="Aged 14-30d" value={watch} tone={watch > 0 ? 'warn' : 'none'} />
        <KpiTile label="SSCCs on site" value={ssccTotal.toLocaleString()} />
        <KpiTile label="Open GR inspection lots" value={openGrLots} tone={openGrLots > 0 ? 'warn' : 'none'} />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Open purchase-order lines</div>
        {error ? <EmptyNote>Could not load inbound backlog — {error.message}</EmptyNote>
          : backlog.isLoading ? <LoadingRows rows={6} />
          : lines.length === 0 ? <EmptyNote>No open inbound PO lines.</EmptyNote> : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead><tr><th></th><th>PO</th><th>Item</th><th>Vendor</th><th>Material</th><th>Ordered</th><th>SLoc</th><th>PO date</th><th>Age (d)</th></tr></thead>
              <tbody>
                {lines.map(l => (
                  <tr key={`${l.poId}-${l.poItem}`}>
                    <td><BandDot band={l.inboundBacklogRiskBand} /></td>
                    <td className="kw-mono">{l.poId}</td>
                    <td className="kw-mono">{l.poItem}</td>
                    <td className="kw-mono">{l.vendorId ?? '—'}</td>
                    <td title={l.materialId ?? undefined}>{l.materialName ?? l.materialId ?? '—'}</td>
                    <td className="kw-num">{formatQty(l.orderedQty, l.uom)}</td>
                    <td className="kw-mono">{l.storageLoc ?? '—'}</td>
                    <td className="kw-num">{formatDate(l.poDate)}</td>
                    <td className="kw-num">{l.oldestPoAgeDays ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Expected deliveries (EL / ELST)</div>
        {deliveriesError ? (
          <EmptyNote>Could not load inbound deliveries — {deliveriesError.message}</EmptyNote>
        ) : deliveries.isLoading ? (
          <LoadingRows rows={4} />
        ) : deliveryRows.length === 0 ? (
          <EmptyNote>No expected inbound deliveries for this scope.</EmptyNote>
        ) : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead>
                <tr>
                  <th></th><th>Delivery</th><th>Type</th><th>Lines</th><th>Qty</th>
                  <th>Received</th><th>Progress</th><th>Expected receipt</th><th>Days</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {deliveryRows.map((d: InboundDelivery) => (
                  <tr key={`${d.plantId}-${d.deliveryId}`}>
                    <td><BandDot band={d.receiptBand} /></td>
                    <td className="kw-mono">{d.deliveryId}</td>
                    <td><span className="kw-chip kw-chip--open">{d.deliveryType ?? '—'}</span></td>
                    <td className="kw-num">{d.lineCount ?? '—'}</td>
                    <td className="kw-num">{formatQty(d.deliveryQty)}</td>
                    <td className="kw-num">{formatQty(d.receivedQty)}</td>
                    <td>
                      {d.receiptFraction != null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="kw-progress" style={{ width: 64 }}>
                            <span style={{ width: `${Math.min(100, Math.round(d.receiptFraction * 100))}%` }} />
                          </div>
                          <span className="kw-num" style={{ fontSize: 10.5 }}>{Math.round(d.receiptFraction * 100)}%</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="kw-num">{formatDate(d.expectedReceiptDate)}</td>
                    <td className="kw-num">{d.daysUntilExpectedReceipt ?? '—'}</td>
                    <td>
                      <span className={`kw-chip ${d.isReceived ? 'kw-chip--complete' : 'kw-chip--open'}`}>
                        {d.isReceived ? 'Received' : 'Open'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Handling units by status</div>
        {husError ? <EmptyNote>Could not load handling units — {husError.message}</EmptyNote>
          : hus.isLoading ? <LoadingRows rows={3} /> : huRows.length === 0 ? (
          <EmptyNote>No handling-unit data for this scope.</EmptyNote>
        ) : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead><tr><th>Status</th><th>Reference</th><th>HU items</th><th>SSCCs</th><th>HUs</th><th>Deliveries</th><th>Materials</th><th>Gross wt</th></tr></thead>
              <tbody>
                {huRows.map(h => (
                  <tr key={`${h.warehouseId}-${h.handlingUnitStatus}-${h.referenceDocumentCategory}`}>
                    <td><span className="kw-chip kw-chip--open">{h.handlingUnitStatus}</span></td>
                    <td>{h.referenceDocumentCategory}</td>
                    <td className="kw-num">{(h.huItemCount ?? 0).toLocaleString()}</td>
                    <td className="kw-num">{(h.distinctSsccCount ?? 0).toLocaleString()}</td>
                    <td className="kw-num">{(h.distinctHuCount ?? 0).toLocaleString()}</td>
                    <td className="kw-num">{(h.linkedDeliveryCount ?? 0).toLocaleString()}</td>
                    <td className="kw-num">{(h.distinctMaterialCount ?? 0).toLocaleString()}</td>
                    <td className="kw-num">{formatQty(h.totalGrossWeight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
