import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { useWmList } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate, formatQty } from '../components/kerry.js'

interface QmDispositionQueueRow {
  plantId: string
  lotId: string
  inspectionLotOriginCode: string | null
  inspectionType: string | null
  materialId: string | null
  materialName: string | null
  batchId: string | null
  orderId: string | null
  lotCreatedDate: string | null
  inspectionStartDate: string | null
  inspectionEndDate: string | null
  lotQty: number | null
  lotUom: string | null
  blockedQty: number | null
  blockedUom: string | null
  estBlockedValue: number | null
  lotAgeDays: number | null
  isOverdue: boolean | null
}

function formatValue(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `€${(v / 1_000).toFixed(1)}K`
  return `€${v.toFixed(0)}`
}

export function QmDispositionQueueView({
  request,
  onOpenProcessOrder,
}: {
  readonly request: WmOperationsAdapterRequest
  readonly onOpenProcessOrder?: (orderId: string) => void
}) {
  const queueResult = useWmList<QmDispositionQueueRow>(
    '/api/wm-operations/qm-disposition-queue',
    {
      plant_id: request.plantId,
      limit: 200,
    },
    Boolean(request.plantId),
  )

  const rows = queueResult.data?.ok ? queueResult.data.data : []
  const error = queueResult.data && !queueResult.data.ok ? queueResult.data.error : null

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const totalBlockedValue = rows.reduce((sum, r) => sum + (r.estBlockedValue ?? 0), 0)
  const overdueCount = rows.filter(r => r.isOverdue).length
  const oldestOpenAge = rows.reduce((max, r) => Math.max(max, r.lotAgeDays ?? 0), 0)

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Control"
        title="Disposition Queue"
        subtitle="Open inspection lots ranked by estimated blocked inventory value. No usage decision recorded."
      />

      {/* KPI row */}
      <div className="kw-kpi-row">
        <KpiTile
          label="Total blocked value"
          value={totalBlockedValue > 0 ? formatValue(totalBlockedValue) : '—'}
          tone={totalBlockedValue > 500_000 ? 'alert' : totalBlockedValue > 100_000 ? 'warn' : 'none'}
        />
        <KpiTile
          label="Overdue lots"
          value={overdueCount}
          tone={overdueCount > 0 ? 'alert' : 'none'}
        />
        <KpiTile
          label="Oldest open lot"
          value={oldestOpenAge > 0 ? `${oldestOpenAge} d` : '—'}
          tone={oldestOpenAge > 30 ? 'alert' : oldestOpenAge > 14 ? 'warn' : 'none'}
        />
      </div>

      {error ? (
        <EmptyNote>Could not load disposition queue — {error.message}</EmptyNote>
      ) : queueResult.isLoading ? (
        <LoadingRows rows={8} />
      ) : rows.length === 0 ? (
        <EmptyNote>No open inspection lots awaiting disposition.</EmptyNote>
      ) : (
        <div className="kw-table-wrap">
          <table className="kw-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Lot</th>
                <th>Material</th>
                <th>Batch</th>
                <th>Origin</th>
                <th>Created</th>
                <th>Age</th>
                <th>Status</th>
                <th className="kw-num">Lot qty</th>
                <th className="kw-num">Blocked qty</th>
                <th className="kw-num">Est. blocked value</th>
                <th>Order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.plantId}-${r.lotId}`} className={r.isOverdue ? 'kw-row-alert' : undefined}>
                  <td className="kw-num" style={{ color: 'var(--kw-text-muted, #9ca3af)', fontSize: 11 }}>{idx + 1}</td>
                  <td className="kw-mono">{r.lotId}</td>
                  <td title={r.materialId ?? undefined} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.materialName ?? r.materialId ?? '—'}
                  </td>
                  <td className="kw-mono">{r.batchId ?? '—'}</td>
                  <td className="kw-mono">{r.inspectionLotOriginCode ?? '—'}</td>
                  <td className="kw-num">{formatDate(r.lotCreatedDate)}</td>
                  <td className="kw-num">{r.lotAgeDays != null ? `${r.lotAgeDays}d` : '—'}</td>
                  <td>{r.isOverdue ? <span className="kw-chip kw-chip--no-stock" title="Inspection end date has passed">Overdue</span> : null}</td>
                  <td className="kw-num">{formatQty(r.lotQty)} {r.lotUom ?? ''}</td>
                  <td className="kw-num">{formatQty(r.blockedQty)} {r.blockedUom ?? r.lotUom ?? ''}</td>
                  <td className="kw-num">{formatValue(r.estBlockedValue)}</td>
                  <td>
                    {r.orderId && onOpenProcessOrder ? (
                      <button
                        type="button"
                        className="kw-viewnav-tab"
                        style={{ fontSize: 11, padding: '1px 6px' }}
                        onClick={() => onOpenProcessOrder(r.orderId!)}
                      >
                        {r.orderId}
                      </button>
                    ) : (
                      <span className="kw-mono">{r.orderId ?? '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
