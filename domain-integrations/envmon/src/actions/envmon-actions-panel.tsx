import { useState } from 'react'
import type { EnvMonContext } from '@connectio/data-contracts'

// ---------------------------------------------------------------------------
// Shared sheet primitives (same pattern as operations actions)
// ---------------------------------------------------------------------------

function ActionSheet({
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
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{ width: 420, maxWidth: '100vw', background: 'var(--shell-bg, #fff)', borderLeft: '1px solid var(--shell-line)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--shell-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--shell-fg)' }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--shell-fg-3)', padding: '4px 8px' }}>✕</button>
        </div>
        <div style={{ padding: '20px', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--shell-fg-2)', marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'contents' }}>{children}</div>
      {error && <span style={{ fontSize: 11, color: 'var(--sunset, #F24A00)', marginTop: 2, display: 'block' }} role="alert">{error}</span>}
    </div>
  )
}

function SheetActions({ onClose, submitLabel }: { onClose: () => void; submitLabel: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
      <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--shell-line)', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>Cancel</button>
      <button type="submit" style={{ padding: '8px 16px', background: 'var(--shell-rail-active, #005776)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff' }}>{submitLabel}</button>
    </div>
  )
}

function SuccessMessage({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 32 }} aria-hidden="true">✓</div>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--shell-fg)' }}>{message}</p>
      <button type="button" onClick={onClose} style={{ padding: '8px 20px', background: 'var(--shell-rail-active, #005776)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff', margin: '0 auto' }}>Done</button>
    </div>
  )
}

type ActionButtonVariant = 'primary' | 'secondary' | 'warning' | 'danger'

function ActionButton({ label, onClick, disabled, variant }: { label: string; onClick: () => void; disabled: boolean; variant: ActionButtonVariant }) {
  const VARIANT: Record<ActionButtonVariant, React.CSSProperties> = {
    primary: { background: 'var(--shell-rail-active, #005776)', color: '#fff', border: 'none' },
    secondary: { background: 'transparent', color: 'var(--shell-fg)', border: '1px solid var(--shell-line)' },
    warning: { background: 'transparent', color: '#D97706', border: '1px solid #D97706' },
    danger: { background: 'transparent', color: '#D32F2F', border: '1px solid #D32F2F' },
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label}
      style={{ ...VARIANT[variant], padding: '8px 12px', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, textAlign: 'left', opacity: disabled ? 0.4 : 1, width: '100%' }}
    >{label}</button>
  )
}

const CTRL: React.CSSProperties = { width: '100%', padding: '6px 8px', fontSize: 13, border: '1px solid var(--shell-line)', borderRadius: 4, background: 'var(--shell-bg, #fff)', color: 'var(--shell-fg)', boxSizing: 'border-box' }

// ---------------------------------------------------------------------------
// Action: Raise Environmental Alert
// ---------------------------------------------------------------------------

