import { useState } from 'react'
import type { TraceInvestigationContext } from '@connectio/data-contracts'
import { ActionSheet, Field, SheetActions, SuccessMessage } from './new-investigation-action.js'

/** Props for EscalateInvestigationAction. */
export interface EscalateInvestigationActionProps {
  /** Current investigation context. */
  readonly context: TraceInvestigationContext | null
  /** Called when the sheet should be dismissed. */
  readonly onClose: () => void
}

/** Form state for escalating an investigation. */
interface EscalateForm {
  escalationReason: string
  targetRole: string
  severity: string
  notes: string
}

/**
 * Modal sheet for escalating an investigation.
 *
 * @remarks
 * Phase 1: validates required fields and emits a console telemetry event.
 * Notification dispatch to the target role will be wired in Phase 2.
 */
export function EscalateInvestigationAction({ context, onClose }: EscalateInvestigationActionProps) {
  const [form, setForm] = useState<EscalateForm>({
    escalationReason: '',
    targetRole: 'qa-director',
    severity: context?.severity ?? 'high',
    notes: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof EscalateForm, string>>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate(): boolean {
    const next: typeof errors = {}
    if (!form.escalationReason.trim()) next.escalationReason = 'Escalation reason is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    console.info('[trace-investigation] escalate submitted', { investigationId: context?.investigationId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Escalate Investigation" onClose={onClose} aria-label="Escalate investigation form">
      {submitted ? (
        <SuccessMessage message="Investigation escalated successfully (mock)." onClose={onClose} />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Escalation Reason *" error={errors.escalationReason}>
              <textarea rows={3} value={form.escalationReason} onChange={e => setForm(f => ({ ...f, escalationReason: e.target.value }))} />
            </Field>
            <Field label="Target Role / Group">
              <select value={form.targetRole} onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))}>
                <option value="qa-director">QA Director</option>
                <option value="food-safety-lead">Food Safety Lead</option>
                <option value="plant-manager">Plant Manager</option>
                <option value="regulatory-affairs">Regulatory Affairs</option>
                <option value="supply-chain-director">Supply Chain Director</option>
              </select>
            </Field>
            <Field label="Severity">
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            <Field label="Notes">
              <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Escalate" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}
