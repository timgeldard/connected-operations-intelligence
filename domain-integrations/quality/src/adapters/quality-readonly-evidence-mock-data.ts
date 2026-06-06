/**
 * Quality read-only evidence fixture scenarios.
 *
 * These fixtures are typed as AdapterResult<QualityEvidenceResponse> and are
 * used for:
 *   - Panel snapshot tests (source-truthfulness)
 *   - Storybook stories
 *   - Development/demo mode
 *
 * CRITICAL RULES FOR ALL FIXTURES:
 * - None may include "Released", "Approved", "Cleared", or "Can release"
 * - All mock fixtures carry source: 'mock'
 * - All fixtures include warnings arrays with source limitation text
 * - Missing usage decision is NOT treated as accepted/released
 * - No deviation evidence is NOT treated as no deviations
 * - CoA-like rows are NOT treated as official CoA approval
 * - MIC result valuation is NOT treated as batch release
 *
 * These fixtures do not represent real batch or inspection data.
 */

import type { QualityEvidenceResponse } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'

const MOCK_QUERIED_AT = '2026-05-21T09:15:00.000Z'
const MOCK_BATCH_ID = '0008602411'
const MOCK_MATERIAL_ID = '000000000070373871'
const MOCK_PLANT_ID = 'C113'
const MOCK_LOT_ID_1 = '000000123456'
const MOCK_LOT_ID_2 = '000000789012'

const BASE_REQUEST = {
  plantId: MOCK_PLANT_ID,
  materialId: MOCK_MATERIAL_ID,
  batchId: MOCK_BATCH_ID,
}

const UNIVERSAL_WARNINGS = [
  'No records returned from a source must not be interpreted as absence of exposure.',
  'Read-only Quality evidence. This panel does not authorise release, rejection, or SAP posting.',
  'Usage decision codes are displayed as source evidence only. A single batch-level release decision is not derived.',
]

// ---------------------------------------------------------------------------
// 1. pendingSourceVerificationFixture
// ---------------------------------------------------------------------------

/**
 * Source verification not yet run for this evidence section.
 * No inspection lot, MIC, usage-decision, CoA, or deviation data is returned.
 */
export const pendingSourceVerificationFixture: AdapterResult<QualityEvidenceResponse> = {
  ok: true,
  fetchedAt: MOCK_QUERIED_AT,
  source: 'mock',
  data: {
    request: BASE_REQUEST,
    summary: {
      source: 'mock',
      status: 'pending-source-verification',
      evidenceState: 'pending-source-verification',
      sourceStatus: 'verification-not-run',
      inspectionLotCount: 0,
      micResultCount: 0,
      usageDecisionStatus: 'source-unverified',
      coaResultCount: 0,
      unavailableEvidence: [
        'inspection-lots',
        'mic-results',
        'usage-decision',
        'coa-results',
        'deviations',
      ],
      warnings: [
        'Broad Quality Databricks source verification pack has not been completed.',
        'Source objects, schema, grain, and join keys for inspection-lot, MIC, CoA-like, and deviation evidence are not yet verified.',
        'Missing usage-decision evidence must not be interpreted as accepted or released.',
        'No-record sections must not be interpreted as proof of absence until source coverage is validated.',
        'CoA-like result evidence is not official CoA document approval.',
        ...UNIVERSAL_WARNINGS,
      ],
      queriedAt: MOCK_QUERIED_AT,
      sourceFreshnessStatus: 'not-verified',
    },
    inspectionLots: [],
    micResults: [],
    usageDecision: null,
    coaResults: [],
  },
}

// ---------------------------------------------------------------------------
// 2. sourceVerifiedNotWiredFixture
// ---------------------------------------------------------------------------

/**
 * Usage-decision source verified (schema/grain/codes confirmed 2026-05-21)
 * but the FastAPI proxy route and adapter are not yet live.
 * Evidence shown here is fixture/simulation only.
 */
