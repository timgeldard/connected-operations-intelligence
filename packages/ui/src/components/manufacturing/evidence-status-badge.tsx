import { StatusBadge } from './status-badge.js'

export type EvidenceStatus =
  | 'loaded'
  | 'partial'
  | 'unavailable'
  | 'no-records'
  | 'mock-only'
  | 'pending-validation'
  | 'error'
  | 'permission-denied'
  | 'timed-out'

export interface EvidenceStatusBadgeProps {
  status: EvidenceStatus
  className?: string
}

/**
 * Standard badge for displaying the completeness and validation state of evidence.
 */
export function EvidenceStatusBadge({ status, className }: EvidenceStatusBadgeProps) {
  const config: Record<EvidenceStatus, { label: string; variant: 'good' | 'warn' | 'bad' | 'info' | 'neutral' }> = {
    loaded: {
      label: 'Loaded',
      variant: 'good',
    },
    partial: {
      label: 'Partial',
      variant: 'warn',
    },
    unavailable: {
      label: 'Unavailable',
      variant: 'bad',
    },
    'no-records': {
      label: 'No Records',
      variant: 'neutral',
    },
    'mock-only': {
      label: 'Mock Only',
      variant: 'neutral',
    },
    'pending-validation': {
      label: 'Pending Validation',
      variant: 'info',
    },
    error: {
      label: 'Error',
      variant: 'bad',
    },
    'permission-denied': {
      label: 'Access Denied',
      variant: 'bad',
    },
    'timed-out': {
      label: 'Timed Out',
      variant: 'bad',
    },
  }

  const { label, variant } = config[status] || { label: status, variant: 'neutral' }

  return (
    <StatusBadge
      label={label}
      variant={variant}
      className={className}
    />
  )
}
