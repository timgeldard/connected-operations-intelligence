import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { useWmList } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate, formatQty } from '../components/kerry.js'

interface ExpiryLine {
  plantId: string; materialId: string; materialName: string | null; batchId: string
  uom: string | null; minimumExpiryDate: string | null; minimumDaysToExpiry: number | null
  totalStockQty: number | null; expiredQty: number | null
  highestExpiryRiskBucket: string | null; hasMinimumShelfLifeBreach: boolean | null
}
interface HoldLine {
  plantId: string; warehouseId: string; storageType: string | null; binId: string | null
  quantId: string; materialId: string | null; batchId: string | null; holdType: string
  qty: number | null; uom: string | null; goodsReceiptDate: string | null; ageHours: number | null
}
interface QmLot {
  plantId: string; materialId: string; batchId: string | null
  openLotCount: number | null; latestLotNumber: string | null
  lastUsageDecision: string | null; oldestOpenStartDate: string | null
}
interface ExceptionLine {
  plantId: string; warehouseId: string | null; exceptionType: string; severity: string | null
  materialId: string | null; batchId: string | null; referenceId: string; qty: number | null
  agingReferenceDate: string | null; ageDays: number | null; detail: string | null
}

const BUCKET_CHIP: Record<string, string> = {
  EXPIRED: 'kw-chip--no-stock', LT_7_DAYS: 'kw-chip--no-stock',
  DAYS_7_30: 'kw-chip--parked', DAYS_30_90: 'kw-chip--open', OK: 'kw-chip--complete',
}

