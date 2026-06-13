import { useMemo, useState } from 'react'
import type { WmOperationsAdapterRequest, WmPiAccuracyItem } from '../adapters/wm-operations-adapter.js'
import { useWmPiAccuracy } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate } from '../components/kerry.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function fmtValue(value: number | null | undefined, currency?: string | null): string {
  if (value == null) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  const formatted = abs.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return currency ? `${sign}${formatted} ${currency}` : `${sign}${formatted}`
}

function accuracyTone(pctValue: number | null): 'ok' | 'warn' | 'alert' | 'none' {
  if (pctValue == null) return 'none'
  if (pctValue >= 0.98) return 'ok'
  if (pctValue >= 0.95) return 'warn'
  return 'alert'
}

/** Roll up items to an overall accuracy/coverage KPI, handling multi-currency carefully.
 *  Accuracy = sum(matched_lines) / sum(counted_lines) — weighted by volume, not an average of pcts.
 *  Coverage = sum(counted_lines) / sum(due_lines).
 *  Only aggregates within a single currency when the selection is single-currency;
 *  returns null if the data spans multiple currencies (to avoid misleading sums). */
function rollupKpis(items: WmPiAccuracyItem[]) {
  if (items.length === 0) return null
  const currencies = new Set(items.map(r => r.currency).filter(Boolean))
  const singleCurrency = currencies.size === 1 ? [...currencies][0] : null

  const totalDue = items.reduce((s, r) => s + r.dueLines, 0)
  const totalCounted = items.reduce((s, r) => s + r.countedLines, 0)
  const totalMatched = items.reduce((s, r) => s + r.matchedLines, 0)
  const totalRecount = items.reduce((s, r) => s + r.recountRequiredLines, 0)

  // Only aggregate value when single-currency
  const totalAbsAdjValue = singleCurrency
    ? items.reduce((s, r) => s + (r.absAdjustmentValue ?? 0), 0)
    : null

  const countAccuracyPct = totalCounted > 0 ? totalMatched / totalCounted : null
  const coveragePct = totalDue > 0 ? totalCounted / totalDue : null
  const recountRatePct = totalCounted > 0 ? totalRecount / totalCounted : null

  return { countAccuracyPct, coveragePct, recountRatePct, totalAbsAdjValue, singleCurrency, totalCounted, totalDue }
}

// ── KPI strip ─────────────────────────────────────────────────────────────────

interface KpiStripProps {
  readonly items: WmPiAccuracyItem[]
}

function KpiStrip({ items }: KpiStripProps) {
  const kpis = useMemo(() => rollupKpis(items), [items])
  if (!kpis) return null

  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
      <KpiTile
        label="Count Accuracy"
        value={pct(kpis.countAccuracyPct)}
        tone={accuracyTone(kpis.countAccuracyPct)}
      />
      <KpiTile
        label="Coverage"
        value={pct(kpis.coveragePct)}
        tone={kpis.coveragePct != null && kpis.coveragePct >= 0.95 ? 'ok' : 'warn'}
      />
      <KpiTile
        label="Abs. Adjustment Value"
        value={fmtValue(kpis.totalAbsAdjValue, kpis.singleCurrency)}
        tone={kpis.totalAbsAdjValue != null && kpis.totalAbsAdjValue > 0 ? 'warn' : 'ok'}
      />
      <KpiTile
        label="Recount Rate"
        value={pct(kpis.recountRatePct)}
        tone={kpis.recountRatePct != null && kpis.recountRatePct > 0.05 ? 'warn' : 'ok'}
      />
    </div>
  )
}

// ── Accuracy trend (CSS bars, no chart lib) ────────────────────────────────

interface TrendBarProps {
  readonly month: string | null
  readonly countAccuracyPct: number | null
  readonly coveragePct: number | null
}

function TrendBar({ month, countAccuracyPct, coveragePct }: TrendBarProps) {
  const accHeight = countAccuracyPct != null ? Math.round(countAccuracyPct * 100) : 0
  const tone = accuracyTone(countAccuracyPct)
  const barColor = tone === 'ok'
    ? 'var(--kw-success, #007a33)'
    : tone === 'warn'
      ? 'var(--kw-warning, #e07b00)'
      : 'var(--kw-error, #c00)'

  const label = month ? month.slice(0, 7) : '—'  // "YYYY-MM"

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 36 }}>
      <span style={{ fontSize: 10, color: 'var(--kw-text-muted, #888)', fontWeight: 600 }}>
        {pct(countAccuracyPct)}
      </span>
      <div
        style={{
          width: 24,
          height: 60,
          background: 'var(--kw-border, #e8e8e8)',
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column-reverse',
          overflow: 'hidden',
        }}
        title={`Accuracy: ${pct(countAccuracyPct)} | Coverage: ${pct(coveragePct)}`}
      >
        <div
          style={{
            width: '100%',
            height: `${accHeight}%`,
            background: barColor,
            transition: 'height 0.3s ease',
          }}
        />
      </div>
      <span style={{ fontSize: 9, color: 'var(--kw-text-muted, #888)', writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
        {label}
      </span>
    </div>
  )
}

