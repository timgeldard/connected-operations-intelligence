import { StatusBadge } from './status-badge.js'

export interface ApplicationDerivedBadgeProps {
  className?: string
}

/**
 * Indicates that a field value was derived by the application,
 * not read directly from the source system.
 */
export function ApplicationDerivedBadge({ className }: ApplicationDerivedBadgeProps) {
  return <StatusBadge label="Application-derived" variant="info" className={className} />
}
