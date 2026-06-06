import { describe, it, expect } from 'vitest'
import {
  TraceInvestigationContextSchema,
  BatchHeaderSummarySchema,
  TraceNodeSchema,
  TraceEdgeSchema,
  TraceGraphSchema,
  MassBalanceSummarySchema,
  CustomerExposureSummarySchema,
  SupplierExposureSummarySchema,
  TraceEventSchema,
  CoAReleaseStatusSchema,
  TraceRiskSignalSchema,
  RelatedInvestigationSchema,
} from './trace-investigation.js'

// ---------------------------------------------------------------------------
// TraceInvestigationContext
// ---------------------------------------------------------------------------

describe('TraceInvestigationContextSchema', () => {
  const valid = {
    investigationId: 'INV-2024-003847',
    status: 'in-progress',
    severity: 'high',
    materialId: '100023847',
    materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
    batchId: 'CH-240308-0047',
    plantId: 'IE10',
    plantName: 'Kerry Listowel',
    initiatedBy: 'quality.lead@kerry.com',
    initiatedAt: '2024-03-08T09:15:00.000Z',
    lastUpdatedAt: '2024-03-08T14:42:00.000Z',
  }

  it('accepts a minimal valid context', () => {
    expect(TraceInvestigationContextSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts a context with optional fields', () => {
    const result = TraceInvestigationContextSchema.safeParse({
      ...valid,
      processOrderId: 'PO-240308-1189',
      scope: { plantId: 'IE10', batchId: 'CH-240308-0047' },
      activeView: 'overview',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown status', () => {
    expect(
      TraceInvestigationContextSchema.safeParse({ ...valid, status: 'archived' }).success,
    ).toBe(false)
  })

  it('rejects an unknown severity', () => {
    expect(
      TraceInvestigationContextSchema.safeParse({ ...valid, severity: 'urgent' }).success,
    ).toBe(false)
  })

  it('rejects a non-datetime initiatedAt', () => {
    expect(
      TraceInvestigationContextSchema.safeParse({ ...valid, initiatedAt: '2024-03-08' }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// BatchHeaderSummary
// ---------------------------------------------------------------------------

describe('BatchHeaderSummarySchema', () => {
  const valid = {
    materialId: '100023847',
    materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
    batchId: 'CH-240308-0047',
    plantId: 'IE10',
    plantName: 'Kerry Listowel',
    batchStatus: 'blocked',
    stockStatus: 'quality-inspection',
    qualityStatus: 'pending',
    releaseStatus: 'blocked',
  }

  it('accepts a minimal valid batch header', () => {
    expect(BatchHeaderSummarySchema.safeParse(valid).success).toBe(true)
  })

  it('accepts optional quantity, uom, dates', () => {
    const result = BatchHeaderSummarySchema.safeParse({
      ...valid,
      quantity: 2400,
      uom: 'KG',
      manufactureDate: '2024-03-08T00:00:00.000Z',
      expiryDate: '2024-09-08T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown batchStatus', () => {
    expect(BatchHeaderSummarySchema.safeParse({ ...valid, batchStatus: 'expired' }).success).toBe(false)
  })

  it('rejects an unknown releaseStatus', () => {
    expect(
      BatchHeaderSummarySchema.safeParse({ ...valid, releaseStatus: 'conditional' }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// TraceNode
// ---------------------------------------------------------------------------

describe('TraceNodeSchema', () => {
  const valid = {
    id: 'n1',
    type: 'finished-good',
    materialId: '100023847',
    materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
  }

  it('accepts a minimal valid node', () => {
    expect(TraceNodeSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects an unknown node type', () => {
    expect(TraceNodeSchema.safeParse({ ...valid, type: 'byproduct' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// TraceEdge
// ---------------------------------------------------------------------------

describe('TraceEdgeSchema', () => {
  const valid = {
    id: 'e1',
    source: 'n2',
    target: 'n1',
    relationshipType: 'component-of',
  }

  it('accepts a minimal valid edge', () => {
    expect(TraceEdgeSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects an unknown relationshipType', () => {
    expect(TraceEdgeSchema.safeParse({ ...valid, relationshipType: 'derived-from' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// TraceGraph
// ---------------------------------------------------------------------------

describe('TraceGraphSchema', () => {
  const valid = {
    nodes: [],
    edges: [],
    direction: 'both',
    depth: 3,
    rootBatch: 'CH-240308-0047',
    upstreamCount: 4,
    downstreamCount: 7,
    unresolvedNodeCount: 2,
  }

  it('accepts a valid trace graph', () => {
    expect(TraceGraphSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a negative depth', () => {
    expect(TraceGraphSchema.safeParse({ ...valid, depth: -1 }).success).toBe(false)
  })

  it('rejects an unknown direction', () => {
    expect(TraceGraphSchema.safeParse({ ...valid, direction: 'sideways' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// MassBalanceSummary
// ---------------------------------------------------------------------------

describe('MassBalanceSummarySchema', () => {
  const valid = {
    inputQuantity: 24002.4,
    outputQuantity: 2400.0,
    varianceQuantity: 21602.4,
    variancePercent: 10.0,
    uom: 'KG',
    confidence: 0.94,
    unresolvedMovements: 1,
  }

  it('accepts a valid mass balance', () => {
    expect(MassBalanceSummarySchema.safeParse(valid).success).toBe(true)
  })

  it('rejects confidence > 1', () => {
    expect(MassBalanceSummarySchema.safeParse({ ...valid, confidence: 1.5 }).success).toBe(false)
  })

  it('rejects negative unresolvedMovements', () => {
    expect(MassBalanceSummarySchema.safeParse({ ...valid, unresolvedMovements: -1 }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CustomerExposureSummary
// ---------------------------------------------------------------------------

describe('CustomerExposureSummarySchema', () => {
  const valid = {
    affectedCustomers: 3,
    affectedDeliveries: 5,
    shippedQuantity: 1400,
    countries: ['IE', 'GB', 'DE'],
    highestSeverity: 'critical',
    blockedDeliveries: 2,
    recallRecommended: true,
  }

  it('accepts a valid customer exposure', () => {
    expect(CustomerExposureSummarySchema.safeParse(valid).success).toBe(true)
  })

  it('rejects negative affectedCustomers', () => {
    expect(
      CustomerExposureSummarySchema.safeParse({ ...valid, affectedCustomers: -1 }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SupplierExposureSummary
// ---------------------------------------------------------------------------

describe('SupplierExposureSummarySchema', () => {
  const valid = {
    supplierCount: 2,
    supplierLots: 3,
    upstreamMaterials: 3,
    openSupplierActions: 1,
  }

  it('accepts a minimal valid supplier exposure', () => {
    expect(SupplierExposureSummarySchema.safeParse(valid).success).toBe(true)
  })

  it('accepts optional highestRiskSupplier', () => {
    const result = SupplierExposureSummarySchema.safeParse({
      ...valid,
      highestRiskSupplier: 'Golden Vale Dairy Co-op',
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// TraceEvent
// ---------------------------------------------------------------------------

describe('TraceEventSchema', () => {
  const valid = {
    eventId: 'evt-001',
    timestamp: '2024-03-08T09:15:00.000Z',
    type: 'investigation-opened',
    title: 'Investigation opened',
    sourceSystem: 'ConnectIO-RAD V2',
  }

  it('accepts a minimal valid event', () => {
    expect(TraceEventSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects an unknown event type', () => {
    expect(TraceEventSchema.safeParse({ ...valid, type: 'batch-split' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CoAReleaseStatus
// ---------------------------------------------------------------------------

describe('CoAReleaseStatusSchema', () => {
  const valid = {
    coaAvailable: true,
    releaseStatus: 'blocked',
    usageDecision: 'reject',
    openQualityLots: 1,
    failedCharacteristics: 0,
    pendingResults: 2,
  }

  it('accepts a valid CoA release status', () => {
    expect(CoAReleaseStatusSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects an unknown releaseStatus', () => {
    expect(CoAReleaseStatusSchema.safeParse({ ...valid, releaseStatus: 'partial' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// TraceRiskSignal
// ---------------------------------------------------------------------------

describe('TraceRiskSignalSchema', () => {
  const valid = {
    signalId: 'sig-001',
    title: 'Environmental Lm signal',
    description: 'Listeria detected in zone ZN-RIPEN-04',
    severity: 'critical',
    source: 'EnvMon',
    confidence: 0.92,
  }

  it('accepts a valid risk signal', () => {
    expect(TraceRiskSignalSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects confidence out of range', () => {
    expect(TraceRiskSignalSchema.safeParse({ ...valid, confidence: 1.1 }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// RelatedInvestigation
// ---------------------------------------------------------------------------

describe('RelatedInvestigationSchema', () => {
  const valid = {
    investigationId: 'INV-2024-003801',
    title: 'Environmental Lm cluster — Listowel Q1 2024',
    status: 'in-progress',
    severity: 'high',
    relatedBy: 'same-plant',
    openedAt: '2024-02-14T08:00:00.000Z',
  }

  it('accepts a minimal valid related investigation', () => {
    expect(RelatedInvestigationSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts optional owner', () => {
    const result = RelatedInvestigationSchema.safeParse({ ...valid, owner: 'micro.analyst@kerry.com' })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown relatedBy type', () => {
    expect(RelatedInvestigationSchema.safeParse({ ...valid, relatedBy: 'same-region' }).success).toBe(false)
  })
})