/** Screen: shelf-life risk, QI/blocked holds, and aged exceptions in one workbench. */
export function StockHealthView({ request }: { readonly request: WmOperationsAdapterRequest }) {
  const expiry = useWmList<ExpiryLine>('/api/wm-operations/expiry-risk', { plant_id: request.plantId, limit: 300 })
  const holds = useWmList<HoldLine>('/api/wm-operations/stock-holds', { plant_id: request.plantId, warehouse_id: request.warehouseId, limit: 200 })
  const exceptions = useWmList<ExceptionLine>('/api/wm-operations/exceptions', { plant_id: request.plantId, warehouse_id: request.warehouseId, limit: 200 })
  const qm = useWmList<QmLot>('/api/wm-operations/qm-lots', { plant_id: request.plantId, limit: 1000 })

  const expiryRows = expiry.data?.ok ? expiry.data.data : []
  const holdRows = holds.data?.ok ? holds.data.data : []
  const exceptionRows = exceptions.data?.ok ? exceptions.data.data : []
  const qmRows = qm.data?.ok ? qm.data.data : []
  const expiryError = expiry.data && !expiry.data.ok ? expiry.data.error : null
  const holdsError = holds.data && !holds.data.ok ? holds.data.error : null
  const exceptionsError = exceptions.data && !exceptions.data.ok ? exceptions.data.error : null
  const qmByKey = new Map(qmRows.map(l => [`${l.materialId}|${l.batchId ?? ''}`, l]))

  const expired = expiryRows.filter(r => r.highestExpiryRiskBucket === 'EXPIRED').length
  const next7 = expiryRows.filter(r => r.highestExpiryRiskBucket === 'LT_7_DAYS').length

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Inventory quality"
        title="Stock Health"
        subtitle="What is expiring, what is held in QI or blocked, and which exceptions have aged past their SLA."
      />
      <div className="kw-kpi-row">
        <KpiTile label="Expired batches" value={expired} tone={expired > 0 ? 'alert' : 'none'} />
        <KpiTile label="Expiring ≤7d" value={next7} tone={next7 > 0 ? 'warn' : 'none'} />
        <KpiTile label="Held quants" value={holdRows.length} tone={holdRows.length > 0 ? 'warn' : 'none'} />
        <KpiTile label="Aged exceptions" value={exceptionRows.length} tone={exceptionRows.length > 0 ? 'alert' : 'none'} />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Shelf-life risk (worst first)</div>
        {expiryError ? <EmptyNote>Could not load expiry data — {expiryError.message}</EmptyNote>
          : expiry.isLoading ? <LoadingRows rows={5} /> : expiryRows.length === 0 ? <EmptyNote>No batches with expiry data.</EmptyNote> : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead><tr><th>Bucket</th><th>Material</th><th>Batch</th><th>Stock</th><th>Expiry</th><th>Days</th><th>MSL breach</th></tr></thead>
              <tbody>
                {expiryRows.slice(0, 40).map(r => (
                  <tr key={`${r.materialId}-${r.batchId}`}>
                    <td><span className={`kw-chip ${BUCKET_CHIP[r.highestExpiryRiskBucket ?? ''] ?? 'kw-chip--neutral'}`}>{r.highestExpiryRiskBucket ?? '—'}</span></td>
                    <td title={r.materialId}>{r.materialName ?? r.materialId}</td>
                    <td className="kw-mono">{r.batchId}</td>
                    <td className="kw-num">{formatQty(r.totalStockQty, r.uom)}</td>
                    <td className="kw-num">{formatDate(r.minimumExpiryDate)}</td>
                    <td className="kw-num">{r.minimumDaysToExpiry ?? '—'}</td>
                    <td>{r.hasMinimumShelfLifeBreach ? <span className="kw-chip kw-chip--no-stock">MSL</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="kw-card">
        <div className="kw-card-title">QI / blocked / restricted holds (oldest first)</div>
        {holdsError ? <EmptyNote>Could not load stock holds — {holdsError.message}</EmptyNote>
          : holds.isLoading ? <LoadingRows rows={4} /> : holdRows.length === 0 ? <EmptyNote>No held stock.</EmptyNote> : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead><tr><th>Hold</th><th>ST</th><th>Bin</th><th>Material</th><th>Batch</th><th>Qty</th><th>GR date</th><th>Age</th><th>QM lot</th><th>UD</th></tr></thead>
              <tbody>
                {holdRows.slice(0, 40).map(h => (
                  <tr key={`${h.warehouseId}-${h.quantId}`}>
                    <td><span className={`kw-chip ${h.holdType === 'quality' ? 'kw-chip--parked' : 'kw-chip--no-stock'}`}>{h.holdType}</span></td>
                    <td className="kw-mono">{h.storageType}</td>
                    <td className="kw-mono">{h.binId}</td>
                    <td className="kw-mono">{h.materialId ?? '—'}</td>
                    <td className="kw-mono">{h.batchId ?? '—'}</td>
                    <td className="kw-num">{formatQty(h.qty, h.uom)}</td>
                    <td className="kw-num">{formatDate(h.goodsReceiptDate)}</td>
                    <td className="kw-num">{h.ageHours != null ? `${Math.round(h.ageHours / 24)}d` : '—'}</td>
                    {(() => { const lot = qmByKey.get(`${h.materialId}|${h.batchId ?? ''}`); return (<>
                      <td className="kw-mono">{lot?.latestLotNumber ?? '—'}</td>
                      <td>{lot ? <span className={`kw-chip ${(lot.openLotCount ?? 0) > 0 ? 'kw-chip--parked' : 'kw-chip--complete'}`}>{(lot.openLotCount ?? 0) > 0 ? `Pending since ${lot.oldestOpenStartDate ?? '?'}` : lot.lastUsageDecision ?? '—'}</span> : '—'}</td>
                    </>) })()}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Aged exceptions (past SLA)</div>
        {exceptionsError ? <EmptyNote>Could not load exceptions — {exceptionsError.message}</EmptyNote>
          : exceptions.isLoading ? <LoadingRows rows={4} /> : exceptionRows.length === 0 ? <EmptyNote>No exceptions past SLA.</EmptyNote> : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead><tr><th>Type</th><th>Severity</th><th>Material</th><th>Batch</th><th>Reference</th><th>Qty</th><th>Age (d)</th><th>Detail</th></tr></thead>
              <tbody>
                {exceptionRows.slice(0, 40).map((e, i) => (
                  <tr key={`${e.exceptionType}-${e.referenceId}-${i}`}>
                    <td>{e.exceptionType}</td>
                    <td><span className={`kw-chip ${e.severity === 'HIGH' ? 'kw-chip--no-stock' : 'kw-chip--parked'}`}>{e.severity ?? '—'}</span></td>
                    <td className="kw-mono">{e.materialId ?? '—'}</td>
                    <td className="kw-mono">{e.batchId ?? '—'}</td>
                    <td className="kw-mono">{e.referenceId}</td>
                    <td className="kw-num">{formatQty(e.qty)}</td>
                    <td className="kw-num">{e.ageDays ?? '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--kw-forest-60)' }}>{e.detail ?? '—'}</td>
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
