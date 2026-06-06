import type { WarehouseHoldStatus } from '@connectio/data-contracts'

/** Mock warehouse hold status — blocked batch on quality hold. */
export const mockWarehouseHoldStatus: WarehouseHoldStatus = {
  batchId: 'CH-240308-0047',
  materialId: 'CH-EMMENTAL-IE',
  plantId: 'IE10',
  storageLocationId: 'SL-IE10-COLD-02',
  stockType: 'quality-inspection',
  totalQuantity: 4870,
  blockedQuantity: 4870,
  restrictedQuantity: 0,
  unrestrictedQuantity: 0,
  uom: 'KG',
  activeHolds: [
    {
      holdId: 'HOLD-2024-00312',
      holdType: 'quality',
      reason: 'MIC failure — Listeria monocytogenes detected above limit. Batch quarantined pending investigation.',
      placedBy: 'Dr. Aoife Murphy (Quality Lead)',
      placedAt: '2024-03-08T08:00:00.000Z',
      expiresAt: undefined,
      status: 'active',
    },
    {
      holdId: 'HOLD-2024-00313',
      holdType: 'trace',
      reason: 'Batch linked to open trace investigation INV-2024-003847. Hold pending investigation closure.',
      placedBy: 'Trace Investigation System',
      placedAt: '2024-03-08T09:15:00.000Z',
      expiresAt: undefined,
      status: 'active',
    },
  ],
  hasBlockingHold: true,
  lastUpdatedAt: '2024-03-08T10:00:00.000Z',
}
