import { useState } from 'react'
import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { useWmList } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader } from '../components/kerry.js'

interface DailyRow {
  plantId: string; activityDate: string; toItemsConfirmed: number | null
  activeOperators: number | null; trsCreated: number | null
  goodsReceiptLines: number | null; goodsIssueLines: number | null
}

/** Brand-tint CSS bar chart (tints are sanctioned for charts in the guidelines). */
function BarChart({ rows, value, color, label }: {
  readonly rows: DailyRow[]
  readonly value: (r: DailyRow) => number
  readonly color: string
  readonly label: string
}) {
  const max = Math.max(1, ...rows.map(value))
  return (
    <div className="kw-card">
      <div className="kw-card-title">{label}</div>
      {rows.length === 0 ? <EmptyNote>No activity in the window.</EmptyNote> : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
          {rows.map(r => (
            <div
              key={r.activityDate}
              title={`${r.activityDate}: ${value(r).toLocaleString()}`}
              style={{
                flex: 1,
                minWidth: 3,
                height: `${Math.max(2, (value(r) / max) * 100)}%`,
                background: color,
                borderRadius: '2px 2px 0 0',
              }}
            />
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--kw-forest-60)', marginTop: 4 }}>
          <span>{rows[0].activityDate}</span>
          <span>{rows[rows.length - 1].activityDate}</span>
        </div>
      )}
    </div>
  )
}

/** Screen: daily activity trends — picks, TRs, receipts, issues. */
export function TrendsView({ request }: { readonly request: WmOperationsAdapterRequest }) {
  const [days, setDays] = useState(90)
  const result = useWmList<DailyRow>('/api/wm-operations/daily-activity', {
    plant_id: request.plantId, days, limit: 400,
  })
  const rows = (result.data?.ok ? result.data.data : []).slice().sort((a, b) => a.activityDate.localeCompare(b.activityDate))

  const totalPicks = rows.reduce((s, r) => s + (r.toItemsConfirmed ?? 0), 0)
  const busiest = rows.reduce((m, r) => Math.max(m, r.toItemsConfirmed ?? 0), 0)

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Performance"
        title="Trends"
        subtitle="Daily picking, TR creation, and goods movement volumes — spot the busy days and the quiet ones."
      />
      <div className="kw-kpi-row">
        <KpiTile label={`Picks (${days}d)`} value={totalPicks.toLocaleString()} />
        <KpiTile label="Busiest day" value={busiest.toLocaleString()} />
        <KpiTile label="Days with activity" value={rows.filter(r => (r.toItemsConfirmed ?? 0) > 0).length} />
      </div>

      <div className="kw-filters" style={{ marginBottom: 12 }}>
        <select aria-label="Window" value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 180 days</option>
          <option value={365}>Last 365 days</option>
        </select>
      </div>

      {result.isLoading ? <LoadingRows rows={6} /> : (
        <>
          <BarChart rows={rows} value={r => r.toItemsConfirmed ?? 0} color="var(--kw-valentia-slate)" label="TO items confirmed per day" />
          <BarChart rows={rows} value={r => r.trsCreated ?? 0} color="var(--kw-sage)" label="Transfer requirements created per day" />
          <BarChart rows={rows} value={r => r.goodsReceiptLines ?? 0} color="var(--kw-jade)" label="Goods receipt lines per day" />
          <BarChart rows={rows} value={r => r.goodsIssueLines ?? 0} color="var(--kw-sunset)" label="Goods issue lines per day" />
        </>
      )}
    </section>
  )
}
