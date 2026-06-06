import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { GoodsMovementEvent } from '@connectio/data-contracts'
import { useGoodsMovements } from '../adapters/warehouse-360-queries.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'inbound-outbound-summary',
  displayName: 'Inbound / Outbound Summary',
  description: 'Today\'s goods movements grouped by type — receipts, issues, transfers, and adjustments.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['warehouse-360-overview'],
  requiredContext: [{ contextKey: 'warehouseId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 180, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.95, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.overview.read', displayName: 'Warehouse Overview Read' }],
}

export interface InboundOutboundSummaryPanelProps {
  readonly request: Warehouse360AdapterRequest
}

const MOVEMENT_META: Record<string, { label: string; short: string; color: string }> = {
  'goods-receipt': { label: 'Goods Receipt', short: 'Inbound', color: '#2E7D32' },
  'goods-issue': { label: 'Goods Issue', short: 'Outbound', color: '#F57C00' },
  'transfer-order': { label: 'Transfer Order', short: 'Transfer', color: '#005776' },
  adjustment: { label: 'Adjustment', short: 'Adj', color: '#9E9E9E' },
}

interface MovementGroup {
  type: string
  count: number
  latest: GoodsMovementEvent
}

function groupMovements(events: GoodsMovementEvent[]): MovementGroup[] {
  const map = new Map<string, MovementGroup>()
  for (const ev of events) {
    const existing = map.get(ev.movementType)
    if (!existing) {
      map.set(ev.movementType, { type: ev.movementType, count: 1, latest: ev })
    } else {
      existing.count += 1
      if (ev.timestamp > existing.latest.timestamp) existing.latest = ev
    }
  }
  const order = ['goods-receipt', 'goods-issue', 'transfer-order', 'adjustment']
  return order.flatMap(t => map.has(t) ? [map.get(t)!] : [])
}

function CountTile({ group }: { group: MovementGroup }) {
  const meta = MOVEMENT_META[group.type] ?? { label: group.type, short: group.type, color: 'var(--shell-fg)' }
  return (
    <div style={{ flex: '1 1 0', minWidth: 64, background: 'var(--shell-surface-2)', borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: meta.color, lineHeight: 1 }}>{group.count}</span>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--shell-fg-3)', textAlign: 'center' }}>{meta.short}</span>
    </div>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function InboundOutboundSummaryPanel({ request }: InboundOutboundSummaryPanelProps) {
  const { data: result, isLoading } = useGoodsMovements(request)
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

  const events: GoodsMovementEvent[] | null = result?.ok ? result.data : null
  const groups = events ? groupMovements(events) : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {groups && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--shell-fg-3)', fontSize: 13 }}>
              No goods movements today
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {groups.map(g => <CountTile key={g.type} group={g} />)}
              </div>

              <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 10, display: 'grid', gap: 5 }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
                  Latest movements
                </div>
                {groups.map(g => {
                  const meta = MOVEMENT_META[g.type] ?? { label: g.type, short: g.type, color: 'var(--shell-fg)' }
                  return (
                    <div key={g.type} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: meta.color, minWidth: 52, fontSize: 11 }}>{meta.short}</span>
                      <span style={{ flex: 1, color: 'var(--shell-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.latest.materialDescription}
                      </span>
                      <span style={{ color: 'var(--shell-fg-3)', whiteSpace: 'nowrap' }}>{formatTime(g.latest.timestamp)}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