export const sourceVerifiedNotWiredFixture: AdapterResult<QualityEvidenceResponse> = {
  ok: true,
  fetchedAt: MOCK_QUERIED_AT,
  source: 'mock',
  data: {
    request: BASE_REQUEST,
    summary: {
      source: 'mock',
      status: 'pending-source-verification',
      evidenceState: 'source-verified-not-wired',
      sourceStatus:
        'gold_inspection_usage_decision verified (schema/grain/codes 2026-05-21); route not live',
      inspectionLotCount: 0,
      micResultCount: 0,
      usageDecisionStatus: 'source-unverified',
      coaResultCount: 0,
      unavailableEvidence: ['inspection-lots', 'mic-results', 'coa-results', 'deviations'],
      warnings: [
        'Usage-decision source object (gold_inspection_usage_decision) schema, grain, and 9 codes verified (2026-05-21). Runtime route is not yet implemented.',
        'Evidence displayed here is fixture/simulation only. It does not represent real batch data.',
        'Lot-selection rule for multiple lots per batch must be confirmed before runtime wiring (TRACE-P1-012).',
        ...UNIVERSAL_WARNINGS,
      ],
      queriedAt: MOCK_QUERIED_AT,
      sourceFreshnessStatus: 'not-verified',
    },
    inspectionLots: [],
    micResults: [],
    usageDecision: null,
    coaResults: [],
  },
}

// ---------------------------------------------------------------------------
// 3. singleLotAcceptedStyleFixture
// ---------------------------------------------------------------------------

/**
 * One inspection lot found. Usage-decision code A returned.
 * Governed label: "Accepted — source UD label only".
 * This is read-only source evidence; it does not constitute a release decision.
 */
export const singleLotAcceptedStyleFixture: AdapterResult<QualityEvidenceResponse> = {
  ok: true,
  fetchedAt: MOCK_QUERIED_AT,
  source: 'mock',
  data: {
    request: BASE_REQUEST,
    summary: {
      source: 'mock',
      status: 'mock',
      evidenceState: 'loaded',
      sourceStatus: 'fixture-only',
      inspectionLotCount: 1,
      lotCount: 1,
      micResultCount: 2,
      usageDecisionStatus: 'source-present',
      coaResultCount: 0,
      unavailableEvidence: ['coa-results', 'deviations'],
      warnings: [
        'Usage decision code A — governed label "Accepted — source UD label only" applied. This is a source evidence label, not a release decision.',
        'Read-only source evidence is not a release authority. Release must be performed in SAP QM.',
        ...UNIVERSAL_WARNINGS,
      ],
      queriedAt: MOCK_QUERIED_AT,
      sourceFreshnessStatus: 'unknown',
    },
    inspectionLots: [
      {
        inspectionLotId: MOCK_LOT_ID_1,
        inspectionType: '04',
        inspectionLotStatus: 'TECO',
        materialId: MOCK_MATERIAL_ID,
        batchId: MOCK_BATCH_ID,
        plantId: MOCK_PLANT_ID,
        processOrderId: '7006965038',
        createdAt: '2026-05-10T06:00:00.000Z',
        startedAt: '2026-05-10T06:00:00.000Z',
        completedAt: '2026-05-18T14:00:00.000Z',
        source: 'mock',
        usageDecisionCode: 'A',
        usageDecisionText: 'Freigabe Produktionsauftrag',
        usageDecisionMappingStatus: 'source-only',
        usageDecisionCreatedAt: '2026-05-18T14:30:00.000Z',
      },
    ],
    micResults: [
      {
        micId: 'MIC-001',
        micCode: 'MOIST',
        micName: 'Moisture Content',
        characteristicId: 'CHAR-001',
        resultValue: 4.2,
        resultText: null,
        resultUnit: '%',
        lowerSpecificationLimit: 2.0,
        upperSpecificationLimit: 6.0,
        targetValue: 4.0,
        toleranceText: '2.0 - 6.0 %',
        valuationCode: 'A',
        valuationText: 'Accepted',
        resultStatus: 'pass',
        sampleId: 'SAMP-001',
        sampleDate: '2026-05-12T08:00:00.000Z',
        resultDate: '2026-05-12T10:00:00.000Z',
        method: 'Karl Fischer',
        source: 'mock',
      },
      {
        micId: 'MIC-002',
        micCode: 'PROTEIN',
        micName: 'Protein Content',
        characteristicId: 'CHAR-002',
        resultValue: 18.5,
        resultText: null,
        resultUnit: '%',
        lowerSpecificationLimit: 16.0,
        upperSpecificationLimit: 22.0,
        targetValue: 19.0,
        toleranceText: '16.0 - 22.0 %',
        valuationCode: 'A',
        valuationText: 'Accepted',
        resultStatus: 'pass',
        sampleId: 'SAMP-001',
        sampleDate: '2026-05-12T08:00:00.000Z',
        resultDate: '2026-05-12T10:30:00.000Z',
        method: 'Kjeldahl',
        source: 'mock',
      },
    ],
    usageDecision: {
      usageDecisionCode: 'A',
      usageDecisionText: 'Freigabe Produktionsauftrag',
      valuationCode: 'A',
      qualityScore: null,
      createdBy: null,
      createdAt: '2026-05-18T14:30:00.000Z',
      source: 'mock',
      mappingStatus: 'source-only',
    },
    coaResults: [],
  },
}

