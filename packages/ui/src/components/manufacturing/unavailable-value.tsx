export interface UnavailableValueProps {
  className?: string
}

/**
 * Renders an em dash placeholder for fields that are null in the source system.
 * Use this instead of empty string or "0" when the source has no value to report.
 */
export function UnavailableValue({ className }: UnavailableValueProps) {
  return (
    <span
      className={className}
      aria-label="Unavailable"
      style={{
        color: 'var(--fg-muted)',
        fontStyle: 'italic',
        fontSize: 'inherit',
      }}
    >
      —
    </span>
  )
}
