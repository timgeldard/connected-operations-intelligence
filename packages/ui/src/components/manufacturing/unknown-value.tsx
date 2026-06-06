export interface UnknownValueProps {
  className?: string
}

/**
 * Renders "Unknown" for fields where a value exists in principle but cannot be determined.
 * Distinct from UnavailableValue (source null) — use when the field exists but the value is indeterminate.
 */
export function UnknownValue({ className }: UnknownValueProps) {
  return (
    <span
      className={className}
      style={{
        color: 'var(--fg-muted)',
        fontStyle: 'italic',
        fontSize: 'inherit',
      }}
    >
      Unknown
    </span>
  )
}
