import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { EnvMonSwabVector } from '@connectio/data-contracts'
import { useEnvMonSwabVectors } from '../adapters/envmon-queries.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'envmon-swab-vectors',
  displayName: 'Swab Sampling Vectors',
  description: 'Scheduled swab sampling routes (vectors) with frequency, next due date, and completion status.',
  ownerDomain: 'envmon',
  sourceOwnership: { domainId: 'envmon', systemName: 'lims', legacyAppId: 'lims' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['envmon-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 600, errorAfterSeconds: 1800, refreshOnFocus: false, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'envmon.monitoring.read', displayName: 'Environmental Monitoring Read' }],
}

export interface EnvMonSwabVectorsPanelProps {
  readonly request: EnvMonAdapterRequest
}

const STATUS_COLOR: Record<string, string> = {
  overdue: '#D32F2F',
  'in-progress': '#1976D2',
  'on-schedule': '#2E7D32',
  suspended: '#9E9E9E',
}

export function EnvMonSwabVectorsPanel({ request }: EnvMonSwabVectorsPanelProps) {
  const { data: result, isLoading } = useEnvMonSwabVectors(request)
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

  const vectors: EnvMonSwabVector[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {vectors && (
        <div style={{ padding: '8px 0' }}>
          {vectors.map((vector) => {
            const color = STATUS_COLOR[vector.status] ?? 'var(--shell-fg-2)'
            return (
              <div key={vector.vectorId} style={{ padding: '10px 16px', borderBottom: '1px solid var(--shell-line)', display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', flex: 1 }}>{vector.vectorName}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color }}>{vector.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{vector.frequency} · {vector.pointCount} points</span>
                  {vector.nextDueDate && (
                    <span style={{ fontSize: 11, color: 'var(--shell-fg-2)' }}>Next: {vector.nextDueDate}</span>
                  )}
                  {vector.assignedTeam && (
                    <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{vector.assignedTeam}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {vector.zoneIds.map((z) => (
                    <span key={z} style={{ fontSize: 10, background: 'var(--shell-surface-2)', borderRadius: 3, padding: '1px 5px', color: 'var(--shell-fg-2)' }}>
                      {z}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </EvidencePanel>
  )
}
