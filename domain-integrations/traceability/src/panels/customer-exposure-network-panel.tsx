import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { CustomerExposureSummary } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'

const registration: EvidencePanelRegistration = {
  panelId: 'customer-exposure-network',
  displayName: 'Customer Exposure',
  description:
    'Customer exposure summary with severity, geographic spread, and recall recommendation for the network view.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['trace-investigation'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: {
    staleAfterSeconds: 300,
    errorAfterSeconds: 900,
    refreshOnFocus: true,
    pollIntervalSeconds: null,
  },
  confidencePolicy: { level: 0.95, hidden: false },
  drillThrough: {
    label: 'Open in Trace2',
    targetWorkspaceId: 'traceability-workspace',
    targetViewId: 'trace',
    contextScopes: ['batch'],
  },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

export interface CustomerExposureNetworkPanelProps {
  readonly result?: AdapterResult<CustomerExposureSummary>
  readonly isLoading?: boolean
}

type Severity = CustomerExposureSummary['highestSeverity']

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; color: string; icon: string }
> = {
  critical: { label: 'CRITICAL', color: 'var(--sunset)', icon: '⚠' },
  high: { label: 'HIGH', color: 'var(--amber-600, #C07000)', icon: '⚠' },
  medium: { label: 'MEDIUM', color: 'var(--sunrise)', icon: '⚡' },
  low: { label: 'LOW', color: 'var(--jade)', icon: '✓' },
  none: { label: 'NONE', color: 'var(--ink-400, #6B7280)', icon: '—' },
}

function Badge({
  variant,
  children,
}: {
  variant: 'default' | 'warning' | 'danger'
  children: React.ReactNode
}) {
  const colorMap = {
    default: 'var(--shell-fg-2)',
    warning: 'var(--sunrise)',
    danger: 'var(--sunset)',
  }
  const color = colorMap[variant]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: `${color}1A`,
        color,
        border: `1px solid ${color}`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: 'var(--shell-surface-2, #F1F1E5)',
        borderRadius: 8,
        padding: 12,
      }}
    >
      <p style={{ margin: 0, fontSize: 11, color: 'var(--shell-fg-2)' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700, color: 'var(--forest)' }}>
        {value}
      </p>
    </div>
  )
}

export function CustomerExposureNetworkPanel({
  result,
  isLoading = false,
}: CustomerExposureNetworkPanelProps) {
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

  const data: CustomerExposureSummary | null = result?.ok ? result.data : null
  const risk = data ? SEVERITY_CONFIG[data.highestSeverity] : SEVERITY_CONFIG.none

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--forest)' }}>
              Customer Exposure
            </h3>
            {data.recallRecommended && <Badge variant="danger">Recall Recommended</Badge>}
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 8,
              border: `2px solid ${risk.color}`,
              background: `${risk.color}15`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 28, lineHeight: 1 }}>{risk.icon}</span>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--shell-fg-2)' }}>Risk Level</p>
              <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: risk.color }}>
                {risk.label}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <MetricTile label="Affected Customers" value={data.affectedCustomers} />
            <MetricTile label="Deliveries" value={data.affectedDeliveries} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--shell-fg-2)' }}>
                Total Shipped Quantity
              </p>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: 'var(--forest)',
                }}
              >
                {data.shippedQuantity.toLocaleString()} {data.uom ?? 'units'}
              </p>
            </div>

            {data.countries.length > 0 && (
              <div>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--shell-fg-2)', marginBottom: 6 }}>
                  Geographic Spread
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {data.countries.map((country) => (
                    <Badge key={country} variant="default">
                      {country}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {data.blockedDeliveries > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid var(--shell-line)',
                  paddingTop: 12,
                }}
              >
                <p style={{ margin: 0, fontSize: 12, color: 'var(--shell-fg-2)' }}>
                  Blocked Deliveries
                </p>
                <Badge variant="warning">{data.blockedDeliveries}</Badge>
              </div>
            )}

            {data.maxExposureDepth != null && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid var(--shell-line)',
                  paddingTop: 12,
                }}
              >
                <p style={{ margin: 0, fontSize: 12, color: 'var(--shell-fg-2)' }}>
                  Max Exposure Depth
                </p>
                <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 500, color: 'var(--forest)' }}>
                  {data.maxExposureDepth} {data.maxExposureDepth === 1 ? 'hop' : 'hops'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}
