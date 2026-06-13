/**
 * Production Planning Board (PEX-E-36) — read-only line-laned Gantt.
 *
 * Lanes = production lines (process_order.production_line / CRVER) — never work-centre.
 * Lane data from vw_consumption_wm_operations_lineside_lines (reused from lineside monitor).
 * Block data from vw_consumption_wm_operations_plan_board (date-windowable at query time).
 *
 * READ-ONLY: no drag/drop, no schedule button, no block move/resize, no POST endpoints.
 * The backlog rail is informational only. Date navigation drives the query window.
 *
 * Wall-clock rule (ADR 012): projected_finish / is_overdue / status are computed at
 * query time in the consumption view — never stored in a base MV.
 *
 * Note: changeover/cleaning/maintenance block kinds are omitted — no governed SAP source.
 *
 * Cross-surface navigation:
 *   block click → Order Journey (order_id deep-link)
 *   lane header → Lineside Monitor (line_id deep-link)
 *   shortage chip → Shortage Projection view
 */

import { useState, useMemo, useCallback } from 'react'
import { useWmLinesideLines } from '../adapters/wm-operations-queries.js'
import { useWmPlanBoard, useWmPlanBoardKpis, useWmPlanBoardBacklog, useWmPlanBoardWmOverlay } from '../adapters/wm-operations-queries.js'
import type { WmPlanBoardBlock, WmPlanBoardBacklogItem, WmPlanBoardKpis, WmPlanBoardWmOverlayItem, WmLinesideLine } from '../adapters/wm-operations-adapter.js'
import { EmptyNote } from '../components/kerry.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PX_PER_HOUR = 80
const LANE_HEADER_WIDTH = 180
const MIN_BLOCK_PX = 8

// Status colour mapping — governed data only (no changeover/cleaning/maintenance).
const STATUS_COLOURS: Record<string, string> = {
  running:          '#2E7D50',  // kerry forest
  atrisk:           '#E65100',  // at-risk orange
  'material-short': '#B71C1C',  // shortage red
  completed:        '#607D8B',  // slate
  firm:             '#1565C0',  // planned blue
  open:             '#9E9E9E',  // grey (released but unstarted)
}

const STATUS_LABELS: Record<string, string> = {
  running:          'Running',
  atrisk:           'At Risk',
  'material-short': 'Material Short',
  completed:        'Completed',
  firm:             'Firm (not started)',
  open:             'Open',
}

const STAGING_COLOURS: Record<string, string> = {
  FULL:    '#2E7D50',
  PARTIAL: '#F9A825',
  NONE:    '#B71C1C',
}

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, n: number): string {
  // Parse + mutate + format strictly in UTC — parsing as local midnight then formatting via
  // toISOString() (UTC) shifts the day by one for non-UTC (esp. positive-offset) timezones.
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return toIso(d)
}

function todayIso(): string {
  return toIso(new Date())
}

function isoToDate(iso: string): Date {
  return new Date(iso + 'T00:00:00Z')
}

