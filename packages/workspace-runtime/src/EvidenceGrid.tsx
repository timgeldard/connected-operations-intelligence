import type { ReactNode } from 'react'
import type { EvidencePanelReference } from '@connectio/product-model'

/** Props for EvidenceGrid. */
export interface EvidenceGridProps {
  /**
   * Panel references from the active view's `defaultPanels`.
   * Reserved for future slot-based CSS grid-area assignment; children are
   * rendered independently and are not paired 1-to-1 with this array.
   */
  panels: readonly EvidencePanelReference[]
  /** Evidence panel components to render inside the grid. */
  children: ReactNode
}

/**
 * EvidenceGrid provides the responsive CSS grid layout that hosts evidence panels.
 *
 * @remarks
 * Uses `auto-fill` columns so the grid adapts to the available width without
 * requiring explicit column counts. Each cell is at least 320px wide. Gap is
 * 1rem (16px) to match the workspace body padding. Children are expected to
 * be `EvidencePanel` components or similar full-height card elements.
 */
export function EvidenceGrid({ panels: _panels, children }: EvidenceGridProps) {
  return (
    <div
      data-testid="evidence-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1rem',
        flex: 1,
        alignContent: 'start',
      }}
    >
      {children}
    </div>
  )
}
