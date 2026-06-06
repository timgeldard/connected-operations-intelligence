import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { StagingPickTask } from '@connectio/data-contracts'
import { useStagingPickTasks } from '../adapters/production-staging-queries.js'
import type { ProductionStagingAdapterRequest } from '../adapters/production-staging-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'staging-pick-tasks',
  displayName: 'Pick Tasks',
  description: 'Open and in-progress warehouse pick tasks for today\'s production staging wave.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['production-staging'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.95, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.staging.read', displayName: 'Warehouse Staging Read' }],
}

export interface StagingPickTasksPanelProps {
  readonly request: ProductionStagingAdapterRequest
}

const STATUS_COLOR: Record<string, string> = {
  staged: '#2E7D32',
  picked: '#4CAF50',
  'in-progress': '#1976D2',
  open: '#F57C00',
  cancelled: '#9E9E9E',
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#D97706',
  low: '#9E9E9E',
}

export function StagingPickTasksPanel({ request }: StagingPickTasksPanelProps) {
  const { data: result, isLoading } = useStagingPickTasks(request)
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

  const tasks: StagingPickTask[] | null = result?.ok ? result.data : null
  const openTasks = tasks?.filter(t => t.status === 'open' || t.status === 'in-progress') ?? null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {openTasks && (
        <div style={{ padding: '8px 0' }}>
          {openTasks.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--shell-fg-3)', fontSize: 13 }}>
              No open pick tasks
            </div>
          ) : (
            openTasks.map((task) => {
              const statusColor = STATUS_COLOR[task.status] ?? 'var(--shell-fg-2)'
              const priorityColor = PRIORITY_COLOR[task.priority] ?? 'var(--shell-fg-2)'
              const pct = task.requiredQuantity > 0 ? Math.round((task.pickedQuantity / task.requiredQuantity) * 100) : 0
              return (
                <div key={task.taskId} style={{ padding: '10px 16px', borderBottom: '1px solid var(--shell-line)', display: 'grid', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: priorityColor, border: `1px solid ${priorityColor}`, borderRadius: 4, padding: '1px 6px' }}>
                      {task.priority}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', flex: 1 }}>{task.materialDescription}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: statusColor }}>{task.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>
                    {task.storageLocation} → {task.destinationLocation}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, height: 4, background: 'var(--shell-surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: statusColor, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--shell-fg-3)', whiteSpace: 'nowrap' }}>
                      {task.pickedQuantity}/{task.requiredQuantity} {task.uom}
                    </span>
                  </div>
                  {task.assignee && (
                    <div style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{task.taskId} · {task.assignee}</div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