function formatDateDisplay(iso: string): string {
  // Format in UTC so the displayed weekday/day matches the UTC-parsed date (no off-by-one).
  return isoToDate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** Generate array of ISO date strings for [from, to] inclusive. */
function dateRange(from: string, to: string): string[] {
  const result: string[] = []
  let current = from
  while (current <= to) {
    result.push(current)
    current = addDays(current, 1)
  }
  return result
}

/** Hours in a date string relative to window start. */
function hoursFromStart(isoDatetime: string, windowStartIso: string): number {
  const start = new Date(windowStartIso + 'T00:00:00Z').getTime()
  // isoDatetime is a naive (UTC-basis) timestamp from gold — interpret as UTC for a consistent
  // offset against the UTC window start (mixing local + UTC shifted the NOW line in non-UTC tz).
  const tsIso = /(Z|[+-]\d\d:?\d\d)$/.test(isoDatetime) ? isoDatetime : isoDatetime + 'Z'
  const ts = new Date(tsIso).getTime()
  return (ts - start) / 3_600_000
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OrderDrawer({
  block,
  onClose,
  onOpenOrderJourney,
  onOpenLinesideMonitor,
  onOpenShortageProjection,
}: {
  readonly block: WmPlanBoardBlock
  readonly onClose: () => void
  readonly onOpenOrderJourney?: (orderId: string) => void
  readonly onOpenLinesideMonitor?: (lineId: string) => void
  readonly onOpenShortageProjection?: () => void
}) {
  const colour = STATUS_COLOURS[block.status] ?? '#9E9E9E'
  return (
    <div
      role="dialog"
      aria-label={`Order ${block.orderId}`}
      style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 360,
        background: 'var(--kw-surface, #fff)', boxShadow: '-4px 0 16px rgba(0,0,0,0.15)',
        zIndex: 200, overflowY: 'auto', padding: 24,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 className="kw-heading" style={{ margin: 0, fontSize: 16 }}>Order {block.orderId}</h2>
        <button type="button" onClick={onClose} aria-label="Close drawer"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>&#x2715;</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span className="kw-chip" style={{ background: colour, color: '#fff', padding: '2px 10px', borderRadius: 12, fontSize: 12 }}>
          {STATUS_LABELS[block.status] ?? block.status}
        </span>
        {block.hasShortage && (
          <span className="kw-chip" style={{ background: '#B71C1C', color: '#fff', padding: '2px 10px', borderRadius: 12, fontSize: 12 }}>
            Shortage
          </span>
        )}
        {block.isOverdue && (
          <span className="kw-chip" style={{ background: '#E65100', color: '#fff', padding: '2px 10px', borderRadius: 12, fontSize: 12 }}>
            Overdue
          </span>
        )}
      </div>

      <table style={{ fontSize: 13, borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          {[
            ['Line', block.lineId ?? '—'],
            ['Material', block.materialName ?? block.materialId ?? '—'],
            ['Planned qty', block.plannedQty != null ? `${block.plannedQty.toLocaleString()} ${block.uom ?? ''}` : '—'],
            ['Delivered qty', block.deliveredQty != null ? `${block.deliveredQty.toLocaleString()} ${block.uom ?? ''}` : '—'],
            ['% complete', block.pctComplete != null ? `${block.pctComplete.toFixed(1)}%` : '—'],
            ['Sched. start', block.scheduledStartDate ?? '—'],
            ['Sched. finish', block.scheduledFinishDate ?? '—'],
            ['Actual start', block.actualStart ?? '—'],
            ['Actual finish', block.actualFinish ?? '—'],
            ['Proj. finish', block.projectedFinish ?? '—'],
            ['Staging', block.stagingStatus ?? '—'],
          ].map(([label, value]) => (
            <tr key={String(label)}>
              <td className="kw-eyebrow" style={{ padding: '4px 0', paddingRight: 12, color: '#666', verticalAlign: 'top' }}>{label}</td>
              <td style={{ padding: '4px 0' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        <p className="kw-eyebrow" style={{ margin: 0, color: '#666' }}>Navigate to</p>
        {onOpenOrderJourney && (
          <button type="button" className="kw-btn kw-btn--secondary"
            onClick={() => { onOpenOrderJourney(block.orderId); onClose() }}
            style={{ textAlign: 'left' }}>
            Order Journey &#x2192;
          </button>
        )}
        {onOpenLinesideMonitor && block.lineId && (
          <button type="button" className="kw-btn kw-btn--secondary"
            onClick={() => { onOpenLinesideMonitor(block.lineId!); onClose() }}
            style={{ textAlign: 'left' }}>
            Lineside Monitor &#x2014; {block.lineId} &#x2192;
          </button>
        )}
        {onOpenShortageProjection && block.hasShortage && (
          <button type="button" className="kw-btn kw-btn--secondary"
            onClick={() => { onOpenShortageProjection(); onClose() }}
            style={{ textAlign: 'left' }}>
            Shortage Projection &#x2192;
          </button>
        )}
      </div>

      <p className="kw-eyebrow" style={{ marginTop: 'auto', color: '#999', fontSize: 11 }}>
        Read-only &#x2014; no scheduling controls. Use Order Journey for detailed timeline.
      </p>
    </div>
  )
}

function GanttBlock({
  block,
  fromIso,
  zoomHours,
  pxPerHour,
  onClick,
  wmOverlayOn,
}: {
  readonly block: WmPlanBoardBlock
  readonly fromIso: string
  readonly zoomHours: number
  readonly pxPerHour: number
  readonly onClick: (b: WmPlanBoardBlock) => void
  readonly wmOverlayOn: boolean
}) {
  const startIso = block.scheduledStartDate ? block.scheduledStartDate + 'T00:00:00' : null
  const finishIso = block.scheduledFinishDate ? block.scheduledFinishDate + 'T23:59:59' : null
  if (!startIso || !finishIso) return null

  const startH = Math.max(0, hoursFromStart(startIso, fromIso))
  const finishH = Math.min(zoomHours, hoursFromStart(finishIso, fromIso))
  if (finishH <= startH) return null

  const left = startH * pxPerHour
  const width = Math.max(MIN_BLOCK_PX, (finishH - startH) * pxPerHour)
  const colour = STATUS_COLOURS[block.status] ?? '#9E9E9E'
  const pct = block.pctComplete ?? 0

  // Projected overshoot — show ghost bar past scheduled_finish if projectedFinish > scheduledFinishDate
  let overshootWidth = 0
  if (
    block.projectedFinish &&
    block.scheduledFinishDate &&
    block.projectedFinish > block.scheduledFinishDate &&
    block.status === 'running'
  ) {
    const projH = Math.min(zoomHours, hoursFromStart(block.projectedFinish, fromIso))
    overshootWidth = Math.max(0, (projH - finishH) * pxPerHour)
  }

  const stagingColour = wmOverlayOn && block.stagingStatus ? STAGING_COLOURS[block.stagingStatus] : undefined

  return (
    <>
      <button
        type="button"
        onClick={() => onClick(block)}
        title={`${block.orderId} — ${block.materialName ?? ''} (${STATUS_LABELS[block.status] ?? block.status})`}
        style={{
          position: 'absolute',
          left,
          width,
          height: 28,
          top: 8,
          background: colour,
          borderRadius: 4,
          border: 'none',
          cursor: 'pointer',
          overflow: 'hidden',
          opacity: block.status === 'completed' ? 0.6 : 1,
          outline: wmOverlayOn && stagingColour ? `2px solid ${stagingColour}` : undefined,
        }}
        aria-label={`Order ${block.orderId}`}
      >
        {/* Progress fill */}
        {pct > 0 && (
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${Math.min(100, pct)}%`,
            background: 'rgba(255,255,255,0.25)',
          }} />
        )}
        {/* Label */}
        <span style={{
          position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
          fontSize: 11, color: '#fff', whiteSpace: 'nowrap', pointerEvents: 'none',
          overflow: 'hidden', maxWidth: width - 12,
        }}>
          {block.orderId}
        </span>
      </button>
      {/* Projected overshoot ghost */}
      {overshootWidth > 0 && (
        <div style={{
          position: 'absolute',
          left: left + width,
          width: overshootWidth,
          height: 28,
          top: 8,
          background: STATUS_COLOURS.atrisk,
          opacity: 0.35,
          borderRadius: '0 4px 4px 0',
          pointerEvents: 'none',
        }} />
      )}
    </>
  )
}

function LegendPanel() {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      {Object.entries(STATUS_LABELS).map(([key, label]) => (
        <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: STATUS_COLOURS[key] }} />
          {label}
        </span>
      ))}
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, opacity: 0.6 }}>
        <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: STATUS_COLOURS.atrisk, opacity: 0.35 }} />
        Proj. overshoot
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export interface PlanningBoardViewProps {
  readonly plantId: string
  readonly onNavigateToView?: (viewId: string) => void
  readonly onOpenProcessOrder?: (orderId: string) => void
}

export function PlanningBoardView({ plantId, onNavigateToView, onOpenProcessOrder }: PlanningBoardViewProps) {
  const today = todayIso()

  // ── Date navigation state ──────────────────────────────────────────────
  // Read initial value from URL ?from= search param (allows deep-links and day nav to persist).
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      const p = sp.get('from')
      if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) return p
    }
    return today
  })
  const [zoom, setZoom] = useState<'day' | 'week'>('day')
  const [wmOverlayOn, setWmOverlayOn] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const [selectedBlock, setSelectedBlock] = useState<WmPlanBoardBlock | null>(null)
  const [lineFilter, setLineFilter] = useState<string | undefined>(undefined)

  // Keyboard arrow key date scrub
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setSelectedDate(d => addDays(d, -1))
    if (e.key === 'ArrowRight') setSelectedDate(d => addDays(d, 1))
  }, [])

  // ── Date window from selectedDate + zoom ────────────────────────────────
  const { fromDate, toDate, zoomHours, days } = useMemo(() => {
    if (zoom === 'day') {
      return {
        fromDate: selectedDate,
        toDate: selectedDate,
        zoomHours: 24,
        days: [selectedDate],
      }
    }
    // Week: selectedDate +/- 3 days
    const from = addDays(selectedDate, -3)
    const to   = addDays(selectedDate, 3)
    return {
      fromDate: from,
      toDate:   to,
      zoomHours: 7 * 24,
      days: dateRange(from, to),
    }
  }, [selectedDate, zoom])

  const pxPerHour = zoom === 'day' ? PX_PER_HOUR : Math.round(PX_PER_HOUR / 3)
  const ganttWidth = zoomHours * pxPerHour

  // ── Data fetching ────────────────────────────────────────────────────────
  const linesQuery = useWmLinesideLines(plantId)
  const boardReq = useMemo(() => ({
    plantId,
    lineId: lineFilter,
    fromDate,
    toDate,
    limit: 1000,
  }), [plantId, lineFilter, fromDate, toDate])

  const boardQuery    = useWmPlanBoard(boardReq)
  const kpisQuery     = useWmPlanBoardKpis(boardReq)
  const backlogQuery  = useWmPlanBoardBacklog({ plantId, lineId: lineFilter, limit: 100 })
  const overlayQuery  = useWmPlanBoardWmOverlay(boardReq, wmOverlayOn)

  // ── Derived structures ───────────────────────────────────────────────────
  const lines: WmLinesideLine[] = useMemo(() => {
    return linesQuery.data?.ok ? (linesQuery.data as { ok: true; data: WmLinesideLine[] }).data : []
  }, [linesQuery.data])

  const blocksByLine = useMemo(() => {
    const blocks: WmPlanBoardBlock[] = boardQuery.data?.ok ? (boardQuery.data as { ok: true; data: WmPlanBoardBlock[] }).data : []
    const map = new Map<string, WmPlanBoardBlock[]>()
    for (const b of blocks) {
      const key = b.lineId ?? '__NO_LINE__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(b)
    }
    return map
  }, [boardQuery.data])

  const overlayByOrder = useMemo(() => {
    if (!wmOverlayOn) return new Map<string, string>()
    const items: WmPlanBoardWmOverlayItem[] = overlayQuery.data?.ok ? (overlayQuery.data as { ok: true; data: WmPlanBoardWmOverlayItem[] }).data : []
    const map = new Map<string, string>()
    for (const item of items) {
      if (item.stagingStatus) map.set(item.orderId, item.stagingStatus)
    }
    return map
  }, [wmOverlayOn, overlayQuery.data])

  // overlayByOrder used by GanttBlock via wmOverlayOn flag — referenced here for exhaustive-deps
  void overlayByOrder

  const kpisData: WmPlanBoardKpis[] = kpisQuery.data?.ok ? (kpisQuery.data as { ok: true; data: WmPlanBoardKpis[] }).data : []
  const kpis = kpisData[0]
  const backlog: WmPlanBoardBacklogItem[] = backlogQuery.data?.ok ? (backlogQuery.data as { ok: true; data: WmPlanBoardBacklogItem[] }).data : []

  // ── NOW line position ────────────────────────────────────────────────────
  const nowOffset = useMemo(() => {
    const nowH = hoursFromStart(new Date().toISOString(), fromDate)
    if (nowH < 0 || nowH > zoomHours) return null
    return nowH * pxPerHour
  }, [fromDate, zoomHours, pxPerHour])

  // ── Error / loading states ───────────────────────────────────────────────
  const isLoading = linesQuery.isLoading || boardQuery.isLoading
  const isError   = linesQuery.isError || boardQuery.isError
  const freshness = boardQuery.dataUpdatedAt
    ? new Date(boardQuery.dataUpdatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null
  const isStale = boardQuery.dataUpdatedAt
    ? Date.now() - boardQuery.dataUpdatedAt > 2 * 60 * 60 * 1000
    : false

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="kw-planning-board"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{ outline: 'none', fontFamily: 'Noto Sans, sans-serif' }}
      aria-label="Production Planning Board — use left/right arrow keys to navigate dates"
    >
      {/* ── KPI strip ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Lines running',  value: kpis?.linesRunning ?? '—' },
          { label: 'Today qty',       value: kpis?.todayQtyDelivered != null ? kpis.todayQtyDelivered.toLocaleString() : '—' },
          { label: 'On-time %',       value: kpis?.onTimePct != null ? `${kpis.onTimePct}%` : '—' },
          { label: 'At-risk',         value: kpis?.atRiskCount ?? '—' },
          { label: 'Shortages',       value: kpis?.shortageCount ?? '—' },
          { label: 'Backlog',         value: kpis?.backlogCount ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="kw-card" style={{ padding: '10px 16px', minWidth: 100, textAlign: 'center' }}>
            <div className="kw-eyebrow" style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--kw-ink, #1a1a1a)' }}>{String(value)}</div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        {/* Date nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden' }}>
          <button type="button" className="kw-btn kw-btn--ghost"
            style={{ padding: '5px 10px', border: 'none' }}
            onClick={() => setSelectedDate(d => addDays(d, -1))}
            aria-label="Previous day">&#9664;</button>
          <button type="button" className="kw-btn kw-btn--ghost"
            style={{ padding: '5px 10px', border: 'none', fontWeight: selectedDate === today ? 700 : 400 }}
            onClick={() => setSelectedDate(today)}>Today</button>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            aria-label="Selected date"
            style={{ border: 'none', padding: '5px 8px', fontSize: 13, background: 'transparent' }}
          />
          <button type="button" className="kw-btn kw-btn--ghost"
            style={{ padding: '5px 10px', border: 'none' }}
            onClick={() => setSelectedDate(d => addDays(d, 1))}
            aria-label="Next day">&#9654;</button>
        </div>

        {/* Zoom */}
        <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid #ddd' }}>
          {(['day', 'week'] as const).map(z => (
            <button key={z} type="button"
              className={`kw-btn kw-btn--ghost${zoom === z ? ' kw-btn--active' : ''}`}
              style={{ padding: '5px 14px', border: 'none', background: zoom === z ? 'var(--kw-forest, #2E7D50)' : undefined, color: zoom === z ? '#fff' : undefined }}
              onClick={() => setZoom(z)}
            >{z.charAt(0).toUpperCase() + z.slice(1)}</button>
          ))}
        </div>

        {/* Line filter */}
        {lines.length > 0 && (
          <select
            value={lineFilter ?? ''}
            onChange={e => setLineFilter(e.target.value || undefined)}
            aria-label="Filter by line"
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}
          >
            <option value="">All lines</option>
            {lines.map(l => (
              <option key={l.lineId} value={l.lineId}>{l.lineLabel}</option>
            ))}
          </select>
        )}

        {/* WM overlay toggle */}
        <button type="button"
          className={`kw-btn kw-btn--ghost${wmOverlayOn ? ' kw-btn--active' : ''}`}
          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #ddd', background: wmOverlayOn ? '#e8f5e9' : undefined }}
          onClick={() => setWmOverlayOn(v => !v)}
          aria-pressed={wmOverlayOn}>
          WM Overlay {wmOverlayOn ? 'ON' : 'OFF'}
        </button>

        {/* Legend toggle */}
        <button type="button" className="kw-btn kw-btn--ghost"
          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #ddd' }}
          onClick={() => setShowLegend(v => !v)}
          aria-expanded={showLegend}>
          Legend
        </button>

        {/* Freshness */}
        {freshness && (
          <span className="kw-eyebrow" style={{ marginLeft: 'auto', color: isStale ? '#E65100' : '#666', fontSize: 11 }}>
            {isStale ? 'DATA STALE — ' : ''}as of {freshness}
          </span>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="kw-card" style={{ padding: '10px 16px', marginBottom: 12 }}>
          <LegendPanel />
          <p className="kw-eyebrow" style={{ marginTop: 8, fontSize: 11, color: '#999' }}>
            Note: changeover / cleaning / maintenance blocks are omitted — no governed SAP source.
          </p>
        </div>
      )}

      {/* ── Error / loading / empty ────────────────────────────────────── */}
      {isError && (
        <div className="kw-card" style={{ padding: 16, background: '#fff3e0', borderLeft: '4px solid #E65100', marginBottom: 12 }}>
          <strong>Error loading planning board data.</strong> Check connectivity and retry.
        </div>
      )}
      {isLoading && !isError && (
        <div className="kw-card" style={{ padding: 16, color: '#666', marginBottom: 12 }}>Loading planning board&#x2026;</div>
      )}

      {/* ── Main layout: Gantt + Backlog rail ─────────────────────────── */}
      {!isLoading && !isError && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Gantt */}
          <div style={{ flex: 1, overflowX: 'auto', minWidth: 0 }}>
            <div style={{ minWidth: LANE_HEADER_WIDTH + ganttWidth }}>
              {/* Day header row */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', marginLeft: LANE_HEADER_WIDTH }}>
                {days.map(day => {
                  const isToday = day === today
                  const dayHours = 24
                  const dayWidth = dayHours * pxPerHour
                  return (
                    <div key={day} style={{
                      width: dayWidth, minWidth: dayWidth,
                      padding: '6px 8px',
                      background: isToday ? '#e8f5e9' : 'transparent',
                      borderLeft: '1px solid #e0e0e0',
                      boxSizing: 'border-box',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400 }}>
                        {formatDateDisplay(day)}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Empty state */}
              {lines.length === 0 ? (
                <EmptyNote>No production lines found for this plant.</EmptyNote>
              ) : blocksByLine.size === 0 && !boardQuery.isLoading ? (
                <EmptyNote>{`No orders scheduled ${fromDate === toDate ? `on ${formatDateDisplay(fromDate)}` : `${formatDateDisplay(fromDate)} – ${formatDateDisplay(toDate)}`}.`}</EmptyNote>
              ) : (
                /* Lane rows */
                lines.filter(l => !lineFilter || l.lineId === lineFilter).map(line => {
                  const laneBlocks = blocksByLine.get(line.lineId) ?? []
                  return (
                    <div key={line.lineId} style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', minHeight: 52 }}>
                      {/* Lane header — click opens Lineside Monitor */}
                      <button
                        type="button"
                        style={{
                          width: LANE_HEADER_WIDTH, minWidth: LANE_HEADER_WIDTH,
                          padding: '8px 12px', textAlign: 'left',
                          background: line.activeOrderCount > 0 ? '#f1f8f4' : 'transparent',
                          border: 'none', borderRight: '1px solid #e0e0e0',
                          cursor: onNavigateToView ? 'pointer' : 'default',
                        }}
                        onClick={() => onNavigateToView?.('lineside-monitor')}
                        title={onNavigateToView ? `Open Lineside Monitor — ${line.lineLabel}` : undefined}
                        aria-label={`Lane ${line.lineLabel}`}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--kw-ink, #1a1a1a)' }}>{line.lineLabel}</div>
                        {line.activeOrderCount > 0 && (
                          <div className="kw-eyebrow" style={{ fontSize: 10, color: '#2E7D50' }}>
                            {line.activeOrderCount} running
                          </div>
                        )}
                      </button>

                      {/* Time grid */}
                      <div style={{ position: 'relative', flex: 1, minHeight: 52 }}>
                        {/* Past shading */}
                        {(() => {
                          const nowH = hoursFromStart(new Date().toISOString(), fromDate)
                          if (nowH <= 0) return null
                          return (
                            <div style={{
                              position: 'absolute', left: 0, top: 0, bottom: 0,
                              width: Math.min(nowH * pxPerHour, ganttWidth),
                              background: 'rgba(0,0,0,0.03)',
                              pointerEvents: 'none',
                            }} />
                          )
                        })()}

                        {/* Day column grid lines */}
                        {days.map((day, i) => (
                          <div key={day} style={{
                            position: 'absolute',
                            left: i * 24 * pxPerHour,
                            top: 0, bottom: 0, width: 1,
                            background: day === today ? '#a5d6b8' : '#e8e8e8',
                            pointerEvents: 'none',
                          }} />
                        ))}

                        {/* NOW line */}
                        {nowOffset !== null && (
                          <div style={{
                            position: 'absolute', left: nowOffset, top: 0, bottom: 0, width: 2,
                            background: '#E65100', opacity: 0.7, pointerEvents: 'none', zIndex: 10,
                          }}>
                            <div style={{ position: 'absolute', top: 2, left: 3, fontSize: 9, color: '#E65100', whiteSpace: 'nowrap' }}>NOW</div>
                          </div>
                        )}

                        {/* Order blocks */}
                        {laneBlocks.map(block => (
                          <GanttBlock
                            key={block.orderId}
                            block={block}
                            fromIso={fromDate}
                            zoomHours={zoomHours}
                            pxPerHour={pxPerHour}
                            onClick={setSelectedBlock}
                            wmOverlayOn={wmOverlayOn}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Backlog rail — informational only, no drag */}
          <div style={{ width: 240, flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--kw-ink, #1a1a1a)' }}>
              Backlog / Overdue
              <span className="kw-eyebrow" style={{ fontSize: 10, fontWeight: 400, color: '#666', marginLeft: 6 }}>(read-only)</span>
            </div>
            {backlog.length === 0 ? (
              <div className="kw-card" style={{ padding: 12, color: '#666', fontSize: 13 }}>No backlog.</div>
            ) : (
              backlog.map(item => (
                <div
                  key={item.orderId}
                  className="kw-card"
                  style={{
                    padding: '8px 10px', marginBottom: 6, fontSize: 12,
                    borderLeft: `3px solid ${item.isOverdue ? STATUS_COLOURS.atrisk : STATUS_COLOURS.firm}`,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{item.orderId}</div>
                  <div style={{ color: '#666', marginTop: 2 }}>{item.materialName ?? item.materialId}</div>
                  <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {item.isOverdue && (
                      <span style={{ background: STATUS_COLOURS.atrisk, color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>Overdue</span>
                    )}
                    {item.hasShortage && (
                      <span style={{ background: STATUS_COLOURS['material-short'], color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>Shortage</span>
                    )}
                    <span style={{ background: item.stagingStatus === 'FULL' ? STATUS_COLOURS.running : '#e0e0e0', color: item.stagingStatus === 'FULL' ? '#fff' : '#333', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{item.stagingStatus ?? 'No WM'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Order drawer ──────────────────────────────────────────────── */}
      {selectedBlock && (
        <OrderDrawer
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
          onOpenOrderJourney={onOpenProcessOrder ? (id) => { onOpenProcessOrder(id) } : onNavigateToView ? () => onNavigateToView('order-journey') : undefined}
          onOpenLinesideMonitor={onNavigateToView ? (_lineId) => onNavigateToView('lineside-monitor') : undefined}
          onOpenShortageProjection={onNavigateToView ? () => { onNavigateToView('shortage-projection'); setSelectedBlock(null) } : undefined}
        />
      )}
    </div>
  )
}
