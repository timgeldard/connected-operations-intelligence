import type { CSSProperties } from 'react'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'
import { PohGeniePilotPanel } from '../panels/poh-genie-pilot-panel.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(320px, 960px)',
  gap: 12,
  padding: 16,
  justifyContent: 'center',
}

export interface PohGeniePilotViewProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

export function PohGeniePilotView({ request }: PohGeniePilotViewProps) {
  return (
    <div style={GRID}>
      <PohGeniePilotPanel request={request} />
    </div>
  )
}
