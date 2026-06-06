import { OperationsActionQueuePanel } from '../panels/operations-action-queue-panel.js'
// TODO: Move cross-domain panels to a shared UI package to resolve circularity
// eslint-disable-next-line @nx/enforce-module-boundaries
import { QualityBlockersPanel, ReleaseHoldImpactPanel } from '@connectio/di-quality'
import type {
  OperationsEvidenceAdapterRequest as OperationsPlanRiskAdapterRequest,
  QualityBlockersAdapterRequest,
} from '@connectio/data-contracts'

export interface QualityReleaseBlockersViewProps {
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

export function QualityReleaseBlockersView({ opsRequest, qualityRequest }: QualityReleaseBlockersViewProps) {
  return (
    <div style={GRID}>
      <QualityBlockersPanel request={qualityRequest} />
      <ReleaseHoldImpactPanel request={qualityRequest} />
      <OperationsActionQueuePanel request={opsRequest} />
    </div>
  )
}
