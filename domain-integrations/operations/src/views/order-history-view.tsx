import { useState, useMemo } from 'react'
import type { CSSProperties } from 'react'
import {
  useProcessOrderHeader,
  useOrderOperations,
  useOrderConfirmations,
  useOrderGoodsMovements,
} from '../adapters/process-order-review-queries.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'
import {
  VerificationStatusBanner,
  SourceConfidenceStrip,
  SourceModeBadge,
  EvidenceStatusBadge,
  type ExtendedSourceMode,
  type EvidenceStatus,
} from '@connectio/design-system'
import type { UATEvidencePayload } from '@connectio/data-contracts'

type PohSectionKey = 'header' | 'operations' | 'confirmations' | 'goodsMovements'
type PohSectionState =
  | 'loaded'
  | 'no-records-returned'
  | 'unavailable'
  | 'error'
  | 'mock-only'
  | 'pending-validation'
type ComponentConsumptionRow = {
  materialId: string
  materialDescription?: string
  batchId?: string
  totalQuantity: number
  uom: string
  sourceMovementCount: number
}
type ProducedOutputRow = {
  materialId: string
  materialDescription?: string
  batchId?: string
  netQuantity: number
  uom: string
  movementTypes: string[]
  sourceMovementCount: number
  referenceDocument?: string
}

const safeFormatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? '-' : d.toLocaleString()
  } catch {
    return '-'
  }
}

interface QueryLike {
  data?: { ok: boolean; source?: string; error?: { code: string; message: string } }
  isLoading: boolean
  isError: boolean
  error?: Error | null
}

function getEvidenceStatus(query: QueryLike, isEmpty?: boolean): EvidenceStatus {
  if (query.isLoading) return 'pending-validation'
  if (query.isError || (query.data && !query.data.ok)) {
    const errorCode = String(query.data?.error?.code ?? query.error?.message ?? '')
    if (errorCode.includes('403')) return 'permission-denied'
    if (errorCode.includes('504')) return 'timed-out'
    return 'error'
  }
  if (!query.data) return 'unavailable'
  if (isEmpty) return 'no-records'

  const source = query.data.source
  if (source === 'mock') return 'mock-only'

  return 'loaded'
}

function getSectionState(query: QueryLike, isEmpty?: boolean): PohSectionState {
  if (query.isLoading) return 'pending-validation'
  if (query.isError || (query.data && !query.data.ok)) return 'error'
  if (!query.data) return 'unavailable'
  if (query.data.source === 'mock') return 'mock-only'
  if (isEmpty) return 'no-records-returned'
  return 'loaded'
}

function sectionStateToEvidenceStatus(state: PohSectionState): EvidenceStatus {
  if (state === 'no-records-returned') return 'no-records'
  return state
}

function mapSectionStateToUATStatus(
  state: PohSectionState,
): 'loaded' | 'partial' | 'mock-only' | 'unavailable' | 'pending-validation' | 'error' {
  if (state === 'no-records-returned') return 'partial'
  return state
}

function getOverallEvidenceStatus(
  sectionStates: Record<PohSectionKey, PohSectionState>,
): UATEvidencePayload['evidenceCompleteness']['status'] {
  const states = Object.values(sectionStates)
  if (states.every((state) => state === 'loaded')) return 'loaded'
  if (states.every((state) => state === 'mock-only')) return 'mock-only'
  if (states.some((state) => state === 'error')) return 'error'
  if (states.some((state) => state === 'pending-validation')) return 'pending-validation'
  if (states.every((state) => state === 'unavailable')) return 'unavailable'
  return 'partial'
}

function getOverallSource(
  sections: Record<PohSectionKey, string>,
): UATEvidencePayload['sourceSummary']['overall'] {
  const sources = Object.values(sections)
  const known = sources.filter((source) => source !== 'unknown')
  if (known.length === 0) return 'unknown'
  if (known.every((source) => source === 'unavailable')) return 'unavailable'
  const unique = new Set(known)
  if (unique.size > 1) return 'mixed'
  const [source] = known
  return source === 'mock' || source === 'legacy-api' || source === 'databricks-api'
    ? source
    : 'unknown'
}

function getSectionSource(query: QueryLike): string {
  if (query.data?.source) return query.data.source
  if (query.isError || (query.data && !query.data.ok)) return 'unavailable'
  return 'unknown'
}

function getNoRecordsMessage(section: PohSectionKey): string {
  switch (section) {
    case 'header':
      return 'Order header unavailable from current source.'
    case 'operations':
      return 'No operation records returned for this order/source.'
    case 'confirmations':
      return 'No confirmation records returned for this order/source. Do not interpret as no confirmations until source coverage is validated.'
    case 'goodsMovements':
      return 'No goods-movement records returned for this order/source. Do not interpret as no movement history until source coverage is validated.'
  }
}

function normaliseMovementQuantity(
  quantity: number,
  uom: string,
): { quantity: number; uom: string } | null {
  const normalizedUom = uom.trim().toUpperCase()
  if (normalizedUom === 'EA') {
    return null
  }
  if (normalizedUom === 'G') {
    return { quantity: quantity / 1000, uom: 'KG' }
  }
  return { quantity, uom: normalizedUom || uom }
}

function getQueryError(query: QueryLike) {
  if (query.isError) {
    return {
      code: 'unknown',
      message: String(query.error?.message || query.error || 'React Query failed'),
    }
  }
  if (query.data && !query.data.ok) {
    return query.data.error
  }
  return null
}

