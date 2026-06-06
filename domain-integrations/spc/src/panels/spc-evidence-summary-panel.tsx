import { useEffect, useMemo } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import { EvidenceStatusBadge, type EvidenceStatus } from '@connectio/design-system'
import type { AdapterSource } from '@connectio/source-adapters'

const registration: EvidencePanelRegistration = {
  panelId: 'spc-evidence-summary',
  displayName: 'SPC Evidence Summary',
  description: 'Availability and status of SPC evidence panels.',
  ownerDomain: 'spc',
  sourceOwnership: { domainId: 'spc', systemName: 'spc', legacyAppId: 'spc' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['spc-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 60, errorAfterSeconds: 300, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'spc.read', displayName: 'SPC Read' }],
}

interface EvidenceSection {
  readonly id: string
  readonly name: string
  readonly status: EvidenceStatus
  readonly source?: AdapterSource
  readonly count?: number
  readonly message?: string
}

interface SPCEvidenceSummaryPanelProps {
  readonly sections: EvidenceSection[]
}

export function SPCEvidenceSummaryPanel({ sections }: SPCEvidenceSummaryPanelProps) {
  const lastRefreshedAt = useMemo(() => {
    void sections
    return new Date().toISOString()
  }, [sections])

  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (sections.some(s => s.status === 'pending-validation')) {
      return
    }
    if (sections.some(s => s.status === 'error')) {
      markError()
    } else {
      markReady()
    }
  }, [sections, markReady, markError])

  const overallSource = useMemo(() => {
    const sources = sections.map(s => s.source).filter(Boolean) as AdapterSource[]
    if (sources.includes('mixed')) return 'mixed'
    if (sources.includes('databricks-api') && sources.includes('mock')) return 'mixed'
    if (sources.includes('databricks-api')) return 'databricks-api'
    if (sources.includes('legacy-api')) return 'legacy-api'
    return 'mock'
  }, [sections])

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={displayState === 'error' ? 'One or more evidence sections failed to load.' : undefined}
      source={overallSource}
    >
      <div
        style={{
          padding: '16px',
          background: 'var(--shell-surface)',
          border: '1px solid var(--shell-line)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--shell-fg)' }}>
            SPC Evidence Completeness Summary
          </h3>
          <div style={{ fontSize: '11px', color: 'var(--shell-fg-3)', fontWeight: 500 }}>
            {sections.filter(s => ['ready', 'loaded', 'mock-only'].includes(s.status)).length} / {sections.length} Loaded
          </div>
        </div>

        <div style={{ display: 'grid', gap: '8px' }}>
          {sections.map(section => (
            <div
              key={section.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                background: 'var(--shell-surface-2)',
                borderRadius: '6px',
                border: '1px solid var(--shell-line)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--shell-fg)' }}>
                  {section.name}
                </span>
                {section.message && (
                  <span style={{ fontSize: '10px', color: 'var(--shell-fg-3)' }}>
                    {section.message}
                  </span>
                )}
              </div>

              {section.count !== undefined && (
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  color: 'var(--shell-fg-2)',
                  background: 'var(--shell-surface)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  minWidth: '24px',
                  textAlign: 'center'
                }}>
                  {section.count}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                 {section.source && (
                   <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--shell-fg-3)', textTransform: 'uppercase', opacity: 0.7 }}>
                     {section.source}
                   </span>
                 )}
                 <EvidenceStatusBadge status={section.status} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ 
          marginTop: '4px',
          padding: '8px 12px',
          background: 'rgba(56, 139, 253, 0.05)',
          border: '1px solid rgba(56, 139, 253, 0.2)',
          borderRadius: '6px',
          fontSize: '11px',
          color: 'var(--shell-fg-2)',
          lineHeight: 1.5
        }}>
          <strong style={{ color: 'var(--shell-accent, #388BFD)' }}>Read-Only UAT Notice:</strong> This summary tracks the availability of evidence panels within the current scope. 'Mock' status indicates high-fidelity simulation for workflow validation.
        </div>
      </div>
    </EvidencePanel>
  )
}
