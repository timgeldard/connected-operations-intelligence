import type { ReactNode } from 'react'
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from '@connectio/design-system'
import type { EvidencePanelDisplayState } from '@connectio/data-contracts'

/** Props for EvidencePanelStateRenderer. */
export interface EvidencePanelStateRendererProps {
  /** Current display state of the panel. */
  displayState: EvidencePanelDisplayState
  /** Error message forwarded to ErrorState when `displayState === 'error'`. */
  errorMessage?: string
  /** Panel body content rendered for ready, stale, and partial states. */
  children?: ReactNode
}

/**
 * EvidencePanelStateRenderer maps a display state to the appropriate UI.
 *
 * @remarks
 * - `loading`        → animated skeleton lines
 * - `error`          → error panel with optional message
 * - `unauthorized`   → plain permission-denied message
 * - `waiting-for-context` → recoverable empty state until a driving panel supplies context
 * - `not-applicable` → empty state explaining out-of-scope context
 * - `partial`        → children with a "Partial data" footnote
 * - `ready`          → children rendered as-is
 * - `stale`          → children wrapped with a stale data indicator strip
 */
export function EvidencePanelStateRenderer({
  displayState,
  errorMessage,
  children,
}: EvidencePanelStateRendererProps) {
  switch (displayState) {
    case 'loading':
      return <LoadingState lines={3} />

    case 'error':
      return (
        <ErrorState
          message={errorMessage ?? 'Panel failed to load'}
        />
      )

    case 'unauthorized':
      return (
        <p
          style={{
            padding: 'var(--sp-6)',
            margin: 0,
            fontSize: 'var(--fs-14)',
            color: 'var(--fg-muted)',
            textAlign: 'center',
          }}
        >
          You do not have permission to view this panel
        </p>
      )

    case 'waiting-for-context':
      return (
        <EmptyState
          title="Waiting for investigation context"
          description="Select a batch, process order, material, or plant to load this panel."
        />
      )

    case 'not-applicable':
      return (
        <EmptyState
          title="Not applicable"
          description="This panel is not relevant to the current scope."
        />
      )

    case 'partial':
      return (
        <div>
          {children}
          <small
            style={{
              display: 'block',
              padding: 'var(--sp-2) var(--sp-4)',
              fontSize: 'var(--fs-12)',
              color: 'var(--status-warn)',
            }}
          >
            Partial data
          </small>
        </div>
      )

    case 'stale':
      return (
        <div>
          <div
            aria-label="Data may be out of date"
            style={{
              height: '2px',
              background: 'var(--status-warn)',
              marginBottom: 'var(--sp-1)',
            }}
          />
          {children}
        </div>
      )

    case 'ready':
    default:
      return <>{children}</>
  }
}
