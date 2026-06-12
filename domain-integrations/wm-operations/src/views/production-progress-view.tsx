import { useMemo, useState } from 'react'
import type {
  WmOperationsAdapterRequest,
  WmWipStageItem,
  WmScheduleAdherenceDailyItem,
  WmAdherenceRootCauseItem,
  WmAdherenceRootCauseClass,
} from '../adapters/wm-operations-adapter.js'
import { useWmWipStages, useWmScheduleAdherenceDaily, useWmAdherenceRootCause } from '../adapters/wm-operations-queries.js'
import { setOrderJourneyDeepLink } from '../state/deep-link.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate, formatQty } from '../components/kerry.js'

// ── Stage ordering & labels ───────────────────────────────────────────────────

const STAGE_ORDER = ['RELEASED', 'STAGING', 'STAGED', 'IN_PRODUCTION', 'GR_PARTIAL', 'GR_COMPLETE'] as const
type Stage = typeof STAGE_ORDER[number]

const STAGE_LABEL: Record<Stage, string> = {
  RELEASED: 'Released',
  STAGING: 'Staging',
  STAGED: 'Staged',
  IN_PRODUCTION: 'In Production',
  GR_PARTIAL: 'GR Partial',
  GR_COMPLETE: 'GR Complete',
}

const STAGE_COLOR: Record<Stage, string> = {
  RELEASED: 'var(--kw-text-muted, #888)',
  STAGING: 'var(--kw-warning, #e07b00)',
  STAGED: 'var(--kw-primary, #005eb8)',
  IN_PRODUCTION: 'var(--kw-success, #007a33)',
  GR_PARTIAL: 'var(--kw-warning, #e07b00)',
  GR_COMPLETE: 'var(--kw-success, #007a33)',
}

// ── WIP Funnel card ───────────────────────────────────────────────────────────

interface WipFunnelProps {
  readonly items: WmWipStageItem[]
  readonly isLoading: boolean
  readonly error: string | null
  readonly onOpenProcessOrder?: (orderId: string) => void
  readonly onOpenJourney?: (orderId: string) => void
}

