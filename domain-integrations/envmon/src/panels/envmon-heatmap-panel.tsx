import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { EnvMonHeatmapCell } from '@connectio/data-contracts'
import { useEnvMonHeatmap } from '../adapters/envmon-queries.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'envmon-heatmap',
  displayName: 'Zone Risk Heatmap',
  description: 'Visual risk heatmap of all monitored zones, coloured by risk score from compliance to non-compliant.',
  ownerDomain: 'envmon',
  sourceOwnership: { domainId: 'envmon', systemName: 'lims', legacyAppId: 'lims' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['envmon-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'envmon.monitoring.read', displayName: 'Environmental Monitoring Read' }],
}

export interface EnvMonHeatmapPanelProps {
  readonly request: EnvMonAdapterRequest
}

function riskColor(score: number): string {
  if (score >= 70) return '#D32F2F'
  if (score >= 40) return '#F57C00'
  if (score >= 15) return '#D97706'
  return '#2E7D32'
}

function riskTextColor(score: number): string {
  return score >= 15 ? '#fff' : '#fff'
}

export function EnvMonHeatmapPanel({ request }: EnvMonHeatmapPanelProps) {
  const { data: result, isLoading } = useEnvMonHeatmap(request)
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

  const cells: EnvMonHeatmapCell[] | null = result?.ok ? result.data : null
  const sorted = cells ? [...cells].sort((a, b) => b.riskScore - a.riskScore) : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {sorted && (
        <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {sorted.map((cell) => {
            const bg = riskColor(cell.riskScore)
            const fg = riskTextColor(cell.riskScore)
            return (
              <div key={cell.zoneId} style={{ background: bg, borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: fg, opacity: 0.8 }}>
                  {cell.hygieneZone}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: fg, lineHeight: 1.2 }}>{cell.zoneName}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: fg, lineHeight: 1 }}>{Math.round(cell.riskScore)}</span>
                <span style={{ fontSize: 10, color: fg, opacity: 0.85 }}>
                  {cell.positiveCount}/{cell.sampleCount} positive
                </span>
              </div>
            )
          })}
        </div>
      )}
    </EvidencePanel>
  )
}
