/**
 * Shared action-sheet UI primitives reused across workspace action panels.
 */

export function ActionSheet({
  title,
  onClose,
  children,
  'aria-label': ariaLabel,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  'aria-label'?: string
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{ width: 420, maxWidth: '100vw', background: 'var(--shell-bg, #fff)', borderLeft: '1px solid var(--shell-line)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--shell-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--shell-fg)' }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--shell-fg-3)', padding: '4px 8px' }}>✕</button>
        </div>
        <div style={{ padding: '20px', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--shell-fg-2)', marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'contents' }}>{children}</div>
      {error && <span style={{ fontSize: 11, color: 'var(--sunset, #F24A00)', marginTop: 2, display: 'block' }} role="alert">{error}</span>}
    </div>
  )
}

export function SheetActions({ onClose, submitLabel }: { onClose: () => void; submitLabel: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
      <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--shell-line)', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>Cancel</button>
      <button type="submit" style={{ padding: '8px 16px', background: 'var(--shell-rail-active, #005776)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff' }}>{submitLabel}</button>
    </div>
  )
}

export function SuccessMessage({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 32 }} aria-hidden="true">✓</div>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--shell-fg)' }}>{message}</p>
      <button type="button" onClick={onClose} style={{ padding: '8px 20px', background: 'var(--shell-rail-active, #005776)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff', margin: '0 auto' }}>Done</button>
    </div>
  )
}

export type ActionButtonVariant = 'primary' | 'secondary' | 'warning' | 'danger'

export function ActionButton({ label, onClick, disabled, variant }: { label: string; onClick: () => void; disabled: boolean; variant: ActionButtonVariant }) {
  const VARIANT: Record<ActionButtonVariant, React.CSSProperties> = {
    primary: { background: 'var(--shell-rail-active, #005776)', color: '#fff', border: 'none' },
    secondary: { background: 'transparent', color: 'var(--shell-fg)', border: '1px solid var(--shell-line)' },
    warning: { background: 'transparent', color: '#D97706', border: '1px solid #D97706' },
    danger: { background: 'transparent', color: '#D32F2F', border: '1px solid #D32F2F' },
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label}
      style={{ ...VARIANT[variant], padding: '8px 12px', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, textAlign: 'left', opacity: disabled ? 0.4 : 1, width: '100%' }}
    >{label}</button>
  )
}
