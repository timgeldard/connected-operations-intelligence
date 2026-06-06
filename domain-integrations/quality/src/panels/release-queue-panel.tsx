import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { BatchReleaseQueueItem } from '@connectio/data-contracts'
import { useReleaseQueue } from '../adapters/quality-release-queries.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'

/** Static registration record for the Release Queue panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'release-queue',
  displayName: 'Release Queue',
  description: 'All batch release cases for the plant, sorted by priority. Used as the primary queue view.',
  ownerDomain: 'quality',
  sourceOwnership: { domainId: 'quality', systemName: 'sap-qm', legacyAppId: 'connectedquality' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['quality-batch-release'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: false }],
  freshnessPolicy: { staleAfterSeconds: 180, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: true },
  requiredPermissions: [{ permissionId: 'quality.read', displayName: 'Quality Read' }],
}

/** Props for ReleaseQueuePanel. */
export interface ReleaseQueuePanelProps {
  /** Adapter request context (plantId used for filtering). */
  readonly request: QualityReleaseAdapterRequest
  /** Called when the user selects a release case from the queue. */
  readonly onSelectCase?: (releaseCaseId: string) => void
  /** Currently active release case ID for highlighting. */
  readonly activeCaseId?: string
}

/**
 * Evidence panel displaying the batch release queue.
 *
 * @remarks
 * The primary panel on the `release-queue` view of the quality-batch-release workspace.
 * Each row shows priority, status, blockers, and alarm/deviation counts.
 */
export function ReleaseQueuePanel({ request, onSelectCase, activeCaseId }: ReleaseQueuePanelProps) {
  const { data: result, isLoading } = useReleaseQueue(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) {
      markReady()
    } else if (result && !result.ok) {
      markError()
    }
  }, [isLoading, result, markReady, markError])

  const items: readonly BatchReleaseQueueItem[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {items && (
        <div style={{ padding: '8px 0' }}>
          {items.map((item) => (
            <button
              key={item.releaseCaseId}
              onClick={() => onSelectCase?.(item.releaseCaseId)}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: 12,
                padding: '10px 16px',
                width: '100%',
                textAlign: 'left',
                background: item.releaseCaseId === activeCaseId ? 'var(--shell-surface-3)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--shell-line)',
                cursor: 'pointer',
                alignItems: 'center',
              }}
            >
              <PriorityIndicator priority={item.priority} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>
                  {item.materialDescription}
                  <span style={{ fontWeight: 400, color: 'var(--shell-fg-3)', marginLeft: 8 }}>{item.batchId}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                  {item.releaseCaseId}
                  {item.dueBy && (
                    <span style={{ marginLeft: 8, color: isDueUrgent(item.dueBy) ? '#D32F2F' : 'var(--shell-fg-3)' }}>
                      Due {new Date(item.dueBy).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {item.blockers.length > 0 && (
                  <div style={{ fontSize: 11, color: '#D32F2F', marginTop: 2 }}>
                    {item.blockers.slice(0, 2).join(' · ')}
                    {item.blockers.length > 2 && ` +${item.blockers.length - 2} more`}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <QueueStatusBadge status={item.status} />
                <div style={{ display: 'flex', gap: 6 }}>
                  {item.spcAlarmCount > 0 && (
                    <QueueSignal label={`${item.spcAlarmCount} SPC`} colour="#FF9800" />
                  )}
                  {item.openDeviationCount > 0 && (
                    <QueueSignal label={`${item.openDeviationCount} Dev`} colour="var(--sunset, #F24A00)" />
                  )}
                  {item.hasOpenHold && (
                    <QueueSignal label="Hold" colour="#D32F2F" />
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </EvidencePanel>
  )
}

const PRIORITY_COLOUR: Record<string, string> = {
  critical: '#D32F2F',
  expedited: 'var(--sunset, #F24A00)',
  routine: '#9E9E9E',
}

function PriorityIndicator({ priority }: { priority: string }) {
  return (
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: PRIORITY_COLOUR[priority] ?? '#9E9E9E',
        flexShrink: 0,
      }}
      title={`Priority: ${priority}`}
    />
  )
}

const STATUS_COLOUR: Record<string, string> = {
  'awaiting-review': '#9E9E9E',
  'under-review': '#2196F3',
  'conditionally-released': '#FF9800',
  released: '#4CAF50',
  rejected: '#D32F2F',
  'on-hold': '#FF9800',
  escalated: '#9C27B0',
}

function QueueStatusBadge({ status }: { status: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: STATUS_COLOUR[status] ?? 'var(--shell-fg)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {status.replace(/-/g, ' ')}
    </span>
  )
}

function QueueSignal({ label, colour }: { label: string; colour: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: colour, padding: '1px 5px', borderRadius: 8, background: `${colour}22` }}>
      {label}
    </span>
  )
}

/** Returns true if due date is within 24 hours. */
function isDueUrgent(dueBy: string): boolean {
  return (new Date(dueBy).getTime() - Date.now()) < 24 * 60 * 60 * 1000
}
