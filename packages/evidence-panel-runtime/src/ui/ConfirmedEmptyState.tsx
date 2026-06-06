import { EmptyState } from '@connectio/design-system'

export interface ConfirmedEmptyStateProps {
  description?: string
  className?: string
}

export function ConfirmedEmptyState({ description, className }: ConfirmedEmptyStateProps) {
  return <EmptyState title="No records returned" description={description} className={className} />
}
