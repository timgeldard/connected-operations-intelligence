import { useState } from 'react'
import type { BatchReleaseContext } from '@connectio/data-contracts'
import { ActionSheet, Field, SheetActions, SuccessMessage } from './release-actions-panel.js'

/** Props for RequestRetestAction. */
export interface RequestRetestActionProps {
  /** Current batch release context; null while workspace data is loading. */
  readonly context: BatchReleaseContext | null
  /** Called when the sheet should be dismissed. */
  readonly onClose: () => void
}

/** Form state for the Request Retest action. */
interface RequestRetestForm {
  /** Broad category of test to be repeated. */
  testCategory: string
  /** Optional description of individual tests or parameters within the category. */
  specificParameters: string
  /** Turnaround time urgency level. */
  urgency: string
  /** Mandatory explanation for why the retest is required. */
  justification: string
  /** Optional laboratory reference number or LIMS identifier. */
  labReference: string
}

/**
 * Modal sheet for requesting a batch retest.
 *
 * @remarks
 * Phase 1: validates that a justification is provided and emits a
 * telemetry-style log on submit. No real API call is made.
 */
export function RequestRetestAction({ context, onClose }: RequestRetestActionProps) {
  const [form, setForm] = useState<RequestRetestForm>({
    testCategory: 'Microbiological',
    specificParameters: '',
    urgency: 'Routine (5 days)',
    justification: '',
    labReference: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof RequestRetestForm, string>>>({})
  const [submitted, setSubmitted] = useState(false)

  /** Validates form fields and populates the errors map. Returns true when valid. */
  function validate(): boolean {
    const next: typeof errors = {}
    if (!form.justification.trim()) {
      next.justification = 'Justification is required'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  /** Handles form submission — validates, emits telemetry, and advances to success screen. */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    console.info('[quality-batch-release] request-retest submitted', {
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
    <ActionSheet title="Request Retest" onClose={onClose} aria-label="Request retest form">
      {submitted ? (
        <SuccessMessage message="Retest requested successfully (mock)." onClose={onClose} />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Test Category">
              <select
                value={form.testCategory}
                onChange={e => setForm(f => ({ ...f, testCategory: e.target.value }))}
                style={controlStyle}
              >
                <option value="Microbiological">Microbiological</option>
                <option value="Chemical">Chemical</option>
                <option value="Physical">Physical</option>
                <option value="Sensory">Sensory</option>
              </select>
            </Field>

            <Field label="Specific Parameters">
              <textarea
                rows={3}
                value={form.specificParameters}
                onChange={e => setForm(f => ({ ...f, specificParameters: e.target.value }))}
                placeholder="List specific tests or parameters..."
                style={{
                  ...controlStyle,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </Field>

            <Field label="Urgency">
              <select
                value={form.urgency}
                onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}
                style={controlStyle}
              >
                <option value="Routine (5 days)">Routine (5 days)</option>
                <option value="Expedited (48h)">Expedited (48h)</option>
                <option value="Critical (24h)">Critical (24h)</option>
              </select>
            </Field>

            <Field label="Justification *" error={errors.justification}>
              <textarea
                rows={3}
                value={form.justification}
                onChange={e => setForm(f => ({ ...f, justification: e.target.value }))}
                style={{
                  ...controlStyle,
                  border: `1px solid ${errors.justification ? 'var(--sunset, #F24A00)' : 'var(--shell-line)'}`,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </Field>

            <Field label="Lab Reference">
              <input
                type="text"
                value={form.labReference}
                onChange={e => setForm(f => ({ ...f, labReference: e.target.value }))}
                style={controlStyle}
              />
            </Field>

            <SheetActions onClose={onClose} submitLabel="Request Retest" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}
