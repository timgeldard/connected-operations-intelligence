import { StatusBadge } from './status-badge.js'

export interface ApplicationHeuristicBadgeProps {
  className?: string
}

/**
 * Info-coloured pill indicating a field value was produced by an application heuristic,
 * not read directly from the source system (classification: application-heuristic).
 */
export function ApplicationHeuristicBadge({ className }: ApplicationHeuristicBadgeProps) {
  return <StatusBadge label="Application-heuristic" variant="info" className={className} />
}
