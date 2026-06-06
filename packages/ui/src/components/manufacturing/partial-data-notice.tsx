export interface PartialDataNoticeProps {
  message?: string
  className?: string
}

/**
 * A standardized warning for workspaces with partial or mixed evidence states.
 */
export function PartialDataNotice({
  message = 'Partial evidence loaded — do not treat this workspace as complete until unavailable or failed sections are resolved.',
  className,
}: PartialDataNoticeProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        background: 'rgba(199, 130, 28, 0.08)',
        border: '1px solid rgba(199, 130, 28, 0.25)',
        borderRadius: '6px',
        fontSize: '12.5px',
        color: 'var(--shell-fg, #0E1F0A)',
      }}
    >
      <span style={{ fontSize: '16px' }}>⚠️</span>
      <div>
        <strong>Partial Evidence:</strong> {message}
      </div>
    </div>
  )
}
