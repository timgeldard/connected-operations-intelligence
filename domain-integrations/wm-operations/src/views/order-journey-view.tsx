import { useEffect, useMemo, useState } from 'react'
import type { WmOperationsAdapterRequest, WmOrderJourneyEventItem, WmOrderJourneySummaryItem } from '../adapters/wm-operations-adapter.js'
import { useWmOrderJourney, useWmOrderJourneyEvents } from '../adapters/wm-operations-queries.js'
import { clearOrderJourneyDeepLink, peekOrderJourneyDeepLink } from '../state/deep-link.js'
import { EmptyNote, LoadingRows, ViewHeader, formatDate, formatTs } from '../components/kerry.js'

// ── Event type chips ──────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Created',
  RELEASED: 'Released',
  TR_CREATED: 'TR created',
  STAGING_CONFIRMED: 'Staged',
  PI_START: 'PI start',
  OPERATION_CONFIRMED: 'Op confirmed',
  PI_END: 'PI end',
  GR_POSTED: 'GR posted',
  COMPONENT_ISSUED: 'Issue',
  QM_LOT_CREATED: 'QM lot',
  QM_UD_TAKEN: 'UD taken',
}

const EVENT_COLOR: Record<string, string> = {
  ORDER_CREATED: 'var(--kw-text-muted, #888)',
  RELEASED: 'var(--kw-primary, #005eb8)',
  TR_CREATED: 'var(--kw-primary, #005eb8)',
  STAGING_CONFIRMED: 'var(--kw-success, #007a33)',
  PI_START: 'var(--kw-warning, #e07b00)',
  OPERATION_CONFIRMED: 'var(--kw-success, #007a33)',
  PI_END: 'var(--kw-success, #007a33)',
  GR_POSTED: 'var(--kw-success, #007a33)',
  COMPONENT_ISSUED: 'var(--kw-text-muted, #888)',
  QM_LOT_CREATED: 'var(--kw-warning, #e07b00)',
  QM_UD_TAKEN: 'var(--kw-primary, #005eb8)',
}

