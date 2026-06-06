import { StatusBadge } from './status-badge.js'

export interface SourceBadgeProps {
  source: string
  className?: string
}

/**
 * Renders the specific source backing this evidence.
 */
export function SourceBadge({ source, className }: SourceBadgeProps) {
  return <StatusBadge label={source} variant="neutral" className={className} />
}