// ---------------------------------------------------------------------------
// 4. singleLotRejectedStyleFixture
// ---------------------------------------------------------------------------

/**
 * One inspection lot found. Usage-decision code R returned.
 * Governed label: "Rejected — source UD label only".
 * Read-only evidence only — this does not constitute a release-block action in V2.
 */
export const singleLotRejectedStyleFixture: AdapterResult<QualityEvidenceResponse> = {
  ok: true,
  fetchedAt: MOCK_QUERIED_AT,
  source: 'mock',
  data: {
    request: BASE_REQUEST,
    summary: {
      source: 'mock',
      status: 'mock',
      evidenceState: 'loaded',
      sourceStatus: 'fixture-only',
      inspectionLotCount: 1,
      lotCount: 1,
      micResultCount: 1,
      usageDecisionStatus: 'source-present',
      coaResultCount: 0,
      unavailableEvidence: ['coa-results', 'deviations'],
      warnings: [
        'Usage decision code R — governed label "Rejected — source UD label only" applied. This is a source evidence label, not an active SAP reject action.',
        'Read-only source evidence only. No SAP QM write-back, rejection posting, or stock block has been applied from V2.',
        ...UNIVERSAL_WARNINGS,
      ],
      queriedAt: MOCK_QUERIED_AT,
      sourceFreshnessStatus: 'unknown',
    },
    inspectionLots: [
      {
        inspectionLotId: MOCK_LOT_ID_1,
        inspectionType: '04',
        inspectionLotStatus: 'TECO',
        materialId: MOCK_MATERIAL_ID,
        batchId: MOCK_BATCH_ID,
        plantId: MOCK_PLANT_ID,
        processOrderId: '7006965038',
        createdAt: '2026-05-10T06:00:00.000Z',
        startedAt: '2026-05-10T06:00:00.000Z',
        completedAt: '2026-05-18T14:00:00.000Z',
        source: 'mock',
        usageDecisionCode: 'R',
        usageDecisionText: 'Ablehnung — Spezifikationsabweichung',
        usageDecisionMappingStatus: 'source-only',
        usageDecisionCreatedAt: '2026-05-18T15:00:00.000Z',
      },
    ],
    micResults: [
      {
        micId: 'MIC-001',
        micCode: 'MOIST',
        micName: 'Moisture Content',
        characteristicId: 'CHAR-001',
        resultValue: 8.9,
        resultText: null,
        resultUnit: '%',
        lowerSpecificationLimit: 2.0,
        upperSpecificationLimit: 6.0,
        targetValue: 4.0,
        toleranceText: '2.0 - 6.0 %',
        valuationCode: 'R',
        valuationText: null,
        resultStatus: 'fail',
        sampleId: 'SAMP-002',
        sampleDate: '2026-05-12T08:00:00.000Z',
        resultDate: '2026-05-12T10:00:00.000Z',
        method: 'Karl Fischer',
        source: 'mock',
      },
    ],
    usageDecision: {
      usageDecisionCode: 'R',
      usageDecisionText: 'Ablehnung — Spezifikationsabweichung',
      valuationCode: 'R',
      qualityScore: null,
      createdBy: null,
      createdAt: '2026-05-18T15:00:00.000Z',
      source: 'mock',
      mappingStatus: 'source-only',
    },
    coaResults: [],
  },
}

// ---------------------------------------------------------------------------
// 5. singleLotPendingOpenFixture
// ---------------------------------------------------------------------------

/**
 * One inspection lot found. Usage-decision code is empty string ("").
 * Governed display: "Pending — lot open / no decision taken".
 * Stock may be in QI hold. No release decision has been taken.
 */
