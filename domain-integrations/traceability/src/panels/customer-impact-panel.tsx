import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { CustomerExposureSummary } from '@connectio/data-contracts'
import { useCustomerExposureSummary } from '../adapters/trace2-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'
import { QueriedAtLabel } from '../components/QueriedAtLabel.js'

/** Static registration record for the Customer Impact panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'customer-impact',
  displayName: 'Customer Impact',
  description: 'Downstream customer and delivery exposure including recall recommendation.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['trace-investigation'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.97, hidden: false },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

/** Props for CustomerImpactPanel. */
export interface CustomerImpactPanelProps {
  /** Adapter request context providing investigationId and batchId. */
  readonly request: Trace2AdapterRequest
}

/**
 * Evidence panel showing customer exposure and delivery impact summary.
 *
 * @remarks
 * When `recallRecommended` is true the panel renders a prominent warning banner.
 * Blocked deliveries are highlighted in red if greater than zero.
 */
export function CustomerImpactPanel({ request }: CustomerImpactPanelProps) {
  const { data: result, isLoading } = useCustomerExposureSummary(request)
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

  const data: CustomerExposureSummary | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 8 }}>
          {data.deliveryEvidenceSource === 'lineage' && (
            <div style={{ fontSize: 11, color: 'var(--amber, #C07000)', padding: '4px 8px', background: 'var(--amber-bg, #FFFBEB)', border: '1px solid var(--amber, #C07000)', borderRadius: 3 }}>
              Lineage-only exposure indicator — countries and customer names not available from this source.
            </div>
          )}
          {data.recallRecommended && (
            <div
              style={{
                padding: '8px 12px',
                background: '#FEF2F2',
                border: '1px solid var(--sunset, #F24A00)',
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 12,
                color: 'var(--sunset, #F24A00)',
              }}
              role="alert"
              aria-label="Recall recommended"
            >
              ⚠ Recall recommended — {data.highestSeverity.toUpperCase()} severity
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <CustomerStat label="Customers" value={data.affectedCustomers} />
            <CustomerStat
              label={data.deliveryEvidenceSource === 'inventory-movements' ? 'Deliveries' : 'Delivery movements'}
              value={data.affectedDeliveries}
            />
            <CustomerStat label="Blocked" value={data.blockedDeliveries} highlight={data.blockedDeliveries > 0} />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>
                {data.deliveryEvidenceSource === 'inventory-movements' ? 'Shipped Qty' : 'Exposure Qty'}
              </span>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--shell-fg)' }}>
                {data.shippedQuantity.toLocaleString()} {data.uom ?? 'source units'}
              </div>
            </div>
            {data.countries.length > 0 && (
              <div>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>
                  Countries
                </span>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--shell-fg)' }}>
                  {data.countries.join(', ')}
                </div>
              </div>
            )}
          </div>
          {data.countries.length === 0 && data.affectedDeliveries > 0 && (
            <div style={{ fontSize: 11, color: 'var(--amber, #C07000)', marginTop: 2 }}>
              Country data not yet available from current source — do not interpret as geographic containment.
            </div>
          )}
          {data.maxExposureDepth != null && (
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
              {data.maxExposureDepth === 1
                ? 'Direct shipment detected (depth 1).'
                : `Indirect exposure detected (min depth ${data.maxExposureDepth}).`}
            </div>
          )}
          <QueriedAtLabel fetchedAt={lastRefreshedAt} style={{ marginTop: 4 }} />
        </div>
      )}
    </EvidencePanel>
  )
}

/** Small numeric stat within the customer impact panel. */
function CustomerStat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--shell-surface)', borderRadius: 4, border: '1px solid var(--shell-line)' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: highlight ? 'var(--sunset, #F24A00)' : 'var(--shell-fg)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  )
}
