import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { OperationsActionQueueItem } from '@connectio/data-contracts'
import { useOperationsActionQueue } from '../adapters/operations-plan-risk-queries.js'
import type { OperationsPlanRiskAdapterRequest } from '../adapters/operations-plan-risk-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'operations-action-queue',
  displayName: 'Operations Action Queue',
  description: 'Recommended actions for operations — prioritised by severity and due time.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'poh' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['operations-plan-risk'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 60, errorAfterSeconds: 300, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.plan.read', displayName: 'Operations Plan Read' }],
}

export interface OperationsActionQueuePanelProps {
  readonly request: OperationsPlanRiskAdapterRequest
}

const SEVERITY_BORDER: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#FBC02D',
  low: '#9E9E9E',
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

const STATUS_COLOR: Record<string, string> = {
  open: '#D32F2F',
  'in-progress': '#F57C00',
}

function sortActions(items: OperationsActionQueueItem[]): OperationsActionQueueItem[] {
  return [...items].sort((a, b) => {
    const rankDiff = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
    if (rankDiff !== 0) return rankDiff
    const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Infinity
    const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Infinity
    return aTime - bTime
  })
}

export function OperationsActionQueuePanel({ request }: OperationsActionQueuePanelProps) {
  const { data: result, isLoading } = useOperationsActionQueue(request)
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

  const data: OperationsActionQueueItem[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel registration={registration} displayState={displayState} errorMessage={!result?.ok ? result?.error.message : undefined}>
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 8 }}>
          {(() => {
            const open = sortActions(data.filter(a => a.status !== 'dismissed' && a.status !== 'completed'))
            return open.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--shell-fg-3)' }}>No open actions — plan on track</span>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: 'var(--sunset, #F24A00)', color: '#fff' }}>
                    {open.length} open {open.length === 1 ? 'action' : 'actions'}
                  </span>
                </div>
                {open.map((action) => {
                  const isPastDue = action.dueAt ? new Date(action.dueAt).getTime() < Date.now() : false
                  return (
                    <div
                      key={action.actionId}
                      style={{
                        borderLeft: `3px solid ${SEVERITY_BORDER[action.severity] ?? 'var(--shell-line)'}`,
                        paddingLeft: 10,
                        paddingTop: 6,
                        paddingBottom: 6,
                        borderBottom: '1px solid var(--shell-line)',
                        display: 'grid',
                        gap: 3,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)' }}>{action.title}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: 'var(--shell-surface-2)', color: 'var(--shell-fg-2)' }}>
                          {action.ownerRole}
                        </span>
                        {action.dueAt && (
                          <span style={{ fontSize: 11, color: isPastDue ? 'var(--sunset, #F24A00)' : 'var(--shell-fg-3)' }}>
                            Due {new Date(action.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {isPastDue && ' · overdue'}
                          </span>
                        )}
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, textTransform: 'capitalize',
                          color: STATUS_COLOR[action.status] ?? 'var(--shell-fg-3)', border: `1px solid ${STATUS_COLOR[action.status] ?? 'var(--shell-line)'}`,
                        }}>
                          {action.status.replace(/-/g, ' ')}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--shell-fg-3)' }}>{action.recommendedAction}</span>
                    </div>
                  )
                })}
              </>
            )
          })()}
        </div>
      )}
    </EvidencePanel>
  )
}
