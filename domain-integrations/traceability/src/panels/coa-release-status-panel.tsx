import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { CoAReleaseStatus } from '@connectio/data-contracts'
import { useCoAReleaseStatus } from '../adapters/trace2-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Static registration record for the CoA / Release Status panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'coa-release-status',
  displayName: 'CoA & Release Status',
  description: 'Certificate of Analysis availability, usage decision, open quality lots, and pending results.',
  ownerDomain: 'quality',
  sourceOwnership: { domainId: 'quality', systemName: 'sap-qm', legacyAppId: 'connectedquality' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['trace-investigation', 'quality-batch-release'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: { staleAfterSeconds: 180, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.99, hidden: false },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

/** Props for CoAReleaseStatusPanel. */
export interface CoAReleaseStatusPanelProps {
  /** Adapter request context providing investigationId and batchId. */
  readonly request: Trace2AdapterRequest
}

/**
 * Evidence panel showing CoA availability and SAP QM release decision status.
 *
 * @remarks
 * `failedCharacteristics > 0` and `usageDecision === 'reject'` are both
 * highlighted in red. `pendingResults > 0` is shown in amber.
 */
export function CoAReleaseStatusPanel({ request }: CoAReleaseStatusPanelProps) {
  const { data: result, isLoading } = useCoAReleaseStatus(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) markReady()
    else if (result && !result.ok) markError()
  }, [isLoading, result, markReady, markError])

  const data: CoAReleaseStatus | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 8 }}>
          {/* CoA availability + decision */}
          <div style={{ display: 'flex', gap: 12 }}>
            <CoAField
              label="CoA Available"
              value={data.coaAvailable ? 'Yes' : 'No'}
              highlight={!data.coaAvailable}
            />
            <CoAField
              label="Release Status"
              value={data.releaseStatus.replace(/-/g, ' ')}
              highlight={data.releaseStatus === 'blocked' || data.releaseStatus === 'not-released'}
            />
            <CoAField
              label="Usage Decision"
              value={data.usageDecision.replace(/-/g, ' ')}
              highlight={data.usageDecision === 'reject'}
            />
          </div>
          {/* Counts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <CoAStat label="Open QM Lots" value={data.openQualityLots} highlight={data.openQualityLots > 0} />
            <CoAStat label="Failed Chars" value={data.failedCharacteristics} highlight={data.failedCharacteristics > 0} />
            <CoAStat label="Pending Results" value={data.pendingResults} warn={data.pendingResults > 0} />
          </div>
          {data.lastDecisionAt && (
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
              Last decision: {new Date(data.lastDecisionAt).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

/** Labelled text field for CoA/release metadata. */
function CoAField({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: highlight ? 'var(--sunset, #F24A00)' : 'var(--shell-fg)', textTransform: 'capitalize' }}>
        {value}
      </div>
    </div>
  )
}

/** Numeric stat with optional red/amber colouring. */
function CoAStat({ label, value, highlight = false, warn = false }: { label: string; value: number; highlight?: boolean; warn?: boolean }) {
  const colour = highlight ? 'var(--sunset, #F24A00)' : warn ? '#D97706' : 'var(--shell-fg)'
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--shell-surface)', borderRadius: 4, border: '1px solid var(--shell-line)' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: colour }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  )
}
