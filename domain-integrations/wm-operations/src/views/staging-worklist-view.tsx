import { useState } from 'react'
import type {
  WmOperationsAdapterRequest,
  WmWorkArea,
  WmWorklistStatus,
} from '../adapters/wm-operations-adapter.js'
import { useWmWorklist, useWmWorklistSummary } from '../adapters/wm-operations-queries.js'
import { ViewHeader, EmptyNote } from '../components/kerry.js'
import { WorklistTable } from '../panels/worklist-table.js'
import { OrderDetailOverlay } from '../components/overlays.js'
import { WorklistSummaryStrip } from '../panels/worklist-summary-strip.js'

export interface StagingWorklistViewProps {
  readonly request: WmOperationsAdapterRequest
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

export function StagingWorklistView({ request }: StagingWorklistViewProps) {
  const [workArea, setWorkArea] = useState<WmWorkArea | ''>('')
  const [status, setStatus] = useState<WmWorklistStatus | ''>('')
  const [queue, setQueue] = useState('')
  const [appliedQueue, setAppliedQueue] = useState('')
  const [drillOrder, setDrillOrder] = useState<{ plantId: string; orderId: string } | null>(null)

  const summaryResult = useWmWorklistSummary(request)
  const worklistResult = useWmWorklist({
    ...request,
    workArea: workArea || undefined,
    status: status || undefined,
    queue: appliedQueue || undefined,
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
            onChange={e => setWorkArea(e.target.value as WmWorkArea | '')}
          >
            {WORK_AREA_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={e => setStatus(e.target.value as WmWorklistStatus | '')}
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
            onBlur={() => setAppliedQueue(queue.trim())}
            onKeyDown={e => e.key === 'Enter' && setAppliedQueue(queue.trim())}
          />
        </div>
        {error ? (
          <EmptyNote>Could not load the worklist — {error.message}</EmptyNote>
        ) : (
          <WorklistTable
            items={items}
            isLoading={worklistResult.isLoading}
            onOrderClick={item => item.referenceId && setDrillOrder({ plantId: item.plantId, orderId: item.referenceId })}
          />
        )}
      </div>
      {drillOrder && (
        <OrderDetailOverlay
          plantId={drillOrder.plantId}
          orderId={drillOrder.orderId}
          onClose={() => setDrillOrder(null)}
        />
      )}
    </section>
  )
}
