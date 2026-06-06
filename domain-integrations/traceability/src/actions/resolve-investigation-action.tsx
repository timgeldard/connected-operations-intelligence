import { useState } from 'react'
import type { TraceInvestigationContext } from '@connectio/data-contracts'
import { ActionSheet, Field, SheetActions, SuccessMessage } from './new-investigation-action.js'

/** Props for ResolveInvestigationAction. */
export interface ResolveInvestigationActionProps {
  /** Current investigation context. */
  readonly context: TraceInvestigationContext | null
  /** Called when the sheet should be dismissed. */
  readonly onClose: () => void
}

/** Form state for resolving an investigation. */
interface ResolveForm {
  resolutionType: string
  summary: string
  actionsCompleted: string
  residualRisk: string
  approverPlaceholder: string
}

/**
 * Modal sheet for resolving an investigation.
 *
 * @remarks
 * Phase 1: validates required fields and emits a console telemetry event.
 * Approval workflow integration will be wired in Phase 2.
 */
export function ResolveInvestigationAction({ context, onClose }: ResolveInvestigationActionProps) {
  const [form, setForm] = useState<ResolveForm>({
    resolutionType: 'contained',
    summary: '',
    actionsCompleted: '',
    residualRisk: 'none',
    approverPlaceholder: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof ResolveForm, string>>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate(): boolean {
    const next: typeof errors = {}
    if (!form.summary.trim()) next.summary = 'Resolution summary is required'
    if (!form.actionsCompleted.trim()) next.actionsCompleted = 'Actions completed is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    console.info('[trace-investigation] resolve submitted', { investigationId: context?.investigationId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Resolve Investigation" onClose={onClose} aria-label="Resolve investigation form">
      {submitted ? (
        <SuccessMessage message="Investigation resolved successfully (mock)." onClose={onClose} />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Resolution Type">
              <select value={form.resolutionType} onChange={e => setForm(f => ({ ...f, resolutionType: e.target.value }))}>
                <option value="contained">Contained — no further action</option>
                <option value="recall-completed">Recall Completed</option>
                <option value="rejected-and-destroyed">Rejected and Destroyed</option>
                <option value="conditional-release">Conditional Release</option>
                <option value="false-positive">False Positive</option>
              </select>
            </Field>
            <Field label="Resolution Summary *" error={errors.summary}>
              <textarea rows={4} value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="Describe the outcome and actions taken…" />
            </Field>
            <Field label="Actions Completed *" error={errors.actionsCompleted}>
              <textarea rows={3} value={form.actionsCompleted} onChange={e => setForm(f => ({ ...f, actionsCompleted: e.target.value }))} placeholder="List corrective or containment actions completed" />
            </Field>
            <Field label="Residual Risk">
              <select value={form.residualRisk} onChange={e => setForm(f => ({ ...f, residualRisk: e.target.value }))}>
                <option value="none">None</option>
                <option value="low">Low — monitoring in place</option>
                <option value="medium">Medium — follow-up required</option>
                <option value="high">High — escalation recommended</option>
              </select>
            </Field>
            <Field label="Approver (Phase 2 — placeholder)">
              <input
                value={form.approverPlaceholder}
                onChange={e => setForm(f => ({ ...f, approverPlaceholder: e.target.value }))}
                placeholder="Approver email (approval workflow in Phase 2)"
                style={{ color: 'var(--shell-fg-3)' }}
              />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Resolve Investigation" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}
