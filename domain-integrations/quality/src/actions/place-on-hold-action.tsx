import { useState } from 'react'
import type { BatchReleaseContext } from '@connectio/data-contracts'
import { ActionSheet, Field, SheetActions, SuccessMessage } from './release-actions-panel.js'

/** Props for PlaceOnHoldAction. */
export interface PlaceOnHoldActionProps {
  /** Current batch release context; null while workspace data is loading. */
  readonly context: BatchReleaseContext | null
  /** Called when the sheet should be dismissed. */
  readonly onClose: () => void
}

/** Form state for the Place on Hold action. */
interface PlaceOnHoldForm {
  /** Category of hold being applied. */
  holdType: string
  /** Mandatory explanation for why the hold is being placed. */
  reason: string
  /** Optional target date for hold resolution (ISO date string). */
  expectedResolution: string
  /** Optional comma-separated list of email addresses to notify. */
  notifiedParties: string
}

/**
 * Modal sheet for placing a batch on hold.
 *
 * @remarks
 * Phase 1: validates that a reason is provided and emits a telemetry-style log
 * on submit. No real API call is made.
 */
export function PlaceOnHoldAction({ context, onClose }: PlaceOnHoldActionProps) {
  const [form, setForm] = useState<PlaceOnHoldForm>({
    holdType: 'Quality Review',
    reason: '',
    expectedResolution: '',
    notifiedParties: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof PlaceOnHoldForm, string>>>({})
  const [submitted, setSubmitted] = useState(false)

  /** Validates form fields and populates the errors map. Returns true when valid. */
  function validate(): boolean {
    const next: typeof errors = {}
    if (!form.reason.trim()) {
      next.reason = 'Reason is required'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  /** Handles form submission — validates, emits telemetry, and advances to success screen. */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    console.info('[quality-batch-release] place-on-hold submitted', {
      releaseCaseId: context?.releaseCaseId,
      form,
    })
    setSubmitted(true)
  }

  /** Shared inline style for full-width form controls. */
  const controlStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    fontSize: 13,
    border: '1px solid var(--shell-line)',
    borderRadius: 4,
    background: 'var(--shell-bg, #fff)',
    color: 'var(--shell-fg)',
    boxSizing: 'border-box',
  }

  return (
    <ActionSheet title="Place on Hold" onClose={onClose} aria-label="Place on hold form">
      {submitted ? (
        <SuccessMessage message="Batch placed on hold (mock)." onClose={onClose} />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Hold Type">
              <select
                value={form.holdType}
                onChange={e => setForm(f => ({ ...f, holdType: e.target.value }))}
                style={controlStyle}
              >
                <option value="Quality Review">Quality Review</option>
                <option value="Trace Investigation">Trace Investigation</option>
                <option value="Regulatory">Regulatory</option>
                <option value="Quarantine">Quarantine</option>
              </select>
            </Field>

            <Field label="Reason *" error={errors.reason}>
              <textarea
                rows={3}
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                style={{
                  ...controlStyle,
                  border: `1px solid ${errors.reason ? 'var(--sunset, #F24A00)' : 'var(--shell-line)'}`,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </Field>

            <Field label="Expected Resolution">
              <input
                type="date"
                value={form.expectedResolution}
                onChange={e => setForm(f => ({ ...f, expectedResolution: e.target.value }))}
                style={controlStyle}
              />
            </Field>

            <Field label="Notified Parties">
              <input
                type="text"
                value={form.notifiedParties}
                onChange={e => setForm(f => ({ ...f, notifiedParties: e.target.value }))}
                placeholder="email addresses, comma-separated"
                style={controlStyle}
              />
            </Field>

            <SheetActions onClose={onClose} submitLabel="Place on Hold" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}
