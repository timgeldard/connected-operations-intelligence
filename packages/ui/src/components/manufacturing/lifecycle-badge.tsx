/** Non-live lifecycle states. Live modules do not show a badge. */
export type LifecycleBadgeVariant = 'pilot' | 'concept-lab' | 'deprecated'

export interface LifecycleBadgeProps {
  /** The lifecycle stage to display. Only renders for non-live states. */
  variant: LifecycleBadgeVariant
  className?: string
}

const variantConfig: Record<LifecycleBadgeVariant, { token: string; label: string }> = {
  pilot:          { token: 'var(--lifecycle-pilot)',       label: 'Pilot' },
  'concept-lab':  { token: 'var(--lifecycle-concept-lab)', label: 'Concept' },
  deprecated:     { token: 'var(--lifecycle-deprecated)',  label: 'Deprecated' },
}

/**
 * LifecycleBadge renders a pill showing the non-live lifecycle state of a module.
 * Live modules should not render this component at all.
 */
export function LifecycleBadge({ variant, className }: LifecycleBadgeProps) {
  const { token, label } = variantConfig[variant]

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--fs-12)',
        fontWeight: 'var(--fw-medium)',
        lineHeight: '1.5',
        color: 'var(--forest)',
        background: token,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
