import { LineStatusPanel } from '../panels/line-status-panel.js'
import { YieldVariancePanel } from '../panels/yield-variance-panel.js'
import { ScheduleAdherencePanel } from '../panels/schedule-adherence-panel.js'
import { LateOrdersPanel } from '../panels/late-orders-panel.js'
// TODO: Move cross-domain panels to a shared UI package to resolve circularity

import { MaintenanceConstraintPanel } from '@connectio/di-maintenance'
import type { OperationsEvidenceAdapterRequest as OperationsPlanRiskAdapterRequest } from '@connectio/data-contracts'
import type { MaintenanceConstraintsAdapterRequest } from '@connectio/di-maintenance'

export interface LineResourceRiskViewProps {
  readonly opsRequest: OperationsPlanRiskAdapterRequest
  readonly maintenanceRequest: MaintenanceConstraintsAdapterRequest
}

const GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function LineResourceRiskView({
  opsRequest,
  maintenanceRequest,
}: LineResourceRiskViewProps) {
  return (
    <div style={GRID}>
      <LineStatusPanel request={opsRequest} />
      <MaintenanceConstraintPanel request={maintenanceRequest} />
      <YieldVariancePanel request={opsRequest} />
      <ScheduleAdherencePanel request={opsRequest} />
      <LateOrdersPanel request={opsRequest} />
    </div>
  )
}
