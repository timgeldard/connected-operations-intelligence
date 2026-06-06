import { LoadingState } from '@connectio/design-system'

export interface EvidenceLoadingStateProps {
  lines?: number
  className?: string
}

export function EvidenceLoadingState({ lines, className }: EvidenceLoadingStateProps) {
  return <LoadingState lines={lines} className={className} />
}
