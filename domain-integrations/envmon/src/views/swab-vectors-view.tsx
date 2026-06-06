import type { CSSProperties } from 'react'
import { EnvMonSwabVectorsPanel } from '../panels/envmon-swab-vectors-panel.js'
import { EnvMonSwabResultsPanel } from '../panels/envmon-swab-results-panel.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

export interface SwabVectorsViewProps {
  readonly request: EnvMonAdapterRequest
}

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function SwabVectorsView({ request }: SwabVectorsViewProps) {
  return (
    <div style={GRID}>
      <EnvMonSwabVectorsPanel request={request} />
      <EnvMonSwabResultsPanel request={request} />
    </div>
  )
}
