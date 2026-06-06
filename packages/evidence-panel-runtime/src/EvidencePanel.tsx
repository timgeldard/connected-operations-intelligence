import { EvidencePanelHeader } from './EvidencePanelHeader.js'
import { EvidencePanelBody } from './EvidencePanelBody.js'
import { EvidencePanelFooter } from './EvidencePanelFooter.js'
import { EvidencePanelErrorBoundary } from './EvidencePanelErrorBoundary.js'
import type { EvidencePanelProps } from './types.js'

/**
 * EvidencePanel — the root card component for a single evidence panel.
 *
 * @remarks
 * Composes header / body / footer in a flex-column card layout.
 * The body is wrapped in `EvidencePanelErrorBoundary` so a render error in
 * panel content degrades gracefully without unmounting the rest of the grid.
 *
 * Styling uses CSS custom properties from the design-system token layer.
 * `data-testid` and `data-state` attributes are applied for testability and
 * CSS state-based styling.
 */
export function EvidencePanel({
  registration,
  displayState,
  freshness,
  confidence,
  errorMessage,
  onDrillThrough,
  children,
  className,
  source,
}: EvidencePanelProps) {
  return (
    <div
      data-testid={`evidence-panel-${registration.panelId}`}
      data-state={displayState}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--shell-surface)',
        border: '1px solid var(--shell-line)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      <EvidencePanelHeader registration={registration} source={source} />
      <EvidencePanelErrorBoundary>
        <EvidencePanelBody
          displayState={displayState}
          errorMessage={errorMessage}
        >
          {children}
        </EvidencePanelBody>
      </EvidencePanelErrorBoundary>
      <EvidencePanelFooter
        registration={registration}
        confidence={confidence}
        freshness={freshness}
        onDrillThrough={onDrillThrough}
      />
    </div>
  )
}
