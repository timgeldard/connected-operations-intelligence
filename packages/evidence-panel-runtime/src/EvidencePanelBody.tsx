import type { ReactNode } from 'react'
import { EvidencePanelStateRenderer } from './EvidencePanelStateRenderer.js'
import type { EvidencePanelDisplayState } from '@connectio/data-contracts'

/** Props for EvidencePanelBody. */
export interface EvidencePanelBodyProps {
  /** Current display state forwarded to the state renderer. */
  displayState: EvidencePanelDisplayState
  /** Error message forwarded when `displayState === 'error'`. */
  errorMessage?: string
  /** Panel content rendered when state permits. */
  children?: ReactNode
}

/**
 * EvidencePanelBody wraps content in a scrollable region and delegates
 * state-based rendering to EvidencePanelStateRenderer.
 *
 * @remarks
 * The overflow is intentionally set on this wrapper so the header and footer
 * remain visible while only the body scrolls within a fixed-height card.
 */
export function EvidencePanelBody({
  displayState,
  errorMessage,
  children,
}: EvidencePanelBodyProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <EvidencePanelStateRenderer
        displayState={displayState}
        errorMessage={errorMessage}
      >
        {children}
      </EvidencePanelStateRenderer>
    </div>
  )
}
