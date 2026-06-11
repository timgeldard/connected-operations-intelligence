import { useState } from 'react'
import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { useWmList } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate, formatQty } from '../components/kerry.js'

interface MovementRow {
  plantId: string; documentNumber: string | null; fiscalYear: string | null
  lineItem: string | null; materialId: string | null; batchId: string | null
  movementTypeCode: string | null; movementLabel: string | null; eventCategory: string | null
  isGoodsReceipt: boolean | null; isGoodsIssue: boolean | null; isTransfer: boolean | null
  isReversal: boolean | null; quantity: number | null; uom: string | null
  postingDate: string | null; orderNumber: string | null; deliveryNumber: string | null
  postedBy: string | null; transactionCode: string | null
}

/** Screen: auditable goods-movement feed with category/type/user filters. */
export function MovementsView({ request }: { readonly request: WmOperationsAdapterRequest }) {
  const [days, setDays] = useState(7)
  const [category, setCategory] = useState('')
  const [user, setUser] = useState('')
  const [appliedUser, setAppliedUser] = useState('')

  const result = useWmList<MovementRow>('/api/wm-operations/movements', {
    plant_id: request.plantId, days,
    event_category: category || undefined,
    posted_by: appliedUser || undefined,
    limit: 300,
  }, Boolean(request.plantId))

  const rows = result.data?.ok ? result.data.data : []
  const error = result.data && !result.data.ok ? result.data.error : null
  const receipts = rows.filter(r => r.isGoodsReceipt).length
  const issues = rows.filter(r => r.isGoodsIssue).length
  const reversals = rows.filter(r => r.isReversal).length
  const categories = [...new Set(rows.map(r => r.eventCategory).filter(Boolean))] as string[]

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Audit"
        title="Goods Movements"
        subtitle="Every IM posting in the window — receipts, issues, transfers, and reversals, with who posted them."
      />
      <div className="kw-kpi-row">
        <KpiTile label={`Lines (${days}d)`} value={rows.length >= 300 ? '300+' : rows.length} />
        <KpiTile label="Receipts" value={receipts} tone="ok" />
        <KpiTile label="Issues" value={issues} />
        <KpiTile label="Reversals" value={reversals} tone={reversals > 0 ? 'warn' : 'none'} />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Movement feed (newest first)</div>
        <div className="kw-filters">
          <select aria-label="Window" value={days} onChange={e => setDays(Number(e.target.value))}>
            <option value={1}>Last day</option>
            <option value={7}>Last 7 days</option>
            <option value={31}>Last 31 days</option>
          </select>
          <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            aria-label="Posted by"
            placeholder="Posted by"
            value={user}
            onChange={e => setUser(e.target.value)}
            onBlur={() => setAppliedUser(user.trim())}
            onKeyDown={e => e.key === 'Enter' && setAppliedUser(user.trim())}
          />
        </div>
        {error ? <EmptyNote>Could not load movements — {error.message}</EmptyNote>
          : result.isLoading ? <LoadingRows rows={8} />
          : rows.length === 0 ? <EmptyNote>No movements in the window.</EmptyNote> : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead><tr><th>Date</th><th>Movement</th><th>Category</th><th>Material</th><th>Batch</th><th>Qty</th><th>Order / Delivery</th><th>Document</th><th>By</th><th>TCode</th></tr></thead>
              <tbody>
                {rows.map((m, i) => (
                  <tr key={`${m.documentNumber}-${m.lineItem}-${i}`}>
                    <td className="kw-num">{formatDate(m.postingDate)}</td>
                    <td><span className="kw-mono">{m.movementTypeCode}</span> {m.movementLabel ?? ''}{m.isReversal && <span className="kw-chip kw-chip--no-stock" style={{ marginLeft: 4 }}>rev</span>}</td>
                    <td>{m.eventCategory ?? '—'}</td>
                    <td className="kw-mono">{m.materialId ?? '—'}</td>
                    <td className="kw-mono">{m.batchId ?? '—'}</td>
                    <td className="kw-num">{formatQty(m.quantity, m.uom)}</td>
                    <td className="kw-mono">{m.orderNumber ?? m.deliveryNumber ?? '—'}</td>
                    <td className="kw-mono">{m.documentNumber ?? '—'}</td>
                    <td>{m.postedBy ?? '—'}</td>
                    <td className="kw-mono">{m.transactionCode ?? '—'}</td>
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
