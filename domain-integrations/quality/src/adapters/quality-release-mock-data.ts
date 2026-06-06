import type {
  BatchReleaseContext,
  BatchReleaseQueueItem,
  BatchReleaseSummary,
  QualityResultsSummary,
  CoAReadiness,
  DeviationSummary,
  ReleaseDecisionHistoryItem,
} from '@connectio/data-contracts'

/** Mock release case — Kerry Listowel Emmental, blocked on MIC failure. */
export const mockReleaseContext: BatchReleaseContext = {
  releaseCaseId: 'RC-2024-001847',
  batchId: 'CH-240308-0047',
  materialId: 'CH-EMMENTAL-IE',
  materialDescription: 'Kerry Listowel Emmental 10kg Block',
  plantId: 'IE10',
  plantName: 'Kerry Listowel',
  processOrderId: 'PO-240308-3847',
  status: 'under-review',
  priority: 'critical',
  assignedTo: 'sarah.byrne@kerry.com',
  requestedBy: 'lab.system@kerry.com',
  requestedAt: '2024-03-08T06:00:00.000Z',
  dueBy: '2024-03-09T12:00:00.000Z',
  lastUpdatedAt: '2024-03-08T10:30:00.000Z',
  releaseType: 'standard',
}

/** Mock release queue — 3 cases at different priority levels. */
export const mockReleaseQueue: readonly BatchReleaseQueueItem[] = [
  {
    releaseCaseId: 'RC-2024-001847',
    batchId: 'CH-240308-0047',
    materialId: 'CH-EMMENTAL-IE',
    materialDescription: 'Kerry Listowel Emmental 10kg Block',
    plantId: 'IE10',
    status: 'under-review',
    priority: 'critical',
    dueBy: '2024-03-09T12:00:00.000Z',
    blockers: ['MIC failure: Listeria spp.', 'CoA incomplete'],
    openDeviationCount: 2,
    spcAlarmCount: 1,
    hasOpenHold: true,
    assignedTo: 'sarah.byrne@kerry.com',
    requestedAt: '2024-03-08T06:00:00.000Z',
  },
  {
    releaseCaseId: 'RC-2024-001848',
    batchId: 'CH-240307-0031',
    materialId: 'CH-CHEDDAR-IE',
    materialDescription: 'Kerry Listowel Mature Cheddar 20kg Block',
    plantId: 'IE10',
    status: 'awaiting-review',
    priority: 'expedited',
    dueBy: '2024-03-09T17:00:00.000Z',
    blockers: [],
    openDeviationCount: 0,
    spcAlarmCount: 0,
    hasOpenHold: false,
    assignedTo: undefined,
    requestedAt: '2024-03-07T14:00:00.000Z',
  },
  {
    releaseCaseId: 'RC-2024-001846',
    batchId: 'CH-240306-0019',
    materialId: 'CH-GOUDA-IE',
    materialDescription: 'Kerry Listowel Young Gouda 15kg Wheel',
    plantId: 'IE10',
    status: 'conditionally-released',
    priority: 'routine',
    dueBy: '2024-03-10T12:00:00.000Z',
    blockers: [],
    openDeviationCount: 0,
    spcAlarmCount: 0,
    hasOpenHold: false,
    assignedTo: 'michael.oconnor@kerry.com',
    requestedAt: '2024-03-06T08:00:00.000Z',
  },
]

/** Mock release summary — blocked, recall risk. */
export const mockReleaseSummary: BatchReleaseSummary = {
  releaseCaseId: 'RC-2024-001847',
  batchId: 'CH-240308-0047',
  materialId: 'CH-EMMENTAL-IE',
  materialDescription: 'Kerry Listowel Emmental 10kg Block',
  plantId: 'IE10',
  overallReadiness: 'blocked',
  qualityPassed: false,
  spcClean: false,
  coaComplete: false,
  noOpenHolds: false,
  deviationsResolved: false,
  traceClean: false,
  blockers: [
    'MIC failure: Listeria spp. detected above limit (10 cfu/g, limit: 0)',
    'CoA incomplete: pH result, moisture result missing',
    'Open warehouse hold: Quality hold placed 2024-03-08',
    'SPC alarm: X-bar rule violation on pH parameter',
  ],
  warnings: [
    'Related trace investigation INV-2024-003847 in progress',
    'Upstream supplier lot (GLV-240301-091) flagged for co-investigation',
  ],
  recommendedAction: 'reject',
  lastEvaluatedAt: '2024-03-08T10:30:00.000Z',
}

