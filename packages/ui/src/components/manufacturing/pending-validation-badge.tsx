import { StatusBadge } from './status-badge.js'

export interface PendingValidationBadgeProps {
  className?: string
}

/**
 * Indicates that evidence is pending validation.
 */
export function PendingValidationBadge({ className }: PendingValidationBadgeProps) {
  return <StatusBadge label="Pending validation" variant="warn" className={className} />
}
