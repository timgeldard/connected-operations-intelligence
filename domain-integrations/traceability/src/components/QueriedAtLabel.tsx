import React from 'react'

/**
 * Small inline label showing when a panel's data was last fetched, plus an
 * explicit note that the underlying source refresh time is unavailable.
 *
 * `fetchedAt` is the HTTP response time recorded by the adapter (from
 * `AdapterResult.fetchedAt`). It is NOT the Databricks pipeline freshness
 * timestamp — that requires a verified `_updated_at` column on each gold
 * view (TRACE-P2-002 Phase 2 work, not in this slice).
 *
 * Renders nothing if `fetchedAt` is null/undefined (e.g., panel hasn't
 * loaded yet or returned an error).
 */
export interface QueriedAtLabelProps {
  readonly fetchedAt?: string | null
  readonly style?: React.CSSProperties
}

export function QueriedAtLabel({ fetchedAt, style }: QueriedAtLabelProps) {
  if (!fetchedAt) return null
  const time = formatQueryTime(fetchedAt)
  return (
    <div
      style={{
        fontSize: 11,
        color: 'var(--shell-fg-3)',
        ...style,
      }}
      aria-label="Data fetch time and source freshness notice"
    >
      Queried at {time} — source refresh time unavailable
    </div>
  )
}

function formatQueryTime(iso: string): string {
  // Display as HH:MM:SS local time. If the ISO string is malformed, fall back
  // to the raw value rather than throwing.
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}
