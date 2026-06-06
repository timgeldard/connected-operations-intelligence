import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { StagingShortfall } from '@connectio/data-contracts'
import { useStagingShortfalls } from '../adapters/production-staging-queries.js'
import type { ProductionStagingAdapterRequest } from '../adapters/production-staging-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'staging-shortfalls',
  displayName: 'Material Shortfalls',
  description: 'Materials with insufficient stock or staging for today\'s production plan.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['production-staging'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.staging.read', displayName: 'Warehouse Staging Read' }],
}

export interface StagingShortfallsPanelProps {
  readonly request: ProductionStagingAdapterRequest
  readonly onProcessOrderClick?: (processOrderId: string) => void
}

const URGENCY_COLOR: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#D97706',
  low: '#9E9E9E',
}

const PROC_STATUS_COLOR: Record<string, string> = {
  'out-of-stock': '#D32F2F',
  delayed: '#F57C00',
  ordered: '#D97706',
  'in-transit': '#1976D2',
  'in-stock': '#2E7D32',
  unknown: '#9E9E9E',
}

export function StagingShortfallsPanel({ request, onProcessOrderClick }: StagingShortfallsPanelProps) {
  const { data: result, isLoading } = useStagingShortfalls(request)
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

  const shortfalls: StagingShortfall[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {shortfalls && (
        <div style={{ padding: '8px 0' }}>
          {shortfalls.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--shell-fg-3)', fontSize: 13 }}>
              No material shortfalls
            </div>
          ) : (
            shortfalls.map((sf) => {
              const urgencyColor = URGENCY_COLOR[sf.urgency] ?? 'var(--shell-fg-2)'
              const procColor = PROC_STATUS_COLOR[sf.procurementStatus] ?? 'var(--shell-fg-2)'
              return (
                <div key={sf.shortfallId} style={{ padding: '10px 16px', borderBottom: '1px solid var(--shell-line)', display: 'grid', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: urgencyColor, border: `1px solid ${urgencyColor}`, borderRadius: 4, padding: '1px 6px' }}>
                      {sf.urgency}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', flex: 1 }}>{sf.materialDescription}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>
                    Shortfall: <strong style={{ color: urgencyColor }}>{sf.shortfallQuantity} {sf.uom}</strong>
                    {' '}(need {sf.requiredQuantity}, have {sf.availableQuantity})
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: procColor }}>{sf.procurementStatus}</span>
                    {sf.expectedArrival && (
                      <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>ETA: {new Date(sf.expectedArrival).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                    {onProcessOrderClick ? (
                      <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {sf.affectedOrders.map(orderId => (
                          <button
                            key={orderId}
                            onClick={() => onProcessOrderClick(orderId)}
                            style={{ fontSize: 11, color: 'var(--ocean, #005776)', border: '1px solid var(--ocean, #005776)', borderRadius: 4, padding: '1px 6px', background: 'transparent', cursor: 'pointer' }}
                          >
                            {orderId}
                          </button>
                        ))}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Orders: {sf.affectedOrders.length}</span>
                    )}
                    {sf.canBeSubstituted && (
                      <span style={{ fontSize: 11, color: '#1976D2' }}>Substitution available</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
