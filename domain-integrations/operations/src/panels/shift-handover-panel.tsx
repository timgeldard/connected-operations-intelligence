import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ShiftHandoverItem } from '@connectio/data-contracts'
import { useShiftHandoverItems } from '../adapters/operations-plan-risk-queries.js'
import type { OperationsPlanRiskAdapterRequest } from '../adapters/operations-plan-risk-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'shift-handover',
  displayName: 'Shift Handover',
  description: 'Shift handover notes and carried-forward actions from the previous shift.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'poh' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['operations-plan-risk'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 600, errorAfterSeconds: 1800, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.98, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.plan.read', displayName: 'Operations Plan Read' }],
}

export interface ShiftHandoverPanelProps {
  readonly request: OperationsPlanRiskAdapterRequest
}

const CATEGORY_COLOR: Record<string, string> = {
  quality: '#005776',
  safety: '#D32F2F',
  maintenance: '#F57C00',
  operations: '#2E7D32',
  material: '#D97706',
  other: 'var(--shell-fg-3)',
}

const STATUS_COLOR: Record<string, string> = {
  open: '#D32F2F',
  'in-progress': '#F57C00',
  acknowledged: '#1565C0',
  resolved: '#2E7D32',
}

const SEVERITY_BORDER: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#FBC02D',
  low: '#9E9E9E',
}

export function ShiftHandoverPanel({ request }: ShiftHandoverPanelProps) {
  const { data: result, isLoading } = useShiftHandoverItems(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) { markReady() } else if (result && !result.ok) { markError() }
  }, [isLoading, result, markReady, markError])

  const data: ShiftHandoverItem[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel registration={registration} displayState={displayState} errorMessage={!result?.ok ? result?.error.message : undefined}>
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 10 }}>
          {data.length > 0 && (
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg-2)', marginBottom: 2 }}>
              Shift {data[0].shiftId} handover notes
            </div>
          )}
          {data.length === 0 ? (
            <span style={{ fontSize: 13, color: 'var(--shell-fg-3)' }}>No handover notes for this shift</span>
          ) : (
            data.map((item) => (
              <div
                key={item.handoverId}
                style={{
                  borderLeft: `3px solid ${SEVERITY_BORDER[item.severity] ?? 'var(--shell-line)'}`,
                  paddingLeft: 10,
                  paddingTop: 6,
                  paddingBottom: 6,
                  borderBottom: '1px solid var(--shell-line)',
                  display: 'grid',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, textTransform: 'capitalize',
                    background: CATEGORY_COLOR[item.category] ?? 'var(--shell-fg-3)', color: '#fff',
                  }}>
                    {item.category}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: SEVERITY_BORDER[item.severity] ?? 'var(--shell-fg)', textTransform: 'capitalize' }}>
                    {item.severity}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, textTransform: 'capitalize',
                    color: STATUS_COLOR[item.status] ?? 'var(--shell-fg-3)', border: `1px solid ${STATUS_COLOR[item.status] ?? 'var(--shell-line)'}`,
                  }}>
                    {item.status.replace(/-/g, ' ')}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)' }}>{item.title}</span>
                <span style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{item.description}</span>
                {item.linkedOrders.length > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Orders: {item.linkedOrders.join(', ')}</span>
                )}
                <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {item.createdBy}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
