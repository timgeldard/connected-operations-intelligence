/** Operational status values supported by StatusBadge. */
export type StatusBadgeVariant = 'good' | 'warn' | 'bad' | 'info' | 'neutral'

export interface StatusBadgeProps {
  /** Human-readable label displayed inside the pill. */
  label: string
  /** Determines which status colour token is applied. */
  variant: StatusBadgeVariant
  className?: string
  title?: string
}

/** Map each variant to its CSS custom property token. */
const variantTokens: Record<StatusBadgeVariant, string> = {
  good: 'var(--status-good)',
  warn: 'var(--status-warn)',
  bad: 'var(--status-bad)',
  info: 'var(--status-info)',
  neutral: 'var(--status-neutral)',
}

/**
 * StatusBadge renders a coloured pill for operational status values.
 * Colours are sourced from CSS custom properties defined in tokens.css.
 */
export function StatusBadge({ label, variant, className, title }: StatusBadgeProps) {
  return (
    <span
      className={className}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--fs-12)',
        fontWeight: 'var(--fw-semibold)',
        lineHeight: '1.5',
        color: 'var(--fg-on-brand)',
        background: variantTokens[variant],
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
