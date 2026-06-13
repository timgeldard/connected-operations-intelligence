import { useMemo, useState } from 'react'
import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { useWmList } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader } from '../components/kerry.js'

interface DailyRow {
  plantId: string; activityDate: string; toItemsConfirmed: number | null
  activeOperators: number | null; trsCreated: number | null
  goodsReceiptLines: number | null; goodsIssueLines: number | null
}

interface BaselineRow {
  plantId: string; metricName: string; dayOfWeek: number
  medianValue: number | null; p10Value: number | null; p90Value: number | null
  sampleDays: number | null
}

type DowBand = { median: number; p10: number; p90: number }
type BaselineLookup = Record<string, Record<number, DowBand>>

/** Parse ISO date string (YYYY-MM-DD) → Spark day_of_week (1=Sun … 7=Sat) */
function dateToDow(isoDate: string): number {
  // Parse parts explicitly to avoid off-by-one in positive timezones
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 1  // 0→1(Sun) … 6→7(Sat)
}

/** Returns 'flagged-high' | 'flagged-low' | 'normal' | 'unknown' */
function bandPosition(value: number | null, band: DowBand | undefined): 'flagged-high' | 'flagged-low' | 'normal' | 'unknown' {
  if (value === null || !band) return 'unknown'
  if (value > band.p90) return 'flagged-high'
  if (value < band.p10) return 'flagged-low'
  return 'normal'
}

/** Brand-tint CSS bar chart with optional baseline band overlay. */
function BarChart({ rows, value, color, label, metricKey, baseline }: {
  readonly rows: DailyRow[]
  readonly value: (r: DailyRow) => number
  readonly color: string
  readonly label: string
  readonly metricKey: string
  readonly baseline: BaselineLookup
}) {
  const max = Math.max(1, ...rows.map(value))
  const lastRow = rows.length > 0 ? rows[rows.length - 1] : null
  const lastRowPos = lastRow ? bandPosition(value(lastRow), baseline[metricKey]?.[dateToDow(lastRow.activityDate)]) : null

  return (
    <div className="kw-card">
      <div className="kw-card-title">{label}</div>
      {rows.length === 0 ? <EmptyNote>No activity in the window.</EmptyNote> : (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
          {rows.map((r, i) => {
            const v = value(r)
            const dow = dateToDow(r.activityDate)
            const band = baseline[metricKey]?.[dow]
            const isLast = i === rows.length - 1
            const pos = isLast ? (lastRowPos ?? 'unknown') : 'unknown'

            // Bar colour: last bar coloured by band position; others use default color
            const barColor = isLast && pos === 'flagged-high' ? 'var(--kw-sunset)'
              : isLast && pos === 'flagged-low' ? 'var(--kw-sage)'
              : isLast && pos === 'normal' ? 'var(--kw-jade)'
              : color

            // Band overlay for this bar's DOW
            const bandPct = band ? {
              p10: (band.p10 / max) * 100,
              p90: Math.min((band.p90 / max) * 100, 100),
              median: (band.median / max) * 100,
            } : null

            return (
              <div
                key={r.activityDate}
                style={{ position: 'relative', flex: 1, minWidth: 3, height: '100%', display: 'flex', alignItems: 'flex-end' }}
              >
                {/* Shaded p10–p90 band */}
                {bandPct && (
                  <div style={{
                    position: 'absolute',
                    bottom: `${bandPct.p10}%`,
                    left: 0, right: 0,
                    height: `${Math.max(0, bandPct.p90 - bandPct.p10)}%`,
                    background: 'rgba(0,0,0,0.06)',
                    borderRadius: 1,
                    pointerEvents: 'none',
                  }} />
                )}
                {/* Median reference line */}
                {bandPct && (
                  <div style={{
                    position: 'absolute',
                    bottom: `${bandPct.median}%`,
                    left: 0, right: 0,
                    height: 1,
                    background: 'rgba(0,0,0,0.25)',
                    pointerEvents: 'none',
                  }} />
                )}
                {/* Actual bar */}
                <div
                  title={`${r.activityDate}: ${v.toLocaleString()}`}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: `${Math.max(2, (v / max) * 100)}%`,
                    background: barColor,
                    borderRadius: '2px 2px 0 0',
                  }}
                />
              </div>
            )
          })}
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--kw-forest-60)', marginTop: 4 }}>
          <span>{rows[0].activityDate}</span>
          <span>{rows[rows.length - 1].activityDate}</span>
        </div>
      )}
      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--kw-forest-60)', marginTop: 4, alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 12, height: 8, background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 1 }} />
          Normal range p10–p90
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 12, height: 1, background: 'rgba(0,0,0,0.25)' }} />
          Median
        </span>
        {lastRow && (
          <span style={{ color: 'var(--kw-forest-60)' }}>
            Last point: {lastRowPos === 'normal' ? '✓ in band' : lastRowPos === 'unknown' ? '–' : '⚑ out of band'}
          </span>
        )}
      </div>
    </div>
  )
}

/** Screen: daily activity trends — picks, TRs, receipts, issues. */
export function TrendsView({ request }: { readonly request: WmOperationsAdapterRequest }) {
  const [days, setDays] = useState(90)
  const result = useWmList<DailyRow>('/api/wm-operations/daily-activity', {
    plant_id: request.plantId, days, limit: 400,
  })
  const baselineResult = useWmList<BaselineRow>('/api/wm-operations/daily-activity-baseline', {
    plant_id: request.plantId, limit: 500,
  }, Boolean(request.plantId))

  const rows = (result.data?.ok ? result.data.data : []).slice().sort((a, b) => a.activityDate.localeCompare(b.activityDate))
  const error = result.data && !result.data.ok ? result.data.error : null

  const baseline = useMemo<BaselineLookup>(() => {
    const bRows = baselineResult.data?.ok ? baselineResult.data.data : []
    const lookup: BaselineLookup = {}
    for (const b of bRows) {
      if (b.medianValue === null && b.p10Value === null && b.p90Value === null) continue
      if (!lookup[b.metricName]) lookup[b.metricName] = {}
      lookup[b.metricName][b.dayOfWeek] = {
        median: b.medianValue ?? 0,
        p10: b.p10Value ?? 0,
        p90: b.p90Value ?? 0,
      }
    }
    return lookup
  }, [baselineResult.data])

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

      {error ? <div className="kw-card"><EmptyNote>Could not load activity trends — {error.message}</EmptyNote></div>
        : result.isLoading ? <LoadingRows rows={6} /> : (
        <>
          <BarChart rows={rows} value={r => r.toItemsConfirmed ?? 0} color="var(--kw-valentia-slate)" label="TO items confirmed per day" metricKey="to_items_confirmed" baseline={baseline} />
          <BarChart rows={rows} value={r => r.trsCreated ?? 0} color="var(--kw-sage)" label="Transfer requirements created per day" metricKey="trs_created" baseline={baseline} />
          <BarChart rows={rows} value={r => r.goodsReceiptLines ?? 0} color="var(--kw-jade)" label="Goods receipt lines per day" metricKey="goods_receipt_lines" baseline={baseline} />
          <BarChart rows={rows} value={r => r.goodsIssueLines ?? 0} color="var(--kw-sunset)" label="Goods issue lines per day" metricKey="goods_issue_lines" baseline={baseline} />
        </>
      )}
    </section>
  )
}
