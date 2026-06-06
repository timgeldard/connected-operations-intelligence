import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { EquipmentAvailability } from '@connectio/data-contracts'
import { useEquipmentAvailability } from '../adapters/maintenance-reliability-queries.js'
import type { MaintenanceReliabilityAdapterRequest } from '../adapters/maintenance-reliability-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'equipment-availability',
  displayName: 'Equipment Availability',
  description: 'Availability % vs target per equipment — planned vs unplanned downtime and current status.',
  ownerDomain: 'maintenance',
  sourceOwnership: { domainId: 'maintenance', systemName: 'cmms', legacyAppId: 'cmms' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['maintenance-reliability'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'maintenance.overview.read', displayName: 'Maintenance Overview Read' }],
}

export interface EquipmentAvailabilityPanelProps {
  readonly request: MaintenanceReliabilityAdapterRequest
}

const STATUS_COLOR: Record<string, string> = {
  running: '#2E7D32',
  'planned-down': '#005776',
  'unplanned-down': '#D32F2F',
  standby: '#9E9E9E',
  maintenance: '#F57C00',
}

function AvailBar({ value, target }: { value: number; target: number }) {
  const color = value < target ? '#D32F2F' : '#2E7D32'
  return (
    <div style={{ position: 'relative', height: 8, background: 'var(--shell-surface-2)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${value}%`, background: color, borderRadius: 4 }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${target}%`, width: 2, background: 'rgba(0,0,0,0.3)' }} />
    </div>
  )
}

export function EquipmentAvailabilityPanel({ request }: EquipmentAvailabilityPanelProps) {
  const { data: result, isLoading } = useEquipmentAvailability(request)
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

  const equipments: EquipmentAvailability[] = result?.ok ? result.data : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {equipments.map(eq => (
          <div key={eq.equipmentId} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 8, borderBottom: '1px solid var(--shell-line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)', flex: 1 }}>{eq.equipmentDescription}</span>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: STATUS_COLOR[eq.currentStatus] ?? '#9E9E9E', color: '#fff', fontWeight: 600 }}>{eq.currentStatus}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <AvailBar value={eq.availabilityPercent} target={eq.targetPercent} />
              <span style={{ fontSize: 11, whiteSpace: 'nowrap', color: eq.availabilityPercent < eq.targetPercent ? '#D32F2F' : '#2E7D32', fontWeight: 600 }}>{eq.availabilityPercent.toFixed(0)}%</span>
              <span style={{ fontSize: 11, color: 'var(--shell-fg-3)', whiteSpace: 'nowrap' }}>/ {eq.targetPercent}% target</span>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--shell-fg-3)' }}>
              {eq.unplannedDowntimeMinutes > 0 && <span style={{ color: '#D32F2F' }}>Unplanned: {eq.unplannedDowntimeMinutes}m</span>}
              {eq.plannedDowntimeMinutes > 0 && <span>Planned: {eq.plannedDowntimeMinutes}m</span>}
              {eq.openWorkOrderCount > 0 && <span>WOs: {eq.openWorkOrderCount}</span>}
            </div>
          </div>
        ))}
      </div>
    </EvidencePanel>
  )
}
