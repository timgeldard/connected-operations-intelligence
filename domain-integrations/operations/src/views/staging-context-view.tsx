import type { CSSProperties } from 'react'
import { OrderStagingContextPanel } from '../panels/order-staging-context-panel.js'
import { OrderProgressPanel } from '../panels/order-progress-panel.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface StagingContextViewProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

export function StagingContextView({ request }: StagingContextViewProps) {
  return (
    <div style={GRID}>
      <OrderStagingContextPanel request={request} />
      <OrderProgressPanel request={request} />
    </div>
  )
}
