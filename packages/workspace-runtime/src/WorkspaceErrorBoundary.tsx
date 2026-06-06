import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface WorkspaceErrorBoundaryProps {
  /** Content to render when no error has been caught. */
  children: ReactNode
}

interface WorkspaceErrorBoundaryState {
  hasError: boolean
  message: string
}

/**
 * WorkspaceErrorBoundary â€” class-component React error boundary for workspace-level errors.
 *
 * @remarks
 * Catches render errors thrown by any workspace component and replaces the
 * entire workspace body with a styled fallback. Unlike EvidencePanelErrorBoundary,
 * this boundary wraps the full workspace rather than a single panel.
 */
export class WorkspaceErrorBoundary extends Component<
  WorkspaceErrorBoundaryProps,
  WorkspaceErrorBoundaryState
> {
  constructor(props: WorkspaceErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): WorkspaceErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred in this workspace.'
    return { hasError: true, message }
  }

  override componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    console.error('[WorkspaceErrorBoundary] Caught workspace render error:', error, errorInfo)
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 'var(--sp-4)',
            padding: 'var(--sp-12)',
            textAlign: 'center',
            color: 'var(--shell-fg)',
          }}
        >
          <span
            aria-hidden="true"
            style={{ fontSize: '2rem', color: 'var(--shell-bad)', lineHeight: 1 }}
          >
            âš 
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--fs-16)',
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--shell-bad)',
            }}
          >
            Workspace failed to load
          </p>
          <p style={{ margin: 0, fontSize: 'var(--fs-14)', color: 'var(--shell-fg-2)' }}>
            {this.state.message}
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
