import { useState } from 'react'
import { BatchHeaderPanel } from '../panels/batch-header-panel.js'
import { RiskSignalsPanel } from '../panels/risk-signals-panel.js'
import { TraceGraphPanel } from '../panels/trace-graph-panel.js'
import { CustomerImpactPanel } from '../panels/customer-impact-panel.js'
import { CoAReleaseStatusPanel } from '../panels/coa-release-status-panel.js'
import { EventTimelinePanel } from '../panels/event-timeline-panel.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'
import {
  useBatchHeaderSummary,
  useCustomerExposureSummary,
  useMassBalanceSummary,
  useCoAReleaseStatus,
  useSupplierExposureSummary,
  useTraceGraph,
} from '../adapters/trace2-queries.js'
import { calculateConfidence } from '../components/EvidenceConfidence.js'
import { InvestigationSummary } from '../components/InvestigationSummary.js'
import { EvidencePackReadiness } from '../components/EvidencePackReadiness.js'
import { TraceabilityInitialState } from '../components/TraceabilityInitialState.js'
import { TraceQueryForm } from '../forms/trace-query-form.js'
import { featureFlags } from '@connectio/feature-flags'
import { useOptionalActiveInvestigationContext } from '@connectio/workspace-runtime'

import type { AdapterError } from '@connectio/source-adapters'

/** Props for OverviewView. */
import { UAT_CANDIDATE } from '../constants.js'

export interface OverviewViewProps {
  /** Adapter request context forwarded to all panels. */
  readonly request: Trace2AdapterRequest
}

/** Maps adapter error codes to user-facing headings. */
function batchHeaderErrorHeading(code: AdapterError['code']): string {
  switch (code) {
    case 'not-found':
      return 'Batch not found'
    case 'unauthorized':
      return 'Not authorized or data not accessible'
    case 'timeout':
      return 'Data source timeout'
    default:
      return 'Batch header unavailable'
  }
}

/** Inline error banner shown in the cockpit header when the batch header adapter fails. */
function BatchHeaderErrorBanner({ code, message }: Pick<AdapterError, 'code' | 'message'>) {
  return (
    <div
      role="alert"
      aria-label="Batch header error"
      style={{
        padding: '10px 14px',
        borderRadius: 6,
        border: '1px solid var(--sunset, #F24A00)',
        background: 'rgba(242, 74, 0, 0.08)',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sunset, #F24A00)', flexShrink: 0 }}>
        {batchHeaderErrorHeading(code)}
      </span>
      <span style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{message}</span>
    </div>
  )
}

/**
 * Overview view for the Trace Investigation workspace.
 *
 * @remarks
 * Renders the consolidated InvestigationSummary at the top of the layout,
 * and a split grid containing the 6 modular evidence panels alongside the
 * EvidencePackReadiness digital compilation checklist.
 */
export function OverviewView({ request: initialRequest }: OverviewViewProps) {
  const [request, setRequest] = useState<Trace2AdapterRequest>(initialRequest)
  const [sim, setSim] = useState(false)
  const adapterMode = import.meta.env.VITE_ADAPTER_MODE ?? 'mock'
  const setActiveInvestigationContext = useOptionalActiveInvestigationContext(
    (state) => state.setContext,
    () => undefined,
  )

  function submitInvestigationContext(nextRequest: Trace2AdapterRequest) {
    setRequest(nextRequest)
    if (!featureFlags.runtime.enableCrossDomainContext) return
    setActiveInvestigationContext({
      batchId: nextRequest.batchId,
      materialId: nextRequest.materialId,
      plantId: nextRequest.plantId,
      lastChangedByPanel: 'trace-query-form',
    })
  }

  // Fetch all required data sectors for confidence rating and cockpit header
  const { data: batchHeaderResult } = useBatchHeaderSummary(request)
  const { data: customerExposureResult } = useCustomerExposureSummary(request)
  const { data: massBalanceResult } = useMassBalanceSummary(request)
  const { data: coaReleaseResult } = useCoAReleaseStatus(request)
  const { data: supplierExposureResult } = useSupplierExposureSummary(request)
  const { data: traceGraphResult } = useTraceGraph(request)

  // Distinguish loading (undefined) from error (ok === false) for the cockpit header.
  // When loading, batchHeaderError is null and InvestigationSummary shows a loading state.
  // When the adapter returns an error, we surface a visible banner above the cockpit.
  const batchHeaderError =
    batchHeaderResult !== undefined && !batchHeaderResult.ok ? batchHeaderResult.error : null

  const batchHeader = batchHeaderResult?.ok ? batchHeaderResult.data : null
  const customerExposure = customerExposureResult?.ok ? customerExposureResult.data : null
  const massBalance = massBalanceResult?.ok ? massBalanceResult.data : null
  const coaRelease = coaReleaseResult?.ok ? coaReleaseResult.data : null
  const supplierExposure = supplierExposureResult?.ok ? supplierExposureResult.data : null
  const traceGraph = traceGraphResult?.ok ? traceGraphResult.data : null

  // Calculate evidence confidence dossier metrics
  const confidence = calculateConfidence({
    batchHeader,
    customerExposure,
    massBalance,
    coaRelease,
    supplierExposure,
    traceGraph,
  })

  const isInitialState = !request.batchId || request.batchId === ''

  if (isInitialState) {
    return (
      <TraceabilityInitialState 
        adapterMode={adapterMode}
        onLoadCandidate={() => {
           submitInvestigationContext({
             ...request,
             ...UAT_CANDIDATE
           })
        }}
      >
        <TraceQueryForm 
          onSubmit={submitInvestigationContext}
          initialMaterialId={request.materialId}
          initialBatchId={request.batchId}
          initialPlantId={request.plantId}
          hideCandidateButton={true}
        />
      </TraceabilityInitialState>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 16,
      }}
    >
      {/* Batch header error banner — visible when adapter returns ok:false (not during loading) */}
      {batchHeaderError && (
        <BatchHeaderErrorBanner code={batchHeaderError.code} message={batchHeaderError.message} />
      )}

      {/* Case Header / Investigation cockpit summary */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TraceQueryForm 
          onSubmit={submitInvestigationContext}
          initialMaterialId={request.materialId}
          initialBatchId={request.batchId}
          initialPlantId={request.plantId}
        />
        <InvestigationSummary
          batchHeader={batchHeader}
          customerExposure={customerExposure}
          supplierExposure={supplierExposure}
          confidence={confidence}
          sim={sim}
          onSim={setSim}
          adapterMode={adapterMode}
          fetchedAt={batchHeaderResult?.ok ? batchHeaderResult.fetchedAt : undefined}
        />
      </div>

      {/* Grid structure dividing modular panels and the digital signature card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 3fr) minmax(280px, 1fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* Six modular evidence panels */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 12,
          }}
        >
          <BatchHeaderPanel request={request} />
          <RiskSignalsPanel request={request} />
          <TraceGraphPanel request={request} />
          <CustomerImpactPanel request={request} />
          <CoAReleaseStatusPanel request={request} />
          <EventTimelinePanel request={request} />
        </div>

        {/* Digital verification checklist panel */}
        <EvidencePackReadiness confidence={confidence} />
      </div>
    </div>
  )
}
