import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { InvestigationTimeline, TimelineEvent } from '@connectio/data-contracts'
import { useInvestigationTimeline } from './trace-app-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'investigation-timeline',
  displayName: 'Investigation Timeline',
  description:
    'Chronological log of production, QC, release, hold, dispatch, and approval events across SAP, LIMS, and TRACE source systems.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['trace'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: {
    staleAfterSeconds: 300,
    errorAfterSeconds: 900,
    refreshOnFocus: true,
    pollIntervalSeconds: null,
  },
  confidencePolicy: { level: 0.95, hidden: false },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

export interface TimelinePanelProps {
  readonly request: Trace2AdapterRequest
}

const TONE_COLORS: Record<TimelineEvent['tone'], string> = {
  good: 'var(--status-good)',
  warn: 'var(--status-warn)',
  bad: 'var(--status-bad)',
  brand: 'var(--brand)',
  neutral: 'var(--status-neutral)',
}

const TYPE_LABELS: Record<TimelineEvent['type'], string> = {
  production: 'Production',
  consumption: 'Consumption',
  qc: 'QC',
  release: 'Release',
  approval: 'Approval',
  hold: 'Hold',
  dispatch: 'Dispatch',
  note: 'Note',
}

export function TimelinePanel({ request }: TimelinePanelProps) {
  const { data: result, isLoading } = useInvestigationTimeline(request)
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

  const data: InvestigationTimeline | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: 24, fontFamily: 'var(--font-sans)' }}>
          <div style={{ position: 'relative', paddingLeft: 28 }}>
            <div
              style={{
                position: 'absolute',
                top: 6,
                bottom: 6,
                left: 9,
                width: 2,
                background: 'var(--stroke-soft)',
              }}
            />
            {data.events.map((e, i) => (
              <TimelineRow key={`${e.ts}-${i}`} event={e} />
            ))}
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  const dotColor = TONE_COLORS[event.tone]
  const date = new Date(event.ts)
  const dateLabel = isNaN(date.getTime()) ? event.ts : date.toLocaleString()

  return (
    <div style={{ position: 'relative', paddingBottom: 22 }}>
      <div
        style={{
          position: 'absolute',
          left: -24,
          top: 6,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: dotColor,
          border: '2px solid var(--white)',
          boxShadow: 'var(--shadow-sm)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 'var(--fs-12)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--fg-muted)',
            minWidth: 140,
          }}
        >
          {dateLabel}
        </span>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 10,
            fontWeight: 'var(--fw-bold)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            background: `color-mix(in srgb, ${dotColor} 12%, white)`,
            color: dotColor,
          }}
        >
          {TYPE_LABELS[event.type]}
        </span>
        <span style={{ fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-semibold)', color: 'var(--forest)' }}>
          {event.label}
        </span>
        {event.sourceSystem && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--fg-muted)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--stroke-soft)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {event.sourceSystem}
          </span>
        )}
      </div>
      <div style={{ marginTop: 6, fontSize: 'var(--fs-13)', color: 'var(--fg-muted)', paddingLeft: 152 }}>
        {event.detail} · <span style={{ fontStyle: 'italic', color: 'var(--forest)' }}>{event.actor}</span>
      </div>
    </div>
  )
}