export const singleLotPendingOpenFixture: AdapterResult<QualityEvidenceResponse> = {
  ok: true,
  fetchedAt: MOCK_QUERIED_AT,
  source: 'mock',
  data: {
    request: BASE_REQUEST,
    summary: {
      source: 'mock',
      status: 'mock',
      evidenceState: 'loaded',
      sourceStatus: 'fixture-only',
      inspectionLotCount: 1,
      lotCount: 1,
      micResultCount: 0,
      usageDecisionStatus: 'source-present',
      coaResultCount: 0,
      unavailableEvidence: ['mic-results', 'coa-results', 'deviations'],
      warnings: [
        'Usage decision code is empty string — inspection lot is still open; stock may be in QI hold; no decision has been taken.',
        'An empty usage-decision code must not be interpreted as accepted, compliant, or no issue.',
        ...UNIVERSAL_WARNINGS,
      ],
      queriedAt: MOCK_QUERIED_AT,
      sourceFreshnessStatus: 'unknown',
    },
    inspectionLots: [
      {
        inspectionLotId: MOCK_LOT_ID_1,
        inspectionType: '04',
        inspectionLotStatus: 'REL',
        materialId: MOCK_MATERIAL_ID,
        batchId: MOCK_BATCH_ID,
        plantId: MOCK_PLANT_ID,
        processOrderId: '7006965038',
        createdAt: '2026-05-19T06:00:00.000Z',
        startedAt: '2026-05-19T06:00:00.000Z',
        completedAt: null,
        source: 'mock',
        usageDecisionCode: '',
        usageDecisionText: null,
        usageDecisionMappingStatus: 'source-only',
        usageDecisionCreatedAt: null,
      },
    ],
    micResults: [],
    usageDecision: {
      usageDecisionCode: '',
      usageDecisionText: null,
      valuationCode: '',
      qualityScore: null,
      createdBy: null,
      createdAt: null,
      source: 'mock',
      mappingStatus: 'source-only',
    },
    coaResults: [],
  },
}

// ---------------------------------------------------------------------------
// 6. multipleLotsFixture
// ---------------------------------------------------------------------------

/**
 * Two inspection lots found. Lot 1 has code A; Lot 2 has code "" (pending).
 * Multiple lots warning is shown. No batch-level decision is derived.
 * Lot-selection rule is not confirmed — runtime wiring is blocked (TRACE-P1-012).
 */
export const multipleLotsFixture: AdapterResult<QualityEvidenceResponse> = {
  ok: true,
  fetchedAt: MOCK_QUERIED_AT,
  source: 'mock',
  data: {
    request: BASE_REQUEST,
    summary: {
      source: 'mock',
      status: 'mock',
      evidenceState: 'multiple-lots',
      sourceStatus: 'fixture-only',
      inspectionLotCount: 2,
      lotCount: 2,
      micResultCount: 0,
      usageDecisionStatus: 'source-present',
      coaResultCount: 0,
      multipleLotsWarning:
        'Multiple inspection lots found. Per-lot usage decisions are shown individually. A batch-level release decision is not derived from individual lot decisions.',
      unavailableEvidence: ['mic-results', 'coa-results', 'deviations'],
      warnings: [
        'Multiple inspection lots found for this batch. A batch-level release decision is not derived.',
        'Per-lot usage decisions are displayed individually. Lot-selection rule is not confirmed (TRACE-P1-012).',
        'Lot 1 (000000123456): code A — governed label "Accepted — source UD label only".',
        'Lot 2 (000000789012): code "" — inspection lot open, no decision taken.',
        ...UNIVERSAL_WARNINGS,
      ],
      queriedAt: MOCK_QUERIED_AT,
      sourceFreshnessStatus: 'unknown',
    },
    inspectionLots: [
      {
        inspectionLotId: MOCK_LOT_ID_1,
        inspectionType: '04',
        inspectionLotStatus: 'TECO',
        materialId: MOCK_MATERIAL_ID,
        batchId: MOCK_BATCH_ID,
        plantId: MOCK_PLANT_ID,
        processOrderId: '7006965038',
        createdAt: '2026-05-10T06:00:00.000Z',
        startedAt: '2026-05-10T06:00:00.000Z',
        completedAt: '2026-05-18T14:00:00.000Z',
        source: 'mock',
        usageDecisionCode: 'A',
        usageDecisionText: 'Freigabe Produktionsauftrag',
        usageDecisionMappingStatus: 'source-only',
        usageDecisionCreatedAt: '2026-05-18T14:30:00.000Z',
      },
      {
        inspectionLotId: MOCK_LOT_ID_2,
        inspectionType: '89',
        inspectionLotStatus: 'REL',
        materialId: MOCK_MATERIAL_ID,
        batchId: MOCK_BATCH_ID,
        plantId: MOCK_PLANT_ID,
        processOrderId: null,
        createdAt: '2026-05-19T06:00:00.000Z',
        startedAt: '2026-05-19T06:00:00.000Z',
        completedAt: null,
        source: 'mock',
        usageDecisionCode: '',
        usageDecisionText: null,
        usageDecisionMappingStatus: 'source-only',
        usageDecisionCreatedAt: null,
      },
    ],
    micResults: [],
    usageDecision: {
      usageDecisionCode: 'A',
      usageDecisionText: 'Freigabe Produktionsauftrag',
      valuationCode: 'A',
      qualityScore: null,
      createdBy: null,
      createdAt: '2026-05-18T14:30:00.000Z',
      source: 'mock',
      mappingStatus: 'source-only',
    },
    coaResults: [],
  },
}

