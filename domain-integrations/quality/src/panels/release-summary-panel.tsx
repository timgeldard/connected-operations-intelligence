import { useState, useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import { SourceConfidenceStrip, type ExtendedSourceMode } from '@connectio/design-system'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { BatchReleaseSummary } from '@connectio/data-contracts'
import { useReleaseSummary } from '../adapters/quality-release-queries.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'

/** Static registration record for the Release Summary panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'batch-release-summary',
  displayName: 'Release Summary',
  description: 'Consolidated release readiness across quality, SPC, CoA, holds, deviations, and trace — with recommended action.',
  ownerDomain: 'quality',
  sourceOwnership: { domainId: 'quality', systemName: 'sap-qm', legacyAppId: 'connectedquality' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['quality-batch-release'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: { staleAfterSeconds: 180, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.99, hidden: false },
  requiredPermissions: [{ permissionId: 'quality.read', displayName: 'Quality Read' }],
}

const validatedSource = (source: unknown): ExtendedSourceMode => {
  if (source === 'mock' || source === 'legacy-api' || source === 'databricks-api') {
    return source
  }
  return 'unknown'
}

/** Props for ReleaseSummaryPanel. */
export interface ReleaseSummaryPanelProps {
  /** Adapter request context providing releaseCaseId and batchId. */
  readonly request: QualityReleaseAdapterRequest
}

/**
 * Evidence panel displaying the consolidated batch release readiness summary.
 *
 * @remarks
 * Shows overall readiness, all blocking factors and warnings, and the
 * system-recommended action. This is the primary decision-support panel
 * on the quality-batch-release workspace overview.
 */
export function ReleaseSummaryPanel({ request }: ReleaseSummaryPanelProps) {
  const { data: result, isLoading } = useReleaseSummary(request)
  const [showAdvisories, setShowAdvisories] = useState(true)
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

  const data: BatchReleaseSummary | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          <SourceConfidenceStrip
            mode={validatedSource(result?.source)}
            status="loaded"
            fetchedAt={result?.ok ? result.fetchedAt : undefined}
            style={{ marginBottom: '4px', background: 'var(--shell-surface)', border: 'none', padding: '0 0 8px 0' }}
          />
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <ReadinessBadge readiness={data.overallReadiness} />
            <RecommendedActionChip action={data.recommendedAction} />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
            <ReadinessSignal label="Quality" passed={data.qualityPassed} />
            <ReadinessSignal label="SPC" passed={data.spcClean} />
            <ReadinessSignal label="CoA" passed={data.coaComplete} />
            <ReadinessSignal label="No Holds" passed={data.noOpenHolds} />
            <ReadinessSignal label="Deviations" passed={data.deviationsResolved} />
            <ReadinessSignal label="Trace" passed={data.traceClean} />
          </div>

          {data.blockers.length > 0 && (
            <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#D32F2F', marginBottom: 6 }}>
                Blockers ({data.blockers.length})
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {data.blockers.map((b, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--shell-fg-2)', display: 'flex', gap: 6 }}>
                    <span style={{ color: '#D32F2F', flexShrink: 0 }}>●</span>
                    {b}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.warnings.length > 0 && (
            <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FF9800', marginBottom: 6 }}>
                Warnings ({data.warnings.length})
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {data.warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--shell-fg-2)', display: 'flex', gap: 6 }}>
                    <span style={{ color: '#FF9800', flexShrink: 0 }}>▲</span>
                    {w}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 10, marginTop: 4, fontSize: 11, color: 'var(--shell-fg-3)', display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Notes & Advisories</span>
              <button
                type="button"
                onClick={() => setShowAdvisories(!showAdvisories)}
                style={{
                  fontSize: 10,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--shell-fg-3)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  padding: '2px 4px',
                }}
              >
                {showAdvisories ? 'Hide' : 'Show'}
              </button>
            </div>
            {showAdvisories && (
              <div style={{ display: 'grid', gap: 6 }}>
                {result?.source === 'mock' && (
                  <div style={{ display: 'flex', gap: 4, padding: '4px 6px', background: 'rgba(217,119,6,0.06)', borderLeft: '3px solid #D97706', borderRadius: 4 }}>
                    <strong>Mock data only:</strong>
                    <span>This panel is showing simulated data. Usage decisions do not write back to SAP QM.</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 4 }}>
                  <strong>Trust Notice:</strong>
                  <span>Unavailable evidence panels must not be interpreted as zero exposure. No risk signals returned from current source.</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <strong>Advisory:</strong>
                  <span>Recommended actions are system-generated based on available evidence. Always cross-reference lot details and deviation status before finalizing the release decision.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

const READINESS_STYLE: Record<string, { bg: string; fg: string }> = {
  ready: { bg: 'rgba(76,175,80,0.1)', fg: '#4CAF50' },
  conditional: { bg: 'rgba(255,152,0,0.1)', fg: '#FF9800' },
  blocked: { bg: 'rgba(211,47,47,0.1)', fg: '#D32F2F' },
  incomplete: { bg: 'rgba(158,158,158,0.1)', fg: '#9E9E9E' },
  unknown: { bg: 'rgba(158,158,158,0.1)', fg: '#9E9E9E' },
}

function ReadinessBadge({ readiness }: { readiness: string }) {
  const style = READINESS_STYLE[readiness] ?? READINESS_STYLE.incomplete
  return (
    <span style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize', color: style.fg, padding: '4px 12px', borderRadius: 20, background: style.bg }}>
      {readiness.replace(/-/g, ' ')}
    </span>
  )
}

const ACTION_COLOUR: Record<string, string> = {
  release: '#4CAF50',
  'conditional-release': '#FF9800',
  reject: '#D32F2F',
  escalate: '#9C27B0',
  retest: '#2196F3',
}

function RecommendedActionChip({ action }: { action: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        Recommended
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'capitalize', color: ACTION_COLOUR[action] ?? 'var(--shell-fg)' }}>
        {action.replace(/-/g, ' ')}
      </div>
    </div>
  )
}

function ReadinessSignal({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 56 }}>
      <div style={{ fontSize: 16, color: passed ? '#4CAF50' : '#D32F2F' }}>{passed ? '✓' : '✗'}</div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>
        {label}
      </div>
    </div>
  )
}
