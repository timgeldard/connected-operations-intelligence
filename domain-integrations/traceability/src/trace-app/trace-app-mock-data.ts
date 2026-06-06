import type {
  BatchQualityPassport,
  HoldsLedger,
  InvestigationTimeline,
  MassBalanceEvent,
  MassBalanceLedger,
  RecallReadiness,
  SupplierBatchView,
} from '@connectio/data-contracts'

/**
 * Mock data for the Trace App's secondary tabs.
 *
 * Slice 2 ships only the Quality Passport. The supporting gold views
 * (gold_batch_lot_history, gold_batch_signoff) are not yet built; this file
 * returns the design's fixture data so the panel can be exercised end-to-end
 * in UAT without a real backend. When the real adapter lands, replace the
 * hook implementation only — the panel JSX is contract-driven and won't
 * need to change.
 */
export const MOCK_BATCH_QUALITY_PASSPORT: BatchQualityPassport = {
  identity: {
    materialDescription: 'Emmental Cheese Block',
    materialId: '100023847',
    batchId: 'CH-240308-0047',
    plantName: 'Kerry Listowel',
    plantId: 'IE10',
    processOrderId: 'PO-2024-03-0847',
    manufactureDate: '2024-03-08T06:00:00Z',
    expiryDate: '2024-09-08T23:59:59Z',
    daysToExpiry: 124,
    uom: 'KG',
  },
  quality: {
    heuristicQualityConfidence: 87,
    confidenceSource: 'application-heuristic',
    heuristicQualityStatus: 'accepted',
    notes: ['1 conditional release', '1 MIC near limit', 'No audit findings'],
    coa: [
      {
        mic: 'MIC-001',
        param: 'Moisture',
        low: 38,
        high: 42,
        target: 40,
        actual: 40.2,
        uom: '%',
        status: 'ok',
      },
      {
        mic: 'MIC-002',
        param: 'Fat (DM)',
        low: 45,
        high: 50,
        target: 47.5,
        actual: 47.8,
        uom: '%',
        status: 'ok',
      },
      {
        mic: 'MIC-003',
        param: 'pH',
        low: 5.1,
        high: 5.4,
        target: 5.25,
        actual: 5.24,
        uom: '',
        status: 'ok',
      },
      {
        mic: 'MIC-004',
        param: 'Salt',
        low: 0.4,
        high: 0.7,
        target: 0.55,
        actual: 0.68,
        uom: '%',
        status: 'warn',
      },
      {
        mic: 'MIC-005',
        param: 'Total plate count',
        low: 0,
        high: 10000,
        target: 5000,
        actual: 4200,
        uom: 'CFU/g',
        status: 'ok',
      },
      {
        mic: 'MIC-006',
        param: 'Listeria',
        low: 0,
        high: 0,
        target: 0,
        actual: 0,
        uom: '/25g',
        status: 'ok',
        binary: 'Absent',
      },
    ],
  },
  stock: {
    unrestricted: 12450,
    qualityInspection: 850,
    blocked: 2100,
    restricted: 450,
    transit: 1200,
    uom: 'KG',
  },
  production: {
    orderId: 'PO-2024-03-0847',
    line: 'Cheese line 3 · Listowel',
    operator: 'J. Cremins',
    startedAt: '2024-03-08T06:00:00Z',
    confirmedAt: '2024-03-08T16:30:00Z',
    plannedQty: 17050,
    actualQty: 17050,
    yield: 1.0,
    originatingCustomer: 'Internal stock build',
    notes: 'Standard run · no deviations recorded',
  },
  lotHistory: [
    {
      id: 'LOT-2024-3-08-A',
      date: '2024-03-08',
      inspection: 'Lab MIC + retain',
      result: 'accept',
      mics: 6,
      failed: 0,
      decisionBy: 'S. Murphy',
    },
    {
      id: 'LOT-2024-3-08-B',
      date: '2024-03-08',
      inspection: 'Lab MIC + retain',
      result: 'conditional',
      mics: 6,
      failed: 1,
      decisionBy: 'D. Ferreira',
    },
    {
      id: 'LOT-2024-3-09-A',
      date: '2024-03-09',
      inspection: 'Standard',
      result: 'accept',
      mics: 6,
      failed: 0,
      decisionBy: 'S. Murphy',
    },
    {
      id: 'LOT-2024-3-11-A',
      date: '2024-03-11',
      inspection: 'Retest',
      result: 'accept',
      mics: 6,
      failed: 0,
      decisionBy: 'S. Murphy',
    },
  ],
  massBalance: {
    variance: 0,
    note: 'Reconciled — all production and outflow postings balance to current on-hand within 0.01%.',
    detailUrl: 'mass-balance',
  },
  usageDecisionEvidence: [
    {
      role: 'QA reviewer',
      decisionBy: 'S. Murphy',
      decisionType: 'inspection-completed',
      recordedAt: '2024-03-12 11:42',
    },
    {
      role: 'Release decision',
      decisionBy: 'D. Ferreira',
      decisionType: 'usage-decision-recorded',
      recordedAt: '2024-03-12 14:08',
    },
    { role: 'Group QA', decisionBy: '—', decisionType: 'none', recordedAt: '' },
  ],
}

