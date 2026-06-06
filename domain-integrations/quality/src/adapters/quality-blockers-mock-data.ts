import type { QualityBlocker, ReleaseHoldImpact } from '@connectio/data-contracts'

export const mockQualityBlockers: QualityBlocker[] = [
  {
    blockerId: 'QB-20260515-001',
    type: 'release-hold',
    materialId: 'CHIP-VAR-001',
    materialDescription: 'Kerry Listowel Mature Cheddar 20kg Block',
    batchId: '2026-W20-A',
    processOrderId: '4500837291',
    inspectionLotId: 'IL-20260514-037',
    releaseCaseId: 'RC-2026-001847',
    severity: 'critical',
    description: 'Batch on quality hold — MIC retest for Listeria spp. Day 2 result outstanding. Release blocked until result received.',
    owner: 'quality.lead@kerry.com',
    dueAt: '2026-05-15T14:00:00.000Z',
    drillThroughTarget: 'quality-batch-release',
  },
  {
    blockerId: 'QB-20260515-002',
    type: 'spc-alarm',
    materialId: 'CHIP-RED-003',
    materialDescription: 'Kerry Red Cheddar 10kg Block',
    batchId: '2026-W20-C',
    processOrderId: '4500837302',
    severity: 'medium',
    description: 'SPC alarm — moisture content trending above +2σ on L-01 pasteurisation. 3 consecutive points outside control limit.',
    owner: 'quality.analyst@kerry.com',
    dueAt: '2026-05-15T09:00:00.000Z',
  },
  {
    blockerId: 'QB-20260515-003',
    type: 'deviation',
    materialId: 'CHIP-MLD-005',
    materialDescription: 'Kerry Listowel Mild Cheddar 20kg Block',
    batchId: '2026-W19-F',
    processOrderId: '4500837288',
    severity: 'low',
    description: 'Open deviation DEV-20260514-012 — minor pH excursion at pressing. Under investigation, does not block release.',
    owner: 'quality.analyst@kerry.com',
  },
]

export const mockReleaseHoldImpacts: ReleaseHoldImpact[] = [
  {
    holdId: 'HOLD-20260515-001',
    batchId: '2026-W20-A',
    materialId: 'CHIP-VAR-001',
    materialDescription: 'Kerry Listowel Mature Cheddar 20kg Block',
    plantId: 'IE10',
    blockedQuantity: 4920,
    affectedOrders: ['4500837291'],
    affectedDeliveries: ['DEL-20260517-001', 'DEL-20260518-003'],
    holdReason: 'MIC retest outstanding — Listeria spp. Day 2 result expected 14:00',
    releaseStatus: 'active',
    qualityOwner: 'quality.lead@kerry.com',
    severity: 'critical',
  },
]