function WipFunnel({ items, isLoading, error, onOpenProcessOrder, onOpenJourney }: WipFunnelProps) {
  const [expandedStage, setExpandedStage] = useState<Stage | null>(null)

  const byStage = useMemo(() => {
    const map = new Map<Stage, WmWipStageItem[]>()
    for (const stage of STAGE_ORDER) map.set(stage, [])
    for (const item of items) {
      const s = item.stage as Stage
      if (map.has(s)) map.get(s)!.push(item)
    }
    return map
  }, [items])

  const maxCount = useMemo(() => Math.max(...STAGE_ORDER.map(s => (byStage.get(s)?.length ?? 0)), 1), [byStage])

  if (isLoading) return <LoadingRows rows={6} />
  if (error) return <EmptyNote>Could not load WIP data: {error}</EmptyNote>
  if (items.length === 0) return <EmptyNote>No active orders in the WIP window.</EmptyNote>

  return (
    <div>
      {STAGE_ORDER.map(stage => {
        const rows = byStage.get(stage) ?? []
        const totalQty = rows.reduce((s, r) => s + (r.orderQty ?? 0), 0)
        const widthPct = maxCount > 0 ? Math.round((rows.length / maxCount) * 100) : 0
        const isExpanded = expandedStage === stage
        const color = STAGE_COLOR[stage]

        return (
          <div key={stage} style={{ marginBottom: 6 }}>
            {/* Stage row — click to expand */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setExpandedStage(isExpanded ? null : stage)}
              onKeyDown={e => e.key === 'Enter' && setExpandedStage(isExpanded ? null : stage)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                background: isExpanded ? 'var(--kw-selected-bg, #e8f0fe)' : 'var(--kw-card-bg, #fafafa)',
                border: `1px solid ${isExpanded ? 'var(--kw-primary, #005eb8)' : 'var(--kw-border, #e8e8e8)'}`,
              }}
            >
              {/* CSS bar */}
              <div style={{ flex: '0 0 160px', position: 'relative', height: 10, background: 'var(--kw-border, #e8e8e8)', borderRadius: 5 }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${widthPct}%`, background: color, borderRadius: 5 }} />
              </div>
              <div style={{ flex: '0 0 70px', fontWeight: 700, fontSize: 13, color }}>
                {rows.length} <span style={{ fontWeight: 400, color: 'var(--kw-text-muted, #888)', fontSize: 11 }}>orders</span>
              </div>
              <div style={{ flex: 1, fontSize: 13 }}>{STAGE_LABEL[stage]}</div>
              {totalQty > 0 && (
                <div style={{ fontSize: 11, color: 'var(--kw-text-muted, #888)' }}>
                  {totalQty.toLocaleString(undefined, { maximumFractionDigits: 0 })} total qty
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--kw-text-muted, #888)' }}>{isExpanded ? '▲' : '▼'}</div>
            </div>

            {/* Expanded order list */}
            {isExpanded && rows.length > 0 && (
              <div style={{ marginTop: 4, marginLeft: 12, maxHeight: 260, overflowY: 'auto' }}>
                {rows.map(r => (
                  <div
                    key={r.orderId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 8px', fontSize: 12, borderBottom: '1px solid var(--kw-border, #e8e8e8)',
                    }}
                  >
                    <span className="kw-mono" style={{ fontWeight: 700, minWidth: 90 }}>{r.orderId}</span>
                    <span style={{ flex: 1, color: 'var(--kw-text-secondary, #444)' }}>
                      {r.materialName ?? r.materialCode ?? '—'}
                    </span>
                    <span style={{ color: 'var(--kw-text-muted, #888)', minWidth: 60 }}>
                      {formatQty(r.orderQty, r.uom)}
                    </span>
                    <span style={{ color: 'var(--kw-text-muted, #888)', minWidth: 70 }}>
                      {formatDate(r.scheduledFinishDate)}
                    </span>
                    {onOpenProcessOrder && (
                      <button
                        type="button"
                        className="kw-viewnav-tab"
                        style={{ fontSize: 11, padding: '2px 6px' }}
                        onClick={e => { e.stopPropagation(); onOpenProcessOrder(r.orderId) }}
                      >
                        Order
                      </button>
                    )}
                    {onOpenJourney && (
                      <button
                        type="button"
                        className="kw-viewnav-tab"
                        style={{ fontSize: 11, padding: '2px 6px' }}
                        onClick={e => { e.stopPropagation(); onOpenJourney(r.orderId) }}
                      >
                        Journey
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Schedule S-curve card ─────────────────────────────────────────────────────

const WEEKS_TO_SHOW = 8  // weeks of data to display in the S-curve

interface SCurveProps {
  readonly items: WmScheduleAdherenceDailyItem[]
  readonly maxActual: string | null
  readonly isLoading: boolean
  readonly error: string | null
}

function SCurveChart({ items, maxActual, isLoading, error }: SCurveProps) {
  // items is already the visible (windowed) slice — sorted ascending by the parent.
  const visible = items

  // Scale bars against the tallest column across BOTH planned and completed so that
  // a day where completedCount > plannedCount does not overflow 100%.
  const maxVal = useMemo(
    () => Math.max(...visible.flatMap(r => [r.plannedCount, r.completedCount]), 1),
    [visible],
  )

  if (isLoading) return <LoadingRows rows={4} />
  if (error) return <EmptyNote>Could not load schedule adherence: {error}</EmptyNote>
  if (visible.length === 0) return <EmptyNote>No schedule adherence data for the selected range.</EmptyNote>

  // Adherence % for the visible window
  const totalPlanned = visible.reduce((s, r) => s + r.plannedCount, 0)
  const totalOnTime = visible.reduce((s, r) => s + r.onTimeCount, 0)
  const adherencePct = totalPlanned > 0 ? Math.round((totalOnTime / totalPlanned) * 100) : null

  return (
    <div>
      {adherencePct != null && (
        <div style={{ marginBottom: 10, fontSize: 13 }}>
          <span className="kw-eyebrow">Adherence ({WEEKS_TO_SHOW}w window)</span>{' '}
          <strong style={{ fontSize: 15, color: adherencePct >= 80 ? 'var(--kw-success, #007a33)' : 'var(--kw-warning, #e07b00)' }}>
            {adherencePct}%
          </strong>
          {' '}on-time completion
          {maxActual && (
            <span style={{ marginLeft: 8, color: 'var(--kw-text-muted, #888)', fontSize: 11 }}>
              anchored to {formatDate(maxActual)}
            </span>
          )}
        </div>
      )}
      {/* Bar chart: ghost bars = planned, solid bars = completed, colour = on-time */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120, overflowX: 'auto' }}>
        {visible.map(row => {
          const plannedH = maxVal > 0 ? Math.round((row.plannedCount / maxVal) * 100) : 0
          const completedH = maxVal > 0 ? Math.round((row.completedCount / maxVal) * 100) : 0
          const onTimeFrac = row.completedCount > 0 ? row.onTimeCount / row.completedCount : 0
          const barColor = onTimeFrac >= 0.8
            ? 'var(--kw-success, #007a33)'
            : onTimeFrac >= 0.5
              ? 'var(--kw-warning, #e07b00)'
              : 'var(--kw-error, #c00)'
          return (
            <div key={row.scheduledDate} title={`${row.scheduledDate}: ${row.plannedCount} planned, ${row.completedCount} completed, ${row.onTimeCount} on-time`}
              style={{ flex: '0 0 12px', position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end' }}>
              {/* Ghost bar: planned */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, width: '100%',
                height: `${plannedH}%`, background: 'var(--kw-border, #d4d9e0)', borderRadius: '2px 2px 0 0',
              }} />
              {/* Solid bar: completed, coloured by adherence */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, width: '100%',
                height: `${completedH}%`, background: barColor, borderRadius: '2px 2px 0 0', opacity: 0.85,
              }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--kw-text-muted, #888)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 12, height: 8, background: 'var(--kw-border, #d4d9e0)', borderRadius: 2 }} /> Planned
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 12, height: 8, background: 'var(--kw-success, #007a33)', borderRadius: 2, opacity: 0.85 }} /> Completed on-time
        </span>
      </div>
    </div>
  )
}

// ── Root-cause breakdown + late-order list ────────────────────────────────────

const ROOT_CAUSE_ORDER: WmAdherenceRootCauseClass[] = [
  'LATE_RELEASE', 'MATERIAL_SHORT', 'CAPACITY', 'UNCLASSIFIED',
]

const ROOT_CAUSE_LABEL: Record<WmAdherenceRootCauseClass, string> = {
  LATE_RELEASE: 'Late release',
  MATERIAL_SHORT: 'Material short',
  CAPACITY: 'Capacity',
  UNCLASSIFIED: 'Unclassified',
}

const ROOT_CAUSE_COLOR: Record<WmAdherenceRootCauseClass, string> = {
  LATE_RELEASE: 'var(--kw-warning, #e07b00)',
  MATERIAL_SHORT: 'var(--kw-error, #c00)',
  CAPACITY: 'var(--kw-primary, #005eb8)',
  UNCLASSIFIED: 'var(--kw-text-muted, #888)',
}

function RootCauseChip({ cause }: { readonly cause: WmAdherenceRootCauseClass }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 6px',
      borderRadius: 4, color: '#fff', background: ROOT_CAUSE_COLOR[cause],
    }}>
      {ROOT_CAUSE_LABEL[cause]}
    </span>
  )
}

interface RootCausePanelProps {
  readonly items: WmAdherenceRootCauseItem[]
  readonly cutoff: string | null
  readonly isLoading: boolean
  readonly error: string | null
  readonly onOpenJourney?: (orderId: string) => void
}

function RootCausePanel({ items, cutoff, isLoading, error, onOpenJourney }: RootCausePanelProps) {
  const { counts, lateOrders } = useMemo(() => {
    const misses = items.filter(r => {
      if (!(r.isFinishLate || r.isOpenLate)) return false
      if (cutoff && r.scheduledFinishDate && r.scheduledFinishDate < cutoff) return false
      return true
    })
    const byClass = new Map<WmAdherenceRootCauseClass, number>()
    for (const c of ROOT_CAUSE_ORDER) byClass.set(c, 0)
    for (const r of misses) {
      byClass.set(r.rootCauseClass, (byClass.get(r.rootCauseClass) ?? 0) + 1)
    }
    const sorted = [...misses].sort((a, b) =>
      (b.scheduledFinishDate ?? '').localeCompare(a.scheduledFinishDate ?? ''),
    )
    return { counts: byClass, lateOrders: sorted }
  }, [items, cutoff])

  if (isLoading) return <LoadingRows rows={4} />
  if (error) return <EmptyNote>Could not load root-cause data: {error}</EmptyNote>
  if (lateOrders.length === 0) return <EmptyNote>No adherence misses in the {WEEKS_TO_SHOW}-week window.</EmptyNote>

  const total = [...counts.values()].reduce((s, n) => s + n, 0)

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {ROOT_CAUSE_ORDER.map(cause => {
          const n = counts.get(cause) ?? 0
          const pct = total > 0 ? Math.round((n / total) * 100) : 0
          return (
            <div key={cause} style={{
              flex: '1 1 100px', padding: '8px 10px', borderRadius: 6,
              border: '1px solid var(--kw-border, #e8e8e8)',
              background: 'var(--kw-card-bg, #fafafa)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--kw-text-muted, #888)' }}>{ROOT_CAUSE_LABEL[cause]}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{n}</div>
              <div style={{ fontSize: 10, color: 'var(--kw-text-muted, #888)' }}>{pct}%</div>
            </div>
          )
        })}
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {lateOrders.map(r => (
          <div key={r.orderId} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px',
            fontSize: 12, borderBottom: '1px solid var(--kw-border, #e8e8e8)',
          }}>
            <span className="kw-mono" style={{ fontWeight: 700, minWidth: 90 }}>{r.orderId}</span>
            <RootCauseChip cause={r.rootCauseClass} />
            <span style={{ flex: 1, color: 'var(--kw-text-secondary, #444)' }}>
              {r.materialName ?? r.materialId ?? '—'}
            </span>
            <span style={{ color: 'var(--kw-text-muted, #888)', minWidth: 70 }}>
              {formatDate(r.scheduledFinishDate)}
            </span>
            {onOpenJourney && (
              <button
                type="button"
                className="kw-viewnav-tab"
                style={{ fontSize: 11, padding: '2px 6px' }}
                onClick={() => onOpenJourney(r.orderId)}
              >
                Journey
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── KPI strip ─────────────────────────────────────────────────────────────────

function ProductionProgressKpiStrip({
  wipItems,
  visibleAdherence,
}: {
  readonly wipItems: WmWipStageItem[]
  readonly visibleAdherence: WmScheduleAdherenceDailyItem[]
}) {
  const ordersInWip = wipItems.length

  const pastStagedCount = wipItems.filter(
    r => r.stage === 'IN_PRODUCTION' || r.stage === 'GR_PARTIAL' || r.stage === 'GR_COMPLETE',
  ).length
  const pastStagedPct = ordersInWip > 0 ? Math.round((pastStagedCount / ordersInWip) * 100) : null

  const totalPlanned = visibleAdherence.reduce((s, r) => s + r.plannedCount, 0)
  const totalOnTime = visibleAdherence.reduce((s, r) => s + r.onTimeCount, 0)
  const adherencePct = totalPlanned > 0 ? Math.round((totalOnTime / totalPlanned) * 100) : null

  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
      <KpiTile label="Orders in WIP" value={ordersInWip} tone="none" />
      <KpiTile
        label="% Past Staged"
        value={pastStagedPct != null ? `${pastStagedPct}%` : '—'}
        tone={pastStagedPct != null && pastStagedPct >= 50 ? 'ok' : 'none'}
      />
      <KpiTile
        label="Adherence %"
        value={adherencePct != null ? `${adherencePct}%` : '—'}
        tone={adherencePct != null && adherencePct >= 80 ? 'ok' : adherencePct != null ? 'warn' : 'none'}
      />
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export interface ProductionProgressViewProps {
  readonly request: WmOperationsAdapterRequest
  readonly onOpenProcessOrder?: (orderId: string) => void
  readonly onNavigateToView?: (viewId: string) => void
}

export function ProductionProgressView({
  request,
  onOpenProcessOrder,
  onNavigateToView,
}: ProductionProgressViewProps) {
  const wipResult = useWmWipStages(request.plantId, 500, Boolean(request.plantId))
  const adherenceResult = useWmScheduleAdherenceDaily(request.plantId, Boolean(request.plantId))
  const rootCauseResult = useWmAdherenceRootCause(request.plantId, 500, Boolean(request.plantId))

  const wipItems: WmWipStageItem[] = wipResult.data?.ok ? wipResult.data.data : []
  const adherenceItems: WmScheduleAdherenceDailyItem[] = adherenceResult.data?.ok ? adherenceResult.data.data : []
  const rootCauseItems: WmAdherenceRootCauseItem[] = rootCauseResult.data?.ok ? rootCauseResult.data.data : []

  const wipError = wipResult.data && !wipResult.data.ok ? wipResult.data.error.message : null
  const adherenceError = adherenceResult.data && !adherenceResult.data.ok ? adherenceResult.data.error.message : null
  const rootCauseError = rootCauseResult.data && !rootCauseResult.data.ok ? rootCauseResult.data.error.message : null

  // Compute the shared 8-week window here so both the KPI strip and the S-curve chart
  // show the same adherence figure (rather than the strip showing all-time vs the chart
  // showing the rolling window).
  const maxActual = useMemo(() => {
    const dates = adherenceItems.map(r => r.maxActualDate).filter(Boolean) as string[]
    return dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null
  }, [adherenceItems])

  const adherenceCutoff = useMemo(() => {
    if (!maxActual) return null
    const d = new Date(maxActual)
    d.setDate(d.getDate() - WEEKS_TO_SHOW * 7)
    return d.toISOString().slice(0, 10)
  }, [maxActual])

  const visibleAdherence = useMemo(() => {
    const sorted = [...adherenceItems].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    if (!adherenceCutoff) return sorted
    return sorted.filter(r => r.scheduledDate >= adherenceCutoff)
  }, [adherenceItems, adherenceCutoff])

  function handleOpenJourney(orderId: string) {
    if (!onNavigateToView) return
    setOrderJourneyDeepLink({ plantId: request.plantId ?? undefined, orderId })
    onNavigateToView('order-journey')
  }

  if (!request.plantId) {
    return (
      <section>
        <ViewHeader eyebrow="Insight" title="Production Progress" subtitle="Select a plant to view WIP funnel and schedule adherence." />
        <EmptyNote>No plant selected.</EmptyNote>
      </section>
    )
  }

  return (
    <section>
      <ViewHeader
        eyebrow="Insight"
        title="Production Progress"
        subtitle="WIP funnel by stage and schedule adherence S-curve for active process orders."
      />

      <ProductionProgressKpiStrip wipItems={wipItems} visibleAdherence={visibleAdherence} />

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* WIP Funnel card */}
        <div className="kw-card" style={{ flex: '1 1 340px', minWidth: 280 }}>
          <div className="kw-card-title" style={{ marginBottom: 12 }}>WIP Funnel</div>
          <WipFunnel
            items={wipItems}
            isLoading={wipResult.isLoading}
            error={wipError}
            onOpenProcessOrder={onOpenProcessOrder}
            onOpenJourney={onNavigateToView ? handleOpenJourney : undefined}
          />
        </div>

        {/* Schedule adherence S-curve card */}
        <div className="kw-card" style={{ flex: '1 1 340px', minWidth: 280 }}>
          <div className="kw-card-title" style={{ marginBottom: 12 }}>Schedule Adherence</div>
          <SCurveChart
            items={visibleAdherence}
            maxActual={maxActual}
            isLoading={adherenceResult.isLoading}
            error={adherenceError}
          />
        </div>
      </div>

      <div className="kw-card" style={{ marginTop: 20 }}>
        <div className="kw-card-title" style={{ marginBottom: 12 }}>
          Adherence Miss Root Cause ({WEEKS_TO_SHOW}w window)
        </div>
        <RootCausePanel
          items={rootCauseItems}
          cutoff={adherenceCutoff}
          isLoading={rootCauseResult.isLoading}
          error={rootCauseError}
          onOpenJourney={onNavigateToView ? handleOpenJourney : undefined}
        />
      </div>
    </section>
  )
}
