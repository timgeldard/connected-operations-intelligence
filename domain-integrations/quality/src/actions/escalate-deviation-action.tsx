import { useState } from 'react'
import type { BatchReleaseContext } from '@connectio/data-contracts'
import { ActionSheet, Field, SheetActions, SuccessMessage } from './release-actions-panel.js'

/** Props for EscalateDeviationAction. */
export interface EscalateDeviationActionProps {
  /** Current batch release context; null while workspace data is loading. */
  readonly context: BatchReleaseContext | null
  /** Called when the sheet should be dismissed. */
  readonly onClose: () => void
}

/** Form state for the Escalate Deviation action. */
interface EscalateDeviationForm {
  /** Deviation record identifier, format DEV-YYYY-NNNN. */
  deviationReference: string
  /** Target organisational level for the escalation. */
  escalationLevel: string
  /** Mandatory description of the customer and/or regulatory impact. */
  impactAssessment: string
  /** Optional outline of the proposed resolution path. */
  proposedResolution: string
  /** Required deadline for resolving or responding to the escalation. */
  deadline: string
}

/**
 * Modal sheet for escalating a deviation associated with a batch.
 *
 * @remarks
 * Phase 1: validates that deviationReference, impactAssessment, and deadline are
 * all provided, then emits a telemetry-style log on submit. No real API call is
 * made.
 */
export function EscalateDeviationAction({ context, onClose }: EscalateDeviationActionProps) {
  const [form, setForm] = useState<EscalateDeviationForm>({
    deviationReference: '',
    escalationLevel: 'Site Quality Manager',
    impactAssessment: '',
    proposedResolution: '',
    deadline: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof EscalateDeviationForm, string>>>({})
  const [submitted, setSubmitted] = useState(false)

  /** Validates form fields and populates the errors map. Returns true when valid. */
  function validate(): boolean {
    const next: typeof errors = {}
    if (!form.deviationReference.trim()) {
      next.deviationReference = 'Deviation reference is required'
    }
    if (!form.impactAssessment.trim()) {
      next.impactAssessment = 'Impact assessment is required'
    }
    if (!form.deadline) {
      next.deadline = 'Deadline is required'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  /** Handles form submission — validates, emits telemetry, and advances to success screen. */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    console.info('[quality-batch-release] escalate-deviation submitted', {
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
    <ActionSheet title="Escalate Deviation" onClose={onClose} aria-label="Escalate deviation form">
      {submitted ? (
        <SuccessMessage message="Deviation escalated successfully (mock)." onClose={onClose} />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Deviation Reference *" error={errors.deviationReference}>
              <input
                type="text"
                value={form.deviationReference}
                onChange={e => setForm(f => ({ ...f, deviationReference: e.target.value }))}
                placeholder="DEV-YYYY-NNNN"
                style={{
                  ...controlStyle,
                  border: `1px solid ${errors.deviationReference ? 'var(--sunset, #F24A00)' : 'var(--shell-line)'}`,
                }}
              />
            </Field>

            <Field label="Escalation Level">
              <select
                value={form.escalationLevel}
                onChange={e => setForm(f => ({ ...f, escalationLevel: e.target.value }))}
                style={controlStyle}
              >
                <option value="Site Quality Manager">Site Quality Manager</option>
                <option value="Regional Quality Director">Regional Quality Director</option>
                <option value="Global Quality">Global Quality</option>
              </select>
            </Field>

            <Field label="Impact Assessment *" error={errors.impactAssessment}>
              <textarea
                rows={4}
                value={form.impactAssessment}
                onChange={e => setForm(f => ({ ...f, impactAssessment: e.target.value }))}
                placeholder="Describe customer / regulatory impact..."
                style={{
                  ...controlStyle,
                  border: `1px solid ${errors.impactAssessment ? 'var(--sunset, #F24A00)' : 'var(--shell-line)'}`,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </Field>

            <Field label="Proposed Resolution">
              <textarea
                rows={3}
                value={form.proposedResolution}
                onChange={e => setForm(f => ({ ...f, proposedResolution: e.target.value }))}
                style={{
                  ...controlStyle,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </Field>

            <Field label="Deadline *" error={errors.deadline}>
              <input
                type="date"
                value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                style={{
                  ...controlStyle,
                  border: `1px solid ${errors.deadline ? 'var(--sunset, #F24A00)' : 'var(--shell-line)'}`,
                }}
              />
            </Field>

            <SheetActions onClose={onClose} submitLabel="Escalate Deviation" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}
