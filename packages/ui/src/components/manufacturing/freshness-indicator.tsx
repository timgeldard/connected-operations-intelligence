export interface FreshnessIndicatorProps {
  /**
   * ISO 8601 timestamp of the last successful data refresh.
   * Null when the refresh time is unknown.
   */
  lastRefreshedAt: string | null
  /** When true, renders a visual stale warning alongside the timestamp. */
  isStale: boolean
  className?: string
}

/** Format an ISO timestamp into a human-readable "HH:MM DD MMM" string. */
function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  })
}

/**
 * FreshnessIndicator renders the last-refreshed timestamp and a stale indicator.
 * A warning dot is shown when isStale is true, prompting the user to refresh.
 */
export function FreshnessIndicator({ lastRefreshedAt, isStale, className }: FreshnessIndicatorProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: 'var(--fs-12)',
        color: isStale ? 'var(--status-warn)' : 'var(--fg-muted)',
      }}
    >
      {isStale && (
        <span
          aria-label="Stale data"
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--status-warn)',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
      )}
      {lastRefreshedAt ? formatTimestamp(lastRefreshedAt) : 'Never refreshed'}
    </span>
  )
}
