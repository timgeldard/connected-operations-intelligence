import type {
  TraceInvestigationContext,
  BatchHeaderSummary,
  TraceGraph,
  MassBalanceSummary,
  CustomerExposureSummary,
  SupplierExposureSummary,
  ProductionHistorySummary,
  TraceEvent,
  CoAReleaseStatus,
  TraceRiskSignal,
  RelatedInvestigation,
  TraceExposureForRelease,
} from '@connectio/data-contracts'

/**
 * Realistic mock data for Phase 1 Trace Investigation.
 *
 * Based on a fictional Emmental cheese batch manufactured at Kerry Ingredients
 * Listowel plant. All identifiers follow realistic SAP-style conventions.
 */

export const MOCK_INVESTIGATION_ID = 'INV-2024-003847'
export const MOCK_BATCH_ID = 'CH-240308-0047'
export const MOCK_MATERIAL_ID = '100023847'
export const MOCK_PLANT_ID = 'IE10'

export const mockInvestigationContext: TraceInvestigationContext = {
  investigationId: MOCK_INVESTIGATION_ID,
  status: 'in-progress',
  severity: 'high',
  materialId: MOCK_MATERIAL_ID,
  materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
  batchId: MOCK_BATCH_ID,
  plantId: MOCK_PLANT_ID,
  plantName: 'Kerry Listowel',
  processOrderId: 'PO-240308-1189',
  initiatedBy: 'quality.lead@kerry.com',
  initiatedAt: '2024-03-08T09:15:00.000Z',
  lastUpdatedAt: '2024-03-08T14:42:00.000Z',
  scope: {
    plantId: MOCK_PLANT_ID,
    batchId: MOCK_BATCH_ID,
    materialId: MOCK_MATERIAL_ID,
    processOrderId: 'PO-240308-1189',
  },
  activeView: 'overview',
}

export const mockBatchHeader: BatchHeaderSummary = {
  materialId: MOCK_MATERIAL_ID,
  materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
  batchId: MOCK_BATCH_ID,
  plantId: MOCK_PLANT_ID,
  plantName: 'Kerry Listowel',
  batchStatus: 'blocked',
  quantity: 2400,
  uom: 'KG',
  manufactureDate: '2024-03-08T00:00:00.000Z',
  expiryDate: '2024-09-08T00:00:00.000Z',
  processOrderId: 'PO-240308-1189',
  unrestricted: 0,
  blocked: 800,
  qualityInspection: 1600,
  restricted: 0,
  transit: 0,
  stockStatus: 'quality-inspection',
  qualityStatus: 'pending',
  releaseStatus: 'blocked',
}

export const mockTraceGraph: TraceGraph = {
  direction: 'both',
  depth: 3,
  rootBatch: MOCK_BATCH_ID,
  upstreamCount: 4,
  downstreamCount: 7,
  unresolvedNodeCount: 2,
  nodes: [
    {
      id: 'n1',
      type: 'finished-good',
      materialId: MOCK_MATERIAL_ID,
      materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
      batchId: MOCK_BATCH_ID,
      plantId: MOCK_PLANT_ID,
      quantity: 2400,
      uom: 'KG',
      status: 'resolved',
      riskLevel: 'high',
    },
    {
      id: 'n2',
      type: 'raw-material',
      materialId: '200047123',
      materialDescription: 'PASTEURISED WHOLE MILK IE GRADE A',
      batchId: 'MILK-240308-022',
      plantId: MOCK_PLANT_ID,
      quantity: 24000,
      uom: 'L',
      status: 'resolved',
      riskLevel: 'high',
    },
    {
      id: 'n3',
      type: 'raw-material',
      materialId: '200047456',
      materialDescription: 'CHEESE STARTER CULTURE DVS 3000',
      batchId: 'SC-240307-004',
      plantId: MOCK_PLANT_ID,
      quantity: 2.4,
      uom: 'KG',
      status: 'resolved',
      riskLevel: 'low',
    },
    {
      id: 'n4',
      type: 'supplier-lot',
      materialId: '200047123',
      materialDescription: 'PASTEURISED WHOLE MILK IE GRADE A',
      batchId: 'SL-GOLDEN-240308-019',
      quantity: 24000,
      uom: 'L',
      status: 'unresolved',
      riskLevel: 'high',
    },
    {
      id: 'n5',
      type: 'customer-delivery',
      materialId: MOCK_MATERIAL_ID,
      materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
      batchId: MOCK_BATCH_ID,
      quantity: 600,
      uom: 'KG',
      status: 'unresolved',
      riskLevel: 'critical',
    },
    {
      id: 'n6',
      type: 'customer-delivery',
      materialId: MOCK_MATERIAL_ID,
      materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
      batchId: MOCK_BATCH_ID,
      quantity: 800,
      uom: 'KG',
      status: 'resolved',
      riskLevel: 'medium',
    },
    {
      id: 'n7',
      type: 'process-order',
      materialId: MOCK_MATERIAL_ID,
      materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
      quantity: 2400,
      uom: 'KG',
      status: 'resolved',
      riskLevel: 'none',
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'n2',
      target: 'n1',
      relationshipType: 'component-of',
      quantity: 24000,
      uom: 'L',
      movementType: 'GI-261',
      documentReference: 'MAT-4500123456',
    },
    {
      id: 'e2',
      source: 'n3',
      target: 'n1',
      relationshipType: 'component-of',
      quantity: 2.4,
      uom: 'KG',
      movementType: 'GI-261',
      documentReference: 'MAT-4500123457',
    },
    {
      id: 'e3',
      source: 'n4',
      target: 'n2',
      relationshipType: 'produced-from',
      quantity: 24000,
      uom: 'L',
      documentReference: 'PO-MILK-240308',
    },
    {
      id: 'e4',
      source: 'n1',
      target: 'n5',
      relationshipType: 'delivered-to',
      quantity: 600,
      uom: 'KG',
      movementType: 'GD-601',
      documentReference: 'DO-4900089123',
    },
    {
      id: 'e5',
      source: 'n1',
      target: 'n6',
      relationshipType: 'delivered-to',
      quantity: 800,
      uom: 'KG',
      movementType: 'GD-601',
      documentReference: 'DO-4900089124',
    },
    {
      id: 'e6',
      source: 'n7',
      target: 'n1',
      relationshipType: 'produced-from',
      quantity: 2400,
      uom: 'KG',
      movementType: 'GR-101',
      documentReference: 'PO-240308-1189',
    },
  ],
}

