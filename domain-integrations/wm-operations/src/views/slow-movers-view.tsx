import { useState } from 'react'
import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { useWmList } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate, formatQty } from '../components/kerry.js'

interface SlowRow {
  plantId: string; warehouseId: string; materialId: string; materialName: string | null
  batchId: string | null; uom: string | null; quantCount: number | null
  totalQty: number | null; stockValue: number | null; standardPrice: number | null
  lastMovementTs: string | null; earliestGoodsReceiptDate: string | null
  earliestExpiryDate: string | null; daysSinceLastMovement: number | null
  ageBucket: string | null
}

const BUCKETS = [
  { value: '', label: 'All ages' },
  { value: 'OVER_365D', label: 'Over 365 days' },
  { value: 'D180_365', label: '180–365 days' },
  { value: 'D90_180', label: '90–180 days' },
  { value: 'NO_MOVEMENT_RECORD', label: 'No movement record' },
]

const BUCKET_CHIP: Record<string, string> = {
  OVER_365D: 'kw-chip--no-stock', D180_365: 'kw-chip--parked',
  D90_180: 'kw-chip--open', ACTIVE: 'kw-chip--complete', NO_MOVEMENT_RECORD: 'kw-chip--neutral',
}

const fmtVal = (v: number | null) => v != null ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'

/** Screen: value-weighted stock aging — what has not moved, and what it is worth. */
export function SlowMoversView({ request }: { readonly request: WmOperationsAdapterRequest }) {
  const [bucket, setBucket] = useState('')
  const result = useWmList<SlowRow>('/api/wm-operations/slow-movers', {
    plant_id: request.plantId, warehouse_id: request.warehouseId,
    severity: bucket || undefined, limit: 300,
  })
  const rows = result.data?.ok ? result.data.data : []
  const error = result.data && !result.data.ok ? result.data.error : null

  const stale = rows.filter(r => r.ageBucket && r.ageBucket !== 'ACTIVE')
  const staleValue = stale.reduce((s, r) => s + (r.stockValue ?? 0), 0)
  const over365 = rows.filter(r => r.ageBucket === 'OVER_365D')

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Working capital"
        title="Slow Movers"
        subtitle="Stock that has not moved in 90+ days, ranked by what it is worth — the dead-stock conversation, with numbers."
      />
      <div className="kw-kpi-row">
        <KpiTile label="Aged lines (≥90d)" value={stale.length} tone={stale.length > 0 ? 'warn' : 'ok'} />
        <KpiTile label="Aged stock value" value={fmtVal(staleValue)} tone={staleValue > 0 ? 'warn' : 'none'} />
        <KpiTile label="Over 365d" value={over365.length} tone={over365.length > 0 ? 'alert' : 'none'} />
        <KpiTile label="Value over 365d" value={fmtVal(over365.reduce((s, r) => s + (r.stockValue ?? 0), 0))} />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">
          Stock by value (highest first)
          <select aria-label="Age bucket" style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 12 }} value={bucket} onChange={e => setBucket(e.target.value)}>
            {BUCKETS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
        {error ? <EmptyNote>Could not load slow movers — {error.message}</EmptyNote>
          : result.isLoading ? <LoadingRows rows={8} />
          : rows.length === 0 ? <EmptyNote>No stock matches this filter.</EmptyNote> : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead><tr><th>Age</th><th>Material</th><th>Batch</th><th>Qty</th><th>Value</th><th>Last moved</th><th>Idle (d)</th><th>GR date</th><th>Expiry</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.materialId}-${r.batchId}-${i}`}>
                    <td><span className={`kw-chip ${BUCKET_CHIP[r.ageBucket ?? ''] ?? 'kw-chip--neutral'}`}>{r.ageBucket ?? '—'}</span></td>
                    <td title={r.materialId}>{r.materialName ?? r.materialId}</td>
                    <td className="kw-mono">{r.batchId ?? '—'}</td>
                    <td className="kw-num">{formatQty(r.totalQty, r.uom)}</td>
                    <td className="kw-num">{fmtVal(r.stockValue)}</td>
                    <td className="kw-num">{r.lastMovementTs ? formatDate(r.lastMovementTs) : '—'}</td>
                    <td className="kw-num">{r.daysSinceLastMovement ?? '—'}</td>
                    <td className="kw-num">{formatDate(r.earliestGoodsReceiptDate)}</td>
                    <td className="kw-num">{formatDate(r.earliestExpiryDate)}</td>
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
