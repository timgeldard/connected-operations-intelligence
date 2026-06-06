import type { CSSProperties } from 'react'
import { EnvMonCorrectiveActionsPanel } from '../panels/envmon-corrective-actions-panel.js'
import { EnvMonAlertsPanel } from '../panels/envmon-alerts-panel.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

export interface CorrectiveActionsViewProps {
  readonly request: EnvMonAdapterRequest
}

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function CorrectiveActionsView({ request }: CorrectiveActionsViewProps) {
  return (
    <div style={GRID}>
      <EnvMonCorrectiveActionsPanel request={request} />
      <EnvMonAlertsPanel request={request} />
    </div>
  )
}