export const mockMassBalance: MassBalanceSummary = {
  inputQuantity: 24002.4,
  outputQuantity: 2400.0,
  varianceQuantity: 21602.4,
  variancePercent: 10.0,
  uom: 'KG-equivalent',
  confidence: 0.94,
  unresolvedMovements: 1,
  movements: [
    {
      date: '2024-03-08',
      category: 'production',
      quantity: 2400,
      delta: 2400,
      runningBalance: 2400,
      uom: 'KG',
      reference: 'PO-240308-1189',
      movementType: 'GR-101',
    },
    {
      date: '2024-03-09',
      category: 'shipment',
      quantity: 800,
      delta: -800,
      runningBalance: 1600,
      uom: 'KG',
      reference: 'DO-4900089124',
      movementType: 'GD-601',
    },
    {
      date: '2024-03-10',
      category: 'shipment',
      quantity: 600,
      delta: -600,
      runningBalance: 1000,
      uom: 'KG',
      reference: 'DO-4900089123',
      movementType: 'GD-601',
    },
    {
      date: '2024-03-10',
      category: 'consumption',
      quantity: 0,
      delta: 0,
      runningBalance: 1000,
      uom: 'KG',
      reference: 'MAT-4500123456',
      movementType: 'GI-261',
    },
  ],
}

export const mockCustomerExposure: CustomerExposureSummary = {
  affectedCustomers: 3,
  affectedDeliveries: 5,
  shippedQuantity: 1400,
  countries: ['IE', 'GB', 'DE'],
  highestSeverity: 'critical',
  blockedDeliveries: 2,
  recallRecommended: true,
}

export const mockSupplierExposure: SupplierExposureSummary = {
  supplierCount: 2,
  supplierLots: 3,
  highestRiskSupplier: 'Golden Vale Dairy Co-op',
  upstreamMaterials: 3,
  openSupplierActions: 1,
}

export const mockProductionHistory: ProductionHistorySummary = {
  materialId: '100023847',
  totalBatches: 3,
  passCount: 2,
  failCount: 1,
  unknownCount: 0,
  rows: [
    {
      processOrderId: 'PO-240310-1190',
      batchId: 'CH-240310-0048',
      plantId: 'IE10',
      materialId: '100023847',
      postingDate: '2024-03-10',
      quantity: 2350,
      uom: 'KG',
      qualityStatus: 'pass',
    },
    {
      processOrderId: 'PO-240308-1189',
      batchId: 'CH-240308-0047',
      plantId: 'IE10',
      materialId: '100023847',
      postingDate: '2024-03-08',
      quantity: 2400,
      uom: 'KG',
      qualityStatus: 'fail',
    },
    {
      processOrderId: 'PO-240306-1187',
      batchId: 'CH-240306-0045',
      plantId: 'IE10',
      materialId: '100023847',
      postingDate: '2024-03-06',
      quantity: 2380,
      uom: 'KG',
      qualityStatus: 'pass',
    },
  ],
}

