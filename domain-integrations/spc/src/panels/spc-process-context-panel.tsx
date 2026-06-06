import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { SPCMonitoringContext } from '@connectio/data-contracts'
import { useSPCMonitoringContext } from '../adapters/spc-monitoring-queries.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'spc-process-context',
  displayName: 'SPC Process Context',
  description: 'Current monitoring scope — plant, material, batch, work centre, characteristic, and chart type.',
  ownerDomain: 'spc',
  sourceOwnership: { domainId: 'spc', systemName: 'spc', legacyAppId: 'spc' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['spc-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: false, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'spc.read', displayName: 'SPC Read' }],
}

export interface SPCProcessContextPanelProps {
  readonly request: SPCMonitoringAdapterRequest
}

export function SPCProcessContextPanel({ request }: SPCProcessContextPanelProps) {
  const { data: result, isLoading } = useSPCMonitoringContext(request)
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

  const ctx: SPCMonitoringContext | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {ctx && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 8 }}>
          <ContextRow label="Plant" value={ctx.plantName} />
          <ContextRow label="Material" value={`${ctx.materialId} — ${ctx.materialDescription}`} />
          {ctx.workCentreId && <ContextRow label="Work Centre" value={ctx.workCentreId} />}
          {ctx.batchId && <ContextRow label="Batch" value={ctx.batchId} />}
          {ctx.characteristicId && <ContextRow label="Characteristic" value={ctx.characteristicId} />}
          {ctx.chartType && <ContextRow label="Chart Type" value={ctx.chartType.toUpperCase()} />}
          <ContextRow label="Active Signals" value={String(ctx.activeSignals)} />
          <ContextRow label="Last Updated" value={new Date(ctx.lastUpdatedAt).toLocaleString()} />
        </div>
      )}
    </EvidencePanel>
  )
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, alignItems: 'baseline' }}>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--shell-fg)', fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}
