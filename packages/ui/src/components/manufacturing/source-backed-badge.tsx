import { StatusBadge } from './status-badge.js'

export interface SourceBackedBadgeProps {
  className?: string
}

/**
 * Indicates that the evidence is backed by the source system.
 */
export function SourceBackedBadge({ className }: SourceBackedBadgeProps) {
  return <StatusBadge label="Source-backed" variant="neutral" className={className} />
}
