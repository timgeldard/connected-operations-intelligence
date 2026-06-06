import { useState } from 'react'
import type { TraceInvestigationContext } from '@connectio/data-contracts'
import { ActionSheet, Field, SheetActions, SuccessMessage } from './new-investigation-action.js'

/** Props for AddEvidenceAction. */
export interface AddEvidenceActionProps {
  /** Current investigation context. */
  readonly context: TraceInvestigationContext | null
  /** Called when the sheet should be dismissed. */
  readonly onClose: () => void
}

/** Form state for adding evidence. */
interface AddEvidenceForm {
  evidenceType: string
  source: string
  description: string
  linkedEntity: string
  notes: string
}

/**
 * Modal sheet for adding evidence to an investigation.
 *
 * @remarks
 * Phase 1: validates required fields and emits a console telemetry event.
 * Attachment upload is a placeholder — file handling will be wired in Phase 2.
 */
export function AddEvidenceAction({ context, onClose }: AddEvidenceActionProps) {
  const [form, setForm] = useState<AddEvidenceForm>({
    evidenceType: 'environmental-result',
    source: '',
    description: '',
    linkedEntity: context?.batchId ?? '',
    notes: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof AddEvidenceForm, string>>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate(): boolean {
    const next: typeof errors = {}
    if (!form.source.trim()) next.source = 'Source is required'
    if (!form.description.trim()) next.description = 'Description is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    console.info('[trace-investigation] add-evidence submitted', { investigationId: context?.investigationId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Add Evidence" onClose={onClose} aria-label="Add evidence form">
      {submitted ? (
        <SuccessMessage message="Evidence added successfully (mock)." onClose={onClose} />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Evidence Type">
              <select value={form.evidenceType} onChange={e => setForm(f => ({ ...f, evidenceType: e.target.value }))}>
                <option value="environmental-result">Environmental Result</option>
                <option value="lab-result">Lab Result</option>
                <option value="coa">Certificate of Analysis</option>
                <option value="audit-record">Audit Record</option>
                <option value="corrective-action">Corrective Action</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Source System *" error={errors.source}>
              <input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="e.g. EnvMon, SAP QM, LIMS" />
            </Field>
            <Field label="Description *" error={errors.description}>
              <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </Field>
            <Field label="Attachment">
              <input
                type="file"
                disabled
                aria-label="Attachment upload (Phase 2)"
                style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}
              />
              <span style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>File upload available in Phase 2</span>
            </Field>
            <Field label="Linked Entity">
              <input value={form.linkedEntity} onChange={e => setForm(f => ({ ...f, linkedEntity: e.target.value }))} placeholder="Batch ID, material ID, etc." />
            </Field>
            <Field label="Notes">
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Add Evidence" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}
