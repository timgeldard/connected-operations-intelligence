import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { TraceEvent } from '@connectio/data-contracts'
import { useTraceEvents } from '../adapters/trace2-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Static registration record for the Event Timeline panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'event-timeline',
  displayName: 'Event Timeline',
  description: 'Ordered timeline of investigation and batch events with source system and actor attribution.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['trace-investigation', 'quality-batch-release'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: false }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: true },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

/** Severity to colour mapping for event timeline markers. */
const severityColour: Record<string, string> = {
  critical: 'var(--sunset, #F24A00)',
  warning: '#D97706',
  info: 'var(--sage, #289BA2)',
}

/** Props for EventTimelinePanel. */
export interface EventTimelinePanelProps {
  /** Adapter request context providing investigationId and batchId. */
  readonly request: Trace2AdapterRequest
}

/**
 * Evidence panel displaying an ordered event timeline for the investigation.
 *
 * @remarks
 * Events are sorted newest-first. Each event shows severity, event type,
 * timestamp, actor, and source system. The panel uses a vertical timeline
 * layout using CSS-only styling — no additional layout library required.
 */
export function EventTimelinePanel({ request }: EventTimelinePanelProps) {
  const { data: result, isLoading } = useTraceEvents(request)
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

  const events: readonly TraceEvent[] = result?.ok ? result.data : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {events.length > 0 && (
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[...events]
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .map((event, idx) => (
                <div key={event.eventId} style={{ display: 'flex', gap: 12, paddingBottom: idx < events.length - 1 ? 16 : 0 }}>
                  {/* Timeline spine */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 16 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: severityColour[event.severity ?? 'info'] ?? 'var(--shell-fg-3)',
                        flexShrink: 0,
                        display: 'block',
                        marginTop: 3,
                      }}
                      aria-label={`Severity: ${event.severity ?? 'info'}`}
                    />
                    {idx < events.length - 1 && (
                      <div style={{ width: 2, flex: 1, background: 'var(--shell-line)', marginTop: 4 }} />
                    )}
                  </div>
                  {/* Event body */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)', marginBottom: 2 }}>
                      {event.title}
                    </div>
                    {event.description && (
                      <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginBottom: 4, lineHeight: 1.5 }}>
                        {event.description}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>{new Date(event.timestamp).toLocaleString()}</span>
                      <span>· {event.sourceSystem}</span>
                      {event.actor && <span>· {event.actor}</span>}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}
