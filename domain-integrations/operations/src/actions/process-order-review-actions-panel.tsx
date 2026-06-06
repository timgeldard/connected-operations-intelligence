import { useState } from 'react'
import type { ProcessOrderReviewContext } from '@connectio/data-contracts'
import { ActionSheet, Field, SheetActions, SuccessMessage, ActionButton } from './operations-plan-risk-actions-panel.js'

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

function RaiseDeviationAction({ context, onClose }: { context: ProcessOrderReviewContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ operationId: '', description: '', severity: 'medium', assignee: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.description.trim()) e.description = 'Description is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    console.info('[por] raise-deviation submitted', { processOrderId: context?.processOrderId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Raise Deviation" onClose={onClose}>
      {submitted ? <SuccessMessage message="Deviation raised (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Operation ID">
              <input type="text" value={form.operationId} onChange={e => setForm(f => ({ ...f, operationId: e.target.value }))} placeholder="e.g. OP-030" style={CTRL} />
            </Field>
            <Field label="Description *" error={errors.description}>
              <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.description ? '#F24A00' : 'var(--shell-line)'}`, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <Field label="Severity">
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} style={CTRL}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
            <Field label="Assignee">
              <input type="text" value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))} placeholder="e.g. c.moriarty@listowel.ie" style={CTRL} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Raise Deviation" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

type ActiveAction = 'raise-deviation' | 'open-batch-release' | 'open-staging' | 'open-trace' | null

export interface ProcessOrderReviewActionsPanelProps {
  readonly context: ProcessOrderReviewContext | null
}

export function ProcessOrderReviewActionsPanel({ context }: ProcessOrderReviewActionsPanelProps) {
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const disabled = context === null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, background: 'var(--shell-surface)', borderLeft: '1px solid var(--shell-line)', minWidth: 200 }} aria-label="Process order review actions">
      <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>Actions</h3>

      <ActionButton label="Raise Deviation" onClick={() => setActiveAction('raise-deviation')} disabled={disabled} variant="warning" />
      <ActionButton label="Open Batch Release" onClick={() => setActiveAction('open-batch-release')} disabled={disabled} variant="secondary" />
      <ActionButton label="Open Production Staging" onClick={() => setActiveAction('open-staging')} disabled={disabled} variant="secondary" />
      <ActionButton label="Open Trace Investigation" onClick={() => setActiveAction('open-trace')} disabled={disabled} variant="secondary" />

      {activeAction === 'raise-deviation' && <RaiseDeviationAction context={context} onClose={() => setActiveAction(null)} />}
      {activeAction === 'open-batch-release' && (
        <LinkAction label="Quality Batch Release" href={`/?workspace=quality-batch-release&batchId=${context?.batchId ?? ''}`} onClose={() => setActiveAction(null)} />
      )}
      {activeAction === 'open-staging' && (
        <LinkAction label="Production Staging" href={`/?workspace=production-staging`} onClose={() => setActiveAction(null)} />
      )}
      {activeAction === 'open-trace' && (
        <LinkAction label="Trace Investigation" href={`/?workspace=trace-investigation&batchId=${context?.batchId ?? ''}`} onClose={() => setActiveAction(null)} />
      )}
    </div>
  )
}