// ---------------------------------------------------------------------------
// 7. missingInspectionLotFixture
// ---------------------------------------------------------------------------

/**
 * No inspection lot found in the queried source.
 * This is a source gap, not confirmation of no inspection.
 */
export const missingInspectionLotFixture: AdapterResult<QualityEvidenceResponse> = {
  ok: true,
  fetchedAt: MOCK_QUERIED_AT,
  source: 'mock',
  data: {
    request: BASE_REQUEST,
    summary: {
      source: 'mock',
      status: 'no-records',
      evidenceState: 'no-records',
      sourceStatus: 'no-lot-returned',
      inspectionLotCount: 0,
      lotCount: 0,
      micResultCount: 0,
      usageDecisionStatus: 'not-found',
      coaResultCount: 0,
      missingLotWarning:
        'No inspection lot found. This is a source gap, not confirmation that no inspection was performed in SAP.',
      unavailableEvidence: ['inspection-lots', 'mic-results', 'usage-decision', 'coa-results', 'deviations'],
      warnings: [
        'No inspection lot found in the queried source. This is a source gap, not confirmation of no issue.',
        'Missing inspection lot must not be interpreted as accepted, released, or compliant.',
        'Missing usage-decision evidence must not be interpreted as accepted or released.',
        ...UNIVERSAL_WARNINGS,
      ],
      queriedAt: MOCK_QUERIED_AT,
      sourceFreshnessStatus: 'not-verified',
    },
    inspectionLots: [],
    micResults: [],
    usageDecision: null,
    coaResults: [],
  },
}

// ---------------------------------------------------------------------------
// 8. micPresentNoUsageDecisionFixture
// ---------------------------------------------------------------------------

/**
 * MIC rows are present but no usage-decision row was found.
 * MIC result valuation is not a release decision.
 * Missing usage decision must not be interpreted as accepted/released.
 */
export const micPresentNoUsageDecisionFixture: AdapterResult<QualityEvidenceResponse> = {
  ok: true,
  fetchedAt: MOCK_QUERIED_AT,
  source: 'mock',
  data: {
    request: BASE_REQUEST,
    summary: {
      source: 'mock',
      status: 'mock',
      evidenceState: 'partial-evidence',
      sourceStatus: 'fixture-only',
      inspectionLotCount: 1,
      lotCount: 1,
      micResultCount: 3,
      usageDecisionStatus: 'not-found',
      coaResultCount: 0,
      unavailableEvidence: ['usage-decision', 'coa-results', 'deviations'],
      warnings: [
        'MIC result evidence is present but no usage-decision record was found. Missing usage-decision must not be interpreted as accepted or released.',
        'MIC result valuation is not a release decision. Specification limits are not SPC control limits.',
        ...UNIVERSAL_WARNINGS,
      ],
      queriedAt: MOCK_QUERIED_AT,
      sourceFreshnessStatus: 'unknown',
    },
    inspectionLots: [
      {
        inspectionLotId: MOCK_LOT_ID_1,
        inspectionType: '04',
        inspectionLotStatus: 'REL',
        materialId: MOCK_MATERIAL_ID,
        batchId: MOCK_BATCH_ID,
        plantId: MOCK_PLANT_ID,
        processOrderId: '7006965038',
        createdAt: '2026-05-10T06:00:00.000Z',
        startedAt: '2026-05-10T06:00:00.000Z',
        completedAt: null,
        source: 'mock',
        usageDecisionCode: null,
        usageDecisionText: null,
        usageDecisionMappingStatus: null,
        usageDecisionCreatedAt: null,
      },
    ],
    micResults: [
      {
        micId: 'MIC-001',
        micCode: 'MOIST',
        micName: 'Moisture Content',
        characteristicId: 'CHAR-001',
        resultValue: 4.1,
        resultText: null,
        resultUnit: '%',
        lowerSpecificationLimit: 2.0,
        upperSpecificationLimit: 6.0,
        targetValue: 4.0,
        toleranceText: '2.0 - 6.0 %',
        valuationCode: 'A',
        valuationText: null,
        resultStatus: 'pass',
        sampleId: 'SAMP-001',
        sampleDate: '2026-05-12T08:00:00.000Z',
        resultDate: '2026-05-12T10:00:00.000Z',
        method: 'Karl Fischer',
        source: 'mock',
      },
      {
        micId: 'MIC-002',
        micCode: 'PROTEIN',
        micName: 'Protein Content',
        characteristicId: 'CHAR-002',
        resultValue: 18.8,
        resultText: null,
        resultUnit: '%',
        lowerSpecificationLimit: 16.0,
        upperSpecificationLimit: 22.0,
        targetValue: 19.0,
        toleranceText: '16.0 - 22.0 %',
        valuationCode: 'A',
        valuationText: null,
        resultStatus: 'pass',
        sampleId: 'SAMP-001',
        sampleDate: '2026-05-12T08:00:00.000Z',
        resultDate: '2026-05-12T10:30:00.000Z',
        method: 'Kjeldahl',
        source: 'mock',
      },
      {
        micId: 'MIC-003',
        micCode: 'FAT',
        micName: 'Fat Content',
        characteristicId: 'CHAR-003',
        resultValue: 5.2,
        resultText: null,
        resultUnit: '%',
        lowerSpecificationLimit: 3.0,
        upperSpecificationLimit: 8.0,
        targetValue: 5.0,
        toleranceText: '3.0 - 8.0 %',
        valuationCode: 'A',
        valuationText: null,
        resultStatus: 'pass',
        sampleId: 'SAMP-001',
        sampleDate: '2026-05-12T08:00:00.000Z',
        resultDate: '2026-05-12T11:00:00.000Z',
        method: 'Soxhlet',
        source: 'mock',
      },
    ],
    usageDecision: null,
    coaResults: [],
  },
}

