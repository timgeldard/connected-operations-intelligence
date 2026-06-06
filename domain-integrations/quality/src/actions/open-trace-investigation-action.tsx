import { useState } from 'react'
import type { BatchReleaseContext } from '@connectio/data-contracts'
import { ActionSheet, Field, SheetActions, SuccessMessage } from './release-actions-panel.js'

/** Props for OpenTraceInvestigationAction. */
export interface OpenTraceInvestigationActionProps {
  /** Current batch release context; null while workspace data is loading. */
  readonly context: BatchReleaseContext | null
  /** Called when the sheet should be dismissed. */
  readonly onClose: () => void
}

/** Form state for the Open Trace Investigation action. */
interface OpenTraceInvestigationForm {
  /** Scope of the trace investigation to be opened. */
  investigationScope: string
  /** Mandatory explanation for why a full trace investigation is required. */
  investigationReason: string
  /** Relative urgency of the investigation. */
  priority: string
}

/**
 * Modal sheet for opening a trace investigation from the Quality Batch Release workspace.
 *
 * @remarks
 * This action navigates to the Trace Investigation workspace rather than
 * posting a mutation. Phase 1: validates that an investigation reason is
 * provided, emits a telemetry-style log, and shows a contextual success message
 * explaining that production would navigate the user to the Trace Investigation
 * workspace. No navigation or real API call is performed.
 */
export function OpenTraceInvestigationAction({ context, onClose }: OpenTraceInvestigationActionProps) {
  const [form, setForm] = useState<OpenTraceInvestigationForm>({
    investigationScope: 'Batch',
    investigationReason: '',
    priority: 'Routine',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof OpenTraceInvestigationForm, string>>>({})
  const [submitted, setSubmitted] = useState(false)

  /** Validates form fields and populates the errors map. Returns true when valid. */
  function validate(): boolean {
    const next: typeof errors = {}
    if (!form.investigationReason.trim()) {
      next.investigationReason = 'Investigation reason is required'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  /** Handles form submission — validates, emits telemetry, and advances to success screen. */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    console.info('[quality-batch-release] open-trace-investigation submitted', {
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
    <ActionSheet title="Open Trace Investigation" onClose={onClose} aria-label="Open trace investigation form">
      {submitted ? (
        <SuccessMessage
          message="Trace Investigation opened (mock). In production this would navigate to the Trace Investigation workspace."
          onClose={onClose}
        />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Investigation Scope">
              <select
                value={form.investigationScope}
                onChange={e => setForm(f => ({ ...f, investigationScope: e.target.value }))}
                style={controlStyle}
              >
                <option value="Batch">Batch</option>
                <option value="Material">Material</option>
                <option value="Supplier">Supplier</option>
                <option value="Customer">Customer</option>
              </select>
            </Field>

            <Field label="Investigation Reason *" error={errors.investigationReason}>
              <textarea
                rows={4}
                value={form.investigationReason}
                onChange={e => setForm(f => ({ ...f, investigationReason: e.target.value }))}
                placeholder="Why is a full trace investigation required?"
                style={{
                  ...controlStyle,
                  border: `1px solid ${errors.investigationReason ? 'var(--sunset, #F24A00)' : 'var(--shell-line)'}`,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </Field>

            <Field label="Priority">
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                style={controlStyle}
              >
                <option value="Routine">Routine</option>
                <option value="Priority">Priority</option>
                <option value="Urgent">Urgent</option>
              </select>
            </Field>

            <SheetActions onClose={onClose} submitLabel="Open Investigation" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}