export const mockTraceEvents: TraceEvent[] = [
  {
    eventId: 'evt-001',
    timestamp: '2024-03-08T09:15:00.000Z',
    type: 'investigation-opened',
    title: 'Investigation opened — high severity',
    description:
      'Elevated Listeria monocytogenes environmental signal detected in ripening area. Batch CH-240308-0047 placed under investigation.',
    sourceSystem: 'ConnectIO-RAD V2',
    actor: 'quality.lead@kerry.com',
    severity: 'critical',
  },
  {
    eventId: 'evt-002',
    timestamp: '2024-03-08T09:18:00.000Z',
    type: 'batch-blocked',
    title: 'Batch blocked in SAP — usage decision set to blocked',
    description: 'SAP batch status updated to 04 (Blocked). Stock moved to quality-inspection.',
    sourceSystem: 'SAP ECC',
    actor: 'qm-system',
    severity: 'warning',
  },
  {
    eventId: 'evt-003',
    timestamp: '2024-03-08T09:45:00.000Z',
    type: 'evidence-added',
    title: 'Environmental monitoring report attached',
    description: 'EnvMon scan result report for zone ZN-RIPEN-04 attached as supporting evidence.',
    sourceSystem: 'EnvMon',
    actor: 'micro.analyst@kerry.com',
    severity: 'info',
  },
  {
    eventId: 'evt-004',
    timestamp: '2024-03-08T11:20:00.000Z',
    type: 'investigation-updated',
    title: 'Downstream deliveries identified',
    description:
      '5 deliveries identified. 600 KG to DE customer DO-4900089123 already in transit — delivery blocked at customs.',
    sourceSystem: 'Warehouse360',
    actor: 'warehouse.lead@kerry.com',
    severity: 'critical',
  },
  {
    eventId: 'evt-005',
    timestamp: '2024-03-08T12:30:00.000Z',
    type: 'quality-decision',
    title: 'Recall recommendation raised',
    description:
      'Risk assessment completed. Recall recommended for DO-4900089123 (DE). Investigation escalated to QA Director.',
    sourceSystem: 'ConnectIO-RAD V2',
    actor: 'qa.director@kerry.com',
    severity: 'critical',
  },
]

export const mockCoAReleaseStatus: CoAReleaseStatus = {
  coaAvailable: true,
  releaseStatus: 'blocked',
  usageDecision: 'reject',
  openQualityLots: 1,
  failedCharacteristics: 0,
  pendingResults: 2,
  lastDecisionAt: '2024-03-08T12:30:00.000Z',
}

export const mockRiskSignals: TraceRiskSignal[] = [
  {
    signalId: 'sig-001',
    title: 'Environmental Lm signal in ripening zone',
    description:
      'Listeria monocytogenes detected in environmental swab zone ZN-RIPEN-04 (Listowel). Organism risk decay model indicates sustained exposure risk above threshold.',
    severity: 'critical',
    source: 'EnvMon',
    confidence: 0.92,
    recommendedAction:
      'Immediately block all batches from affected ripening chamber. Initiate deep clean and root cause analysis.',
  },
  {
    signalId: 'sig-002',
    title: 'Unresolved supplier lot — raw milk traceability gap',
    description:
      'Supplier lot SL-GOLDEN-240308-019 (Golden Vale Dairy Co-op) has no confirmed CoA. Upstream traceability cannot be fully resolved.',
    severity: 'high',
    source: 'Trace2',
    confidence: 0.87,
    recommendedAction: 'Request supplier CoA and lot specification. Escalate to supplier quality team.',
  },
  {
    signalId: 'sig-003',
    title: 'Customer delivery in transit — recall exposure',
    description:
      'Delivery DO-4900089123 (600 KG to DE customer) is in transit. Customer has not yet received or stored product. Recall window is open.',
    severity: 'critical',
    source: 'Warehouse360',
    confidence: 0.98,
    recommendedAction:
      'Issue recall notification to DE customer. Contact logistics provider to halt delivery at customs.',
  },
]

export const mockRelatedInvestigations: RelatedInvestigation[] = [
  {
    investigationId: 'INV-2024-003801',
    title: 'Environmental Lm cluster — Listowel ripening zones Q1 2024',
    status: 'in-progress',
    severity: 'high',
    relatedBy: 'same-plant',
    openedAt: '2024-02-14T08:00:00.000Z',
    owner: 'micro.analyst@kerry.com',
  },
  {
    investigationId: 'INV-2024-003712',
    title: 'Golden Vale Dairy raw milk quality incident — Feb 2024',
    status: 'resolved',
    severity: 'medium',
    relatedBy: 'same-supplier',
    openedAt: '2024-02-01T10:30:00.000Z',
    owner: 'supplier.quality@kerry.com',
  },
]

/** Trace exposure summary oriented for a batch release decision. */
export const mockTraceExposureForRelease: TraceExposureForRelease = {
  batchId: MOCK_BATCH_ID,
  releaseCaseId: 'RC-2024-001847',
  upstreamRiskLevel: 'high',
  downstreamRiskLevel: 'critical',
  affectedCustomerCount: 3,
  affectedSupplierLotCount: 1,
  openTraceInvestigations: [
    {
      investigationId: MOCK_INVESTIGATION_ID,
      status: 'in-progress',
      severity: 'high',
      summary: 'Listeria monocytogenes — environmental signal and MIC failure linked to batch CH-240308-0047',
    },
  ],
  recallRiskFlag: true,
  traceReadiness: 'blocked',
  lastEvaluatedAt: '2024-03-08T10:30:00.000Z',
}
