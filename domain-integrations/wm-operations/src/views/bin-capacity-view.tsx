import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { useWmList } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatQty } from '../components/kerry.js'

interface OccRow {
  plantId: string; warehouseId: string; storageType: string; binType: string
  binRecordCount: number | null; occupiedBinCount: number | null; emptyBinCount: number | null
  blockedBinCount: number | null; stockRemovalBlockedBinCount: number | null
  putawayBlockedBinCount: number | null; occupancyRate: number | null
  totalStockQty: number | null; availableStockQty: number | null; openTransferStockQty: number | null
}

/** Screen: bin occupancy & capacity headroom for putaway planning. */
export function BinCapacityView({ request }: { readonly request: WmOperationsAdapterRequest }) {
  const result = useWmList<OccRow>('/api/wm-operations/bin-occupancy', {
    plant_id: request.plantId, warehouse_id: request.warehouseId, limit: 500,
  })
  const rows = result.data?.ok ? result.data.data : []
  const error = result.data && !result.data.ok ? result.data.error : null

  const totalBins = rows.reduce((s, r) => s + (r.binRecordCount ?? 0), 0)
  const emptyBins = rows.reduce((s, r) => s + (r.emptyBinCount ?? 0), 0)
  const blockedBins = rows.reduce((s, r) => s + (r.blockedBinCount ?? 0), 0)
  const occupied = rows.reduce((s, r) => s + (r.occupiedBinCount ?? 0), 0)
  const utilisation = totalBins ? Math.round((occupied / totalBins) * 100) : 0

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Capacity"
        title="Bin Capacity"
        subtitle="Occupancy and headroom by storage type — where the next pallet can actually go."
      />
      <div className="kw-kpi-row">
        <KpiTile label="Total bins" value={totalBins.toLocaleString()} />
        <KpiTile label="Utilisation" value={`${utilisation}%`} tone={utilisation > 90 ? 'alert' : utilisation > 75 ? 'warn' : 'ok'} />
        <KpiTile label="Empty bins" value={emptyBins.toLocaleString()} tone={emptyBins === 0 ? 'alert' : 'none'} />
        <KpiTile label="Blocked bins" value={blockedBins.toLocaleString()} tone={blockedBins > 0 ? 'warn' : 'none'} />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Occupancy by storage type (fullest first)</div>
        {error ? <EmptyNote>Could not load occupancy — {error.message}</EmptyNote>
          : result.isLoading ? <LoadingRows rows={6} />
          : rows.length === 0 ? <EmptyNote>No bin master data for this scope.</EmptyNote> : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead><tr><th>ST</th><th>Bin type</th><th>Bins</th><th>Occupied</th><th>Empty</th><th>Blocked</th><th>Occupancy</th><th>Stock qty</th><th>Available qty</th></tr></thead>
              <tbody>
                {rows.map(r => {
                  const pct = Math.round((r.occupancyRate ?? 0) * 100)
                  return (
                    <tr key={`${r.warehouseId}-${r.storageType}-${r.binType}`}>
                      <td className="kw-mono">{r.storageType}</td>
                      <td className="kw-mono">{r.binType || '—'}</td>
                      <td className="kw-num">{(r.binRecordCount ?? 0).toLocaleString()}</td>
                      <td className="kw-num">{(r.occupiedBinCount ?? 0).toLocaleString()}</td>
                      <td className="kw-num" style={(r.emptyBinCount ?? 0) === 0 ? { color: 'var(--kw-sunset)', fontWeight: 600 } : undefined}>{(r.emptyBinCount ?? 0).toLocaleString()}</td>
                      <td className="kw-num">{(r.blockedBinCount ?? 0).toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="kw-progress" style={{ width: 64 }}>
                            <span style={{ width: `${Math.min(100, pct)}%`, background: pct > 90 ? 'var(--kw-sunset)' : pct > 75 ? 'var(--kw-sunrise)' : 'var(--kw-jade)' }} />
                          </div>
                          <span className="kw-num" style={{ fontSize: 10.5 }}>{pct}%</span>
                        </div>
                      </td>
                      <td className="kw-num">{formatQty(r.totalStockQty)}</td>
                      <td className="kw-num">{formatQty(r.availableStockQty)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
