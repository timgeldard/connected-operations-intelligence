import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { MaterialShortage } from '@connectio/data-contracts'
import { useMaterialShortages } from '../adapters/operations-plan-risk-queries.js'
import type { OperationsPlanRiskAdapterRequest } from '../adapters/operations-plan-risk-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'material-shortage',
  displayName: 'Material Shortages',
  description: 'Material shortages affecting process orders in the current plan.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'poh' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['operations-plan-risk'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.88, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.plan.read', displayName: 'Operations Plan Read' }],
}

const SEVERITY_BORDER: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F24A00',
  medium: '#D97706',
  low: '#2E7D32',
}

const STAGING_COLOUR: Record<string, string> = {
  'not-staged': '#D32F2F',
  partial: '#D97706',
  staged: '#2E7D32',
  'not-required': 'var(--shell-fg-3)',
}

const PROCUREMENT_COLOUR: Record<string, string> = {
  delayed: '#D32F2F',
  'out-of-stock': '#D32F2F',
  ordered: '#D97706',
  'in-stock': '#2E7D32',
  unknown: 'var(--shell-fg-3)',
}

const WORST_SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']

function worstSeverity(items: MaterialShortage[]): string {
  for (const s of WORST_SEVERITY_ORDER) {
    if (items.some((i) => i.severity === s)) return s
  }
  return 'low'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', border: `1px solid ${color}`, borderRadius: 3, padding: '1px 5px' }}>
      {label.replace(/-/g, ' ')}
    </span>
  )
}

function ShortageRow({ item }: { item: MaterialShortage }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--shell-line)' }}>
      <div style={{ width: 3, minHeight: 48, borderRadius: 2, background: SEVERITY_BORDER[item.severity] ?? 'var(--shell-fg-3)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.materialDescription}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: item.severity === 'low' ? '#D97706' : '#D32F2F' }}>
            -{item.shortageQuantity.toLocaleString()} {item.uom}
          </span>
          <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>by {formatTime(item.requiredBy)}</span>
          <StatusBadge label={item.stagingStatus} color={STAGING_COLOUR[item.stagingStatus] ?? 'var(--shell-fg-3)'} />
          <StatusBadge label={item.procurementStatus} color={PROCUREMENT_COLOUR[item.procurementStatus] ?? 'var(--shell-fg-3)'} />
          <span style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginLeft: 'auto' }}>
            {item.affectedOrders.length} {item.affectedOrders.length === 1 ? 'order' : 'orders'}
          </span>
        </div>
      </div>
    </div>
  )
}

export interface MaterialShortagePanelProps {
  readonly request: OperationsPlanRiskAdapterRequest
}

export function MaterialShortagePanel({ request }: MaterialShortagePanelProps) {
  const { data: result, isLoading } = useMaterialShortages(request)
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

  const data: MaterialShortage[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {data && (
        <div style={{ padding: '12px 16px' }}>
          {data.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--shell-fg-3)', padding: '8px 0' }}>No material shortages for this plan</div>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: SEVERITY_BORDER[worstSeverity(data)], marginBottom: 8 }}>
                {data.length} material {data.length === 1 ? 'shortage' : 'shortages'}
              </div>
              <div>
                {data.map((item) => (
                  <ShortageRow key={item.materialId} item={item} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