function RaiseAlertAction({ context, onClose }: { context: EnvMonContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ zoneId: '', testType: 'swab', organism: '', severity: 'high', sampleId: '', description: '', owner: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.zoneId.trim()) e.zoneId = 'Zone is required'
    if (!form.organism.trim()) e.organism = 'Organism is required'
    if (!form.description.trim()) e.description = 'Description is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    console.info('[envmon] raise-alert submitted', { plantId: context?.plantId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Raise Environmental Alert" onClose={onClose}>
      {submitted ? <SuccessMessage message="Environmental alert raised (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Zone ID *" error={errors.zoneId}>
              <input type="text" value={form.zoneId} onChange={e => setForm(f => ({ ...f, zoneId: e.target.value }))} placeholder="e.g. ZONE-003" style={{ ...CTRL, border: `1px solid ${errors.zoneId ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Test Type">
              <select value={form.testType} onChange={e => setForm(f => ({ ...f, testType: e.target.value }))} style={CTRL}>
                <option value="swab">Swab</option>
                <option value="air-sample">Air Sample</option>
                <option value="surface-contact">Surface Contact</option>
                <option value="rinse-water">Rinse Water</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Organism *" error={errors.organism}>
              <input type="text" value={form.organism} onChange={e => setForm(f => ({ ...f, organism: e.target.value }))} placeholder="e.g. Listeria monocytogenes" style={{ ...CTRL, border: `1px solid ${errors.organism ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Severity">
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} style={CTRL}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
            <Field label="Sample ID">
              <input type="text" value={form.sampleId} onChange={e => setForm(f => ({ ...f, sampleId: e.target.value }))} placeholder="e.g. SWB-2024-1023" style={CTRL} />
            </Field>
            <Field label="Description *" error={errors.description}>
              <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.description ? '#F24A00' : 'var(--shell-line)'}`, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <Field label="Owner / Assignee">
              <input type="text" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="e.g. qc.lab@listowel.ie" style={CTRL} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Raise Alert" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

// ---------------------------------------------------------------------------
// Action: Create Corrective Action
// ---------------------------------------------------------------------------

function CreateCorrectiveActionAction({ context, onClose }: { context: EnvMonContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ alertId: '', zoneId: '', actionType: 'deep-clean', title: '', description: '', severity: 'high', assignee: '', dueDate: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.zoneId.trim()) e.zoneId = 'Zone is required'
    if (!form.title.trim()) e.title = 'Title is required'
    if (!form.assignee.trim()) e.assignee = 'Assignee is required'
    if (!form.dueDate.trim()) e.dueDate = 'Due date is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    console.info('[envmon] create-corrective-action submitted', { plantId: context?.plantId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Create Corrective Action" onClose={onClose}>
      {submitted ? <SuccessMessage message="Corrective action created (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Alert ID">
              <input type="text" value={form.alertId} onChange={e => setForm(f => ({ ...f, alertId: e.target.value }))} placeholder="e.g. ALT-001" style={CTRL} />
            </Field>
            <Field label="Zone ID *" error={errors.zoneId}>
              <input type="text" value={form.zoneId} onChange={e => setForm(f => ({ ...f, zoneId: e.target.value }))} placeholder="e.g. ZONE-003" style={{ ...CTRL, border: `1px solid ${errors.zoneId ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Action Type">
              <select value={form.actionType} onChange={e => setForm(f => ({ ...f, actionType: e.target.value }))} style={CTRL}>
                <option value="deep-clean">Deep Clean</option>
                <option value="retest">Retest</option>
                <option value="equipment-check">Equipment Check</option>
                <option value="process-review">Process Review</option>
                <option value="personnel-training">Personnel Training</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Title *" error={errors.title}>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.title ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Description">
              <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...CTRL, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <Field label="Severity">
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} style={CTRL}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
            <Field label="Assignee *" error={errors.assignee}>
              <input type="text" value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))} placeholder="e.g. hygiene.team@listowel.ie" style={{ ...CTRL, border: `1px solid ${errors.assignee ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Due Date *" error={errors.dueDate}>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.dueDate ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Create Action" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

// ---------------------------------------------------------------------------
// Action: Request Retest
// ---------------------------------------------------------------------------

function RequestRetestAction({ context, onClose }: { context: EnvMonContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ zoneId: '', testType: 'swab', organism: '', urgency: 'high', scheduledDate: '', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.zoneId.trim()) e.zoneId = 'Zone is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    console.info('[envmon] request-retest submitted', { plantId: context?.plantId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Request Zone Retest" onClose={onClose}>
      {submitted ? <SuccessMessage message="Retest request submitted (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Zone ID *" error={errors.zoneId}>
              <input type="text" value={form.zoneId} onChange={e => setForm(f => ({ ...f, zoneId: e.target.value }))} placeholder="e.g. ZONE-003" style={{ ...CTRL, border: `1px solid ${errors.zoneId ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Test Type">
              <select value={form.testType} onChange={e => setForm(f => ({ ...f, testType: e.target.value }))} style={CTRL}>
                <option value="swab">Swab</option>
                <option value="air-sample">Air Sample</option>
                <option value="surface-contact">Surface Contact</option>
                <option value="rinse-water">Rinse Water</option>
              </select>
            </Field>
            <Field label="Target Organism">
              <input type="text" value={form.organism} onChange={e => setForm(f => ({ ...f, organism: e.target.value }))} placeholder="e.g. Listeria monocytogenes" style={CTRL} />
            </Field>
            <Field label="Urgency">
              <select value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))} style={CTRL}>
                <option value="critical">Critical (same day)</option>
                <option value="high">High (next available)</option>
                <option value="medium">Medium (scheduled)</option>
              </select>
            </Field>
            <Field label="Scheduled Date">
              <input type="date" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} style={CTRL} />
            </Field>
            <Field label="Notes">
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...CTRL, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Request Retest" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