function EventChip({ type }: { readonly type: string }) {
  const label = EVENT_LABELS[type] ?? type
  const color = EVENT_COLOR[type] ?? 'var(--kw-text-muted, #888)'
  return (
    <span
      style={{
        display: 'inline-block', padding: '1px 7px', borderRadius: 10,
        border: `1px solid ${color}`, color, fontSize: 11, fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

// ── Milestone header ──────────────────────────────────────────────────────────

type Milestone = { label: string; value: string | null }

function formatLagHours(hours: number | null | undefined): string {
  if (hours == null) return '—'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  return `${hours.toFixed(1)}h`
}

function MilestoneHeader({ row }: { readonly row: WmOrderJourneySummaryItem }) {
  const milestones: Milestone[] = [
    { label: 'Created', value: formatDate(row.orderCreatedTs) },
    { label: 'Released', value: formatDate(row.releaseDate) },
    { label: 'Sched. start', value: formatDate(row.scheduledStartDate) },
    { label: 'First TR', value: formatTs(row.firstTrCreatedTs) },
    { label: 'Staged', value: formatTs(row.stagingLastConfirmedTs) },
    { label: 'Prod. start', value: formatTs(row.productionFirstActualStart) },
    { label: 'Prod. finish', value: row.productionLastActualFinish ? formatTs(row.productionLastActualFinish) : '—' },
    { label: 'GR posted', value: formatDate(row.firstGrPostingDate) },
  ]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
      {milestones.map(m => (
        <div key={m.label} style={{ minWidth: 90 }}>
          <div className="kw-eyebrow">{m.label}</div>
          <div className="kw-mono" style={{ fontSize: 12, fontWeight: 600 }}>{m.value ?? '—'}</div>
        </div>
      ))}
    </div>
  )
}

function LagStrip({ row }: { readonly row: WmOrderJourneySummaryItem }) {
  const lags = [
    { from: 'Release', to: 'First TR', value: row.releaseToFirstTrHours },
    { from: 'First TR', to: 'Staged', value: row.trToStagedHours },
    { from: 'Staged', to: 'Prod. start', value: row.stagedToProductionHours },
    { from: 'Prod. start', to: 'GR', value: row.productionToGrHours },
  ]
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
      {lags.map(l => (
        <div key={`${l.from}-${l.to}`} style={{ fontSize: 12 }}>
          <span style={{ color: 'var(--kw-text-muted, #888)' }}>{l.from} → {l.to}:</span>
          {' '}
          <span style={{ fontWeight: 600 }}>{formatLagHours(l.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Stage chips from summary row ──────────────────────────────────────────────

function StageChips({ row }: { readonly row: WmOrderJourneySummaryItem }) {
  const chips: string[] = []
  if (row.releaseDate) chips.push('Released')
  if (row.stagingLastConfirmedTs) chips.push('Staged')
  if (row.productionFirstActualStart) chips.push('In production')
  if (row.productionLastActualFinish) chips.push('Prod. done')
  if (row.firstGrPostingDate) chips.push('GR posted')
  if (chips.length === 0) chips.push('Created')
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {chips.map(c => (
        <span key={c} style={{
          display: 'inline-block', padding: '1px 6px', borderRadius: 8,
          background: 'var(--kw-chip-bg, #e8f0fe)',
          color: 'var(--kw-primary, #005eb8)',
          fontSize: 11, fontWeight: 600,
        }}>
          {c}
        </span>
      ))}
    </div>
  )
}

// ── Event timeline panel ──────────────────────────────────────────────────────

function EventTimeline({
  events,
  isLoading,
  error,
}: {
  readonly events: WmOrderJourneyEventItem[]
  readonly isLoading: boolean
  readonly error: string | null
}) {
  if (isLoading) return <LoadingRows rows={6} />
  if (error) return <EmptyNote>Could not load events: {error}</EmptyNote>
  if (events.length === 0) return <EmptyNote>No events found for this order.</EmptyNote>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {events.map(ev => (
        <div
          key={`${ev.eventSeq}-${ev.eventType}`}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '6px 0', borderBottom: '1px solid var(--kw-border, #e8e8e8)',
            fontSize: 12,
          }}
        >
          <div style={{ minWidth: 130, color: 'var(--kw-text-muted, #888)' }}>
            {formatTs(ev.eventTs) ?? '—'}
          </div>
          <EventChip type={ev.eventType} />
          {ev.qty != null && (
            <div className="kw-mono" style={{ minWidth: 70 }}>
              {ev.qty.toLocaleString(undefined, { maximumFractionDigits: 2 })}{ev.uom ? ` ${ev.uom}` : ''}
            </div>
          )}
          {ev.referenceId && (
            <div className="kw-mono" style={{ color: 'var(--kw-text-muted, #888)', minWidth: 80 }}>
              {ev.referenceId}
            </div>
          )}
          {ev.detail && (
            <div style={{ color: 'var(--kw-text-secondary, #555)', flex: 1 }}>
              {ev.detail}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export interface OrderJourneyViewProps {
  readonly request: WmOperationsAdapterRequest
  readonly onNavigateToView?: (viewId: string) => void
}

export function OrderJourneyView({ request }: OrderJourneyViewProps) {
  const [filter, setFilter] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [limit, setLimit] = useState(300)

  // Consume deep-link on mount (in effect — never in render)
  useEffect(() => {
    const link = peekOrderJourneyDeepLink()
    if (link?.orderId) {
      setSelectedOrderId(link.orderId)
    }
    clearOrderJourneyDeepLink()
  }, [])

  const summaryResult = useWmOrderJourney(
    { plantId: request.plantId, limit },
    Boolean(request.plantId),
  )
  const allRows: WmOrderJourneySummaryItem[] = summaryResult.data?.ok ? summaryResult.data.data : []
  const summaryError = summaryResult.data && !summaryResult.data.ok ? summaryResult.data.error.message : null

  const eventsResult = useWmOrderJourneyEvents(
    { plantId: request.plantId ?? '', orderId: selectedOrderId ?? '' },
    Boolean(request.plantId && selectedOrderId),
  )
  const events: WmOrderJourneyEventItem[] = eventsResult.data?.ok ? eventsResult.data.data : []
  const eventsError = eventsResult.data && !eventsResult.data.ok ? eventsResult.data.error.message : null

  const selectedRow = useMemo(
    () => allRows.find(r => r.orderId === selectedOrderId) ?? null,
    [allRows, selectedOrderId],
  )

  // Client-side filter over orderId, materialCode, materialName, productionLine
  const filterLower = filter.toLowerCase()
  const filteredRows = useMemo(() => {
    if (!filterLower) return allRows
    return allRows.filter(
      r =>
        r.orderId?.toLowerCase().includes(filterLower) ||
        r.materialCode?.toLowerCase().includes(filterLower) ||
        r.materialName?.toLowerCase().includes(filterLower) ||
        r.productionLine?.toLowerCase().includes(filterLower),
    )
  }, [allRows, filterLower])

  if (!request.plantId) {
    return (
      <section>
        <ViewHeader eyebrow="Order Journey" title="Select a plant" subtitle="Choose a plant in the scope bar to view order journeys." />
        <EmptyNote>No plant selected.</EmptyNote>
      </section>
    )
  }

  return (
    <section>
      <ViewHeader
        eyebrow="Execute"
        title="Order Journey"
        subtitle="Per-order milestone timeline — staging, production, and goods receipt across all process orders."
      />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Left: search + list */}
        <div style={{ flex: '0 0 380px', minWidth: 280 }}>
          <div style={{ marginBottom: 8 }}>
            <input
              type="search"
              placeholder="Filter by order, material, or line..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{
                width: '100%', padding: '6px 10px', border: '1px solid var(--kw-border, #ccc)',
                borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
              }}
            />
          </div>

          {summaryResult.isLoading && <LoadingRows rows={8} />}
          {summaryError && <EmptyNote>Could not load orders: {summaryError}</EmptyNote>}
          {!summaryResult.isLoading && !summaryError && filteredRows.length === 0 && (
            <EmptyNote>No orders found{filter ? ' for this filter' : ''}.</EmptyNote>
          )}

          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {filteredRows.map(row => (
              <div
                key={row.orderId}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedOrderId(row.orderId === selectedOrderId ? null : row.orderId)}
                onKeyDown={e => e.key === 'Enter' && setSelectedOrderId(row.orderId === selectedOrderId ? null : row.orderId)}
                style={{
                  padding: '8px 10px',
                  marginBottom: 4,
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: row.orderId === selectedOrderId
                    ? 'var(--kw-selected-bg, #e8f0fe)'
                    : 'var(--kw-card-bg, #fafafa)',
                  border: `1px solid ${row.orderId === selectedOrderId ? 'var(--kw-primary, #005eb8)' : 'var(--kw-border, #e8e8e8)'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span className="kw-mono" style={{ fontWeight: 700, fontSize: 13 }}>{row.orderId}</span>
                  <span style={{ fontSize: 11, color: 'var(--kw-text-muted, #888)' }}>
                    {formatDate(row.scheduledStartDate) ?? '—'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--kw-text-secondary, #444)', marginBottom: 4 }}>
                  {row.materialName ?? row.materialCode ?? '—'}
                  {row.productionLine && <span style={{ marginLeft: 8, color: 'var(--kw-text-muted, #888)' }}>{row.productionLine}</span>}
                </div>
                <StageChips row={row} />
              </div>
            ))}
          </div>

          {allRows.length >= limit && (
            <div style={{ marginTop: 8 }}>
              <button type="button" className="kw-viewnav-tab" onClick={() => setLimit(l => l + 300)}>
                Show more
              </button>
            </div>
          )}
        </div>

        {/* Right: selected order detail */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!selectedRow && (
            <EmptyNote>Select an order on the left to view its journey timeline.</EmptyNote>
          )}
          {selectedRow && (
            <div>
              <div className="kw-card" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div className="kw-eyebrow">Order</div>
                    <div className="kw-mono" style={{ fontSize: 18, fontWeight: 700 }}>{selectedRow.orderId}</div>
                    <div style={{ fontSize: 13, color: 'var(--kw-text-secondary, #444)', marginTop: 2 }}>
                      {selectedRow.materialName ?? selectedRow.materialCode ?? '—'}
                      {selectedRow.orderQty != null && (
                        <span style={{ marginLeft: 8 }}>
                          {selectedRow.orderQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} {selectedRow.uom ?? ''}
                        </span>
                      )}
                      {selectedRow.productionLine && (
                        <span style={{ marginLeft: 8, color: 'var(--kw-text-muted, #888)' }}>
                          {selectedRow.productionLine}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                    {selectedRow.qmLotCount != null && (
                      <div>
                        <div className="kw-eyebrow">QM lots</div>
                        <div style={{ fontWeight: 700 }}>
                          {selectedRow.qmOpenLotCount ?? 0} open / {selectedRow.qmLotCount}
                        </div>
                      </div>
                    )}
                    {selectedRow.deliveryCount != null && selectedRow.deliveryCount > 0 && (
                      <div>
                        <div className="kw-eyebrow">Deliveries</div>
                        <div style={{ fontWeight: 700 }}>{selectedRow.deliveryCount}</div>
                      </div>
                    )}
                  </div>
                </div>
                <MilestoneHeader row={selectedRow} />
                <LagStrip row={selectedRow} />
              </div>

              <div className="kw-card">
                <div className="kw-card-title" style={{ marginBottom: 10 }}>Event Timeline</div>
                <EventTimeline
                  events={events}
                  isLoading={eventsResult.isLoading}
                  error={eventsError}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
