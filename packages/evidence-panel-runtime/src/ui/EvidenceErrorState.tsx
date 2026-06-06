import { ErrorState } from '@connectio/design-system'

export interface EvidenceErrorStateProps {
  message: string
  className?: string
}

export function EvidenceErrorState({ message, className }: EvidenceErrorStateProps) {
  // Ensure we don't accidentally display "no data" when there is a source error.
  const displayMessage = message.toLowerCase() === 'no data' ? 'Source system error' : message
  return <ErrorState title="Evidence Unavailable" message={displayMessage} className={className} />
}