// ---------------------------------------------------------------------------
// Mass Balance — programmatic event ledger (60 daily postings)
// ---------------------------------------------------------------------------

function buildMockMassBalance(): MassBalanceLedger {
  const events: MassBalanceEvent[] = []
  let cum = 0
  for (let i = 0; i < 60; i += 1) {
    let delta: number
    let code: MassBalanceEvent['code']
    let label: string
    if (i < 4) {
      delta = 3800 + Math.sin(i * 9.7) * 400
      code = '101'
      label = 'GR · Production'
    } else if (i === 21) {
      delta = 4200
      code = '101'
      label = 'GR · Production (Run 2)'
    } else if (i % 11 === 0) {
      delta = -((Math.sin(i * 1.3) + 2) * 220)
      code = '261'
      label = 'GI · Consumption'
    } else if (i === 28) {
      delta = -1320
      code = '601'
      label = 'Goods issue · Dispatch'
    } else if (i === 41) {
      delta = 180
      code = '701'
      label = 'Stock adjustment'
    } else {
      delta = -((Math.cos(i * 0.8) + 1.4) * 90 + 30)
      code = '601'
      label = 'Goods issue · Dispatch'
    }
    cum += delta
    events.push({
      d: i,
      delta: Math.round(delta * 10) / 10,
      cum: Math.round(cum * 10) / 10,
      code,
      label,
    })
  }
  const produced = events.filter((e) => e.code === '101').reduce((s, e) => s + e.delta, 0)
  const consumed = events.filter((e) => e.code === '261').reduce((s, e) => s + e.delta, 0)
  const shipped = events.filter((e) => e.code === '601').reduce((s, e) => s + e.delta, 0)
  const adjusted = events.filter((e) => e.code === '701').reduce((s, e) => s + e.delta, 0)
  const current = cum
  const variance = Math.round((produced + adjusted + consumed + shipped - current) * 10) / 10

  return {
    kpi: {
      produced: Math.round(produced),
      consumed: Math.round(consumed),
      shipped: Math.round(shipped),
      adjusted: Math.round(adjusted),
      current: Math.round(current),
      variance,
      uom: 'KG',
      postings: {
        production: events.filter((e) => e.code === '101').length,
        consumption: events.filter((e) => e.code === '261').length,
        dispatch: events.filter((e) => e.code === '601').length,
        adjustment: events.filter((e) => e.code === '701').length,
      },
    },
    events,
    dateStart: '2024-03-08',
    dateEnd: '2024-05-06',
    reconciliationSource: 'application-heuristic',
  }
}

