import { useEffect, useState } from 'react'
import type {
  WmOperationsAdapterRequest,
  WmWorkArea,
  WmWorklistStatus,
} from '../adapters/wm-operations-adapter.js'
import { useWmWorklist, useWmWorklistSummary } from '../adapters/wm-operations-queries.js'
import { ViewHeader, EmptyNote } from '../components/kerry.js'
import { WorklistTable } from '../panels/worklist-table.js'
import { OrderDetailOverlay } from '../components/overlays.js'
import { clearWorklistDeepLink, peekWorklistDeepLink } from '../state/deep-link.js'
import { WorklistSummaryStrip } from '../panels/worklist-summary-strip.js'

export interface StagingWorklistViewProps {
  readonly request: WmOperationsAdapterRequest
  readonly onOpenProcessOrder?: (orderId: string) => void
}

const WORK_AREA_OPTIONS: Array<{ value: WmWorkArea | ''; label: string }> = [
  { value: '', label: 'All work areas' },
  { value: 'PRODUCTION_STAGING', label: 'Production staging' },
  { value: 'DISPENSARY_REPLENISHMENT', label: 'Dispensary replenishment' },
  { value: 'DISPENSARY_PICKING', label: 'Dispensary picking' },
  { value: 'WAREHOUSE_OTHER', label: 'Other warehouse' },
]

const STATUS_OPTIONS: Array<{ value: WmWorklistStatus | ''; label: string }> = [
  { value: '', label: 'All open statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'PARKED', label: 'Parked' },
  { value: 'NO_STOCK', label: 'No stock' },
  { value: 'COMPLETE', label: 'Complete' },
]

const FILTER_STORE = 'wm-ops-worklist-filters'

function restoreFilters(): { workArea: string; status: string; queue: string; campaign: string } {
  try {
    return { workArea: '', status: '', queue: '', campaign: '', ...JSON.parse(localStorage.getItem(FILTER_STORE) ?? '{}') }
  } catch {
    return { workArea: '', status: '', queue: '', campaign: '' }
  }
}

export function StagingWorklistView({ request, onOpenProcessOrder }: StagingWorklistViewProps) {
  // Lazy initialisers: peek (no mutation) is render-safe; localStorage is read once per mount,
  // not on every render. The deep link is cleared in an effect AFTER the mount commits, so
  // concurrent/StrictMode re-renders cannot drop it.
  const [deepLink] = useState(peekWorklistDeepLink)
  const [saved] = useState(restoreFilters)
  useEffect(() => { clearWorklistDeepLink() }, [])
  const [workArea, setWorkArea] = useState<WmWorkArea | ''>(saved.workArea as WmWorkArea | '')
  const [status, setStatus] = useState<WmWorklistStatus | ''>(saved.status as WmWorklistStatus | '')
  const [queue, setQueue] = useState(saved.queue)
  const [appliedQueue, setAppliedQueue] = useState(saved.queue)
  const [campaign, setCampaign] = useState(saved.campaign)
  const [appliedCampaign, setAppliedCampaign] = useState(saved.campaign)
  const [limit, setLimit] = useState(200)
  const [reference, setReference] = useState(deepLink?.reference ?? '')
  // Filters persist across sessions (saved-preset behaviour, zero ceremony).
  const persist = (next: Partial<ReturnType<typeof restoreFilters>>) => {
    try { localStorage.setItem(FILTER_STORE, JSON.stringify({ workArea, status, queue: appliedQueue, campaign: appliedCampaign, ...next })) } catch { /* private mode */ }
  }
  const [drillOrder, setDrillOrder] = useState<{ plantId: string; orderId: string } | null>(null)

  const summaryResult = useWmWorklistSummary(request)
  const worklistResult = useWmWorklist({
    ...request,
    workArea: workArea || undefined,
    status: status || undefined,
    queue: appliedQueue || undefined,
    campaign: appliedCampaign || undefined,
    reference: reference || undefined,
    includeComplete: Boolean(reference),
    limit,
  })

  const summary = summaryResult.data?.ok ? summaryResult.data.data : []
  const items = worklistResult.data?.ok ? worklistResult.data.data : []
  const error = worklistResult.data && !worklistResult.data.ok ? worklistResult.data.error : null

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Live worklist"
        title="Staging & Picking"
        subtitle="Every open staging and picking job — who has it, where it stands, and what is stuck."
      />

      <WorklistSummaryStrip items={summary} />

      <div className="kw-card">
        <div className="kw-card-title">Job worklist</div>
        <div className="kw-filters">
          <select
            aria-label="Filter by work area"
            value={workArea}
            onChange={e => { setWorkArea(e.target.value as WmWorkArea | ''); persist({ workArea: e.target.value }) }}
          >
            {WORK_AREA_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={e => { setStatus(e.target.value as WmWorklistStatus | ''); persist({ status: e.target.value }) }}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            aria-label="Filter by queue"
            placeholder="Queue"
            value={queue}
            onChange={e => setQueue(e.target.value)}
            onBlur={() => { setAppliedQueue(queue.trim()); persist({ queue: queue.trim() }) }}
            onKeyDown={e => { if (e.key === 'Enter') { setAppliedQueue(queue.trim()); persist({ queue: queue.trim() }) } }}
          />
          <input
            aria-label="Filter by campaign"
            placeholder="Campaign"
            value={campaign}
            onChange={e => setCampaign(e.target.value)}
            onBlur={() => { setAppliedCampaign(campaign.trim()); persist({ campaign: campaign.trim() }) }}
            onKeyDown={e => { if (e.key === 'Enter') { setAppliedCampaign(campaign.trim()); persist({ campaign: campaign.trim() }) } }}
          />
        </div>
        {reference && (
          <div style={{ marginBottom: 8 }}>
            <span className="kw-chip kw-chip--open">Order {reference}</span>
            <button type="button" className="kw-link" style={{ marginLeft: 8 }} onClick={() => setReference('')}>clear</button>
          </div>
        )}
        {error ? (
          <EmptyNote>Could not load the worklist — {error.message}</EmptyNote>
        ) : (
          <WorklistTable
            items={items}
            isLoading={worklistResult.isLoading}
            onOrderClick={item => item.referenceId && setDrillOrder({ plantId: item.plantId, orderId: item.referenceId })}
          />
        )}
        {items.length >= limit && limit < 500 && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button type="button" className="kw-viewnav-tab" onClick={() => setLimit(500)}>
              Show more (up to 500)
            </button>
          </div>
        )}
      </div>
      {drillOrder && (
        <OrderDetailOverlay
          plantId={drillOrder.plantId}
          orderId={drillOrder.orderId}
          onClose={() => setDrillOrder(null)}
          onOpenProcessOrder={onOpenProcessOrder}
        />
      )}
    </section>
  )
}
