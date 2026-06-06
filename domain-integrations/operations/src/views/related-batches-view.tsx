import type { CSSProperties } from 'react'
import { RelatedBatchContextPanel } from '../panels/related-batch-context-panel.js'
import { OrderQualityContextPanel } from '../panels/order-quality-context-panel.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface RelatedBatchesViewProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

export function RelatedBatchesView({ request }: RelatedBatchesViewProps) {
  return (
    <div style={GRID}>
      <RelatedBatchContextPanel request={request} />
      <OrderQualityContextPanel request={request} />
    </div>
  )
}
