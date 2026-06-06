import { useState } from 'react'
import type { MaintenanceReliabilityContext } from '@connectio/data-contracts'

function ActionSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }} role="dialog" aria-modal="true" aria-label={title} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: 420, maxWidth: '100vw', background: 'var(--shell-bg, #fff)', borderLeft: '1px solid var(--shell-line)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--shell-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--shell-fg)' }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--shell-fg-3)', padding: '4px 8px' }}>✕</button>
        </div>
        <div style={{ padding: '20px', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--shell-fg-2)', marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'contents' }}>{children}</div>
      {error && <span style={{ fontSize: 11, color: '#F24A00', marginTop: 2, display: 'block' }} role="alert">{error}</span>}
    </div>
  )
}

function SheetActions({ onClose, submitLabel }: { onClose: () => void; submitLabel: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
      <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--shell-line)', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>Cancel</button>
      <button type="submit" style={{ padding: '8px 16px', background: 'var(--shell-rail-active, #005776)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff' }}>{submitLabel}</button>
    </div>
  )
}

function SuccessMessage({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 24 }}>
      <div style={{ fontSize: 36 }}>✓</div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--shell-fg)', textAlign: 'center' }}>{message}</p>
      <button type="button" onClick={onClose} style={{ padding: '8px 20px', background: 'var(--shell-rail-active, #005776)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff' }}>Close</button>
    </div>
  )
}

type ActionButtonVariant = 'primary' | 'secondary' | 'warning'

const BTN_STYLE: Record<ActionButtonVariant, React.CSSProperties> = {
  primary: { background: 'var(--shell-rail-active, #005776)', color: '#fff', border: 'none' },
  secondary: { background: 'transparent', color: 'var(--shell-fg)', border: '1px solid var(--shell-line)' },
  warning: { background: '#F57C00', color: '#fff', border: 'none' },
}

function ActionButton({ label, onClick, disabled, variant = 'secondary' }: { label: string; onClick: () => void; disabled: boolean; variant?: ActionButtonVariant }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ padding: '8px 12px', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, opacity: disabled ? 0.5 : 1, textAlign: 'left', width: '100%', ...BTN_STYLE[variant] }}
    >
      {label}
    </button>
  )
}

function LinkAction({ label, href, onClose }: { label: string; href: string; onClose: () => void }) {
  return (
    <ActionSheet title={label} onClose={onClose}>
      <div style={{ display: 'grid', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>Navigate to the target workspace to continue.</p>
        <a
          href={href}
          style={{ display: 'block', padding: '10px 16px', background: 'var(--shell-rail-active, #005776)', color: '#fff', textDecoration: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, textAlign: 'center' }}
          onClick={onClose}
        >
          Open {label}
        </a>
        <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--shell-line)', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>Cancel</button>
      </div>
    </ActionSheet>
  )
}

const CTRL: React.CSSProperties = { width: '100%', padding: '6px 8px', fontSize: 13, border: '1px solid var(--shell-line)', borderRadius: 4, background: 'var(--shell-bg, #fff)', color: 'var(--shell-fg)', boxSizing: 'border-box' }

function RaiseMaintenanceRequestAction({ context, onClose }: { context: MaintenanceReliabilityContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ equipmentId: '', title: '', priority: 'medium', description: '', requestedBy: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = 'Title is required'
    if (!form.equipmentId.trim()) e.equipmentId = 'Equipment ID is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    console.info('[maint] raise-maintenance-request submitted', { plantId: context?.plantId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Raise Maintenance Request" onClose={onClose}>
      {submitted ? <SuccessMessage message="Maintenance request raised (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Equipment ID *" error={errors.equipmentId}>
              <input type="text" value={form.equipmentId} onChange={e => setForm(f => ({ ...f, equipmentId: e.target.value }))} placeholder="e.g. EQ-IE10-PHE-001" style={{ ...CTRL, border: `1px solid ${errors.equipmentId ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Title *" error={errors.title}>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief description of the issue" style={{ ...CTRL, border: `1px solid ${errors.title ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={CTRL}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
            <Field label="Description">
              <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...CTRL, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <Field label="Requested By">
              <input type="text" value={form.requestedBy} onChange={e => setForm(f => ({ ...f, requestedBy: e.target.value }))} placeholder="e.g. operations.ie10@kerry.com" style={CTRL} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Raise Request" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

type ActiveAction = 'raise-request' | 'open-plan-risk' | null

export interface MaintenanceReliabilityActionsPanelProps {
  readonly context: MaintenanceReliabilityContext | null
}

export function MaintenanceReliabilityActionsPanel({ context }: MaintenanceReliabilityActionsPanelProps) {
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const disabled = context === null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, background: 'var(--shell-surface)', borderLeft: '1px solid var(--shell-line)', minWidth: 200 }} aria-label="Maintenance and reliability actions">
      <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>Actions</h3>

      <ActionButton label="Raise Maintenance Request" onClick={() => setActiveAction('raise-request')} disabled={disabled} variant="primary" />
      <ActionButton label="Open Operations Plan Risk" onClick={() => setActiveAction('open-plan-risk')} disabled={disabled} variant="secondary" />

      {activeAction === 'raise-request' && <RaiseMaintenanceRequestAction context={context} onClose={() => setActiveAction(null)} />}
      {activeAction === 'open-plan-risk' && (
        <LinkAction label="Operations Plan Risk" href={`/?workspace=operations-plan-risk`} onClose={() => setActiveAction(null)} />
      )}
    </div>
  )
}
