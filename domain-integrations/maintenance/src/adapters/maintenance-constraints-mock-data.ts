import type { MaintenanceConstraint } from '@connectio/data-contracts'

export const mockMaintenanceConstraints: MaintenanceConstraint[] = [
  {
    constraintId: 'MC-20260515-001',
    assetId: 'ASSET-PRESS-L04-01',
    assetName: 'Block Press Unit 1 — Line 4',
    lineId: 'L-04',
    workOrderId: 'WO-20260515-007',
    constraintType: 'breakdown',
    severity: 'high',
    expectedResolutionAt: '2026-05-15T10:00:00.000Z',
    affectedOrders: ['4500837291', '4500837299'],
    status: 'in-progress',
  },
  {
    constraintId: 'MC-20260515-002',
    assetId: 'ASSET-COOL-L02-01',
    assetName: 'Brine Cooler Unit 1 — Line 2',
    lineId: 'L-02',
    workOrderId: 'WO-20260515-008',
    constraintType: 'planned-pm',
    severity: 'medium',
    expectedResolutionAt: '2026-05-15T14:00:00.000Z',
    affectedOrders: ['4500837295'],
    status: 'scheduled',
  },
]
