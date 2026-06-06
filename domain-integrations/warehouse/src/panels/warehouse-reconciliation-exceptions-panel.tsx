import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { WarehouseReconciliationException } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'

const registration: EvidencePanelRegistration = {
  panelId: 'warehouse-reconciliation-exceptions',
  displayName: 'IM/WM Reconciliation Exceptions',
  description: 'Stock discrepancies between Inventory Management (IM) and Warehouse Management (WM) — quantity mismatches, missing postings, and location conflicts.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['warehouse-360-overview'],
  requiredContext: [{ contextKey: 'warehouseId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.overview.read', displayName: 'Warehouse Overview Read' }],
}

const SEVERITY_COLOR: Record<WarehouseReconciliationException['severity'], string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#D97706',
  low: '#388E3C',
}

const TYPE_LABEL: Record<WarehouseReconciliationException['exceptionType'], string> = {
  'quantity-mismatch': 'Qty mismatch',
  'location-mismatch': 'Location mismatch',
  'status-mismatch': 'Status mismatch',
  'missing-in-wms': 'Missing in WM',
  'missing-in-im': 'Missing in IM',
  'duplicate-posting': 'Duplicate posting',
}

const RESOLUTION_COLOR: Record<WarehouseReconciliationException['resolution'], string> = {
  open: '#D32F2F',
  'in-progress': '#D97706',
  resolved: '#388E3C',
  escalated: '#7B1FA2',
}

export interface WarehouseReconciliationExceptionsPanelProps {
  readonly result?: AdapterResult<WarehouseReconciliationException[]>
  readonly isLoading?: boolean
}

export function WarehouseReconciliationExceptionsPanel({
  result,
  isLoading = false,
}: WarehouseReconciliationExceptionsPanelProps) {
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

  const exceptions: WarehouseReconciliationException[] = result?.ok ? result.data : []
  const openCount = exceptions.filter((e) => e.resolution === 'open' || e.resolution === 'escalated').length

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {exceptions.length === 0 && result?.ok && (
        <div
          role="status"
          style={{ padding: '16px', color: 'var(--shell-fg-3)', fontSize: 13 }}
        >
          No reconciliation exceptions found.
        </div>
      )}

      {exceptions.length > 0 && (
        <div style={{ display: 'grid', gap: 0, padding: '12px 16px' }}>
          {openCount > 0 && (
            <div style={{ fontSize: 11, fontWeight: 600, color: '#D32F2F', marginBottom: 8 }}>
              {openCount} open {openCount === 1 ? 'exception' : 'exceptions'} require attention
            </div>
          )}

          {exceptions.map((ex) => (
            <div
              key={ex.exceptionId}
              style={{
                borderLeft: `3px solid ${SEVERITY_COLOR[ex.severity]}`,
                paddingLeft: 10,
                paddingTop: 6,
                paddingBottom: 6,
                marginBottom: 6,
                display: 'grid',
                gap: 2,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--shell-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ex.materialDescription}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: RESOLUTION_COLOR[ex.resolution], textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
                  {ex.resolution}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>
                {TYPE_LABEL[ex.exceptionType]}
                {ex.discrepancyQuantity !== undefined && ex.discrepancyQuantity !== 0 && (
                  <span> · Δ {ex.discrepancyQuantity > 0 ? '+' : ''}{ex.discrepancyQuantity} {ex.uom}</span>
                )}
                {ex.batchId && <span> · {ex.batchId}</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
                {ex.storageLocationId} · {ex.ageHours.toFixed(1)}h ago
              </div>
            </div>
          ))}
        </div>
      )}
    </EvidencePanel>
  )
}