export const MOCK_MASS_BALANCE_LEDGER: MassBalanceLedger = buildMockMassBalance()

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export const MOCK_INVESTIGATION_TIMELINE: InvestigationTimeline = {
  events: [
    {
      ts: '2024-03-08T06:00',
      type: 'production',
      label: 'Process order released',
      actor: 'SAP · auto',
      detail: 'PO-2024-03-0847 · 17,050 KG planned',
      tone: 'brand',
      sourceSystem: 'SAP',
    },
    {
      ts: '2024-03-08T07:14',
      type: 'consumption',
      label: 'Raw materials consumed',
      actor: 'SAP · auto',
      detail: 'Milk Powder A · Cultures B12 (2 lots)',
      tone: 'neutral',
      sourceSystem: 'SAP',
    },
    {
      ts: '2024-03-08T16:30',
      type: 'production',
      label: 'Batch confirmed',
      actor: 'J. Cremins',
      detail: '17,050 KG · CH-240308-0047',
      tone: 'good',
      sourceSystem: 'SAP',
    },
    {
      ts: '2024-03-09T09:00',
      type: 'qc',
      label: 'Sample drawn for MIC',
      actor: 'A. Walsh',
      detail: 'Lab sample LS-9201',
      tone: 'brand',
      sourceSystem: 'LIMS',
    },
    {
      ts: '2024-03-11T14:22',
      type: 'qc',
      label: 'MIC results · all parameters pass',
      actor: 'Lab · auto',
      detail: 'Listeria absent · TPC 4,200 CFU/g',
      tone: 'good',
      sourceSystem: 'LIMS',
    },
    {
      ts: '2024-03-12T11:42',
      type: 'approval',
      label: 'QA reviewer signed',
      actor: 'S. Murphy',
      detail: 'Passport v2',
      tone: 'good',
      sourceSystem: 'TRACE',
    },
    {
      ts: '2024-03-12T14:08',
      type: 'release',
      label: 'Release · unrestricted',
      actor: 'D. Ferreira',
      detail: '12,450 KG to free stock',
      tone: 'good',
      sourceSystem: 'SAP',
    },
    {
      ts: '2024-03-14T08:30',
      type: 'dispatch',
      label: 'Goods issue · DE-0023',
      actor: 'SAP · auto',
      detail: '2,200 KG to Müller Foods GmbH',
      tone: 'brand',
      sourceSystem: 'SAP',
    },
    {
      ts: '2024-03-15T11:10',
      type: 'dispatch',
      label: 'Goods issue · FR-0091',
      actor: 'SAP · auto',
      detail: '1,200 KG to Lactalis France',
      tone: 'brand',
      sourceSystem: 'SAP',
    },
    {
      ts: '2024-03-22T16:00',
      type: 'hold',
      label: 'Partial QI hold opened',
      actor: "B. O'Neill",
      detail: '850 KG — pending re-test on retain',
      tone: 'warn',
      sourceSystem: 'TRACE',
    },
  ],
}

// ---------------------------------------------------------------------------
// Recall readiness
// ---------------------------------------------------------------------------

export const MOCK_RECALL_READINESS: RecallReadiness = {
  totals: { customers: 3, countries: 3, deliveries: 12, shipped: 4280, uom: 'KG' },
  countries: [
    { code: 'DE', name: 'Germany', qty: 2200, pct: 0.51 },
    { code: 'FR', name: 'France', qty: 1200, pct: 0.28 },
    { code: 'NL', name: 'Netherlands', qty: 880, pct: 0.21 },
  ],
  deliveries: [
    {
      id: '8030054411',
      customer: 'Müller Foods GmbH',
      country: 'DE',
      date: '2024-03-14',
      qty: 1200,
      status: 'delivery-evidence',
      statusSource: 'delivery-record-present',
      doc: 'INV-44120',
    },
    {
      id: '8030054512',
      customer: 'Müller Foods GmbH',
      country: 'DE',
      date: '2024-03-16',
      qty: 1000,
      status: 'delivery-evidence',
      statusSource: 'delivery-record-present',
      doc: 'INV-44141',
    },
    {
      id: '8030054613',
      customer: 'Lactalis France',
      country: 'FR',
      date: '2024-03-15',
      qty: 800,
      status: 'delivery-evidence',
      statusSource: 'delivery-record-present',
      doc: 'INV-44162',
    },
    {
      id: '8030054714',
      customer: 'Lactalis France',
      country: 'FR',
      date: '2024-03-18',
      qty: 400,
      status: 'delivery-evidence',
      statusSource: 'delivery-record-present',
      doc: 'INV-44183',
    },
    {
      id: '8030054815',
      customer: 'FrieslandCampina',
      country: 'NL',
      date: '2024-03-19',
      qty: 880,
      status: 'delivery-evidence',
      statusSource: 'delivery-record-present',
      doc: 'INV-44204',
    },
  ],
  recommendationStatus: 'not-evaluated',
}

