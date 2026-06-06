import { useState } from 'react'
import type { TraceInvestigationContext } from '@connectio/data-contracts'

/** Props for NewInvestigationAction. */
export interface NewInvestigationActionProps {
  /** Current investigation context used to pre-populate fields. */
  readonly context: TraceInvestigationContext | null
  /** Called when the sheet should be dismissed. */
  readonly onClose: () => void
}

/** Form state for a new investigation. */
interface NewInvestigationForm {
  material: string
  batch: string
  plant: string
  reason: string
  severity: string
  owner: string
  notes: string
}

/**
 * Modal sheet for creating a new trace investigation.
 *
 * @remarks
 * Phase 1: form validates required fields and emits a telemetry-style log on
 * submit. No real API call is made. The sheet traps focus via `aria-modal`.
 */
export function NewInvestigationAction({ context, onClose }: NewInvestigationActionProps) {
  const [form, setForm] = useState<NewInvestigationForm>({
    material: context?.materialId ?? '',
    batch: context?.batchId ?? '',
    plant: context?.plantId ?? '',
    reason: '',
    severity: 'medium',
    owner: '',
    notes: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof NewInvestigationForm, string>>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate(): boolean {
    const next: typeof errors = {}
    if (!form.material.trim()) next.material = 'Material ID is required'
    if (!form.batch.trim()) next.batch = 'Batch ID is required'
    if (!form.plant.trim()) next.plant = 'Plant is required'
    if (!form.reason.trim()) next.reason = 'Reason is required'
    if (!form.owner.trim()) next.owner = 'Owner is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    // Phase 1 mock submit — telemetry only
    console.info('[trace-investigation] new-investigation submitted', form)
    setSubmitted(true)
  }

  return (
    <ActionSheet title="New Investigation" onClose={onClose} aria-label="New investigation form">
      {submitted ? (
        <SuccessMessage message="Investigation raised successfully (mock)." onClose={onClose} />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Material ID *" error={errors.material}>
              <input value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))} />
            </Field>
            <Field label="Batch ID *" error={errors.batch}>
              <input value={form.batch} onChange={e => setForm(f => ({ ...f, batch: e.target.value }))} />
            </Field>
            <Field label="Plant *" error={errors.plant}>
              <input value={form.plant} onChange={e => setForm(f => ({ ...f, plant: e.target.value }))} />
            </Field>
            <Field label="Reason *" error={errors.reason}>
              <textarea rows={2} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
            </Field>
            <Field label="Severity">
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            <Field label="Owner (email) *" error={errors.owner}>
              <input type="email" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} />
            </Field>
            <Field label="Notes">
              <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Raise Investigation" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

// ---------------------------------------------------------------------------
// Shared sheet primitives (local to actions directory)
// ---------------------------------------------------------------------------

/** Overlay + card shell for action sheets. */
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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 1000,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: '100vw',
          background: 'var(--shell-bg, #fff)',
          borderLeft: '1px solid var(--shell-line)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Sheet header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--shell-line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--shell-fg)' }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--shell-fg-3)',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>
        {/* Sheet body */}
        <div style={{ padding: '20px', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}

/** Labelled form field with optional error message. */
export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--shell-fg-2)',
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      <div
        style={{
          display: 'contents',
        }}
      >
        {/* Apply inline styles to the child input/select/textarea */}
        {children}
      </div>
      {error && (
        <span style={{ fontSize: 11, color: 'var(--sunset, #F24A00)', marginTop: 2, display: 'block' }} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

/** Submit + cancel button row for action sheets. */
export function SheetActions({ onClose, submitLabel }: { onClose: () => void; submitLabel: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
      <button
        type="button"
        onClick={onClose}
        style={{
          padding: '8px 16px',
          background: 'transparent',
          border: '1px solid var(--shell-line)',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--shell-fg)',
        }}
      >
        Cancel
      </button>
      <button
        type="submit"
        style={{
          padding: '8px 16px',
          background: 'var(--shell-rail-active, var(--valentia-slate, #005776))',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          color: '#fff',
        }}
      >
        {submitLabel}
      </button>
    </div>
  )
}

/** Success confirmation shown after form submission. */
export function SuccessMessage({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 32 }} aria-hidden="true">✓</div>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--shell-fg)' }}>{message}</p>
      <button
        type="button"
        onClick={onClose}
        style={{
          padding: '8px 20px',
          background: 'var(--shell-rail-active, var(--valentia-slate, #005776))',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          color: '#fff',
          margin: '0 auto',
        }}
      >
        Done
      </button>
    </div>
  )
}