// ---------------------------------------------------------------------------
// 9. coaLikeEvidenceFixture
// ---------------------------------------------------------------------------

/**
 * CoA-like result rows are present. Official CoA document approval is unavailable.
 * CoA-like result evidence is not official CoA document approval.
 */
export const coaLikeEvidenceFixture: AdapterResult<QualityEvidenceResponse> = {
  ok: true,
  fetchedAt: MOCK_QUERIED_AT,
  source: 'mock',
  data: {
    request: BASE_REQUEST,
    summary: {
      source: 'mock',
      status: 'mock',
      evidenceState: 'loaded',
      sourceStatus: 'fixture-only',
      inspectionLotCount: 1,
      lotCount: 1,
      micResultCount: 0,
      usageDecisionStatus: 'source-present',
      coaResultCount: 2,
      unavailableEvidence: ['mic-results', 'deviations'],
      warnings: [
        'CoA-like result evidence is not official CoA document approval. No controlled CoA document, sign-off, version, or PDF has been proven for this source.',
        'Official CoA document status remains unavailable.',
        ...UNIVERSAL_WARNINGS,
      ],
      queriedAt: MOCK_QUERIED_AT,
      sourceFreshnessStatus: 'unknown',
    },
    inspectionLots: [
      {
        inspectionLotId: MOCK_LOT_ID_1,
        inspectionType: '04',
        inspectionLotStatus: 'TECO',
        materialId: MOCK_MATERIAL_ID,
        batchId: MOCK_BATCH_ID,
        plantId: MOCK_PLANT_ID,
        processOrderId: '7006965038',
        createdAt: '2026-05-10T06:00:00.000Z',
        startedAt: '2026-05-10T06:00:00.000Z',
        completedAt: '2026-05-18T14:00:00.000Z',
        source: 'mock',
        usageDecisionCode: 'A',
        usageDecisionText: 'Freigabe Produktionsauftrag',
        usageDecisionMappingStatus: 'source-only',
        usageDecisionCreatedAt: '2026-05-18T14:30:00.000Z',
      },
    ],
    micResults: [],
    usageDecision: {
      usageDecisionCode: 'A',
      usageDecisionText: 'Freigabe Produktionsauftrag',
      valuationCode: 'A',
      qualityScore: null,
      createdBy: null,
      createdAt: '2026-05-18T14:30:00.000Z',
      source: 'mock',
      mappingStatus: 'source-only',
    },
    coaResults: [
      {
        micCode: 'MOIST',
        micName: 'Moisture Content',
        targetValue: 4.0,
        toleranceRange: '2.0 - 6.0',
        actualResult: 4.2,
        resultStatus: 'pass',
        withinSpec: 'Yes',
        deviationFromTarget: 0.2,
        source: 'mock',
        documentStatus: 'unavailable',
      },
      {
        micCode: 'PROTEIN',
        micName: 'Protein Content',
        targetValue: 19.0,
        toleranceRange: '16.0 - 22.0',
        actualResult: 18.5,
        resultStatus: 'pass',
        withinSpec: 'Yes',
        deviationFromTarget: -0.5,
        source: 'mock',
        documentStatus: 'unavailable',
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// 10. deviationSourceUnavailableFixture
// ---------------------------------------------------------------------------

/**
 * Deviation/notification source is unavailable.
 * Do not interpret this as no deviations — the source has not been proven.
 */
export const deviationSourceUnavailableFixture: AdapterResult<QualityEvidenceResponse> = {
  ok: true,
  fetchedAt: MOCK_QUERIED_AT,
  source: 'mock',
  data: {
    request: BASE_REQUEST,
    summary: {
      source: 'mock',
      status: 'mock',
      evidenceState: 'partial-evidence',
      sourceStatus: 'fixture-only',
      inspectionLotCount: 1,
      lotCount: 1,
      micResultCount: 2,
      usageDecisionStatus: 'source-present',
      coaResultCount: 0,
      unavailableEvidence: ['deviations', 'coa-results'],
      warnings: [
        'Deviation/notification source is unavailable. Do not interpret this as no deviations.',
        'No deviation or nonconformance source has been verified for V2. Missing deviation evidence is not proof of absence.',
        ...UNIVERSAL_WARNINGS,
      ],
      queriedAt: MOCK_QUERIED_AT,
      sourceFreshnessStatus: 'unknown',
    },
    inspectionLots: [
      {
        inspectionLotId: MOCK_LOT_ID_1,
        inspectionType: '04',
        inspectionLotStatus: 'TECO',
        materialId: MOCK_MATERIAL_ID,
        batchId: MOCK_BATCH_ID,
        plantId: MOCK_PLANT_ID,
        processOrderId: '7006965038',
        createdAt: '2026-05-10T06:00:00.000Z',
        startedAt: '2026-05-10T06:00:00.000Z',
        completedAt: '2026-05-18T14:00:00.000Z',
        source: 'mock',
        usageDecisionCode: 'A',
        usageDecisionText: 'Freigabe Produktionsauftrag',
        usageDecisionMappingStatus: 'source-only',
        usageDecisionCreatedAt: '2026-05-18T14:30:00.000Z',
      },
    ],
    micResults: [
      {
        micId: 'MIC-001',
        micCode: 'MOIST',
        micName: 'Moisture Content',
        characteristicId: 'CHAR-001',
        resultValue: 4.2,
        resultText: null,
        resultUnit: '%',
        lowerSpecificationLimit: 2.0,
        upperSpecificationLimit: 6.0,
        targetValue: 4.0,
        toleranceText: '2.0 - 6.0 %',
        valuationCode: 'A',
        valuationText: null,
        resultStatus: 'pass',
        sampleId: 'SAMP-001',
        sampleDate: '2026-05-12T08:00:00.000Z',
        resultDate: '2026-05-12T10:00:00.000Z',
        method: 'Karl Fischer',
        source: 'mock',
      },
      {
        micId: 'MIC-002',
        micCode: 'PROTEIN',
        micName: 'Protein Content',
        characteristicId: 'CHAR-002',
        resultValue: 18.8,
        resultText: null,
        resultUnit: '%',
        lowerSpecificationLimit: 16.0,
        upperSpecificationLimit: 22.0,
        targetValue: 19.0,
        toleranceText: '16.0 - 22.0 %',
        valuationCode: 'A',
        valuationText: null,
        resultStatus: 'pass',
        sampleId: 'SAMP-001',
        sampleDate: '2026-05-12T08:00:00.000Z',
        resultDate: '2026-05-12T10:30:00.000Z',
        method: 'Kjeldahl',
        source: 'mock',
      },
    ],
    usageDecision: {
      usageDecisionCode: 'A',
      usageDecisionText: 'Freigabe Produktionsauftrag',
      valuationCode: 'A',
      qualityScore: null,
      createdBy: null,
      createdAt: '2026-05-18T14:30:00.000Z',
      source: 'mock',
      mappingStatus: 'source-only',
    },
    coaResults: [],
  },
}

// ---------------------------------------------------------------------------
// 11. sourceErrorFixture
// ---------------------------------------------------------------------------

/**
 * The adapter returned a non-OK result.
 * An error means the query failed, not that no quality evidence exists.
 */
export const sourceErrorFixture: AdapterResult<QualityEvidenceResponse> = {
  ok: false,
  displayState: 'error',
  error: {
    message:
      'Quality evidence could not be retrieved — simulated network error. This is not confirmation of no quality issue.',
    code: 'network',
    retryable: true,
  },
  source: 'mock',
}

// ---------------------------------------------------------------------------
// 12. simulatedReleasePanelFixture
// ---------------------------------------------------------------------------

/**
 * Release queue panel simulation mode.
 * No SAP QM write-back, e-signature, or GxP audit trail is active.
 * All release actions are demonstration-only.
 */
export const simulatedReleasePanelFixture: AdapterResult<QualityEvidenceResponse> = {
  ok: true,
  fetchedAt: MOCK_QUERIED_AT,
  source: 'mock',
  data: {
    request: BASE_REQUEST,
    summary: {
      source: 'mock',
      status: 'mock',
      evidenceState: 'simulated-release-only',
      sourceStatus: 'simulation',
      inspectionLotCount: 1,
      lotCount: 1,
      micResultCount: 2,
      usageDecisionStatus: 'source-present',
      coaResultCount: 0,
      unavailableEvidence: ['coa-results', 'deviations'],
      warnings: [
        'SIMULATED RELEASE PANEL — demonstration only. This panel does not authorise release, rejection, or any SAP posting.',
        'No SAP QM write-back has been implemented. All release actions are simulation-only.',
        'No e-signature, GxP audit trail, or 21 CFR Part 11 compliance is active.',
        'Do not use this panel for operational release decisions.',
        ...UNIVERSAL_WARNINGS,
      ],
      queriedAt: MOCK_QUERIED_AT,
      sourceFreshnessStatus: 'not-verified',
    },
    inspectionLots: [
      {
        inspectionLotId: MOCK_LOT_ID_1,
        inspectionType: '04',
        inspectionLotStatus: 'TECO',
        materialId: MOCK_MATERIAL_ID,
        batchId: MOCK_BATCH_ID,
        plantId: MOCK_PLANT_ID,
        processOrderId: '7006965038',
        createdAt: '2026-05-10T06:00:00.000Z',
        startedAt: '2026-05-10T06:00:00.000Z',
        completedAt: '2026-05-18T14:00:00.000Z',
        source: 'mock',
        usageDecisionCode: 'A',
        usageDecisionText: 'Freigabe Produktionsauftrag',
        usageDecisionMappingStatus: 'source-only',
        usageDecisionCreatedAt: '2026-05-18T14:30:00.000Z',
      },
    ],
    micResults: [
      {
        micId: 'MIC-001',
        micCode: 'MOIST',
        micName: 'Moisture Content',
        characteristicId: 'CHAR-001',
        resultValue: 4.2,
        resultText: null,
        resultUnit: '%',
        lowerSpecificationLimit: 2.0,
        upperSpecificationLimit: 6.0,
        targetValue: 4.0,
        toleranceText: '2.0 - 6.0 %',
        valuationCode: 'A',
        valuationText: null,
        resultStatus: 'pass',
        sampleId: 'SAMP-001',
        sampleDate: '2026-05-12T08:00:00.000Z',
        resultDate: '2026-05-12T10:00:00.000Z',
        method: 'Karl Fischer',
        source: 'mock',
      },
      {
        micId: 'MIC-002',
        micCode: 'PROTEIN',
        micName: 'Protein Content',
        characteristicId: 'CHAR-002',
        resultValue: 18.5,
        resultText: null,
        resultUnit: '%',
        lowerSpecificationLimit: 16.0,
        upperSpecificationLimit: 22.0,
        targetValue: 19.0,
        toleranceText: '16.0 - 22.0 %',
        valuationCode: 'A',
        valuationText: null,
        resultStatus: 'pass',
        sampleId: 'SAMP-001',
        sampleDate: '2026-05-12T08:00:00.000Z',
        resultDate: '2026-05-12T10:30:00.000Z',
        method: 'Kjeldahl',
        source: 'mock',
      },
    ],
    usageDecision: {
      usageDecisionCode: 'A',
      usageDecisionText: 'Freigabe Produktionsauftrag',
      valuationCode: 'A',
      qualityScore: null,
      createdBy: null,
      createdAt: '2026-05-18T14:30:00.000Z',
      source: 'mock',
      mappingStatus: 'source-only',
    },
    coaResults: [],
  },
}