// ---------------------------------------------------------------------------
// Holds ledger
// ---------------------------------------------------------------------------

export const MOCK_HOLDS_LEDGER: HoldsLedger = {
  activeHolds: [
    {
      id: 'H-2024-0312',
      reason: 'Q4 · Quality inspection',
      reasonCode: 'Q4',
      qty: 850,
      uom: null,
      opened: '2024-03-22',
      owner: "B. O'Neill",
      status: 'pending',
      detail: 'Pending re-test on retain sample',
    },
    {
      id: 'H-2024-0315',
      reason: 'B3 · Blocked stock',
      reasonCode: 'B3',
      qty: 2100,
      uom: null,
      opened: '2024-03-25',
      owner: 'S. Murphy',
      status: 'pending',
      detail: 'Customer claim under investigation · Müller Foods',
    },
  ],
  resolvedHolds: [
    {
      id: 'H-2024-0290',
      reason: 'Q4 · Quality inspection',
      reasonCode: 'Q4',
      qty: 17050,
      uom: null,
      opened: '2024-03-09',
      resolved: '2024-03-12',
      owner: 'S. Murphy',
      status: 'released',
      detail: 'Initial post-production QC hold',
      resolution: 'Released — MIC pass',
    },
  ],
  qtyByReason: [
    { code: 'B3', label: 'Blocked stock', qty: 2100, uom: null, color: 'var(--sunset, #F24A00)' },
    { code: 'Q4', label: 'Quality inspection', qty: 850, uom: null, color: 'var(--sage, #289BA2)' },
    { code: 'R1', label: 'Restricted', qty: 450, uom: null, color: 'var(--sunrise, #F9C20A)' },
  ],
}

// ---------------------------------------------------------------------------
// Supplier batches
// ---------------------------------------------------------------------------

export const MOCK_SUPPLIER_BATCH_VIEW: SupplierBatchView = {
  consumedLots: [
    {
      vendor: 'Glanbia Ireland DAC',
      vendorBatch: 'GL-MP-240226-A47',
      material: 'Milk Powder A',
      receipt: '2024-02-28',
      consumed: 8800,
      uom: 'KG',
      coa: 'CoA-GL-9921',
      risk: 'medium',
    },
    {
      vendor: 'Chr. Hansen A/S',
      vendorBatch: 'CH-CULT-B12-2403',
      material: 'Cultures B12',
      receipt: '2024-03-04',
      consumed: 140,
      uom: 'KG',
      coa: 'CoA-CH-7720',
      risk: 'low',
    },
    {
      vendor: 'Dairygold Co-operative',
      vendorBatch: 'DG-RAW-MILK-0307',
      material: 'Raw whole milk',
      receipt: '2024-03-07',
      consumed: 9200,
      uom: 'KG',
      coa: 'CoA-DG-5511',
      risk: 'low',
    },
  ],
  siblingBatches: [
    {
      plant: 'IE10 · Listowel',
      plantId: 'IE10',
      batchId: 'CH-240307-0046',
      mfg: '2024-03-07',
      qty: 16200,
      vendorBatch: 'GL-MP-240226-A47',
    },
    {
      plant: 'IE10 · Listowel',
      plantId: 'IE10',
      batchId: 'CH-240309-0048',
      mfg: '2024-03-09',
      qty: 17800,
      vendorBatch: 'GL-MP-240226-A47',
    },
    {
      plant: 'IE20 · Charleville',
      plantId: 'IE20',
      batchId: 'CV-240308-0112',
      mfg: '2024-03-08',
      qty: 14500,
      vendorBatch: 'GL-MP-240226-A47',
    },
    {
      plant: 'DE30 · Schwerin',
      plantId: 'DE30',
      batchId: 'SH-240310-0203',
      mfg: '2024-03-10',
      qty: 22100,
      vendorBatch: 'GL-MP-240226-A47',
    },
  ],
}
