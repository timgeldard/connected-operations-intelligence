import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { PreventiveMaintenanceTask } from '@connectio/data-contracts'
import { usePreventiveMaintenanceTasks } from '../adapters/maintenance-reliability-queries.js'
import type { MaintenanceReliabilityAdapterRequest } from '../adapters/maintenance-reliability-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'preventive-maintenance-schedule',
  displayName: 'PM Schedule',
  description: 'Upcoming and overdue preventive maintenance tasks — due dates, assigned technicians, and production impact.',
  ownerDomain: 'maintenance',
  sourceOwnership: { domainId: 'maintenance', systemName: 'cmms', legacyAppId: 'cmms' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['maintenance-reliability'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'maintenance.overview.read', displayName: 'Maintenance Overview Read' }],
}

export interface PreventiveMaintenanceSchedulePanelProps {
  readonly request: MaintenanceReliabilityAdapterRequest
}

const STATUS_COLOR: Record<string, string> = {
  overdue: '#D32F2F',
  'due-today': '#F57C00',
  upcoming: '#1565C0',
  completed: '#2E7D32',
  deferred: '#9E9E9E',
}

export function PreventiveMaintenanceSchedulePanel({ request }: PreventiveMaintenanceSchedulePanelProps) {
  const { data: result, isLoading } = usePreventiveMaintenanceTasks(request)
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

  const tasks: PreventiveMaintenanceTask[] = result?.ok ? result.data : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {tasks.length === 0 && !isLoading && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--shell-fg-3)' }}>No PM tasks.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map(task => (
          <div key={task.taskId} style={{ borderLeft: `3px solid ${STATUS_COLOR[task.status] ?? '#9E9E9E'}`, paddingLeft: 10, paddingTop: 4, paddingBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)', flex: 1 }}>{task.title}</span>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: STATUS_COLOR[task.status] ?? '#9E9E9E', color: '#fff', whiteSpace: 'nowrap', fontWeight: 600 }}>{task.status}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginTop: 4 }}>{task.equipmentDescription}</div>
            <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
              <span>{task.frequency}</span>
              <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
              {task.daysOverdue > 0 && <span style={{ color: '#D32F2F' }}>{task.daysOverdue}d overdue</span>}
              <span>{task.estimatedHours}h</span>
            </div>
          </div>
        ))}
      </div>
    </EvidencePanel>
  )
}
