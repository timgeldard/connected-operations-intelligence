import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import {
  useWmBinStock,
  useWmReconAlerts,
  useWmWorklist,
} from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate, formatQty } from '../components/kerry.js'
import { WorklistTable } from '../panels/worklist-table.js'

/** Shift handover digest — what the incoming shift needs to know, on one page. */
export function HandoverView({ request }: { readonly request: WmOperationsAdapterRequest }) {
  const parked = useWmWorklist({ ...request, status: 'PARKED' })
  const noStock = useWmWorklist({ ...request, status: 'NO_STOCK' })
  const inProgress = useWmWorklist({ ...request, status: 'IN_PROGRESS' })
  const stock = useWmBinStock({ ...request, expiringWithinDays: 7 })
  const alerts = useWmReconAlerts(request)

  const parkedRows = parked.data?.ok ? parked.data.data : []
  const noStockRows = noStock.data?.ok ? noStock.data.data : []
  const inProgressRows = inProgress.data?.ok ? inProgress.data.data : []
  const expiring = stock.data?.ok ? stock.data.data : []
  const alertRows = alerts.data?.ok ? alerts.data.data : []
  const exceptions = [...noStockRows, ...parkedRows]

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Shift change"
        title="Handover"
        subtitle="Everything the incoming shift should know: stuck jobs, work in flight, stock expiring this week, and open reconciliation alerts."
      />

      <div className="kw-kpi-row">
        <KpiTile label="Parked jobs" value={parkedRows.length} tone={parkedRows.length > 0 ? 'warn' : 'none'} />
        <KpiTile label="No-stock jobs" value={noStockRows.length} tone={noStockRows.length > 0 ? 'alert' : 'none'} />
        <KpiTile label="In progress" value={inProgressRows.length} tone="ok" />
        <KpiTile label="Expiring ≤7d" value={expiring.length} tone={expiring.length > 0 ? 'warn' : 'none'} />
        <KpiTile label="Recon alerts" value={alertRows.length} tone={alertRows.length > 0 ? 'alert' : 'none'} />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Stuck jobs (no stock first, then parked)</div>
        <WorklistTable
          items={exceptions}
          isLoading={parked.isLoading || noStock.isLoading}
          emptyMessage="Nothing parked or blocked — clean handover."
        />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Work in flight</div>
        <WorklistTable
          items={inProgressRows}
          isLoading={inProgress.isLoading}
          emptyMessage="No jobs in progress."
        />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Stock expiring within 7 days</div>
        {stock.isLoading ? <LoadingRows rows={3} /> : expiring.length === 0 ? (
          <EmptyNote>Nothing expiring this week.</EmptyNote>
        ) : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead><tr><th>Zone</th><th>Bin</th><th>Material</th><th>Batch</th><th>Available</th><th>Expiry</th></tr></thead>
              <tbody>
                {expiring.slice(0, 25).map(line => (
                  <tr key={`${line.warehouseId}-${line.quantId}`}>
                    <td style={{ fontSize: 11, color: 'var(--kw-forest-60)' }}>{line.storageZone}</td>
                    <td className="kw-mono">{line.binId}</td>
                    <td title={line.materialId ?? undefined}>{line.materialName ?? line.materialId}</td>
                    <td className="kw-mono">{line.batchId ?? '—'}</td>
                    <td className="kw-num">{formatQty(line.availableQty, line.uom)}</td>
                    <td className="kw-num" style={line.isExpired ? { color: 'var(--kw-sunset)', fontWeight: 600 } : undefined}>
                      {formatDate(line.expiryDate)}{line.daysToExpiry != null && ` (${line.daysToExpiry}d)`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Reconciliation alerts</div>
        {alerts.isLoading ? <LoadingRows rows={3} /> : alertRows.length === 0 ? (
          <EmptyNote>No severe reconciliation variances.</EmptyNote>
        ) : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead><tr><th>Priority</th><th>Type</th><th>Material</th><th>Batch</th><th>Reason</th><th>Δ qty</th><th>Δ value</th></tr></thead>
              <tbody>
                {alertRows.slice(0, 25).map(a => (
                  <tr key={a.alertKey}>
                    <td><span className={`kw-chip ${a.alertPriority === 'P1' ? 'kw-chip--no-stock' : 'kw-chip--parked'}`}>{a.alertPriority ?? '—'}</span></td>
                    <td>{a.alertType}</td>
                    <td className="kw-mono">{a.materialId ?? '—'}</td>
                    <td className="kw-mono">{a.batchId ?? '—'}</td>
                    <td>{a.reasonCode ?? '—'}</td>
                    <td className="kw-num">{formatQty(a.deltaQty)}</td>
                    <td className="kw-num">{a.deltaValue != null ? a.deltaValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</td>
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
