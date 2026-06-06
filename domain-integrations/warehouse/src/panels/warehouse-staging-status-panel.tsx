import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { WarehouseStagingStatus } from '@connectio/data-contracts'
import { useWarehouseStagingStatus } from '../adapters/warehouse-staging-queries.js'
import type { WarehouseStagingAdapterRequest } from '../adapters/warehouse-staging-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'warehouse-staging-status',
  displayName: 'Warehouse Staging Status',
  description: 'Warehouse staging progress and missing picks for process orders in the plan.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'warehouse360', legacyAppId: 'warehouse360' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['operations-plan-risk'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.95, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.plan.read', displayName: 'Operations Plan Read' }],
}

export interface WarehouseStagingStatusPanelProps {
  readonly request: WarehouseStagingAdapterRequest
}

const STATUS_COLOR: Record<WarehouseStagingStatus['status'], string> = {
  blocked: '#D32F2F',
  partial: '#D97706',
  staged: '#2E7D32',
  pending: '#005776',
  'in-progress': '#005776',
  'not-required': 'var(--shell-fg-3)',
}

export function WarehouseStagingStatusPanel({ request }: WarehouseStagingStatusPanelProps) {
  const { data: result, isLoading } = useWarehouseStagingStatus(request)
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

  const rows: WarehouseStagingStatus[] | null = result?.ok ? result.data : null

  const fullyStaged = rows ? rows.filter((r) => r.status === 'staged' || r.status === 'not-required').length : 0
  const total = rows ? rows.length : 0
  const summaryColor = rows && fullyStaged === total ? '#2E7D32' : '#D97706'

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {rows && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: summaryColor }}>
            {fullyStaged} of {total} orders fully staged
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {rows.map((row) => (
              <StagingRow key={`${row.processOrderId}-${row.materialId}-${row.batchId}`} row={row} />
            ))}
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

function StagingRow({ row }: { row: WarehouseStagingStatus }) {
  const statusColor = STATUS_COLOR[row.status]
  return (
    <div
      style={{
        fontSize: 12,
        padding: '6px 8px',
        background: 'var(--shell-surface-2)',
        borderRadius: 4,
        borderLeft: `3px solid ${statusColor}`,
        display: 'grid',
        gap: 3,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <span style={{ fontWeight: 600, color: 'var(--shell-fg)' }}>
          {row.processOrderId} — {row.materialDescription}
        </span>
        <StatusBadge status={row.status} color={statusColor} />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: 'var(--shell-fg-2)' }}>
          {row.stagedQuantity.toLocaleString()} / {row.requiredQuantity.toLocaleString()} {row.uom}
        </span>
        {row.missingQuantity > 0 && (
          <span style={{ fontWeight: 700, color: 'var(--sunset, #F24A00)' }}>
            -{row.missingQuantity.toLocaleString()} {row.uom} missing
          </span>
        )}
        <span style={{ color: 'var(--shell-fg-3)', fontSize: 11 }}>{row.stagingArea}</span>
      </div>
      {row.blockerReason && (
        <div style={{ fontSize: 11, fontStyle: 'italic', color: '#D32F2F', marginTop: 1 }}>
          {row.blockerReason}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status, color }: { status: WarehouseStagingStatus['status']; color: string }) {
  const label = status.replace(/-/g, ' ')
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color,
        padding: '2px 7px',
        borderRadius: 10,
        background: `${color}1A`,
        textTransform: 'capitalize',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
