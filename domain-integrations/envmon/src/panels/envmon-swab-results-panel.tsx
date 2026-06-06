import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { EnvMonSwabResult } from '@connectio/data-contracts'
import { useEnvMonSwabResults } from '../adapters/envmon-queries.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'envmon-swab-results',
  displayName: 'Swab Results',
  description: 'Recent environmental swab and surface contact test results for the plant.',
  ownerDomain: 'envmon',
  sourceOwnership: { domainId: 'envmon', systemName: 'lims', legacyAppId: 'lims' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['envmon-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.95, hidden: false },
  requiredPermissions: [{ permissionId: 'envmon.monitoring.read', displayName: 'Environmental Monitoring Read' }],
}

export interface EnvMonSwabResultsPanelProps {
  readonly request: EnvMonAdapterRequest
}

const RESULT_COLOR: Record<string, string> = {
  positive: '#D32F2F',
  borderline: '#F57C00',
  negative: '#2E7D32',
  pending: '#9E9E9E',
}

export function EnvMonSwabResultsPanel({ request }: EnvMonSwabResultsPanelProps) {
  const { data: result, isLoading } = useEnvMonSwabResults(request)
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

  const results: EnvMonSwabResult[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {results && (
        <div style={{ padding: '8px 0' }}>
          {results.map((row) => {
            const color = RESULT_COLOR[row.result] ?? 'var(--shell-fg-2)'
            return (
              <div key={row.sampleId} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', padding: '8px 16px', borderBottom: '1px solid var(--shell-line)', alignItems: 'start' }}>
                <div style={{ display: 'grid', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)' }}>{row.organism}</span>
                  <span style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{row.zoneName} · {row.testType}</span>
                  <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{row.sampleId} · {row.sampleDate}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color }}>
                    {row.result}
                  </span>
                  {row.cfu !== undefined && (
                    <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
                      {row.cfu} CFU{row.cfuLimit !== undefined ? ` / ${row.cfuLimit}` : ''}
                    </span>
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
