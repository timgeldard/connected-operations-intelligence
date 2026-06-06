import type { CSSProperties } from 'react'
import { ProcessOrderHeaderPanel } from '../panels/process-order-header-panel.js'
import { OrderProgressPanel } from '../panels/order-progress-panel.js'
import { OrderQualityContextPanel } from '../panels/order-quality-context-panel.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface OrderOverviewViewProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

export function OrderOverviewView({ request }: OrderOverviewViewProps) {
  return (
    <div style={GRID}>
      <ProcessOrderHeaderPanel request={request} />
      <OrderProgressPanel request={request} />
      <OrderQualityContextPanel request={request} />
    </div>
  )
}
