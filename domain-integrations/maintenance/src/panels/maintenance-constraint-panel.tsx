import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { MaintenanceConstraint } from '@connectio/data-contracts'
import { useMaintenanceConstraints } from '../adapters/maintenance-constraints-queries.js'
import type { MaintenanceConstraintsAdapterRequest } from '../adapters/maintenance-constraints-adapter.js'

/** Static registration record for the Maintenance Constraint panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'maintenance-constraint',
  displayName: 'Maintenance Constraints',
  description: 'Active and scheduled maintenance constraints affecting line and resource availability.',
  ownerDomain: 'maintenance',
  sourceOwnership: { domainId: 'maintenance', systemName: 'cmms', legacyAppId: 'cmms' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['operations-plan-risk'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.93, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.plan.read', displayName: 'Operations Plan Read' }],
}

/** Props for MaintenanceConstraintPanel. */
export interface MaintenanceConstraintPanelProps {
  readonly request: MaintenanceConstraintsAdapterRequest
}

/**
 * Evidence panel displaying active and scheduled maintenance constraints for operations plan risk assessment.
 *
 * @remarks
 * Owned by the maintenance domain; consumed exclusively by the operations-plan-risk workspace.
 * Shows constraint severity, asset, line, type, status, resolution ETA, and affected order count.
 */
export function MaintenanceConstraintPanel({ request }: MaintenanceConstraintPanelProps) {
  const { data: result, isLoading } = useMaintenanceConstraints(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) { markReady() }
    else if (result && !result.ok) { markError() }
  }, [isLoading, result, markReady, markError])

  const data: MaintenanceConstraint[] | null = result?.ok ? result.data : null

  const highestSeverity = data && data.length > 0
    ? SEVERITY_RANK.find(s => data.some(c => c.severity === s)) ?? null
    : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: highestSeverity ? SEVERITY_COLOR[highestSeverity] : 'var(--shell-fg)' }}>
            {data.length === 0
              ? 'No maintenance constraints for this plan'
              : `${data.length} maintenance constraint${data.length === 1 ? '' : 's'}`}
          </div>

          {data.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {data.map((constraint) => (
                <ConstraintRow key={constraint.constraintId} constraint={constraint} />
              ))}
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

const SEVERITY_RANK = ['critical', 'high', 'medium', 'low'] as const
const SEVERITY_COLOR: Record<string, string> = { critical: '#D32F2F', high: '#D32F2F', medium: '#FF9800', low: 'var(--shell-fg-3)' }
const STATUS_COLOR: Record<string, string> = { active: '#D32F2F', overdue: '#D32F2F', 'in-progress': '#FF9800', scheduled: '#1976D2', resolved: '#4CAF50' }

function ConstraintRow({ constraint }: { constraint: MaintenanceConstraint }) {
  const severityColor = SEVERITY_COLOR[constraint.severity] ?? 'var(--shell-fg-3)'
  const statusColor = STATUS_COLOR[constraint.status] ?? 'var(--shell-fg-3)'
  const typeLabel = constraint.constraintType.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const resolutionTime = constraint.expectedResolutionAt
    ? new Date(constraint.expectedResolutionAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div style={{
      padding: '8px 10px',
      background: 'var(--shell-surface-2)',
      borderRadius: 4,
      borderLeft: `3px solid ${severityColor}`,
      display: 'grid',
      gap: 4,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SeverityBadge severity={constraint.severity} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)' }}>
            {constraint.assetName}
          </span>
          <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
            {constraint.lineId}
          </span>
        </div>
        <StatusBadge status={constraint.status} color={statusColor} />
      </div>

      <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{typeLabel}</div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {constraint.affectedOrders.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
            {constraint.affectedOrders.length} order{constraint.affectedOrders.length === 1 ? '' : 's'} affected
          </span>
        )}
        {resolutionTime && (
          <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
            Expected by {resolutionTime}
          </span>
        )}
        {constraint.workOrderId && (
          <span style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>
            {constraint.workOrderId}
          </span>
        )}
      </div>
    </div>
  )
}

const PILL_BASE = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', padding: '1px 6px', borderRadius: 10 }

function SeverityBadge({ severity }: { severity: string }) {
  const color = SEVERITY_COLOR[severity] ?? 'var(--shell-fg-3)'
  return <span style={{ ...PILL_BASE, color, background: `${color}1A` }}>{severity}</span>
}

function StatusBadge({ status, color }: { status: string; color: string }) {
  const label = status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return <span style={{ ...PILL_BASE, color, background: `${color}1A` }}>{label}</span>
}
