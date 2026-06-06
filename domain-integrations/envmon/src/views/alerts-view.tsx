import type { CSSProperties } from 'react'
import { EnvMonAlertsPanel } from '../panels/envmon-alerts-panel.js'
import { EnvMonCorrectiveActionsPanel } from '../panels/envmon-corrective-actions-panel.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

export interface AlertsViewProps {
  readonly request: EnvMonAdapterRequest
}

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function AlertsView({ request }: AlertsViewProps) {
  return (
    <div style={GRID}>
      <EnvMonAlertsPanel request={request} />
      <EnvMonCorrectiveActionsPanel request={request} />
    </div>
  )
}
