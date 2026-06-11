import { useState } from 'react'
import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { useWmList } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate, formatQty } from '../components/kerry.js'

interface ControlRow {
  plantId: string; warehouseId: string; postingDate: string | null
  materialId: string; batchId: string | null; uom: string | null
  movementTypeCode: string | null; imDocumentLineCount: number | null
  imQty: number | null; imValue: number | null; wmToLineCount: number | null
  wmQty: number | null; deltaQty: number | null; absDeltaQty: number | null
  movementReconciliationStatus: string | null
}

const STATUS_CHIP: Record<string, string> = {
  MATCHED_ACTIVITY: 'kw-chip--complete', IM_ONLY: 'kw-chip--parked',
  WM_ONLY: 'kw-chip--no-stock', NO_ACTIVITY: 'kw-chip--neutral',
}

/** Screen: IM postings vs WM confirmations per day — the movement-level control. */
export function MovementControlView({ request }: { readonly request: WmOperationsAdapterRequest }) {
  const [status, setStatus] = useState('IM_ONLY')
  const [days, setDays] = useState(31)
  const result = useWmList<ControlRow>('/api/wm-operations/movement-control', {
    plant_id: request.plantId, warehouse_id: request.warehouseId,
    severity: status || undefined, days, limit: 300,
  })
  const rows = result.data?.ok ? result.data.data : []
  const error = result.data && !result.data.ok ? result.data.error : null

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Controls"
        title="Movement Control"
        subtitle="Days where book postings and bin confirmations disagree — one-sided activity is where stock walks."
      />
      <div className="kw-kpi-row">
        <KpiTile label={`Variance lines (${days}d)`} value={rows.length >= 300 ? '300+' : rows.length} tone={rows.length > 0 ? 'warn' : 'ok'} />
        <KpiTile label="Abs Δ qty shown" value={rows.reduce((s, r) => s + (r.absDeltaQty ?? 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">
          Largest variances
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <select aria-label="Status" style={{ fontWeight: 400, fontSize: 12 }} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="IM_ONLY">IM only (posted, never confirmed)</option>
              <option value="WM_ONLY">WM only (confirmed, never posted)</option>
              <option value="MATCHED_ACTIVITY">Matched activity</option>
              <option value="">All</option>
            </select>
            <select aria-label="Window" style={{ fontWeight: 400, fontSize: 12 }} value={days} onChange={e => setDays(Number(e.target.value))}>
              <option value={7}>7d</option>
              <option value={31}>31d</option>
              <option value={92}>92d</option>
            </select>
          </span>
        </div>
        {error ? <EmptyNote>Could not load movement control — {error.message}</EmptyNote>
          : result.isLoading ? <LoadingRows rows={8} />
          : rows.length === 0 ? <EmptyNote>No variances for this filter — books and bins agree.</EmptyNote> : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead><tr><th>Status</th><th>Date</th><th>Mvt</th><th>Material</th><th>Batch</th><th>IM lines</th><th>IM qty</th><th>WM lines</th><th>WM qty</th><th>Δ qty</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.postingDate}-${r.materialId}-${r.batchId}-${i}`}>
                    <td><span className={`kw-chip ${STATUS_CHIP[r.movementReconciliationStatus ?? ''] ?? 'kw-chip--neutral'}`}>{r.movementReconciliationStatus ?? '—'}</span></td>
                    <td className="kw-num">{formatDate(r.postingDate)}</td>
                    <td className="kw-mono">{r.movementTypeCode ?? '—'}</td>
                    <td className="kw-mono">{r.materialId}</td>
                    <td className="kw-mono">{r.batchId ?? '—'}</td>
                    <td className="kw-num">{r.imDocumentLineCount ?? 0}</td>
                    <td className="kw-num">{formatQty(r.imQty, r.uom)}</td>
                    <td className="kw-num">{r.wmToLineCount ?? 0}</td>
                    <td className="kw-num">{formatQty(r.wmQty, r.uom)}</td>
                    <td className="kw-num">{formatQty(r.deltaQty)}</td>
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
