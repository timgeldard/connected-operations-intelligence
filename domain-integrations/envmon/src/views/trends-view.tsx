import type { CSSProperties } from 'react'
import { EnvMonTrendsPanel } from '../panels/envmon-trends-panel.js'
import { EnvMonSiteSummaryPanel } from '../panels/envmon-site-summary-panel.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

export interface TrendsViewProps {
  readonly request: EnvMonAdapterRequest
}

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function TrendsView({ request }: TrendsViewProps) {
  return (
    <div style={GRID}>
      <EnvMonTrendsPanel request={request} />
      <EnvMonSiteSummaryPanel request={request} />
    </div>
  )
}
