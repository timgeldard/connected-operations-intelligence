import { useState, useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { CoAReadiness } from '@connectio/data-contracts'
import { useCoAReadiness } from '../adapters/quality-release-queries.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'

/**
 * Static registration record for the CoA Readiness panel.
 *
 * @remarks
 * Distinct from the `coa-release-status` panel (owned by quality, sourced from SAP QM,
 * showing the *decision* record). This panel shows whether the CoA *document* is
 * sufficiently complete to proceed with release. Different data, different domain concern.
 */
const registration: EvidencePanelRegistration = {
  panelId: 'coa-readiness',
  displayName: 'CoA Readiness',
  description: 'Certificate of Analysis document completeness — missing fields, sign-off status, and customer-specific CoAs.',
  ownerDomain: 'quality',
  sourceOwnership: { domainId: 'quality', systemName: 'sap-qm', legacyAppId: 'connectedquality' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['quality-batch-release'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: { staleAfterSeconds: 180, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.99, hidden: false },
  requiredPermissions: [{ permissionId: 'quality.read', displayName: 'Quality Read' }],
}

/** Props for CoAReadinessPanel. */
export interface CoAReadinessPanelProps {
  /** Adapter request context providing releaseCaseId and batchId. */
  readonly request: QualityReleaseAdapterRequest
}

/**
 * Evidence panel displaying CoA document readiness for a batch release decision.
 */
export function CoAReadinessPanel({ request }: CoAReadinessPanelProps) {
  const { data: result, isLoading } = useCoAReadiness(request)
  const [showCustomerCoAs, setShowCustomerCoAs] = useState(true)
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

  const data: CoAReadiness | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <ReadinessStatusBadge status={data.readinessStatus} />
            {data.coaDocumentId ? (
              <CoAField label="Document" value={data.coaDocumentId} />
            ) : (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#D32F2F', marginBottom: 2 }}>
                  Document
                </div>
                <div style={{ fontSize: 12, color: '#D32F2F', fontWeight: 600 }}>
                  CoA document unavailable
                </div>
              </div>
            )}
            {data.signedOffBy && (
              <CoAField label="Signed Off By" value={data.signedOffBy} />
            )}
            {data.signedOffAt && (
              <CoAField label="Signed Off" value={new Date(data.signedOffAt).toLocaleDateString()} />
            )}
          </div>

          {data.missingFields.length > 0 && (
            <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#D32F2F', marginBottom: 4 }}>
                Missing Fields
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {data.missingFields.map((f) => (
                  <span key={f} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(211,47,47,0.1)', color: '#D32F2F', fontWeight: 500 }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.customerSpecificCoas.length > 0 && (
            <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>
                  Customer CoAs
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomerCoAs(!showCustomerCoAs)}
                  style={{
                    fontSize: 10,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--shell-accent, #4F46E5)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    padding: '2px 4px',
                  }}
                >
                  {showCustomerCoAs ? 'Hide' : 'Show'}
                </button>
              </div>
              {showCustomerCoAs && (
                <div style={{ display: 'grid', gap: 4 }}>
                  {data.customerSpecificCoas.map((c) => (
                    <div key={c.customerId} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--shell-fg)' }}>{c.customerName}</span>
                      <CustomerCoAStatus status={c.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8, marginTop: 4, fontSize: 11, color: 'var(--shell-fg-3)', fontStyle: 'italic' }}>
            This panel uses simulated mock data. CoA readiness checks document completeness and draft signature status. Live customer sign-off must be verified before final physical shipment.
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

const READINESS_STYLE: Record<string, { fg: string }> = {
  complete: { fg: '#4CAF50' },
  incomplete: { fg: '#D32F2F' },
  'pending-sign-off': { fg: '#FF9800' },
  'not-applicable': { fg: '#9E9E9E' },
  unknown: { fg: '#9E9E9E' },
}

function ReadinessStatusBadge({ status }: { status: string }) {
  const style = READINESS_STYLE[status] ?? { fg: 'var(--shell-fg)' }
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        Status
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: style.fg, textTransform: 'capitalize' }}>
        {status.replace(/-/g, ' ')}
      </div>
    </div>
  )
}

function CoAField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: 'var(--shell-fg)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

function CustomerCoAStatus({ status }: { status: string }) {
  const colour = status === 'complete' ? '#4CAF50' : status === 'incomplete' ? '#D32F2F' : '#9E9E9E'
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: colour, textTransform: 'capitalize' }}>
      {status.replace(/-/g, ' ')}
    </span>
  )
}
