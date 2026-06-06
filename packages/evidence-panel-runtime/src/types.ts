import type { ReactNode } from 'react'
import type {
  EvidencePanelDisplayState,
  FreshnessMetadata,
  ConfidenceMetadata,
} from '@connectio/data-contracts'
import type { EvidencePanelRegistration } from '@connectio/product-model'

/** Which data source backed this panel's last fetch. */
export type AdapterSource = 'mock' | 'legacy-api' | 'databricks-api' | 'mixed'

/**
 * Props shared by all evidence panel components.
 *
 * @remarks
 * `registration` drives all static metadata (displayName, ownerDomain, lifecycle,
 * freshnessPolicy, confidencePolicy, drillThrough). `displayState` controls which
 * state UI is rendered. Optional `freshness` and `confidence` carry runtime
 * snapshot values that override the policy-level defaults for display purposes.
 */
export interface EvidencePanelProps {
  /** Static registration record from the product catalogue. */
  registration: EvidencePanelRegistration
  /** Runtime display state computed by `useEvidencePanel`. */
  displayState: EvidencePanelDisplayState
  /** Runtime freshness snapshot; shown in the footer when provided. */
  freshness?: FreshnessMetadata
  /** Runtime confidence snapshot; shown in the footer when provided and not hidden. */
  confidence?: ConfidenceMetadata
  /** Human-readable error detail shown when `displayState === 'error'`. */
  errorMessage?: string
  /** Called when the user activates the drill-through action. */
  onDrillThrough?: () => void
  /** Panel body content rendered when `displayState` is ready, stale, or partial. */
  children?: ReactNode
  /** Optional extra class names applied to the root element. */
  className?: string
  /** Which data source backed the last successful fetch; shown as a badge in the header. */
  source?: AdapterSource
}
