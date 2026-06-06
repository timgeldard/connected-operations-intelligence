import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { TraceExposureForRelease } from '@connectio/data-contracts'
import { useTraceExposureForRelease } from '../adapters/trace2-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Static registration record for the Trace Exposure for Release panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'trace-exposure-for-release',
  displayName: 'Trace Exposure',
  description: 'Upstream and downstream trace risk signals relevant to the batch release decision.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['quality-batch-release'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

/** Props for TraceExposureForReleasePanel. */
export interface TraceExposureForReleasePanelProps {
  /** Adapter request context providing investigationId and batchId. */
  readonly request: Trace2AdapterRequest
}

/**
 * Evidence panel displaying trace exposure signals for a batch release decision.
 *
 * @remarks
 * Shows upstream/downstream risk levels, affected customer/supplier counts,
 * open trace investigations, and recall risk flag. Owned by the traceability
 * domain; consumed exclusively by the quality-batch-release workspace.
 */
export function TraceExposureForReleasePanel({ request }: TraceExposureForReleasePanelProps) {
  const { data: result, isLoading } = useTraceExposureForRelease(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) {
      markReady()
    } else if (result && !result.ok) {
      markError()
    }
  }, [isLoading, result, markReady, markError])

  const data: TraceExposureForRelease | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <TraceRiskField
              label="Upstream Risk"
              level={data.upstreamRiskLevel}
            />
            <TraceRiskField
              label="Downstream Risk"
              level={data.downstreamRiskLevel}
            />
            <TraceMetricField label="Affected Customers" value={String(data.affectedCustomerCount)} />
            <TraceMetricField label="Affected Supplier Lots" value={String(data.affectedSupplierLotCount)} />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--shell-fg-3)' }}>
              Trace Readiness:
            </span>
            <ReadinessBadge status={data.traceReadiness} />
            {data.recallRiskFlag && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sunset, #F24A00)', marginLeft: 8 }}>
                ⚠ Recall Risk
              </span>
            )}
          </div>

          {data.openTraceInvestigations.length > 0 && (
            <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 6 }}>
                Open Investigations
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {data.openTraceInvestigations.map((inv) => (
                  <div key={inv.investigationId} style={{ fontSize: 12, padding: '6px 8px', background: 'var(--shell-surface-2)', borderRadius: 4 }}>
                    <span style={{ fontWeight: 600, color: 'var(--shell-fg)' }}>{inv.investigationId}</span>
                    <span style={{ color: 'var(--shell-fg-2)', marginLeft: 8 }}>{inv.summary}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

const RISK_COLOUR: Record<string, string> = {
  none: 'var(--shell-fg-3)',
  low: '#4CAF50',
  medium: '#FF9800',
  high: 'var(--sunset, #F24A00)',
  critical: '#D32F2F',
}

function TraceRiskField({ label, level }: { label: string; level: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: RISK_COLOUR[level] ?? 'var(--shell-fg)', textTransform: 'capitalize' }}>
        {level}
      </div>
    </div>
  )
}

function TraceMetricField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--shell-fg)' }}>{value}</div>
    </div>
  )
}

const READINESS_COLOUR: Record<string, string> = {
  clean: '#4CAF50',
  flagged: '#FF9800',
  blocked: '#D32F2F',
  unknown: 'var(--shell-fg-3)',
}

function ReadinessBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'capitalize',
        color: READINESS_COLOUR[status] ?? 'var(--shell-fg)',
        padding: '2px 8px',
        borderRadius: 12,
        background: 'var(--shell-surface-2)',
      }}
    >
      {status}
    </span>
  )
}
