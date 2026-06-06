import * as React from 'react'

export interface EmptyStateProps {
  /** Primary heading explaining what is missing. */
  title: string
  /** Optional supporting text with further context or guidance. */
  description?: string
  /** Optional action element (e.g. a button to trigger data load). */
  action?: React.ReactNode
  className?: string
}

/**
 * EmptyState renders a centred placeholder when a panel has no data to display.
 * Includes an optional description and call-to-action slot.
 */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--sp-4)',
        padding: 'var(--sp-12)',
        textAlign: 'center',
      }}
    >
      <span
        aria-hidden="true"
        style={{ fontSize: '2rem', color: 'var(--fg-muted)', lineHeight: 1 }}
      >
        ○
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--fs-16)',
            fontWeight: 'var(--fw-semibold)',
            color: 'var(--fg)',
          }}
        >
          {title}
        </p>
        {description && (
          <p style={{ margin: 0, fontSize: 'var(--fs-14)', color: 'var(--fg-muted)' }}>
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
