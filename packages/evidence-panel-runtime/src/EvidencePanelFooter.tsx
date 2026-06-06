import {
  ConfidenceIndicator,
  FreshnessIndicator,
  DrillThroughButton,
} from '@connectio/design-system'
import type { FreshnessMetadata, ConfidenceMetadata } from '@connectio/data-contracts'
import type { EvidencePanelRegistration } from '@connectio/product-model'

/** Props for EvidencePanelFooter. */
export interface EvidencePanelFooterProps {
  /** Panel registration used to determine whether drill-through is configured. */
  registration: EvidencePanelRegistration
  /**
   * Runtime confidence snapshot. Rendered only when provided and
   * `confidence.hidden` is false.
   */
  confidence?: ConfidenceMetadata
  /** Runtime freshness snapshot. Rendered only when provided. */
  freshness?: FreshnessMetadata
  /**
   * Drill-through handler. Rendered only when both this prop and
   * `registration.drillThrough` are present.
   */
  onDrillThrough?: () => void
}

/**
 * EvidencePanelFooter renders optional metadata actions at the bottom of a panel.
 *
 * @remarks
 * Only mounts visible content when at least one of confidence, freshness, or
 * drill-through is available. When all three are absent the footer renders nothing.
 */
export function EvidencePanelFooter({
  registration,
  confidence,
  freshness,
  onDrillThrough,
}: EvidencePanelFooterProps) {
  const drillThrough = registration.drillThrough
  const showConfidence = confidence !== undefined && !confidence.hidden
  const showFreshness = freshness !== undefined
  const showDrillThrough = onDrillThrough !== undefined && drillThrough !== undefined

  if (!showConfidence && !showFreshness && !showDrillThrough) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-4)',
        padding: '6px 14px',
        borderTop: '1px solid var(--shell-line)',
        background: 'var(--shell-surface)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      {showConfidence && (
        <ConfidenceIndicator
          level={confidence.level}
          reason={confidence.reason}
        />
      )}
      {showFreshness && (
        <div style={{ marginLeft: showConfidence ? 'auto' : undefined }}>
          <FreshnessIndicator
            lastRefreshedAt={freshness.lastRefreshedAt}
            isStale={freshness.isStale}
          />
        </div>
      )}
      {showDrillThrough && drillThrough !== undefined && onDrillThrough !== undefined && (
        <div style={{ marginLeft: 'auto' }}>
          <DrillThroughButton
            label={drillThrough.label}
            onClick={onDrillThrough}
          />
        </div>
      )}
    </div>
  )
}
