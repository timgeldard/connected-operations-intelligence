import { LifecycleBadge, OwnerBadge } from '@connectio/design-system'
import { requiresLifecycleBadge } from '@connectio/product-model'
import type { LifecycleBadgeVariant } from '@connectio/design-system'
import type { WorkspaceRegistration } from '@connectio/product-model'

/** Props for WorkspaceHeader. */
export interface WorkspaceHeaderProps {
  /** Static workspace registration providing displayName, ownerDomain, and lifecycle. */
  registration: WorkspaceRegistration
}

/**
 * WorkspaceHeader renders the workspace title row inside the sub-nav area.
 *
 * @remarks
 * Displays the workspace display name in large bold type, a LifecycleBadge
 * for non-live workspaces, and an OwnerBadge for the owning domain.
 */
export function WorkspaceHeader({ registration }: WorkspaceHeaderProps) {
  const { displayName, ownerDomain, lifecycle } = registration
  const showLifecycleBadge = requiresLifecycleBadge(lifecycle)

  return (
    <div
      className="connectio-workspace-header"
      style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--shell-line)',
        background: 'var(--shell-surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 'var(--fs-18)',
          fontWeight: 'var(--fw-bold)',
          color: 'var(--shell-fg)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {displayName}
      </span>
      {showLifecycleBadge && (
        <LifecycleBadge variant={lifecycle as LifecycleBadgeVariant} />
      )}
      <OwnerBadge domainId={ownerDomain} displayName={ownerDomain} />
    </div>
  )
}
