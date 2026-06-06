export interface OwnerBadgeProps {
  /** Machine identifier for the owning domain (e.g. "quality", "supply-chain"). */
  domainId: string
  /** Human-readable name rendered inside the badge. */
  displayName: string
  className?: string
}

/**
 * OwnerBadge shows the domain that owns this panel or workspace.
 * Uses the brand accent colour to draw attention to ownership provenance.
 */
export function OwnerBadge({ domainId, displayName, className }: OwnerBadgeProps) {
  return (
    <span
      data-domain-id={domainId}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--fs-12)',
        fontWeight: 'var(--fw-medium)',
        lineHeight: '1.5',
        color: 'var(--fg-on-brand)',
        background: 'var(--brand)',
        whiteSpace: 'nowrap',
        letterSpacing: 'var(--ls-upper)',
        textTransform: 'uppercase',
      }}
    >
      {displayName}
    </span>
  )
}
