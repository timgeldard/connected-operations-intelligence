import { useState } from 'react'
import type { BatchReleaseContext } from '@connectio/data-contracts'
import { ActionSheet, Field, SheetActions, SuccessMessage } from './release-actions-panel.js'

/** Props for ReleaseBatchAction. */
export interface ReleaseBatchActionProps {
  /** Current batch release context; null while workspace data is loading. */
  readonly context: BatchReleaseContext | null
  /** Called when the sheet should be dismissed. */
  readonly onClose: () => void
}

/** Form state for the Release Batch action. */
interface ReleaseBatchForm {
  /** Release decision: full release or conditional release. */
  decision: 'Released' | 'Conditionally Released'
  /** Conditions applicable when decision is Conditionally Released. */
  conditions: string
  /** Required rationale (minimum 20 characters). */
  rationale: string
  /** Name of the authorised signatory. */
  signoffName: string
  /** Optional free-text notes. */
  notes: string
}

/**
 * Modal sheet for releasing a batch (full or conditional).
 *
 * @remarks
 * Phase 1: validates required fields — rationale must be at least 20 characters
 * and signoff name is required. The Conditions textarea is only shown when the
 * decision is "Conditionally Released". On submit a telemetry-style log is
 * emitted; no real API call is made.
 */
export function ReleaseBatchAction({ context, onClose }: ReleaseBatchActionProps) {
  const [form, setForm] = useState<ReleaseBatchForm>({
    decision: 'Released',
    conditions: '',
    rationale: '',
    signoffName: '',
    notes: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof ReleaseBatchForm, string>>>({})
  const [submitted, setSubmitted] = useState(false)

  /** Validates form fields and populates the errors map. Returns true when valid. */
  function validate(): boolean {
    const next: typeof errors = {}
    if (form.rationale.trim().length < 20) {
      next.rationale = 'Rationale must be at least 20 characters'
    }
    if (!form.signoffName.trim()) {
      next.signoffName = 'Signoff name is required'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  /** Handles form submission — validates, emits telemetry, and advances to success screen. */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    console.info('[quality-batch-release] release-batch submitted', {
      releaseCaseId: context?.releaseCaseId,
      form,
    })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Release Batch" onClose={onClose} aria-label="Release batch form">
      {submitted ? (
        <SuccessMessage message="Batch released successfully (mock)." onClose={onClose} />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Decision">
              <select
                value={form.decision}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    decision: e.target.value as ReleaseBatchForm['decision'],
                  }))
                }
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: 13,
                  border: '1px solid var(--shell-line)',
                  borderRadius: 4,
                  background: 'var(--shell-bg, #fff)',
                  color: 'var(--shell-fg)',
                }}
              >
                <option value="Released">Released</option>
                <option value="Conditionally Released">Conditionally Released</option>
              </select>
            </Field>

            {form.decision === 'Conditionally Released' && (
              <Field label="Conditions">
                <textarea
                  rows={3}
                  value={form.conditions}
                  onChange={e => setForm(f => ({ ...f, conditions: e.target.value }))}
                  placeholder="List any conditions for release..."
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: 13,
                    border: '1px solid var(--shell-line)',
                    borderRadius: 4,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    background: 'var(--shell-bg, #fff)',
                    color: 'var(--shell-fg)',
                    boxSizing: 'border-box',
                  }}
                />
              </Field>
            )}

            <Field label="Rationale * (min 20 chars)" error={errors.rationale}>
              <textarea
                rows={3}
                value={form.rationale}
                onChange={e => setForm(f => ({ ...f, rationale: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: 13,
                  border: `1px solid ${errors.rationale ? 'var(--sunset, #F24A00)' : 'var(--shell-line)'}`,
                  borderRadius: 4,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  background: 'var(--shell-bg, #fff)',
                  color: 'var(--shell-fg)',
                  boxSizing: 'border-box',
                }}
              />
            </Field>

            <Field label="Signoff Name *" error={errors.signoffName}>
              <input
                type="text"
                value={form.signoffName}
                onChange={e => setForm(f => ({ ...f, signoffName: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: 13,
                  border: `1px solid ${errors.signoffName ? 'var(--sunset, #F24A00)' : 'var(--shell-line)'}`,
                  borderRadius: 4,
                  background: 'var(--shell-bg, #fff)',
                  color: 'var(--shell-fg)',
                  boxSizing: 'border-box',
                }}
              />
            </Field>

            <Field label="Notes">
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: 13,
                  border: '1px solid var(--shell-line)',
                  borderRadius: 4,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  background: 'var(--shell-bg, #fff)',
                  color: 'var(--shell-fg)',
                  boxSizing: 'border-box',
                }}
              />
            </Field>

            <SheetActions onClose={onClose} submitLabel="Release Batch" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}
