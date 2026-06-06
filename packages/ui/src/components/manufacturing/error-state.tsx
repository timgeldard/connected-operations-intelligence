export interface ErrorStateProps {
  /** Optional heading; defaults to "Something went wrong". */
  title?: string
  /** Required error message or description. */
  message: string
  /** Optional callback to retry the failed operation. */
  onRetry?: () => void
  className?: string
}

/**
 * ErrorState renders a centred error panel with an optional retry button.
 * Uses the destructive status token for the icon and heading colour.
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
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
        style={{ fontSize: '2rem', color: 'var(--status-bad)', lineHeight: 1 }}
      >
        ⚠
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--fs-16)',
            fontWeight: 'var(--fw-semibold)',
            color: 'var(--status-bad)',
          }}
        >
          {title}
        </p>
        <p style={{ margin: 0, fontSize: 'var(--fs-14)', color: 'var(--fg-muted)' }}>
          {message}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: 'var(--sp-2) var(--sp-4)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--stroke)',
            background: 'transparent',
            color: 'var(--fg)',
            fontSize: 'var(--fs-14)',
            fontWeight: 'var(--fw-medium)',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  )
}
