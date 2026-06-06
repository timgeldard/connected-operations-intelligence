import { ScheduleAdherencePanel } from '../panels/schedule-adherence-panel.js'
import { LateOrdersPanel } from '../panels/late-orders-panel.js'
import { YieldVariancePanel } from '../panels/yield-variance-panel.js'
import { MaterialShortagePanel } from '../panels/material-shortage-panel.js'
// TODO: Move cross-domain panels to a shared UI package to resolve circularity
// eslint-disable-next-line @nx/enforce-module-boundaries
import { QualityBlockersPanel } from '@connectio/di-quality'
import type {
  OperationsEvidenceAdapterRequest as OperationsPlanRiskAdapterRequest,
  QualityBlockersAdapterRequest,
} from '@connectio/data-contracts'

export interface ScheduleAdherenceViewProps {
  readonly opsRequest: OperationsPlanRiskAdapterRequest
  readonly qualityRequest: QualityBlockersAdapterRequest
}

const GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function ScheduleAdherenceView({ opsRequest, qualityRequest }: ScheduleAdherenceViewProps) {
  return (
    <div style={GRID}>
      <ScheduleAdherencePanel request={opsRequest} />
      <LateOrdersPanel request={opsRequest} />
      <YieldVariancePanel request={opsRequest} />
      <MaterialShortagePanel request={opsRequest} />
      <QualityBlockersPanel request={qualityRequest} />
    </div>
  )
}