function renderRouteError(
  title: string,
  error: { code: string; message: string } | undefined,
  endpoint: string,
) {
  if (!error) return null
  let guidance = 'The request failed. Please check backend connection logs.'
  const codeStr = String(error.code)

  if (codeStr.includes('401') || error.message.includes('401')) {
    guidance = 'Authentication failed. Please verify your user token / OAuth identity.'
  } else if (codeStr.includes('403') || error.message.includes('403')) {
    guidance = 'Access denied. You do not have the required Unity Catalog or database permissions.'
  } else if (codeStr.includes('502') || error.message.includes('502')) {
    guidance =
      'Upstream gateway error. This usually indicates a source / query column mismatch or unreachable backend V1 endpoint.'
  } else if (codeStr.includes('504') || error.message.includes('504')) {
    guidance =
      'Upstream timeout. The Databricks SQL Warehouse took too long to return the query results.'
  } else if (codeStr.includes('503') || error.message.includes('503')) {
    guidance =
      'Service unavailable. Order operations, confirmations, and goods movements require BACKEND_ADAPTER_MODE=databricks-api. They are not available in legacy-api mode.'
  }

  return (
    <div
      style={{
        background: 'rgba(239, 68, 68, 0.05)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <h4
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>❌</span> {title} Query Failed ({error.code})
        </h4>
        <span
          style={{
            fontSize: 9,
            fontFamily: 'monospace',
            background: '#374151',
            color: '#9CA3AF',
            padding: '2px 4px',
            borderRadius: 3,
          }}
        >
          {endpoint}
        </span>
      </div>
      <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#F3F4F6' }}>
        <strong>Error Message:</strong> {error.message}
      </p>
      <div
        style={{
          fontSize: 11,
          color: '#FCA5A5',
          background: 'rgba(239, 68, 68, 0.1)',
          padding: 8,
          borderRadius: 4,
        }}
      >
        <strong>💡 Troubleshooting:</strong> {guidance}
      </div>
    </div>
  )
}

export interface OrderHistoryViewProps {
  readonly request?: ProcessOrderReviewAdapterRequest
}

interface QueryFormState {
  processOrderId: string
  plantId: string
  materialId: string
  batchId: string
}

export function OrderHistoryView({ request }: OrderHistoryViewProps) {
  // 1. Initial State from URL / Scope Context
  const [form, setForm] = useState<QueryFormState>({
    processOrderId: request?.processOrderId ?? '',
    plantId: request?.plantId ?? '',
    materialId: request?.materialId ?? '',
    batchId: request?.batchId ?? '',
  })
  const [isMockFixtureSelected, setIsMockFixtureSelected] = useState(false)

  // State to trigger the actual parallel React queries
  const [queryParams, setQueryParams] = useState<ProcessOrderReviewAdapterRequest | null>(
    request?.processOrderId
      ? {
          processOrderId: request.processOrderId,
          plantId: request.plantId,
          materialId: request.materialId,
          batchId: request.batchId,
        }
      : null,
  )

  const [validationError, setValidationError] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [technicalOpen, setTechnicalOpen] = useState(false)

  // 2. Query execution with parallel Tanstack hooks
  const headerQuery = useProcessOrderHeader({
    processOrderId: queryParams?.processOrderId,
    plantId: queryParams?.plantId,
    materialId: queryParams?.materialId,
    batchId: queryParams?.batchId,
  })

  const operationsQuery = useOrderOperations({
    processOrderId: queryParams?.processOrderId,
    plantId: queryParams?.plantId,
    materialId: queryParams?.materialId,
    batchId: queryParams?.batchId,
  })

  const confirmationsQuery = useOrderConfirmations({
    processOrderId: queryParams?.processOrderId,
    plantId: queryParams?.plantId,
    materialId: queryParams?.materialId,
    batchId: queryParams?.batchId,
  })

  const goodsMovementsQuery = useOrderGoodsMovements({
    processOrderId: queryParams?.processOrderId,
    plantId: queryParams?.plantId,
    materialId: queryParams?.materialId,
    batchId: queryParams?.batchId,
  })

  // Loading & error flags across all parallel requests
  const isAnyLoading =
    headerQuery.isLoading ||
    operationsQuery.isLoading ||
    confirmationsQuery.isLoading ||
    goodsMovementsQuery.isLoading

  const hasAnyData =
    (headerQuery.data?.ok &&
      headerQuery.data.data &&
      Object.keys(headerQuery.data.data).length > 0) ||
    (operationsQuery.data?.ok &&
      operationsQuery.data.data &&
      operationsQuery.data.data.length > 0) ||
    (confirmationsQuery.data?.ok &&
      confirmationsQuery.data.data &&
      confirmationsQuery.data.data.length > 0) ||
    (goodsMovementsQuery.data?.ok &&
      goodsMovementsQuery.data.data &&
      goodsMovementsQuery.data.data.length > 0)

  const hasAnyError =
    headerQuery.isError ||
    (headerQuery.data && !headerQuery.data.ok) ||
    operationsQuery.isError ||
    (operationsQuery.data && !operationsQuery.data.ok) ||
    confirmationsQuery.isError ||
    (confirmationsQuery.data && !confirmationsQuery.data.ok) ||
    goodsMovementsQuery.isError ||
    (goodsMovementsQuery.data && !goodsMovementsQuery.data.ok)

  // Form Handling
  const handleInputChange = (field: keyof QueryFormState, val: string) => {
    setForm((prev) => ({ ...prev, [field]: val }))
    setValidationError(null)
    setIsMockFixtureSelected(false)
  }

  const handlePresetClick = () => {
    setForm({
      processOrderId: 'PO-240308-3847',
      plantId: 'IE10',
      materialId: 'MAT-CH-EMMENTAL-BLOCK',
      batchId: 'CH-240308-0047',
    })
    setValidationError(null)
    setIsMockFixtureSelected(true)
  }

  const handleUatCandidateClick = () => {
    setForm({
      processOrderId: '7006965038',
      plantId: 'C113',
      materialId: '',
      batchId: '',
    })
    setValidationError(null)
    setIsMockFixtureSelected(false)
  }

  const handleReset = () => {
    setForm({
      processOrderId: '',
      plantId: '',
      materialId: '',
      batchId: '',
    })
    setQueryParams(null)
    setValidationError(null)
    setIsMockFixtureSelected(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.processOrderId.trim()) {
      setValidationError('Process Order ID is required before running investigation.')
      return
    }

    setValidationError(null)
    setQueryParams({
      processOrderId: form.processOrderId,
      plantId: form.plantId || undefined,
      materialId: form.materialId || undefined,
      batchId: form.batchId || undefined,
    })
  }

  // 3. Derived operational metrics & summary stats
  const headerData = headerQuery.data?.ok ? headerQuery.data.data : null
  const operations = useMemo(
    () => (operationsQuery.data?.ok ? operationsQuery.data.data : []) ?? [],
    [operationsQuery.data],
  )
  const confirmations = useMemo(
    () => (confirmationsQuery.data?.ok ? confirmationsQuery.data.data : []) ?? [],
    [confirmationsQuery.data],
  )
  const goodsMovements = useMemo(
    () => (goodsMovementsQuery.data?.ok ? goodsMovementsQuery.data.data : []) ?? [],
    [goodsMovementsQuery.data],
  )

  const headerErr = getQueryError(headerQuery)
  const operationsErr = getQueryError(operationsQuery)
  const confirmationsErr = getQueryError(confirmationsQuery)
  const goodsMovementsErr = getQueryError(goodsMovementsQuery)

  const headerStatus = getEvidenceStatus(headerQuery, !headerData)
  const operationsStatus = getEvidenceStatus(operationsQuery, operations.length === 0)
  const confirmationsStatus = getEvidenceStatus(confirmationsQuery, confirmations.length === 0)
  const goodsMovementsStatus = getEvidenceStatus(goodsMovementsQuery, goodsMovements.length === 0)
  const sectionStates: Record<PohSectionKey, PohSectionState> = {
    header: getSectionState(headerQuery, !headerData),
    operations: getSectionState(operationsQuery, operations.length === 0),
    confirmations: getSectionState(confirmationsQuery, confirmations.length === 0),
    goodsMovements: getSectionState(goodsMovementsQuery, goodsMovements.length === 0),
  }
  const sectionSources: Record<PohSectionKey, string> = {
    header: getSectionSource(headerQuery),
    operations: getSectionSource(operationsQuery),
    confirmations: getSectionSource(confirmationsQuery),
    goodsMovements: getSectionSource(goodsMovementsQuery),
  }
  const overallCompletenessStatus = getOverallEvidenceStatus(sectionStates)
  const sectionStateValues = Object.values(sectionStates)
  const hasLoadedSection = sectionStateValues.some(
    (state) => state === 'loaded' || state === 'mock-only' || state === 'no-records-returned',
  )
  const hasIncompleteSection = sectionStateValues.some(
    (state) =>
      state === 'error' ||
      state === 'unavailable' ||
      state === 'pending-validation' ||
      state === 'no-records-returned',
  )
  const hasPartialOrderHistory =
    Boolean(queryParams) && !isAnyLoading && hasLoadedSection && hasIncompleteSection

  const metrics = useMemo(() => {
    const inputs = goodsMovements.filter((m) => m.direction === 'input')
    const outputs = goodsMovements.filter((m) => m.direction === 'output')
    const unclassified = goodsMovements.filter((m) => m.direction === 'unknown')

    const distinctMaterials = new Set(goodsMovements.map((m) => m.materialId))
    const distinctBatches = new Set(goodsMovements.filter((m) => m.batchId).map((m) => m.batchId))

    // UOM sums and Mixed UOM safety check
    const uomSums: Record<string, number> = {}
    goodsMovements.forEach((m) => {
      if (m.quantity == null || !m.uom) {
        return
      }
      uomSums[m.uom] = (uomSums[m.uom] || 0) + m.quantity
    })
    const uoms = Object.keys(uomSums)
    const hasMixedUoms = uoms.length > 1

    return {
      inputsCount: inputs.length,
      outputsCount: outputs.length,
      unclassifiedCount: unclassified.length,
      distinctMaterialsCount: distinctMaterials.size,
      distinctBatchesCount: distinctBatches.size,
      uomSums,
      uoms,
      hasMixedUoms,
    }
  }, [goodsMovements])

  const componentConsumption = useMemo(() => {
    const byMaterialBatchUom = new Map<string, ComponentConsumptionRow>()

    goodsMovements.forEach((movement) => {
      if (movement.movementType !== '261' && movement.movementType !== '262') {
        return
      }

      if (movement.quantity == null || !movement.uom) {
        return
      }
      const normalized = normaliseMovementQuantity(movement.quantity, movement.uom)
      if (!normalized) {
        return
      }

      const batchKey = movement.batchId ?? ''
      const key = `${movement.materialId}::${batchKey}::${normalized.uom}`
      const sign = movement.movementType === '262' ? -1 : 1
      const existing = byMaterialBatchUom.get(key)

      if (existing) {
        existing.totalQuantity += sign * normalized.quantity
        existing.sourceMovementCount += 1
        return
      }

      byMaterialBatchUom.set(key, {
        materialId: movement.materialId,
        materialDescription: movement.materialDescription,
        batchId: movement.batchId,
        totalQuantity: sign * normalized.quantity,
        uom: normalized.uom,
        sourceMovementCount: 1,
      })
    })

    return [...byMaterialBatchUom.values()]
      .map((row) => ({ ...row, totalQuantity: Number(row.totalQuantity.toFixed(6)) }))
      .sort(
        (a, b) =>
          a.materialId.localeCompare(b.materialId) ||
          (a.batchId ?? '').localeCompare(b.batchId ?? ''),
      )
  }, [goodsMovements])

  const producedOutput = useMemo(() => {
    const byMaterialBatchUom = new Map<string, ProducedOutputRow>()

    goodsMovements.forEach((movement) => {
      if (
        movement.movementType !== '101' &&
        movement.movementType !== '102' &&
        movement.movementType !== '531'
      ) {
        return
      }

      if (movement.quantity == null || !movement.uom) {
        return
      }
      const normalized = normaliseMovementQuantity(movement.quantity, movement.uom)
      if (!normalized) {
        return
      }

      const batchId = movement.batchId || ''
      const key = `${movement.materialId}::${batchId}::${normalized.uom}`
      const sign = movement.movementType === '102' ? -1 : 1
      const existing = byMaterialBatchUom.get(key)

      if (existing) {
        existing.netQuantity += sign * normalized.quantity
        existing.sourceMovementCount += 1
        if (!existing.movementTypes.includes(movement.movementType)) {
          existing.movementTypes.push(movement.movementType)
        }
        if (!existing.referenceDocument && movement.referenceDocument) {
          existing.referenceDocument = movement.referenceDocument
        }
        return
      }

      byMaterialBatchUom.set(key, {
        materialId: movement.materialId,
        materialDescription: movement.materialDescription,
        batchId: movement.batchId,
        netQuantity: sign * normalized.quantity,
        uom: normalized.uom,
        movementTypes: [movement.movementType],
        sourceMovementCount: 1,
        referenceDocument: movement.referenceDocument,
      })
    })

    return [...byMaterialBatchUom.values()]
      .map((row) => ({
        ...row,
        movementTypes: [...row.movementTypes].sort(),
        netQuantity: Number(row.netQuantity.toFixed(6)),
      }))
      .sort(
        (a, b) =>
          a.materialId.localeCompare(b.materialId) ||
          (a.batchId || '').localeCompare(b.batchId || ''),
      )
  }, [goodsMovements])

  // 4. Derived Chronological Timeline (no invented events)
  const sortedTimeline = useMemo(() => {
    interface TimelineEvent {
      id: string
      date: Date | null
      dateString: string
      type: 'operation-start' | 'operation-finish' | 'confirmation' | 'movement'
      title: string
      description: string
      actor?: string
    }

    const events: TimelineEvent[] = []

    // Map operations
    operations.forEach((op) => {
      if (op.actualStart) {
        events.push({
          id: `op-start-${op.operationId}`,
          date: new Date(op.actualStart),
          dateString: op.actualStart,
          type: 'operation-start',
          title: `Operation Started: ${op.operationNumber}`,
          description: `${op.operationText} started at ${op.workCentre}.`,
        })
      } else if (op.plannedStart) {
        events.push({
          id: `op-pstart-${op.operationId}`,
          date: new Date(op.plannedStart),
          dateString: op.plannedStart,
          type: 'operation-start',
          title: `Operation Planned: ${op.operationNumber}`,
          description: `${op.operationText} planned start at ${op.workCentre} (Actual start pending).`,
        })
      }

      if (op.actualFinish) {
        events.push({
          id: `op-finish-${op.operationId}`,
          date: new Date(op.actualFinish),
          dateString: op.actualFinish,
          type: 'operation-finish',
          title: `Operation Finished: ${op.operationNumber}`,
          description: `${op.operationText} confirmed finished at ${op.workCentre}.`,
        })
      }
    })

    // Map confirmations
    confirmations.forEach((conf) => {
      events.push({
        id: `conf-${conf.confirmationId}`,
        date: conf.confirmedAt ? new Date(conf.confirmedAt) : null,
        dateString: conf.confirmedAt || '',
        type: 'confirmation',
        title: `Yield Confirmed: ${conf.confirmationId}`,
        description:
          conf.confirmedYield != null
            ? `Confirmed ${conf.confirmedYield.toLocaleString()} ${conf.uom ?? ''} by ${conf.confirmedBy || 'System'}.${conf.scrapQuantity ? ` (Scrap: ${conf.scrapQuantity})` : ''}`
            : `Confirmed yield unavailable for confirmation ${conf.confirmationId}.`,
        actor: conf.confirmedBy,
      })
    })

    // Map goods movements
    goodsMovements.forEach((mov) => {
      events.push({
        id: `mov-${mov.movementId}`,
        date: mov.postedAt ? new Date(mov.postedAt) : null,
        dateString: mov.postedAt || '',
        type: 'movement',
        title: `Goods Movement [${mov.movementType}]`,
        description: `${mov.direction.toUpperCase()}: ${(mov.quantity ?? 0).toLocaleString()} ${mov.uom} of material ${mov.materialId}${mov.batchId ? ` (Batch: ${mov.batchId})` : ''} posted at ${mov.storageLocation || 's-loc'}.`,
        actor: mov.postedBy,
      })
    })

    // Separate dated and undated events
    const dated = events.filter((e) => e.date !== null && !isNaN(e.date.getTime()))
    const undated = events.filter((e) => e.date === null || isNaN(e.date.getTime()))

    // Sort dated events chronologically (ascending)
    dated.sort((a, b) => a.date!.getTime() - b.date!.getTime())

    return { dated, undated }
  }, [operations, confirmations, goodsMovements])

  // 5. Exception & Data Quality Detection
  const exceptions = useMemo(() => {
    const list: string[] = []

    if (queryParams) {
      if (operations.length === 0 && operationsQuery.data?.ok) {
        list.push(getNoRecordsMessage('operations'))
      }
      if (confirmations.length === 0 && confirmationsQuery.data?.ok) {
        list.push(getNoRecordsMessage('confirmations'))
      }
      if (goodsMovements.length === 0 && goodsMovementsQuery.data?.ok) {
        list.push(getNoRecordsMessage('goodsMovements'))
      }
      if (metrics.hasMixedUoms) {
        list.push(
          'Mixed units of measure detected. Bulk summation totals disabled to avoid scaling calculation errors.',
        )
      }
      if (metrics.unclassifiedCount > 0) {
        list.push(
          `${metrics.unclassifiedCount} goods movement rows have unclassified direction due to unrecognized SAP movement types.`,
        )
      }
      if (goodsMovements.length > 0 && componentConsumption.length === 0) {
        list.push(
          'No net component consumption rows derived from 261/262 movement types. Do not interpret as no BOM or reservation requirements until source coverage is validated.',
        )
      }
      if (goodsMovements.length > 0 && producedOutput.length === 0) {
        list.push(
          'No produced-output rows derived from 101/102/531 movement types. Do not interpret as no production output until source coverage is validated.',
        )
      }

      // Check missing batches on movements
      const missingBatchMovements = goodsMovements.filter(
        (m) =>
          !m.batchId &&
          (m.movementType === '101' ||
            m.movementType === '261' ||
            m.materialId.startsWith('MAT-RM') ||
            m.materialId.startsWith('MAT-CH')),
      )
      if (missingBatchMovements.length > 0) {
        list.push(
          `${missingBatchMovements.length} goods movements are missing critical batch identifiers on batch-managed material document rows.`,
        )
      }

      // Check missing posting dates in timeline
      const undatedCount = sortedTimeline.undated.length
      if (undatedCount > 0) {
        list.push(
          `${undatedCount} timeline event rows possess malformed or completely missing dates/timestamps.`,
        )
      }
    }

    return list
  }, [
    queryParams,
    operations,
    confirmations,
    goodsMovements,
    metrics,
    componentConsumption,
    producedOutput,
    sortedTimeline,
    operationsQuery.data,
    confirmationsQuery.data,
    goodsMovementsQuery.data,
  ])

  const handleCopyRequestDetails = () => {
    const payload: UATEvidencePayload = {
      domain: 'operations',
      workspace: 'Process Order History',
      capturedAt: new Date().toISOString(),
      adapterMode: import.meta.env.VITE_ADAPTER_MODE ?? 'mock',
      inputs: {
        processOrderId: form.processOrderId,
        plantId: form.plantId,
      },
      sourceSummary: {
        overall: getOverallSource(sectionSources),
        sections: {
          header: sectionSources.header,
          operations: sectionSources.operations,
          confirmations: sectionSources.confirmations,
          goodsMovements: sectionSources.goodsMovements,
        },
      },
      evidenceCompleteness: {
        status: overallCompletenessStatus,
        sections: {
          header: mapSectionStateToUATStatus(sectionStates.header),
          operations: mapSectionStateToUATStatus(sectionStates.operations),
          confirmations: mapSectionStateToUATStatus(sectionStates.confirmations),
          goodsMovements: mapSectionStateToUATStatus(sectionStates.goodsMovements),
        },
      },
      counts: {
        operations: operations.length,
        confirmations: confirmations.length,
        goodsMovements: goodsMovements.length,
        componentMaterials: componentConsumption.length,
        producedBatches: producedOutput.length,
      },
      warnings: [
        'No production readiness claimed.',
        'No-record sections must not be interpreted as complete absence until source coverage is validated.',
        ...exceptions,
      ],
      uatNotes: [
        'Databricks/native path requires UAT validation against SAP/Databricks source evidence.',
        'Unavailable evidence must not be interpreted as zero exposure or no risk.',
      ],
    }

    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  // Styles
  const cardStyle: CSSProperties = {
    background: '#1F2937',
    border: '1px solid #374151',
    borderRadius: 8,
    padding: 16,
    color: '#F9FAFB',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
    marginBottom: 16,
  }

  const tableHeaderStyle: CSSProperties = {
    background: '#111827',
    color: '#9CA3AF',
    textAlign: 'left',
    padding: 10,
    fontSize: 11,
    fontWeight: 600,
    borderBottom: '1px solid #374151',
  }

  const tableRowStyle = (idx: number): CSSProperties => ({
    background: idx % 2 === 0 ? '#1F2937' : '#1A2230',
    borderBottom: '1px solid #2D3748',
  })

  const tableCellStyle: CSSProperties = {
    padding: 10,
    fontSize: 12,
    color: '#E5E7EB',
  }

  return (
    <div
      style={{
        padding: 16,
        fontFamily: 'var(--shell-font-sans)',
        color: '#F3F4F6',
        maxWidth: 1200,
        margin: '0 auto',
      }}
    >
      {/* A. Header / Source Banner */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0f1d24 0%, #152b36 100%)',
          border: '1px solid #234d61',
          borderRadius: 8,
          padding: '16px 20px',
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: '#38bdf8',
              letterSpacing: '-0.025em',
            }}
          >
            Process Order History
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#94a3b8' }}>
            Read-only manufacturing order investigation
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 10,
              fontWeight: 600,
              color: '#fbbf24',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            UAT verification pending
          </span>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            No write-back or transaction execution allowed
          </span>
        </div>
      </div>

      <VerificationStatusBanner
        title="Process Order History Integration Specifications"
        status="executable-pending-bv"
        sourceLabel="Databricks Unity Catalog Kerry Manufacturing Schema"
        routes={[
          'POST /api/por/order-header',
          'GET /api/por/order-operations',
          'GET /api/por/order-confirmations',
          'GET /api/por/order-goods-movements',
        ]}
        sourceObjects={[
          'vw_gold_process_order',
          'vw_gold_process_order_phase',
          'vw_gold_confirmation',
          'vw_gold_adp_movement',
        ]}
        limitations={[
          'UAT verification pending browser sweep',
          'no write-back',
          'no SAP transaction execution',
          'mock fixture is UI-only',
          'date and limit filters are not exposed in this UAT form',
          'material and batch filters are planned/diagnostic only',
        ]}
        lastVerified="Pending UAT Sweep"
      />

      {queryParams && (
        <SourceConfidenceStrip
          mode={
            (headerQuery.data?.source as ExtendedSourceMode) ||
            (isMockFixtureSelected ? 'mock' : 'unknown')
          }
          status={headerStatus}
          fetchedAt={headerQuery.data?.ok ? headerQuery.data.fetchedAt : undefined}
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* C. Evidence Completeness Summary */}
      <div
        style={{
          ...cardStyle,
          background: 'linear-gradient(to bottom, #1f2937, #111827)',
          border: '1px solid #374151',
          padding: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#F9FAFB' }}>
              Evidence Completeness Summary
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#9CA3AF' }}>
              Section-level source availability and record counts for PO{' '}
              {queryParams?.processOrderId || '(none)'}
            </p>
          </div>
          {queryParams && (
            <div style={{ display: 'flex', gap: 8 }}>
              <div
                style={{
                  fontSize: 10,
                  background: '#374151',
                  padding: '4px 8px',
                  borderRadius: 4,
                  color: '#9CA3AF',
                }}
              >
                Mode: {isMockFixtureSelected ? 'MOCK' : 'API'}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          {[
            {
              key: 'header' as const,
              label: 'Order Header',
              query: headerQuery,
              status: headerStatus,
              count: headerData ? 1 : 0,
            },
            {
              key: 'operations' as const,
              label: 'Operations',
              query: operationsQuery,
              status: operationsStatus,
              count: operations.length,
            },
            {
              key: 'confirmations' as const,
              label: 'Confirmations',
              query: confirmationsQuery,
              status: confirmationsStatus,
              count: confirmations.length,
            },
            {
              key: 'goodsMovements' as const,
              label: 'Goods Movements',
              query: goodsMovementsQuery,
              status: goodsMovementsStatus,
              count: goodsMovements.length,
            },
          ].map((sec, i) => (
            <div
              key={i}
              style={{
                background: '#111827',
                padding: 12,
                borderRadius: 6,
                border: '1px solid #1f2937',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#D1D5DB' }}>
                    {sec.label}
                  </span>
                  <EvidenceStatusBadge status={sec.status} />
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#F3F4F6' }}>
                  {sec.query.isLoading ? '...' : sec.count}
                  <span style={{ fontSize: 11, fontWeight: 400, color: '#6B7280', marginLeft: 6 }}>
                    records
                  </span>
                </div>
                <div style={{ marginTop: 4, fontSize: 10, color: '#9CA3AF' }}>
                  Section state: {sectionStates[sec.key]}
                </div>
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 9,
                  color: '#6B7280',
                  borderTop: '1px solid #1f2937',
                  paddingTop: 6,
                }}
              >
                Source: {sectionSources[sec.key]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* B. Query Form */}
      <div style={cardStyle} data-testid="poh-query-form">
        <h2 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>
          Manufacturing Order Filter Specification
        </h2>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: '#9CA3AF',
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                Process Order ID <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                value={form.processOrderId}
                onChange={(e) => handleInputChange('processOrderId', e.target.value)}
                placeholder="e.g. PO-240308-3847"
                style={{
                  width: '100%',
                  background: '#111827',
                  border: '1px solid #4B5563',
                  borderRadius: 4,
                  padding: '8px 10px',
                  color: '#fff',
                  fontSize: 12,
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: '#9CA3AF',
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                Plant ID
              </label>
              <input
                type="text"
                aria-label="Plant ID"
                value={form.plantId}
                onChange={(e) => handleInputChange('plantId', e.target.value)}
                placeholder="e.g. IE10"
                style={{
                  width: '100%',
                  background: '#111827',
                  border: '1px solid #4B5563',
                  borderRadius: 4,
                  padding: '8px 10px',
                  color: '#fff',
                  fontSize: 12,
                }}
              />
              <div style={{ fontSize: 9, color: 'var(--shell-fg-3, #7A8A75)', marginTop: 4 }}>
                Wired to Header query only
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: '#9CA3AF',
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                Material ID{' '}
                <span style={{ fontSize: 9, color: 'var(--shell-warn, #C7821C)' }}>
                  (Planned / Diagnostic)
                </span>
              </label>
              <input
                type="text"
                aria-label="Material ID"
                value={form.materialId}
                onChange={(e) => handleInputChange('materialId', e.target.value)}
                placeholder="e.g. MAT-CH-EMMENTAL"
                disabled={true}
                style={{
                  width: '100%',
                  background: '#111827',
                  border: '1px solid #374151',
                  borderRadius: 4,
                  padding: '8px 10px',
                  color: '#9CA3AF',
                  fontSize: 12,
                  cursor: 'not-allowed',
                  opacity: 0.6,
                }}
              />
              <div style={{ fontSize: 9, color: 'var(--shell-fg-3, #7A8A75)', marginTop: 4 }}>
                Planned filter — not applied to database queries
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: '#9CA3AF',
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                Batch ID{' '}
                <span style={{ fontSize: 9, color: 'var(--shell-warn, #C7821C)' }}>
                  (Planned / Diagnostic)
                </span>
              </label>
              <input
                type="text"
                aria-label="Batch ID"
                value={form.batchId}
                onChange={(e) => handleInputChange('batchId', e.target.value)}
                placeholder="e.g. CH-240308-0047"
                disabled={true}
                style={{
                  width: '100%',
                  background: '#111827',
                  border: '1px solid #374151',
                  borderRadius: 4,
                  padding: '8px 10px',
                  color: '#9CA3AF',
                  fontSize: 12,
                  cursor: 'not-allowed',
                  opacity: 0.6,
                }}
              />
              <div style={{ fontSize: 9, color: 'var(--shell-fg-3, #7A8A75)', marginTop: 4 }}>
                Planned filter — not applied to database queries
              </div>
            </div>
          </div>

          {validationError && (
            <div
              style={{
                color: '#FCA5A5',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                padding: '8px 12px',
                borderRadius: 4,
                fontSize: 12,
                marginBottom: 12,
              }}
            >
              ⚠ {validationError}
            </div>
          )}

          {isMockFixtureSelected && (
            <div
              style={{
                color: '#FDBA74',
                background: '#451A03',
                border: '1px solid #B45309',
                padding: '10px 14px',
                borderRadius: 6,
                fontSize: 12,
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>🧪</span>
              <span>
                <strong>Mock fixture selected</strong> — values are demo-only and are not known UAT
                data. Run against a real UAT process order before claiming browser verification.
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="submit"
              style={{
                background: '#0284c7',
                color: '#fff',
                border: 0,
                borderRadius: 4,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              disabled={isAnyLoading}
            >
              {isAnyLoading ? 'Running Investigation...' : 'Run / Refresh Order History'}
            </button>

            <button
              type="button"
              onClick={handleUatCandidateClick}
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: 4,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Load UAT candidate process order 7006965038 / C113
            </button>

            <button
              type="button"
              onClick={handlePresetClick}
              style={{
                background: 'rgba(249, 250, 251, 0.05)',
                color: '#D1D5DB',
                border: '1px solid #4B5563',
                borderRadius: 4,
                padding: '10px 20px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Load Demo-Only Fixture
            </button>

            <button
              type="button"
              onClick={handleReset}
              style={{
                background: 'transparent',
                color: '#9CA3AF',
                border: '1px solid #374151',
                borderRadius: 4,
                padding: '10px 20px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Reset
            </button>

            <div style={{ flexGrow: 1 }} />

            <button
              type="button"
              onClick={handleCopyRequestDetails}
              style={{
                background: 'transparent',
                color: '#38bdf8',
                border: '1px solid #0284c7',
                borderRadius: 4,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {isCopied ? 'Copied UAT Evidence!' : 'Copy UAT Evidence'}
            </button>
          </div>
          {form.processOrderId === '7006965038' && form.plantId === 'C113' && (
            <div
              style={{
                marginTop: 10,
                fontSize: 11,
                color: '#FBBF24',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: 4,
                padding: '8px 10px',
              }}
            >
              Candidate expected results require UAT validation; loaded data must be compared to
              SAP/Databricks source evidence.
            </div>
          )}
        </form>

        {!queryParams && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: '#9CA3AF',
              fontStyle: 'italic',
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <span>💡</span>
            <span>
              Enter a known UAT process order for verification. Click "Load Demo Preset" to test
              offline with fixture data.
            </span>
          </div>
        )}
      </div>

      {/* Empty / Initial State */}
      {!queryParams && (
        <div
          style={{
            textAlign: 'center',
            padding: '64px 32px',
            border: '2px dashed #374151',
            borderRadius: 8,
            color: '#9CA3AF',
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#D1D5DB' }}>
            Enter a process order to load history.
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 12 }}>
            Provide a Process Order ID in the panel above and press "Run / Refresh" to trigger Unity
            Catalog queries.
          </p>
        </div>
      )}

      {/* Render Results */}
      {queryParams && (
        <div>
          {isAnyLoading && (
            <div
              style={{
                textAlign: 'center',
                padding: 32,
                background: '#1F2937',
                border: '1px solid #374151',
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  border: '3px solid #38bdf8',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 8px auto',
                }}
              />
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>
                Running native Databricks Unity Catalog queries...
              </div>
            </div>
          )}

          {hasPartialOrderHistory && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 8,
                padding: 14,
                marginBottom: 16,
                color: '#FBBF24',
                fontSize: 12,
              }}
            >
              <strong>Partial order history loaded</strong> — do not treat this process order
              history as complete until unavailable, no-record, or failed sections are resolved.
            </div>
          )}

          {!isAnyLoading && !hasAnyData && !hasAnyError && (
            <div
              style={{
                textAlign: 'center',
                padding: 32,
                background: '#1F2937',
                border: '1px solid #3EF4D6',
                borderRadius: 8,
                marginBottom: 16,
                color: '#9CA3AF',
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 8 }}>❌</div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#D1D5DB' }}>
                Native routes returned no rows for this process order.
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12 }}>
                Please verify if order ID "{queryParams.processOrderId}" exists in your UAT
                Databricks schema.
              </p>
            </div>
          )}

          {/* C. Order Context Card */}
          {headerErr && renderRouteError('Header Context', headerErr, 'POST /api/por/order-header')}

          {headerQuery.data?.ok && !headerData && !headerErr && (
            <div style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>
                  Process Order Header Context
                </h3>
                <EvidenceStatusBadge status={sectionStateToEvidenceStatus(sectionStates.header)} />
              </div>
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: '#111827',
                  borderRadius: 6,
                  border: '1px dashed #374151',
                  color: '#9CA3AF',
                  fontSize: 12,
                }}
              >
                {getNoRecordsMessage('header')}
              </div>
            </div>
          )}

          {headerData && !headerErr && (
            <div style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                  borderBottom: '1px solid #374151',
                  paddingBottom: 8,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>
                  Process Order Header Context
                </h3>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#9CA3AF' }}>Source:</span>
                  <SourceModeBadge
                    mode={(headerQuery.data?.source as ExtendedSourceMode) || 'unknown'}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                    Process Order ID
                  </div>
                  <div
                    style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', marginTop: 2 }}
                  >
                    {headerData.processOrderId}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                    Order Type
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                    {headerData.orderType}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                    Material ID / Desc
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                    {headerData.materialId} - {headerData.materialDescription}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                    Plant / Production Line
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                    {headerData.plantId}{' '}
                    {headerData.productionLine ? `· ${headerData.productionLine}` : ''}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                    Order Quantities
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                    {headerData.confirmedQuantity != null
                      ? headerData.confirmedQuantity.toLocaleString()
                      : '—'}{' '}
                    /{' '}
                    {headerData.plannedQuantity != null
                      ? `${headerData.plannedQuantity.toLocaleString()} ${headerData.uom ?? ''}`.trim()
                      : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                    Planned Schedule
                  </div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>
                    {safeFormatDate(headerData.plannedStart)} -{' '}
                    {safeFormatDate(headerData.plannedFinish)}
                  </div>
                </div>
                {headerData.actualStart && (
                  <div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                      Actual Start
                    </div>
                    <div style={{ fontSize: 12, marginTop: 2 }}>
                      {new Date(headerData.actualStart).toLocaleString()}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                    Status
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 'bold',
                      color: '#10B981',
                      marginTop: 2,
                      textTransform: 'uppercase',
                    }}
                  >
                    {headerData.orderStatus}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* D. Operations Table */}
          {operationsErr &&
            renderRouteError('Operations', operationsErr, 'GET /api/por/order-operations')}

          {operationsQuery.data?.ok && operations.length === 0 && !operationsErr && (
            <div style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>
                  Operations & Process Phases
                </h3>
                <EvidenceStatusBadge status={operationsStatus} />
              </div>
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: '#111827',
                  borderRadius: 6,
                  border: '1px dashed #374151',
                  color: '#9CA3AF',
                  fontSize: 12,
                }}
              >
                {getNoRecordsMessage('operations')}
              </div>
            </div>
          )}

          {operations.length > 0 && !operationsErr && (
            <div style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>
                  Operations & Process Phases
                </h3>
                <EvidenceStatusBadge status={operationsStatus} />
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12, lineHeight: '1.4' }}>
                💡 <strong>Operations & process phases</strong> represent scheduled or completed
                steps (e.g., pasteurisation, standardization). Planned durations are derived from
                SAP recipe specifications, whereas actual timestamps are captured from execution
                events on the plant floor.
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Phase #</th>
                      <th style={tableHeaderStyle}>Operation Text</th>
                      <th style={tableHeaderStyle}>Work Centre</th>
                      <th style={tableHeaderStyle}>Duration (Plan / Act)</th>
                      <th style={tableHeaderStyle}>Actual Timestamps</th>
                      <th style={tableHeaderStyle}>Status</th>
                      <th style={tableHeaderStyle}>Exceptions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations.map((op, idx) => (
                      <tr key={op.operationId} style={tableRowStyle(idx)}>
                        <td style={tableCellStyle}>{op.operationNumber}</td>
                        <td style={tableCellStyle}>{op.operationText}</td>
                        <td style={tableCellStyle}>{op.workCentre}</td>
                        <td style={tableCellStyle}>
                          {op.plannedDurationMinutes}m /{' '}
                          {op.actualDurationMinutes != null ? `${op.actualDurationMinutes}m` : '-'}
                        </td>
                        <td style={tableCellStyle}>
                          {op.actualStart ? new Date(op.actualStart).toLocaleString() : '-'}
                          {op.actualFinish
                            ? ` to ${new Date(op.actualFinish).toLocaleString()}`
                            : ''}
                        </td>
                        <td style={tableCellStyle}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: 3,
                              fontSize: 10,
                              fontWeight: 600,
                              background:
                                op.status === 'confirmed'
                                  ? 'rgba(16,185,129,0.1)'
                                  : 'rgba(245,158,11,0.1)',
                              color: op.status === 'confirmed' ? '#10B981' : '#F59E0B',
                            }}
                          >
                            {op.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={tableCellStyle}>
                          {op.hasException ? (
                            <span style={{ color: '#F87171', fontWeight: 'bold' }}>
                              ⚠ Excursion
                            </span>
                          ) : (
                            <span style={{ color: '#10B981' }}>None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* E. Confirmations Table */}
          {confirmationsErr &&
            renderRouteError('Confirmations', confirmationsErr, 'GET /api/por/order-confirmations')}

          {confirmationsQuery.data?.ok && confirmations.length === 0 && !confirmationsErr && (
            <div style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>
                  Posted Yield Confirmations
                </h3>
                <EvidenceStatusBadge status={confirmationsStatus} />
              </div>
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: '#111827',
                  borderRadius: 6,
                  border: '1px dashed #374151',
                  color: '#9CA3AF',
                  fontSize: 12,
                }}
              >
                {getNoRecordsMessage('confirmations')}
              </div>
            </div>
          )}

          {confirmations.length > 0 && !confirmationsErr && (
            <div style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>
                  Posted Yield Confirmations
                </h3>
                <EvidenceStatusBadge status={confirmationsStatus} />
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12, lineHeight: '1.4' }}>
                💡 <strong>Yield confirmations</strong> record actual production output, scrap, and
                durations confirmed by operators at each phase. Final confirmations indicate phase
                completion, while partial confirmations show intermediate progress updates.
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Confirmation ID</th>
                      <th style={tableHeaderStyle}>Phase ID</th>
                      <th style={tableHeaderStyle}>Confirmed Yield</th>
                      <th style={tableHeaderStyle}>Date Posted</th>
                      <th style={tableHeaderStyle}>Setup/Machine/Clean</th>
                      <th style={tableHeaderStyle}>Variance</th>
                      <th style={tableHeaderStyle}>Inspector</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confirmations.map((conf, idx) => (
                      <tr key={conf.confirmationId} style={tableRowStyle(idx)}>
                        <td style={tableCellStyle}>{conf.confirmationId}</td>
                        <td style={tableCellStyle}>{conf.operationId}</td>
                        <td style={tableCellStyle}>
                          {conf.confirmedYield != null
                            ? `${conf.confirmedYield.toLocaleString()} ${conf.uom ?? ''}`.trim()
                            : '—'}
                        </td>
                        <td style={tableCellStyle}>{safeFormatDate(conf.confirmedAt)}</td>
                        <td style={tableCellStyle}>
                          {conf.setupDurationMinutes != null
                            ? `${conf.setupDurationMinutes}m / `
                            : '- / '}
                          {conf.machineDurationMinutes != null
                            ? `${conf.machineDurationMinutes}m / `
                            : '- / '}
                          {conf.cleaningDurationMinutes != null
                            ? `${conf.cleaningDurationMinutes}m`
                            : '-'}
                        </td>
                        <td style={tableCellStyle}>
                          {conf.variancePercent != null ? (
                            <span
                              style={{ color: conf.variancePercent > 10 ? '#EF4444' : '#10B981' }}
                            >
                              {conf.variancePercent}%
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td style={tableCellStyle}>{conf.confirmedBy || 'System'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* F. Goods Movements Table */}
          {goodsMovementsErr &&
            renderRouteError(
              'Goods Movements',
              goodsMovementsErr,
              'GET /api/por/order-goods-movements',
            )}

          {goodsMovementsQuery.data?.ok && goodsMovements.length === 0 && !goodsMovementsErr && (
            <div style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>
                  Goods Movements (Material Documents)
                </h3>
                <EvidenceStatusBadge status={goodsMovementsStatus} />
              </div>
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: '#111827',
                  borderRadius: 6,
                  border: '1px dashed #374151',
                  color: '#9CA3AF',
                  fontSize: 12,
                }}
              >
                {getNoRecordsMessage('goodsMovements')}
              </div>
            </div>
          )}

          {goodsMovements.length > 0 && !goodsMovementsErr && (
            <div style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>
                  Goods Movements (Material Documents)
                </h3>
                <EvidenceStatusBadge status={goodsMovementsStatus} />
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12, lineHeight: '1.4' }}>
                💡 <strong>Goods movements</strong> represent physical stock transactions: Goods
                Issues (INPUT/261) represent raw materials consumed into the process order, while
                Goods Receipts (OUTPUT/101) represent finished or co-product stock produced.
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Doc ID</th>
                      <th style={tableHeaderStyle}>Type</th>
                      <th style={tableHeaderStyle}>Direction</th>
                      <th style={tableHeaderStyle}>Material ID</th>
                      <th style={tableHeaderStyle}>Material Desc</th>
                      <th style={tableHeaderStyle}>Batch ID</th>
                      <th style={tableHeaderStyle}>Quantity</th>
                      <th style={tableHeaderStyle}>Date Posted</th>
                      <th style={tableHeaderStyle}>S-Loc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goodsMovements.map((mov, idx) => (
                      <tr key={mov.movementId} style={tableRowStyle(idx)}>
                        <td style={tableCellStyle}>{mov.movementId}</td>
                        <td style={tableCellStyle}>{mov.movementType}</td>
                        <td style={tableCellStyle}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: 3,
                              fontSize: 10,
                              fontWeight: 'bold',
                              background:
                                mov.direction === 'input'
                                  ? 'rgba(123,97,255,0.1)'
                                  : mov.direction === 'output'
                                    ? 'rgba(56,142,60,0.1)'
                                    : 'rgba(136,136,136,0.1)',
                              color:
                                mov.direction === 'input'
                                  ? '#7B61FF'
                                  : mov.direction === 'output'
                                    ? '#388E3C'
                                    : '#888',
                            }}
                          >
                            {mov.direction.toUpperCase()}
                          </span>
                        </td>
                        <td style={tableCellStyle}>{mov.materialId}</td>
                        <td style={tableCellStyle}>{mov.materialDescription || '-'}</td>
                        <td style={tableCellStyle}>
                          {mov.batchId ? (
                            <span style={{ fontFamily: 'monospace' }}>{mov.batchId}</span>
                          ) : (
                            <span style={{ fontStyle: 'italic', color: '#6B7280' }}>none</span>
                          )}
                        </td>
                        <td style={tableCellStyle}>
                          {mov.quantity != null
                            ? `${mov.quantity.toLocaleString()} ${mov.uom ?? ''}`.trim()
                            : '—'}
                        </td>
                        <td style={tableCellStyle}>{safeFormatDate(mov.postedAt)}</td>
                        <td style={tableCellStyle}>{mov.storageLocation || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* G. Component Consumption (Derived from 261/262 movements) */}
          {goodsMovements.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>
                Component Consumption Evidence
              </h3>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12, lineHeight: '1.4' }}>
                Derived from returned goods movements only: 261 adds component issue, 262 subtracts
                reversal, EA rows are excluded, and G is normalised to KG. This is not a BOM or
                reservation coverage claim.
              </div>

              {componentConsumption.length === 0 ? (
                <div
                  style={{
                    padding: '20px 16px',
                    textAlign: 'center',
                    background: '#111827',
                    borderRadius: 6,
                    border: '1px dashed #374151',
                    color: '#9CA3AF',
                    fontSize: 12,
                  }}
                >
                  No net component consumption rows derived from 261/262 movement types. Do not
                  interpret as no BOM or reservation requirements until source coverage is
                  validated.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    data-testid="component-consumption-table"
                    style={{ width: '100%', borderCollapse: 'collapse' }}
                  >
                    <thead>
                      <tr>
                        <th style={tableHeaderStyle}>Material ID</th>
                        <th style={tableHeaderStyle}>Material Desc</th>
                        <th style={tableHeaderStyle}>Representative Batch</th>
                        <th style={tableHeaderStyle}>Net Consumed</th>
                        <th style={tableHeaderStyle}>Source Rows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {componentConsumption.map((component, idx) => (
                        <tr
                          key={`${component.materialId}::${component.batchId ?? ''}::${component.uom}`}
                          style={tableRowStyle(idx)}
                        >
                          <td style={tableCellStyle}>{component.materialId}</td>
                          <td style={tableCellStyle}>{component.materialDescription || '-'}</td>
                          <td style={tableCellStyle}>
                            {component.batchId ? (
                              <span style={{ fontFamily: 'monospace' }}>{component.batchId}</span>
                            ) : (
                              <span style={{ fontStyle: 'italic', color: '#6B7280' }}>
                                not returned
                              </span>
                            )}
                          </td>
                          <td style={tableCellStyle}>
                            {component.totalQuantity.toLocaleString()} {component.uom}
                          </td>
                          <td style={tableCellStyle}>{component.sourceMovementCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* H. Produced Output (Derived from 101/102/531 movements) */}
          {goodsMovements.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>
                Produced Output Evidence
              </h3>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12, lineHeight: '1.4' }}>
                Derived from returned goods movements only: 101 and 531 add produced output, 102
                subtracts reversal, EA rows are excluded, and G is normalised to KG. This is not a
                production completion or full yield claim.
              </div>

              {producedOutput.length === 0 ? (
                <div
                  style={{
                    padding: '20px 16px',
                    textAlign: 'center',
                    background: '#111827',
                    borderRadius: 6,
                    border: '1px dashed #374151',
                    color: '#9CA3AF',
                    fontSize: 12,
                  }}
                >
                  No produced-output rows derived from 101/102/531 movement types. Do not interpret
                  as no production output until source coverage is validated.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    data-testid="produced-output-table"
                    style={{ width: '100%', borderCollapse: 'collapse' }}
                  >
                    <thead>
                      <tr>
                        <th style={tableHeaderStyle}>Material ID</th>
                        <th style={tableHeaderStyle}>Material Desc</th>
                        <th style={tableHeaderStyle}>Produced Batch</th>
                        <th style={tableHeaderStyle}>Net Received</th>
                        <th style={tableHeaderStyle}>Movement Types</th>
                        <th style={tableHeaderStyle}>Reference Doc</th>
                        <th style={tableHeaderStyle}>Source Rows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {producedOutput.map((output, idx) => (
                        <tr
                          key={`${output.materialId}-${output.batchId || 'no-batch'}-${output.uom}`}
                          style={tableRowStyle(idx)}
                        >
                          <td style={tableCellStyle}>{output.materialId}</td>
                          <td style={tableCellStyle}>{output.materialDescription || '-'}</td>
                          <td style={tableCellStyle}>
                            {output.batchId ? (
                              <span style={{ fontFamily: 'monospace' }}>{output.batchId}</span>
                            ) : (
                              <span style={{ fontStyle: 'italic', color: '#6B7280' }}>
                                not returned
                              </span>
                            )}
                          </td>
                          <td style={tableCellStyle}>
                            {output.netQuantity.toLocaleString()} {output.uom}
                          </td>
                          <td style={tableCellStyle}>{output.movementTypes.join(', ')}</td>
                          <td style={tableCellStyle}>{output.referenceDocument || '-'}</td>
                          <td style={tableCellStyle}>{output.sourceMovementCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* I. Movement Summary & Derived stats */}
          {goodsMovements.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>
                Operational Workload & Goods Movements Summary
              </h3>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 12,
                }}
              >
                <div style={{ background: '#111827', padding: 12, borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                    Input Movements (GI)
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#7B61FF', marginTop: 4 }}>
                    {metrics.inputsCount}
                  </div>
                </div>

                <div style={{ background: '#111827', padding: 12, borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                    Output Movements (GR)
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#388E3C', marginTop: 4 }}>
                    {metrics.outputsCount}
                  </div>
                </div>

                <div style={{ background: '#111827', padding: 12, borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                    Unclassified Movements
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#9CA3AF', marginTop: 4 }}>
                    {metrics.unclassifiedCount}
                  </div>
                </div>

                <div style={{ background: '#111827', padding: 12, borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                    Distinct Materials / Batches
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#F59E0B', marginTop: 4 }}>
                    {metrics.distinctMaterialsCount} MATs · {metrics.distinctBatchesCount} BATCHs
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12, padding: 12, background: '#111827', borderRadius: 6 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: '#9CA3AF',
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  Summed Quantities by Unit of Measure
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {metrics.uoms.map((uom) => (
                    <span
                      key={uom}
                      style={{
                        background: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: 4,
                        padding: '4px 8px',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {metrics.uomSums[uom].toLocaleString()} {uom}
                    </span>
                  ))}
                </div>
                {metrics.hasMixedUoms && (
                  <div style={{ fontSize: 11, color: '#FCA5A5', marginTop: 8 }}>
                    ⚠ <strong>Mixed UOM Warning:</strong> Summing quantities directly across
                    distinct units is disabled to avoid logical dimension errors.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* J. Timeline (Derived) */}
          {(sortedTimeline.dated.length > 0 || sortedTimeline.undated.length > 0) && (
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: '#38bdf8' }}>
                Chronological Event Timeline
              </h3>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12, lineHeight: '1.4' }}>
                💡 The event timeline automatically consolidates and sorts operations,
                confirmations, and goods movements by their actual posting dates. Events without
                valid posting dates are grouped below.
              </div>

              {sortedTimeline.dated.length === 0 ? (
                <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>
                  No dated events recorded.
                </p>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gap: 10,
                    paddingLeft: 8,
                    borderLeft: '2px solid #374151',
                  }}
                >
                  {sortedTimeline.dated.map((evt) => (
                    <div key={evt.id} style={{ position: 'relative', paddingLeft: 12 }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: -14,
                          top: 4,
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background:
                            evt.type === 'operation-start'
                              ? '#38bdf8'
                              : evt.type === 'operation-finish'
                                ? '#10B981'
                                : evt.type === 'confirmation'
                                  ? '#F59E0B'
                                  : '#7B61FF',
                        }}
                      />
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>
                          {evt.title}
                        </span>
                        <span style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' }}>
                          {new Date(evt.dateString).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                        {evt.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sortedTimeline.undated.length > 0 && (
                <div style={{ marginTop: 16, borderTop: '1px solid #374151', paddingTop: 12 }}>
                  <h4
                    style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: '#F59E0B' }}
                  >
                    Undated events
                  </h4>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {sortedTimeline.undated.map((evt) => (
                      <div
                        key={evt.id}
                        style={{ background: '#111827', padding: 8, borderRadius: 4 }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#E5E7EB' }}>
                          {evt.title}
                        </div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                          {evt.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* I. Exceptions / Data Quality Panel */}
          {exceptions.length > 0 && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 8,
                padding: 16,
                color: '#FCA5A5',
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  margin: '0 0 10px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#EF4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>⚠</span>
                <span>Data Quality and Operations Exceptions ({exceptions.length})</span>
              </h3>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, display: 'grid', gap: 6 }}>
                {exceptions.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* J. Collapsible Technical Details */}
          <div style={cardStyle}>
            <button
              type="button"
              onClick={() => setTechnicalOpen(!technicalOpen)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 0,
                color: '#38bdf8',
                textAlign: 'left',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>
                {technicalOpen
                  ? '▼ Hide Technical Query Diagnostics'
                  : '▶ Show Technical Query Diagnostics'}
              </span>
              <span
                style={{
                  fontSize: 10,
                  background: '#111827',
                  color: '#9CA3AF',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                UAT Verification Pending
              </span>
            </button>

            {technicalOpen && (
              <div style={{ marginTop: 12, borderTop: '1px solid #374151', paddingTop: 12 }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: '#9CA3AF',
                        textTransform: 'uppercase',
                        marginBottom: 4,
                      }}
                    >
                      Active Endpoints
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        background: '#111827',
                        padding: 8,
                        borderRadius: 4,
                        fontSize: 11,
                        color: '#10B981',
                        overflowX: 'auto',
                        fontFamily: 'monospace',
                      }}
                    >
                      POST /api/por/order-header GET /api/por/order-operations GET
                      /api/por/order-confirmations GET /api/por/order-goods-movements
                    </pre>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: '#9CA3AF',
                        textTransform: 'uppercase',
                        marginBottom: 4,
                      }}
                    >
                      Active Query Parameters
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        background: '#111827',
                        padding: 8,
                        borderRadius: 4,
                        fontSize: 11,
                        color: '#E5E7EB',
                        overflowX: 'auto',
                        fontFamily: 'monospace',
                      }}
                    >
                      {JSON.stringify(queryParams, null, 2)}
                    </pre>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#FBBF24',
                        background: 'rgba(245, 158, 11, 0.08)',
                        padding: '6px 10px',
                        borderRadius: 4,
                        marginTop: 4,
                      }}
                    >
                      ⚠️ <strong>Note:</strong> Planned filter parameters (materialId, batchId) are
                      not currently applied by the upstream native Databricks routes.
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                        Fetched At Timestamp
                      </div>
                      <div style={{ fontSize: 12, color: '#E5E7EB', marginTop: 2 }}>
                        {new Date().toISOString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                        Auth Bearer Status
                      </div>
                      <div style={{ fontSize: 12, color: '#E5E7EB', marginTop: 2 }}>
                        Scoped User OAuth Context
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                        Section Source Statuses
                      </div>
                      <div style={{ fontSize: 11, color: '#E5E7EB', marginTop: 2 }}>
                        Header: {headerStatus} | Ops: {operationsStatus} | Conf:{' '}
                        {confirmationsStatus} | Movements: {goodsMovementsStatus}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>
                        UAT Verification Status
                      </div>
                      <div
                        style={{ fontSize: 12, color: '#FBBF24', fontWeight: 600, marginTop: 2 }}
                      >
                        Pending Claude UAT Sweep
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
