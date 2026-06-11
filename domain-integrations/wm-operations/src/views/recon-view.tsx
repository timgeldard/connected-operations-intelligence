import { useState } from 'react'
import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { useWmList } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatQty } from '../components/kerry.js'

interface ReconSummary {
  plantId: string; warehouseId: string; mismatchReason: string; mismatchSeverity: string
  rowCount: number | null; toleranceExceededCount: number | null
  netDeltaValue: number | null; absDeltaValue: number | null
  absDeltaQuantity: number | null; valueReconciliationStatus: string | null
}
interface ReconException {
  plantId: string; warehouseId: string; materialId: string; materialName: string | null
  batchId: string | null; stockCategory: string; uom: string | null
  imQty: number | null; wmQty: number | null; deltaQty: number | null
  deltaPercent: number | null; deltaValue: number | null
  mismatchReason: string; mismatchSeverity: string | null; isTrusted: boolean | null
}

const fmtVal = (v: number | null) => v != null ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'

/** Screen: IM<->WM reconciliation workbench — value rollup + worst exceptions. */
export function ReconView({ request }: { readonly request: WmOperationsAdapterRequest }) {
  const [severity, setSeverity] = useState('')
  const scope = { plant_id: request.plantId, warehouse_id: request.warehouseId }
  const summary = useWmList<ReconSummary>('/api/wm-operations/recon-summary', scope)
  const detail = useWmList<ReconException>('/api/wm-operations/recon-exceptions', { ...scope, severity: severity || undefined, limit: 100 })

  const sumRows = summary.data?.ok ? summary.data.data : []
  const rows = detail.data?.ok ? detail.data.data : []
  const summaryError = summary.data && !summary.data.ok ? summary.data.error : null
  const detailError = detail.data && !detail.data.ok ? detail.data.error : null
  const totalExceptions = sumRows.reduce((s, r) => s + (r.toleranceExceededCount ?? 0), 0)
  const totalAbsValue = sumRows.reduce((s, r) => s + (r.absDeltaValue ?? 0), 0)
  const high = sumRows.filter(r => r.mismatchSeverity === 'HIGH').reduce((s, r) => s + (r.toleranceExceededCount ?? 0), 0)

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Controls"
        title="IM–WM Reconciliation"
        subtitle="Where book stock and bin stock disagree — value at stake, the reasons, and the worst individual variances."
      />
      <div className="kw-kpi-row">
        <KpiTile label="Open exceptions" value={totalExceptions.toLocaleString()} tone={totalExceptions > 0 ? 'warn' : 'ok'} />
        <KpiTile label="High severity" value={high.toLocaleString()} tone={high > 0 ? 'alert' : 'none'} />
        <KpiTile label="Abs Δ value" value={fmtVal(totalAbsValue)} />
        <KpiTile label="Reason buckets" value={sumRows.length} />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Value at stake by reason</div>
        {summaryError ? <EmptyNote>Could not load reconciliation summary — {summaryError.message}</EmptyNote>
          : summary.isLoading ? <LoadingRows rows={4} /> : sumRows.length === 0 ? <EmptyNote>Nothing to reconcile.</EmptyNote> : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead><tr><th>Reason</th><th>Severity</th><th>Rows</th><th>Exceeded</th><th>Net Δ value</th><th>Abs Δ value</th><th>Status</th></tr></thead>
              <tbody>
                {sumRows.map(r => (
                  <tr key={`${r.warehouseId}-${r.mismatchReason}-${r.mismatchSeverity}`}>
                    <td>{r.mismatchReason}</td>
                    <td><span className={`kw-chip ${r.mismatchSeverity === 'HIGH' ? 'kw-chip--no-stock' : r.mismatchSeverity === 'MEDIUM' ? 'kw-chip--parked' : 'kw-chip--neutral'}`}>{r.mismatchSeverity}</span></td>
                    <td className="kw-num">{(r.rowCount ?? 0).toLocaleString()}</td>
                    <td className="kw-num">{(r.toleranceExceededCount ?? 0).toLocaleString()}</td>
                    <td className="kw-num">{fmtVal(r.netDeltaValue)}</td>
                    <td className="kw-num">{fmtVal(r.absDeltaValue)}</td>
                    <td>{r.valueReconciliationStatus ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="kw-card">
        <div className="kw-card-title">
          Worst variances by value
          <select aria-label="Severity" style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 12 }} value={severity} onChange={e => setSeverity(e.target.value)}>
            <option value="">All severities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
          </select>
        </div>
        {detailError ? <EmptyNote>Could not load recon exceptions — {detailError.message}</EmptyNote>
          : detail.isLoading ? <LoadingRows rows={6} /> : rows.length === 0 ? <EmptyNote>No exceptions for this filter.</EmptyNote> : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead><tr><th>Material</th><th>Batch</th><th>Category</th><th>IM</th><th>WM</th><th>Δ qty</th><th>Δ value</th><th>Reason</th><th>Trusted</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.materialId}-${r.batchId}-${r.stockCategory}-${i}`}>
                    <td title={r.materialId}>{r.materialName ?? r.materialId}</td>
                    <td className="kw-mono">{r.batchId ?? '—'}</td>
                    <td>{r.stockCategory}</td>
                    <td className="kw-num">{formatQty(r.imQty, r.uom)}</td>
                    <td className="kw-num">{formatQty(r.wmQty, r.uom)}</td>
                    <td className="kw-num">{formatQty(r.deltaQty)}</td>
                    <td className="kw-num">{fmtVal(r.deltaValue)}</td>
                    <td>{r.mismatchReason}</td>
                    <td>{r.isTrusted ? '✓' : '—'}</td>
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