// ---------------------------------------------------------------------------
// Action: Notify QA Lead
// ---------------------------------------------------------------------------

function NotifyQALeadAction({ context, onClose }: { context: EnvMonContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ alertId: '', zoneId: '', message: '', priority: 'high', requestCallback: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.message.trim()) e.message = 'Message is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    console.info('[envmon] notify-qa-lead submitted', { plantId: context?.plantId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Notify QA Lead" onClose={onClose}>
      {submitted ? <SuccessMessage message="QA Lead notified (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Related Alert ID">
              <input type="text" value={form.alertId} onChange={e => setForm(f => ({ ...f, alertId: e.target.value }))} placeholder="e.g. ALT-001" style={CTRL} />
            </Field>
            <Field label="Zone ID">
              <input type="text" value={form.zoneId} onChange={e => setForm(f => ({ ...f, zoneId: e.target.value }))} placeholder="e.g. ZONE-003" style={CTRL} />
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={CTRL}>
                <option value="critical">Critical — immediate response needed</option>
                <option value="high">High — respond within 1 hour</option>
                <option value="medium">Medium — respond today</option>
              </select>
            </Field>
            <Field label="Message *" error={errors.message}>
              <textarea rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.message ? '#F24A00' : 'var(--shell-line)'}`, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="request-callback" checked={form.requestCallback} onChange={e => setForm(f => ({ ...f, requestCallback: e.target.checked }))} />
              <label htmlFor="request-callback" style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>Request callback</label>
            </div>
            <SheetActions onClose={onClose} submitLabel="Send Notification" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

// ---------------------------------------------------------------------------
// Actions Panel
// ---------------------------------------------------------------------------

type ActiveAction = 'raise-alert' | 'create-corrective-action' | 'request-retest' | 'notify-qa-lead' | null

export interface EnvMonActionsPanelProps {
  readonly context: EnvMonContext | null
}

export function EnvMonActionsPanel({ context }: EnvMonActionsPanelProps) {
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const disabled = context === null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, background: 'var(--shell-surface)', borderLeft: '1px solid var(--shell-line)', minWidth: 200 }} aria-label="Environmental monitoring actions">
      <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>Actions</h3>

      <ActionButton label="Raise Environmental Alert" onClick={() => setActiveAction('raise-alert')} disabled={disabled} variant="danger" />
      <ActionButton label="Create Corrective Action" onClick={() => setActiveAction('create-corrective-action')} disabled={disabled} variant="warning" />
      <ActionButton label="Request Zone Retest" onClick={() => setActiveAction('request-retest')} disabled={disabled} variant="primary" />
      <ActionButton label="Notify QA Lead" onClick={() => setActiveAction('notify-qa-lead')} disabled={disabled} variant="secondary" />

      {activeAction === 'raise-alert' && <RaiseAlertAction context={context} onClose={() => setActiveAction(null)} />}
      {activeAction === 'create-corrective-action' && <CreateCorrectiveActionAction context={context} onClose={() => setActiveAction(null)} />}
      {activeAction === 'request-retest' && <RequestRetestAction context={context} onClose={() => setActiveAction(null)} />}
      {activeAction === 'notify-qa-lead' && <NotifyQALeadAction context={context} onClose={() => setActiveAction(null)} />}
    </div>
  )
}
