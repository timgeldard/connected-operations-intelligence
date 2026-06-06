import { describe, expect, it } from 'vitest'

import {
  QualityCoaResultEvidenceSchema,
  QualityEvidenceRequestSchema,
  QualityEvidenceResponseSchema,
  QualityEvidenceSummarySchema,
  QualityMicResultEvidenceSchema,
  QualityUsageDecisionEvidenceSchema,
} from './quality-readonly-evidence.js'

const summary = {
  source: 'databricks-api',
  status: 'loaded',
  inspectionLotCount: 1,
  micResultCount: 2,
  usageDecisionStatus: 'source-present',
  coaResultCount: 1,
  unavailableEvidence: ['deviations'],
  warnings: [
    'Usage decision is source evidence only and is not mapped to release approval.',
  ],
  queriedAt: '2026-05-21T08:30:00.000Z',
  sourceFreshnessStatus: 'not-verified',
} as const

describe('Quality read-only evidence contracts', () => {
  it('accepts a request with source identifiers preserved as strings', () => {
    const parsed = QualityEvidenceRequestSchema.safeParse({
      plantId: 'C113',
      materialId: '000000000070373871',
      batchId: '0008602411',
      inspectionLotId: '000000123456',
      processOrderId: '7006965038',
      dateFrom: '2026-01-01',
      dateTo: '2026-05-21',
    })

    expect(parsed.success).toBe(true)
  })

  it('accepts nullable MIC result/specification evidence for future SPC alignment', () => {
    const parsed = QualityMicResultEvidenceSchema.safeParse({
      micId: '00000042',
      micCode: 'PH',
      micName: 'pH',
      characteristicId: 'MIC-00000042',
      resultValue: 4.2,
      resultText: null,
      resultUnit: 'pH',
      lowerSpecificationLimit: 4.0,
      upperSpecificationLimit: 4.5,
      targetValue: null,
      toleranceText: '4.0 - 4.5',
      valuationCode: 'A',
      valuationText: null,
      resultStatus: 'pass',
      sampleId: 'S-001',
      sampleDate: null,
      resultDate: '2026-05-21T08:00:00.000Z',
      method: 'SAP QM',
      source: 'databricks-api',
    })

    expect(parsed.success).toBe(true)
  })

  it('keeps usage decision evidence source-only unless mapping is verified', () => {
    const parsed = QualityUsageDecisionEvidenceSchema.safeParse({
      usageDecisionCode: 'A1',
      usageDecisionText: 'Accepted text from source',
      valuationCode: 'A',
      qualityScore: 98,
      createdBy: 'QUSER',
      createdAt: '2026-05-21T08:00:00.000Z',
      source: 'databricks-api',
      mappingStatus: 'source-only',
    })

    expect(parsed.success).toBe(true)
  })

  it('does not allow usage decision evidence to carry release approval fields', () => {
    const parsed = QualityUsageDecisionEvidenceSchema.safeParse({
      usageDecisionCode: 'A1',
      source: 'databricks-api',
      mappingStatus: 'source-only',
      releaseApproved: true,
    })

    expect(parsed.success).toBe(false)
  })

  it('keeps CoA result evidence separate from official document approval', () => {
    const parsed = QualityCoaResultEvidenceSchema.safeParse({
      micCode: 'MOISTURE',
      micName: 'Moisture',
      targetValue: 4.5,
      toleranceRange: '+/- 0.5',
      actualResult: 4.4,
      resultStatus: 'A',
      withinSpec: 'Within spec',
      deviationFromTarget: -0.1,
      source: 'databricks-api',
      documentStatus: 'unknown',
    })

    expect(parsed.success).toBe(true)
  })

  it('rejects official CoA approval states until a document source is proven', () => {
    const parsed = QualityCoaResultEvidenceSchema.safeParse({
      source: 'databricks-api',
      documentStatus: 'approved',
    })

    expect(parsed.success).toBe(false)
  })

  it('represents unavailable evidence without converting unknowns to zero-proof claims', () => {
    const parsed = QualityEvidenceSummarySchema.safeParse({
      ...summary,
      source: 'unavailable',
      status: 'pending-source-verification',
      inspectionLotCount: 0,
      micResultCount: 0,
      usageDecisionStatus: 'unavailable',
      coaResultCount: 0,
      unavailableEvidence: ['inspection-lots', 'mic-results', 'usage-decision', 'coa-results'],
      warnings: [
        'No records returned is not proof of absence.',
        'Missing usage decision must not be interpreted as accepted or released.',
      ],
    })

    expect(parsed.success).toBe(true)
  })

  it('rejects release decision fields on the response envelope', () => {
    const parsed = QualityEvidenceResponseSchema.safeParse({
      request: {
        plantId: 'C113',
        materialId: '70373871',
        batchId: 'BATCH-1',
      },
      summary,
      inspectionLots: [],
      micResults: [],
      usageDecision: null,
      coaResults: [],
      canRelease: true,
    })

    expect(parsed.success).toBe(false)
  })
})
