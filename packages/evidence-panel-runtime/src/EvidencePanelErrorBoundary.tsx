import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { ErrorState } from '@connectio/design-system'

interface EvidencePanelErrorBoundaryProps {
  /** Content to render when no error has been caught. */
  children: ReactNode
}

interface EvidencePanelErrorBoundaryState {
  hasError: boolean
  message: string
}

/**
 * EvidencePanelErrorBoundary â€” class-component React error boundary.
 *
 * @remarks
 * Catches render errors thrown anywhere in its subtree and replaces the
 * panel body with an `ErrorState`. Use this to wrap the content slot of
 * each `EvidencePanel` so one failing panel does not unmount the whole grid.
 */
export class EvidencePanelErrorBoundary extends Component<
  EvidencePanelErrorBoundaryProps,
  EvidencePanelErrorBoundaryState
> {
  constructor(props: EvidencePanelErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): EvidencePanelErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : 'An unexpected render error occurred.'
    return { hasError: true, message }
  }

  override componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    // Emit to console for developer diagnostics; telemetry integration is
    // intentionally left to the host application via its own error handler.
    console.error('[EvidencePanelErrorBoundary] Caught render error:', error, errorInfo)
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorState message={this.state.message} />
    }
    return this.props.children
  }
}