interface AccuracyTrendProps {
  readonly items: WmPiAccuracyItem[]
}

function AccuracyTrend({ items }: AccuracyTrendProps) {
  // Roll up to plant+month (single-currency or multi — show accuracy bars only)
  const byMonth = useMemo(() => {
    const map = new Map<string, { countedLines: number; matchedLines: number; dueLines: number; coveragePct: number | null }>()
    for (const r of items) {
      const key = r.countMonth ?? 'null'
      const existing = map.get(key)
      if (existing) {
        existing.countedLines += r.countedLines
        existing.matchedLines += r.matchedLines
        existing.dueLines += r.dueLines
      } else {
        map.set(key, {
          countedLines: r.countedLines,
          matchedLines: r.matchedLines,
          dueLines: r.dueLines,
          coveragePct: r.coveragePct,
        })
      }
    }
    return Array.from(map.entries())
      .map(([month, agg]) => ({
        month,
        countAccuracyPct: agg.countedLines > 0 ? agg.matchedLines / agg.countedLines : null,
        coveragePct: agg.dueLines > 0 ? agg.countedLines / agg.dueLines : null,
      }))
      .sort((a, b) => (a.month < b.month ? -1 : 1))
      .slice(-12)  // last 12 months
  }, [items])

  if (byMonth.length === 0) return <EmptyNote>No trend data available.</EmptyNote>

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingBottom: 4 }}>
        {byMonth.map(m => (
          <TrendBar
            key={m.month}
            month={m.month === 'null' ? null : m.month}
            countAccuracyPct={m.countAccuracyPct}
            coveragePct={m.coveragePct}
          />
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--kw-text-muted, #888)', marginTop: 4 }}>
        Bar height = count accuracy %. Hover for coverage. Last 12 months.
      </div>
    </div>
  )
}

// ── By-zone / by-ABC breakdown table ──────────────────────────────────────────

type BreakdownAxis = 'storage_location' | 'abc'

interface BreakdownTableProps {
  readonly items: WmPiAccuracyItem[]
  readonly isLoading: boolean
  readonly error: string | null
}

function BreakdownTable({ items, isLoading, error }: BreakdownTableProps) {
  const [axis, setAxis] = useState<BreakdownAxis>('abc')

  type BreakRow = {
    key: string
    dueLines: number
    countedLines: number
    matchedLines: number
    recountRequiredLines: number
    countAccuracyPct: number | null
    coveragePct: number | null
  }

  const breakdownRows = useMemo((): BreakRow[] => {
    const map = new Map<string, { due: number; counted: number; matched: number; recount: number }>()
    for (const r of items) {
      const key = axis === 'abc' ? (r.abcIndicator || '—') : (r.storageLocationId || '—')
      const existing = map.get(key)
      if (existing) {
        existing.due += r.dueLines
        existing.counted += r.countedLines
        existing.matched += r.matchedLines
        existing.recount += r.recountRequiredLines
      } else {
        map.set(key, { due: r.dueLines, counted: r.countedLines, matched: r.matchedLines, recount: r.recountRequiredLines })
      }
    }
    return Array.from(map.entries())
      .map(([key, agg]) => ({
        key,
        dueLines: agg.due,
        countedLines: agg.counted,
        matchedLines: agg.matched,
        recountRequiredLines: agg.recount,
        countAccuracyPct: agg.counted > 0 ? agg.matched / agg.counted : null,
        coveragePct: agg.due > 0 ? agg.counted / agg.due : null,
      }))
      .sort((a, b) => (a.key < b.key ? -1 : 1))
  }, [items, axis])

  if (error) return <EmptyNote>Could not load PI accuracy — {error}</EmptyNote>
  if (isLoading) return <LoadingRows rows={6} />
  if (breakdownRows.length === 0) return <EmptyNote>No PI accuracy data for the selected plant.</EmptyNote>

  const th = (label: string) => (
    <th style={{ padding: '6px 8px', fontWeight: 600, fontSize: 12, textAlign: 'left', borderBottom: '2px solid var(--kw-border, #e8e8e8)' }}>{label}</th>
  )
  const thR = (label: string) => (
    <th style={{ padding: '6px 8px', fontWeight: 600, fontSize: 12, textAlign: 'right', borderBottom: '2px solid var(--kw-border, #e8e8e8)' }}>{label}</th>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--kw-text-muted, #888)' }}>Group by:</span>
        {(['abc', 'storage_location'] as BreakdownAxis[]).map(a => (
          <button
            key={a}
            type="button"
            className={`kw-viewnav-tab${axis === a ? ' kw-viewnav-tab-active' : ''}`}
            style={{ fontSize: 11, padding: '2px 8px' }}
            onClick={() => setAxis(a)}
          >
            {a === 'abc' ? 'ABC Class' : 'Storage Location'}
          </button>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {th(axis === 'abc' ? 'ABC Class' : 'Storage Location')}
              {thR('Due Lines')}
              {thR('Counted')}
              {thR('Matched')}
              {thR('Accuracy')}
              {thR('Coverage')}
              {thR('Recount')}
            </tr>
          </thead>
          <tbody>
            {breakdownRows.map(row => {
              const tone = accuracyTone(row.countAccuracyPct)
              const accColor = tone === 'ok'
                ? 'var(--kw-success, #007a33)'
                : tone === 'warn'
                  ? 'var(--kw-warning, #e07b00)'
                  : tone === 'alert'
                    ? 'var(--kw-error, #c00)'
                    : 'var(--kw-text-muted, #888)'
              return (
                <tr key={row.key} style={{ borderBottom: '1px solid var(--kw-border, #e8e8e8)' }}>
                  <td style={{ padding: '5px 8px', fontWeight: 600 }}>{row.key}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{row.dueLines.toLocaleString()}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{row.countedLines.toLocaleString()}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{row.matchedLines.toLocaleString()}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: accColor }}>{pct(row.countAccuracyPct)}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--kw-text-secondary, #444)' }}>{pct(row.coveragePct)}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', color: (row.recountRequiredLines > 0) ? 'var(--kw-warning, #e07b00)' : 'var(--kw-text-muted, #888)' }}>
                    {row.recountRequiredLines.toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export interface InventoryAccuracyViewProps {
  readonly request: WmOperationsAdapterRequest
  readonly onNavigateToView?: (viewId: string) => void
}

export function InventoryAccuracyView({ request, onNavigateToView }: InventoryAccuracyViewProps) {
  // Default: last 180 days of count months (2 full PI cycles at most plants)
  const result = useWmPiAccuracy(request.plantId, 180, 2000, Boolean(request.plantId))

  const items: WmPiAccuracyItem[] = result.data?.ok ? result.data.data : []

  const dataError = result.error
    ? (result.error as Error).message
    : result.data && !result.data.ok
      ? result.data.error.message
      : null

  if (!request.plantId) {
    return (
      <section>
        <ViewHeader eyebrow="Insight" title="Inventory Accuracy" subtitle="Select a plant to view physical-inventory count accuracy analytics." />
        <EmptyNote>No plant selected.</EmptyNote>
      </section>
    )
  }

  return (
    <section>
      <ViewHeader
        eyebrow="Insight"
        title="Inventory Accuracy"
        subtitle="Physical-inventory count accuracy, coverage, recount rate and adjustment value by ABC class and storage location."
      />

      {/* Error must appear before empty-state (house convention checked by CI). */}
      {dataError ? (
        <EmptyNote>Could not load inventory accuracy data — {dataError}</EmptyNote>
      ) : (
        <>
          {/* KPI strip */}
          {items.length > 0 && <KpiStrip items={items} />}

          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Accuracy trend (CSS bars) */}
            <div className="kw-card" style={{ flex: '1 1 360px', minWidth: 280 }}>
              <div className="kw-card-title" style={{ marginBottom: 12 }}>Accuracy Trend</div>
              {result.isLoading ? (
                <LoadingRows rows={4} />
              ) : (
                <AccuracyTrend items={items} />
              )}
            </div>

            {/* By-zone / by-ABC breakdown */}
            <div className="kw-card" style={{ flex: '2 1 520px', minWidth: 320 }}>
              <div className="kw-card-title" style={{ marginBottom: 12 }}>Breakdown</div>
              <BreakdownTable
                items={items}
                isLoading={result.isLoading}
                error={dataError}
              />
            </div>
          </div>

          {/* Deep-link to raw Physical Inventory (Handover view contains PI document detail). */}
          {onNavigateToView && (
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                className="kw-viewnav-tab"
                style={{ fontSize: 11, padding: '3px 10px' }}
                onClick={() => onNavigateToView('handover')}
              >
                View raw PI documents →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