/** Mock quality results — MIC failure on Listeria. */
export const mockQualityResults: QualityResultsSummary = {
  batchId: 'CH-240308-0047',
  inspectionLotId: 'IL-240308-0047',
  micStatus: 'fail',
  chemicalStatus: 'pending',
  sensoryStatus: 'pass',
  physicalStatus: 'pass',
  overallStatus: 'fail',
  micFailures: [
    {
      organism: 'Listeria monocytogenes',
      testMethod: 'ISO 11290-1',
      result: 10,
      limit: 0,
      unit: 'cfu/g',
      exceededBy: 10,
      testedAt: '2024-03-07T14:30:00.000Z',
      testedBy: 'Mary Hanrahan, Lab Analyst',
    },
    {
      organism: 'Listeria spp.',
      testMethod: 'ISO 11290-2',
      result: 25,
      limit: 5,
      unit: 'cfu/g',
      exceededBy: 20,
      testedAt: '2024-03-07T14:30:00.000Z',
      testedBy: 'Mary Hanrahan, Lab Analyst',
    },
  ],
  openRetestCount: 1,
  inspectionCompletedAt: undefined,
  inspectionCompletedBy: undefined,
}

/** Mock CoA readiness — two missing fields. */
export const mockCoAReadiness: CoAReadiness = {
  batchId: 'CH-240308-0047',
  materialId: 'CH-EMMENTAL-IE',
  coaDocumentId: 'COA-240308-0047-DRAFT',
  readinessStatus: 'incomplete',
  missingFields: ['pH result', 'moisture content'],
  signedOffBy: undefined,
  signedOffAt: undefined,
  expiresAt: undefined,
  customerSpecificCoas: [
    { customerId: 'CUST-001', customerName: 'Tesco Ireland', status: 'incomplete' },
    { customerId: 'CUST-002', customerName: 'Lidl Ireland', status: 'not-required' },
  ],
  lastUpdatedAt: '2024-03-08T09:00:00.000Z',
}

/** Mock deviations — 2 open, 1 blocking release. */
export const mockDeviations: DeviationSummary = {
  batchId: 'CH-240308-0047',
  processOrderId: 'PO-240308-3847',
  totalDeviationCount: 2,
  openDeviationCount: 2,
  criticalDeviationCount: 1,
  deviations: [
    {
      deviationId: 'DEV-2024-001',
      type: 'quality',
      severity: 'critical',
      status: 'under-investigation',
      description: 'Listeria monocytogenes detected above specification in MIC testing',
      raisedAt: '2024-03-07T16:00:00.000Z',
      raisedBy: 'Mary Hanrahan',
      resolvedAt: undefined,
      impactsRelease: true,
    },
    {
      deviationId: 'DEV-2024-002',
      type: 'environmental',
      severity: 'major',
      status: 'open',
      description: 'Environmental monitoring site ENV-042 flagged positive for Listeria spp.',
      raisedAt: '2024-03-08T07:00:00.000Z',
      raisedBy: 'Food Safety Team',
      resolvedAt: undefined,
      impactsRelease: true,
    },
  ],
  blockingReleaseCount: 2,
  lastUpdatedAt: '2024-03-08T10:00:00.000Z',
}

/** Mock decision history — one previous decision (sample rejected from earlier lot). */
export const mockDecisionHistory: readonly ReleaseDecisionHistoryItem[] = [
  {
    decisionId: 'DEC-2024-007831',
    releaseCaseId: 'RC-2024-001846',
    batchId: 'CH-240306-0019',
    decision: 'conditional-release',
    decidedBy: 'Dr. Aoife Murphy, Quality Lead',
    decidedAt: '2024-03-08T08:30:00.000Z',
    rationale:
      'All MIC results within specification. Minor SPC deviation on pH acknowledged and reviewed. Batch released conditional on re-test within 7 days.',
    conditions: ['Restricted distribution to Plant IE10 only', 'Re-test pH within 7 days'],
    supersedes: undefined,
    attachments: [
      { attachmentId: 'ATT-001', name: 'coa-ch-240306-0019-signed.pdf', mimeType: 'application/pdf' },
    ],
  },
]
