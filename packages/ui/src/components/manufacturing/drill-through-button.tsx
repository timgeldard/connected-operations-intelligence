export interface DrillThroughButtonProps {
  /** Label text rendered before the arrow glyph. */
  label: string
  /** Called when the user activates the button. */
  onClick: () => void
  /** When true, the button is non-interactive and visually dimmed. */
  disabled?: boolean
  className?: string
}

/**
 * DrillThroughButton renders a "View detail →" link to a source system or deeper view.
 * Styled as a compact inline action using the brand link colour.
 */
export function DrillThroughButton({ label, onClick, disabled = false, className }: DrillThroughButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '0',
        border: 'none',
        background: 'transparent',
        color: disabled ? 'var(--fg-muted)' : 'var(--fg-link)',
        fontSize: 'var(--fs-14)',
        fontWeight: 'var(--fw-medium)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        textDecoration: 'none',
        transition: 'color var(--dur-fast) var(--ease-out)',
      }}
    >
      {label}
      <span aria-hidden="true" style={{ fontStyle: 'normal' }}>→</span>
    </button>
  )
}
