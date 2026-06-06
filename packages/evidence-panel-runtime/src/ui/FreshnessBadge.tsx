import { FreshnessIndicator } from '@connectio/design-system'

export interface FreshnessBadgeProps {
  fetchedAt?: string | null
  isStale?: boolean
  className?: string
}

export function FreshnessBadge({ fetchedAt, isStale = false, className }: FreshnessBadgeProps) {
  return (
    <FreshnessIndicator
      lastRefreshedAt={fetchedAt ?? null}
      isStale={isStale}
      className={className}
    />
  )
}
