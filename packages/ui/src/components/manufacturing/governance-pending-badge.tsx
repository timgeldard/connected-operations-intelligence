import { StatusBadge } from './status-badge.js'

export interface GovernancePendingBadgeProps {
  className?: string
  reason?: string
}

/**
 * Indicates that the record is pending governance approval or that rules have not yet been implemented.
 */
export function GovernancePendingBadge({ className, reason }: GovernancePendingBadgeProps) {
  return (
    <StatusBadge label="Governance pending" variant="warn" className={className} title={reason} />
  )
}
