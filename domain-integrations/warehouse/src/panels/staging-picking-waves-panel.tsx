import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { StagingPickingWave } from '@connectio/data-contracts'
import { useStagingPickingWaves } from '../adapters/production-staging-queries.js'
import type { ProductionStagingAdapterRequest } from '../adapters/production-staging-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'staging-picking-waves',
  displayName: 'Picking Waves',
  description: 'Picking wave schedule and completion status for today\'s production staging.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['production-staging'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 180, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.staging.read', displayName: 'Warehouse Staging Read' }],
}

export interface StagingPickingWavesPanelProps {
  readonly request: ProductionStagingAdapterRequest
}

const STATUS_COLOR: Record<string, string> = {
  completed: '#2E7D32',
  'in-progress': '#1976D2',
  planned: '#9E9E9E',
  partial: '#D97706',
  cancelled: '#9E9E9E',
}

function formatTime(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function StagingPickingWavesPanel({ request }: StagingPickingWavesPanelProps) {
  const { data: result, isLoading } = useStagingPickingWaves(request)
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

  const waves: StagingPickingWave[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {waves && (
        <div style={{ padding: '8px 0' }}>
          {waves.map((wave) => {
            const color = STATUS_COLOR[wave.status] ?? 'var(--shell-fg-2)'
            const pct = wave.totalTasks > 0 ? Math.round((wave.completedTasks / wave.totalTasks) * 100) : 0
            return (
              <div key={wave.waveId} style={{ padding: '10px 16px', borderBottom: '1px solid var(--shell-line)', display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', flex: 1 }}>{wave.waveLabel}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color }}>{wave.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--shell-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--shell-fg-2)', whiteSpace: 'nowrap' }}>
                    {wave.completedTasks}/{wave.totalTasks} tasks
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Start: {formatTime(wave.scheduledStart)}</span>
                  <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>ETA: {formatTime(wave.estimatedCompletion)}</span>
                  <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{wave.includedOrders.length} orders</span>
                  {wave.assignedTeam && (
                    <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{wave.assignedTeam}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </EvidencePanel>
  )
}
