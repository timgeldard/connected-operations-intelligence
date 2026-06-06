import type { CSSProperties } from 'react'
import { OrderQualityContextPanel } from '../panels/order-quality-context-panel.js'
import { RelatedBatchContextPanel } from '../panels/related-batch-context-panel.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface QualityContextViewProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

export function QualityContextView({ request }: QualityContextViewProps) {
  return (
    <div style={GRID}>
      <OrderQualityContextPanel request={request} />
      <RelatedBatchContextPanel request={request} />
    </div>
  )
}
