import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ProcessOrderConfirmation } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'

const registration: EvidencePanelRegistration = {
  panelId: 'order-confirmations',
  displayName: 'Confirmations',
  description:
    'Process order confirmations with yield, scrap, duration actuals, and variance against plan.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'poh' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['process-order-review'],
  requiredContext: [{ contextKey: 'processOrderId', scopeLevel: 'process-order', required: true }],
  freshnessPolicy: {
    staleAfterSeconds: 120,
    errorAfterSeconds: 600,
    refreshOnFocus: true,
    pollIntervalSeconds: null,
  },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [
    { permissionId: 'operations.order.read', displayName: 'Operations Order Read' },
  ],
}

export interface OrderConfirmationsPanelProps {
  readonly result?: AdapterResult<ProcessOrderConfirmation[]>
  readonly isLoading?: boolean
}

function varianceLabel(pct: number | undefined): string | null {
  if (pct == null) return null
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function varianceColor(pct: number | undefined): string {
  if (pct == null) return 'var(--shell-fg-3)'
  if (Math.abs(pct) <= 5) return '#388E3C'
  if (Math.abs(pct) <= 15) return '#D97706'
  return '#D32F2F'
}

export function OrderConfirmationsPanel({
  result,
  isLoading = false,
}: OrderConfirmationsPanelProps) {
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

  const confirmations: ProcessOrderConfirmation[] = result?.ok ? result.data : []
  const openCount = confirmations.filter((c) => !c.isFinalConfirmation).length

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {result?.ok && (
        <div style={{ padding: '12px 16px' }}>
          {confirmations.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--shell-fg-3)', margin: 0 }}>
              No confirmations recorded for this order.
            </p>
          ) : (
            <>
              {openCount > 0 && (
                <div
                  style={{
                    background: 'rgba(0,87,118,0.08)',
                    border: '1px solid rgba(0,87,118,0.2)',
                    borderRadius: 4,
                    padding: '4px 8px',
                    marginBottom: 10,
                    fontSize: 11,
                    color: '#005776',
                    fontWeight: 600,
                  }}
                >
                  {openCount} open confirmation{openCount > 1 ? 's' : ''} — not yet final
                </div>
              )}
              <div style={{ display: 'grid', gap: 8 }}>
                {confirmations.map((conf) => (
                  <div
                    key={conf.confirmationId}
                    style={{
                      borderLeft: `2px solid ${conf.isFinalConfirmation ? '#388E3C' : '#D97706'}`,
                      paddingLeft: 8,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg)' }}>
                        {conf.operationText}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: conf.isFinalConfirmation ? '#388E3C' : '#D97706',
                        }}
                      >
                        {conf.isFinalConfirmation ? 'final' : 'partial'}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--shell-fg-2)', marginTop: 2 }}>
                      Yield:{' '}
                      {conf.confirmedYield != null
                        ? `${conf.confirmedYield.toLocaleString()} ${conf.uom ?? ''}`.trim()
                        : '—'}
                      {conf.scrapQuantity != null && conf.scrapQuantity > 0 && (
                        <span style={{ color: '#D32F2F' }}>
                          {' '}
                          · scrap: {conf.scrapQuantity} {conf.uom}
                        </span>
                      )}
                      {conf.variancePercent != null && (
                        <span style={{ color: varianceColor(conf.variancePercent), marginLeft: 4 }}>
                          ({varianceLabel(conf.variancePercent)} vs plan)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', marginTop: 1 }}>
                      {conf.confirmedAt
                        ? new Date(conf.confirmedAt).toLocaleString()
                        : 'Timestamp not recorded'}
                      {conf.confirmedBy && ` · ${conf.confirmedBy}`}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
