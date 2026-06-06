import { SourceModeBadge, type ExtendedSourceMode } from './source-mode-badge.js'
import { EvidenceStatusBadge, type EvidenceStatus } from './evidence-status-badge.js'
import { FreshnessIndicator } from './freshness-indicator.js'

export interface SourceConfidenceStripProps {
  mode: ExtendedSourceMode
  status: EvidenceStatus
  fetchedAt?: string | null
  dataAsOf?: string | null
  className?: string
  style?: React.CSSProperties
}

/**
 * A reusable horizontal strip that combines source mode, evidence status, and freshness indicators.
 * Used at the top of workspaces or high-level evidence summaries to build user trust.
 */
export function SourceConfidenceStrip({
  mode,
  status,
  fetchedAt,
  className,
  style,
}: SourceConfidenceStripProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 12px',
        background: 'var(--shell-surface-2, #FAFAF3)',
        border: '1px solid var(--shell-line, #DAD9C9)',
        borderRadius: '6px',
        fontSize: '13px',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--shell-fg-3, #7A8A75)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Source:</span>
        <SourceModeBadge mode={mode} />
      </div>

      <div style={{ width: '1px', height: '16px', background: 'var(--shell-line, #DAD9C9)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--shell-fg-3, #7A8A75)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Evidence:</span>
        <EvidenceStatusBadge status={status} />
      </div>

      <div style={{ flex: 1 }} />

      <FreshnessIndicator
        lastRefreshedAt={fetchedAt || null}
        isStale={false}
      />
    </div>
  )
}
