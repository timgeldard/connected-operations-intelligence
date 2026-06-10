import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { useWmOperatorActivity, useWmQueueWorkload } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate, formatTs } from '../components/kerry.js'

const WORK_AREA_SHORT: Record<string, string> = {
  PRODUCTION_STAGING: 'Staging',
  DISPENSARY_REPLENISHMENT: 'Disp. replen',
  DISPENSARY_PICKING: 'Disp. pick',
  WAREHOUSE_OTHER: 'Warehouse',
}

export function OperatorsView({ request }: { readonly request: WmOperationsAdapterRequest }) {
  const activityResult = useWmOperatorActivity({ ...request, days: 14 })
  const queueResult = useWmQueueWorkload(request)

  const activity = activityResult.data?.ok ? activityResult.data.data : []
  const queues = queueResult.data?.ok ? queueResult.data.data : []

  const operators = new Set(activity.map(a => a.operator)).size
  const items = activity.reduce((s, a) => s + (a.itemsConfirmed ?? 0), 0)
  const parkedNow = queues.reduce((s, q) => s + (q.parkedJobs ?? 0), 0)
  const openNow = queues.reduce((s, q) => s + (q.openJobs ?? 0), 0)

  // Roll daily activity up per operator for the table.
  const byOperator = new Map<string, { items: number; tos: number; trs: number; days: number; last: string }>()
  for (const a of activity) {
    const cur = byOperator.get(a.operator) ?? { items: 0, tos: 0, trs: 0, days: 0, last: '' }
    cur.items += a.itemsConfirmed ?? 0
    cur.tos += a.transferOrders ?? 0
    cur.trs += a.transferRequirements ?? 0
    cur.days += 1
    if (a.activityDate > cur.last) cur.last = a.activityDate
    byOperator.set(a.operator, cur)
  }
  const operatorRows = [...byOperator.entries()].sort((a, b) => b[1].items - a[1].items)

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · People & queues"
        title="Operators"
        subtitle="Who is picking, how much, and where the queues are backing up — last 14 days of confirmations plus the live queue board."
      />

      <div className="kw-kpi-row">
        <KpiTile label="Active operators (14d)" value={operators} />
        <KpiTile label="Items confirmed (14d)" value={items.toLocaleString()} />
        <KpiTile label="Open jobs now" value={openNow} />
        <KpiTile label="Parked now" value={parkedNow} tone={parkedNow > 0 ? 'warn' : 'none'} />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Queue workload (live)</div>
        {queueResult.isLoading ? <LoadingRows rows={4} /> : queues.length === 0 ? (
          <EmptyNote>No open jobs in any queue.</EmptyNote>
        ) : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead>
                <tr><th>Queue</th><th>Work area</th><th>Open</th><th>In progress</th><th>Parked</th><th>No stock</th><th>Operators</th><th>Oldest planned</th></tr>
              </thead>
              <tbody>
                {queues.map(q => (
                  <tr key={`${q.warehouseId}-${q.queue}-${q.workArea}`}>
                    <td className="kw-mono">{q.queue || '(none)'}</td>
                    <td>{WORK_AREA_SHORT[q.workArea] ?? q.workArea}</td>
                    <td className="kw-num">{q.openJobs ?? 0}</td>
                    <td className="kw-num">{q.inProgressJobs ?? 0}</td>
                    <td className="kw-num" style={(q.parkedJobs ?? 0) > 0 ? { color: 'var(--kw-sunset)', fontWeight: 600 } : undefined}>{q.parkedJobs ?? 0}</td>
                    <td className="kw-num">{q.noStockJobs ?? 0}</td>
                    <td className="kw-num">{q.operatorCount ?? 0}</td>
                    <td className="kw-num">{formatTs(q.earliestPlannedTs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Operator activity (last 14 days)</div>
        {activityResult.isLoading ? <LoadingRows rows={5} /> : operatorRows.length === 0 ? (
          <EmptyNote>No confirmed picks in the window.</EmptyNote>
        ) : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead>
                <tr><th>Operator</th><th>Items confirmed</th><th>Transfer orders</th><th>TRs touched</th><th>Active days</th><th>Last active</th></tr>
              </thead>
              <tbody>
                {operatorRows.map(([op, s]) => (
                  <tr key={op}>
                    <td className="kw-mono">{op}</td>
                    <td className="kw-num">{s.items.toLocaleString()}</td>
                    <td className="kw-num">{s.tos.toLocaleString()}</td>
                    <td className="kw-num">{s.trs.toLocaleString()}</td>
                    <td className="kw-num">{s.days}</td>
                    <td className="kw-num">{formatDate(s.last)}</td>
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
