import type { CSSProperties } from 'react'
import { SPCAlarmHistoryPanel } from '../panels/spc-alarm-history-panel.js'
import { SPCRelatedBatchesPanel } from '../panels/spc-related-batches-panel.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'
import { SPCSandboxBanner } from './chart-overview-view.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  alignItems: 'start',
}

export interface AlarmHistoryViewProps {
  readonly request: SPCMonitoringAdapterRequest
}

export function AlarmHistoryView({ request }: AlarmHistoryViewProps) {
  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <SPCSandboxBanner />
      <div style={GRID}>
        <SPCAlarmHistoryPanel request={request} />
        <SPCRelatedBatchesPanel request={request} />
      </div>
    </div>
  )
}
