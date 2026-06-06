import {
  OwnerBadge,
  LifecycleBadge,
} from '@connectio/design-system'
import { requiresLifecycleBadge } from '@connectio/product-model'
import type { LifecycleBadgeVariant } from '@connectio/design-system'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { AdapterSource } from './types.js'

const SOURCE_BADGE_STYLES: Record<AdapterSource, { background: string; color: string; label: string }> = {
  mock: { background: '#e5e7eb', color: '#6b7280', label: 'Mock' },
  'legacy-api': { background: '#fef3c7', color: '#92400e', label: 'Legacy API' },
  'databricks-api': { background: '#dcfce7', color: '#166534', label: 'Databricks' },
  mixed: { background: '#dbeafe', color: '#1e40af', label: 'Mixed' },
}

/** Props for EvidencePanelHeader. */
export interface EvidencePanelHeaderProps {
  /** Panel registration record providing displayName, ownerDomain, and lifecycle. */
  registration: EvidencePanelRegistration
  /** Which data source backed the last fetch; renders a source status badge. */
  source?: AdapterSource
}

/**
 * EvidencePanelHeader renders the panel title row.
 *
 * @remarks
 * Displays the panel's display name as a heading, an OwnerBadge identifying the
 * owning domain, and a LifecycleBadge when the panel's lifecycle requires one
 * (pilot, concept-lab, or deprecated). Live panels do not show a lifecycle badge.
 */
export function EvidencePanelHeader({ registration, source }: EvidencePanelHeaderProps) {
  const { displayName, ownerDomain, lifecycle } = registration

  // requiresLifecycleBadge returns true only for pilot | concept-lab | deprecated,
  // which are exactly the variants LifecycleBadge accepts.
  const showLifecycleBadge = requiresLifecycleBadge(lifecycle)
  const sourceBadge = source && source !== 'mock' ? SOURCE_BADGE_STYLES[source] : null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        padding: '10px 14px',
        borderBottom: '1px solid var(--shell-line)',
        background: 'var(--shell-surface)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 'var(--fs-14)',
          fontWeight: 'var(--fw-semibold)',
          color: 'var(--shell-fg)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {displayName}
      </span>
      {sourceBadge && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.05em',
            padding: '2px 6px',
            borderRadius: 4,
            background: sourceBadge.background,
            color: sourceBadge.color,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {sourceBadge.label}
        </span>
      )}
      {showLifecycleBadge && (
        <LifecycleBadge variant={lifecycle as LifecycleBadgeVariant} />
      )}
      <OwnerBadge domainId={ownerDomain} displayName={ownerDomain} />
    </div>
  )
}
