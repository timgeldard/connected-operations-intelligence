export interface ConfidenceIndicatorProps {
  /**
   * Data confidence level from 0 to 1, or null when confidence is unknown.
   * Note: 0 is a valid value (zero confidence) distinct from null (unknown).
   */
  level: number | null
  /** Optional explanation of why confidence is at this level. */
  reason?: string
  /** When true, the indicator is hidden entirely (useful for panels without confidence data). */
  hidden?: boolean
}

/** Resolve the colour token for a given confidence level. */
function resolveToken(level: number | null): string {
  if (level === null) return 'var(--confidence-none)'
  if (level > 0.8)  return 'var(--confidence-high)'
  if (level >= 0.5) return 'var(--confidence-medium)'
  return 'var(--confidence-low)'
}

/** Format a 0–1 level as a percentage string for display. */
function formatLevel(level: number | null): string {
  return level === null ? 'Unknown' : `${Math.round(level * 100)}%`
}

/**
 * ConfidenceIndicator renders a coloured bar and label showing data confidence.
 * Thresholds: high > 0.8, medium 0.5–0.8, low < 0.5, none = null.
 */
export function ConfidenceIndicator({ level, reason, hidden = false }: ConfidenceIndicatorProps) {
  if (hidden) return null

  const token = resolveToken(level)
  const pct = level === null ? 0 : Math.round(level * 100)

  return (
    <div
      title={reason}
      style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 80 }}
    >
      <div
        style={{
          height: '4px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--stroke-soft)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: token,
            borderRadius: 'var(--radius-full)',
            transition: 'width var(--dur-mid) var(--ease-out)',
          }}
        />
      </div>
      <span
        style={{
          fontSize: 'var(--fs-12)',
          color: token,
          fontWeight: 'var(--fw-semibold)',
        }}
      >
        {formatLevel(level)}
      </span>
    </div>
  )
}
