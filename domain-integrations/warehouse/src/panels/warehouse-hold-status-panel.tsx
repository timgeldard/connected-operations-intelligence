import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { WarehouseHoldStatus } from '@connectio/data-contracts'
import { useWarehouseHoldStatus } from '../adapters/warehouse-evidence-queries.js'
import type { WarehouseEvidenceAdapterRequest } from '../adapters/warehouse-evidence-adapter.js'

/** Static registration record for the Warehouse Hold Status panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'warehouse-hold-status',
  displayName: 'Warehouse Hold Status',
  description: 'Batch stock status, hold types, and active warehouse holds blocking or restricting the batch.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'warehouse360', legacyAppId: 'warehouse360' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['quality-batch-release'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.97, hidden: false },
  drillThrough: { label: 'Open in Warehouse360', targetWorkspaceId: 'warehouse-workspace', targetViewId: 'holds', contextScopes: ['batch'] },
  requiredPermissions: [{ permissionId: 'quality.read', displayName: 'Quality Read' }],
}

/** Props for WarehouseHoldStatusPanel. */
export interface WarehouseHoldStatusPanelProps {
  /** Adapter request context providing batchId and plantId. */
  readonly request: WarehouseEvidenceAdapterRequest
}

/**
 * Evidence panel displaying warehouse stock and hold status for a batch release decision.
 *
 * @remarks
 * Owned by the warehouse domain; consumed exclusively by the quality-batch-release workspace.
 * Shows stock quantities by type and lists all active holds with hold type, reason, and placer.
 */
export function WarehouseHoldStatusPanel({ request }: WarehouseHoldStatusPanelProps) {
  const { data: result, isLoading } = useWarehouseHoldStatus(request)
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

  const data: WarehouseHoldStatus | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <WhField label="Stock Type" value={data.stockType.replace(/-/g, ' ')} />
            <WhField label="Total" value={`${data.totalQuantity.toLocaleString()} ${data.uom}`} />
            <WhMetric label="Blocked" value={`${data.blockedQuantity.toLocaleString()} ${data.uom}`} highlight={data.blockedQuantity > 0} />
            <WhMetric label="Unrestricted" value={`${data.unrestrictedQuantity.toLocaleString()} ${data.uom}`} highlight={false} />
            {data.hasBlockingHold && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#D32F2F', padding: '2px 8px', borderRadius: 12, background: 'rgba(211,47,47,0.1)' }}>
                Blocking Hold
              </span>
            )}
          </div>

          {data.activeHolds.length > 0 && (
            <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 6 }}>
                Active Holds ({data.activeHolds.length})
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {data.activeHolds.map((hold) => (
                  <div
                    key={hold.holdId}
                    style={{
                      fontSize: 12,
                      padding: '6px 8px',
                      background: 'var(--shell-surface-2)',
                      borderRadius: 4,
                      borderLeft: `3px solid ${hold.status === 'active' ? '#D32F2F' : '#FF9800'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: 'var(--shell-fg)', textTransform: 'capitalize' }}>
                        {hold.holdType} Hold
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>
                        {new Date(hold.placedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ color: 'var(--shell-fg-2)', marginTop: 2 }}>{hold.reason}</div>
                    <div style={{ color: 'var(--shell-fg-3)', marginTop: 2, fontSize: 11 }}>
                      Placed by: {hold.placedBy}
                    </div>
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

function WhField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--shell-fg)', fontWeight: 500, textTransform: 'capitalize' }}>{value}</div>
    </div>
  )
}

function WhMetric({ label, value, highlight }: { label: string; value: string; highlight: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: highlight ? 'var(--sunset, #F24A00)' : 'var(--shell-fg)' }}>
        {value}
      </div>
    </div>
  )
}
