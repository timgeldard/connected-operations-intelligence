import type { ProcessOrderReleaseEvidence } from '@connectio/data-contracts'

/** Mock process order release evidence — emmental batch, completed, conformant. */
export const mockProcessOrderEvidence: ProcessOrderReleaseEvidence = {
  processOrderId: 'PO-240308-3847',
  batchId: 'CH-240308-0047',
  orderStatus: 'completed',
  plannedQuantity: 5000,
  confirmedQuantity: 4870,
  uom: 'KG',
  yieldPercent: 97.4,
  plannedStart: '2024-03-08T00:00:00.000Z',
  actualStart: '2024-03-08T00:15:00.000Z',
  plannedEnd: '2024-03-08T08:00:00.000Z',
  actualEnd: '2024-03-08T07:45:00.000Z',
  conformanceStatus: 'non-conformant',
  openNCRCount: 1,
  criticalDeviationCount: 1,
  workCentreId: 'WC-IE10-CHEESE-01',
  lineId: 'LINE-IE10-A',
}
