import { useState } from 'react'
import type { ProductionStagingContext } from '@connectio/data-contracts'

// ---------------------------------------------------------------------------
// Shared sheet primitives
// ---------------------------------------------------------------------------

function ActionSheet({ title, onClose, children, 'aria-label': ariaLabel }: { title: string; onClose: () => void; children: React.ReactNode; 'aria-label'?: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }} role="dialog" aria-modal="true" aria-label={ariaLabel ?? title} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: 420, maxWidth: '100vw', background: 'var(--shell-bg, #fff)', borderLeft: '1px solid var(--shell-line)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
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
// Action: Request Move
// ---------------------------------------------------------------------------

function RequestMoveAction({ context, onClose }: { context: ProductionStagingContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ fromLocation: '', toLocation: '', materialId: '', quantity: '', uom: 'KG', processOrderId: '', priority: 'high', reason: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.fromLocation.trim()) e.fromLocation = 'From location is required'
    if (!form.toLocation.trim()) e.toLocation = 'To location is required'
    if (!form.materialId.trim()) e.materialId = 'Material is required'
    if (!form.quantity.trim()) e.quantity = 'Quantity is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    console.info('[production-staging] request-move submitted', { warehouseId: context?.warehouseId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Request Internal Move" onClose={onClose}>
      {submitted ? <SuccessMessage message="Move request submitted (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="From Location *" error={errors.fromLocation}>
              <input type="text" value={form.fromLocation} onChange={e => setForm(f => ({ ...f, fromLocation: e.target.value }))} placeholder="e.g. B-02-04" style={{ ...CTRL, border: `1px solid ${errors.fromLocation ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="To Location *" error={errors.toLocation}>
              <input type="text" value={form.toLocation} onChange={e => setForm(f => ({ ...f, toLocation: e.target.value }))} placeholder="e.g. SA-02" style={{ ...CTRL, border: `1px solid ${errors.toLocation ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Material ID *" error={errors.materialId}>
              <input type="text" value={form.materialId} onChange={e => setForm(f => ({ ...f, materialId: e.target.value }))} placeholder="e.g. MAT-CP-250" style={{ ...CTRL, border: `1px solid ${errors.materialId ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <Field label="Quantity *" error={errors.quantity}>
                <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.quantity ? '#F24A00' : 'var(--shell-line)'}` }} />
              </Field>
              <Field label="UOM">
                <select value={form.uom} onChange={e => setForm(f => ({ ...f, uom: e.target.value }))} style={{ ...CTRL, marginTop: 0 }}>
                  <option>KG</option><option>UNIT</option><option>ROLL</option><option>PALLET</option>
                </select>
              </Field>
            </div>
            <Field label="Process Order">
              <input type="text" value={form.processOrderId} onChange={e => setForm(f => ({ ...f, processOrderId: e.target.value }))} placeholder="e.g. PO-4500837295" style={CTRL} />
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={CTRL}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
            <Field label="Reason">
              <textarea rows={2} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} style={{ ...CTRL, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Submit Move Request" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

// ---------------------------------------------------------------------------
// Action: Escalate Shortfall
// ---------------------------------------------------------------------------

function EscalateShortfallAction({ context, onClose }: { context: ProductionStagingContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ materialId: '', shortfallQty: '', uom: 'KG', urgency: 'high', processOrderId: '', expectedArrival: '', escalationReason: '', targetGroup: 'Procurement' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.materialId.trim()) e.materialId = 'Material is required'
    if (!form.escalationReason.trim()) e.escalationReason = 'Reason is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    console.info('[production-staging] escalate-shortfall submitted', { plantId: context?.plantId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Escalate Material Shortfall" onClose={onClose}>
      {submitted ? <SuccessMessage message="Shortfall escalated (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Material ID *" error={errors.materialId}>
              <input type="text" value={form.materialId} onChange={e => setForm(f => ({ ...f, materialId: e.target.value }))} placeholder="e.g. MAT-PF-ROLL" style={{ ...CTRL, border: `1px solid ${errors.materialId ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <Field label="Shortfall Quantity">
                <input type="number" value={form.shortfallQty} onChange={e => setForm(f => ({ ...f, shortfallQty: e.target.value }))} style={CTRL} />
              </Field>
              <Field label="UOM">
                <select value={form.uom} onChange={e => setForm(f => ({ ...f, uom: e.target.value }))} style={CTRL}>
                  <option>KG</option><option>UNIT</option><option>ROLL</option><option>PALLET</option>
                </select>
              </Field>
            </div>
            <Field label="Process Order">
              <input type="text" value={form.processOrderId} onChange={e => setForm(f => ({ ...f, processOrderId: e.target.value }))} style={CTRL} />
            </Field>
            <Field label="Urgency">
              <select value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))} style={CTRL}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
              </select>
            </Field>
            <Field label="Escalate To">
              <select value={form.targetGroup} onChange={e => setForm(f => ({ ...f, targetGroup: e.target.value }))} style={CTRL}>
                <option>Procurement</option>
                <option>Supply Chain</option>
                <option>Plant Manager</option>
                <option>Operations Supervisor</option>
              </select>
            </Field>
            <Field label="Escalation Reason *" error={errors.escalationReason}>
              <textarea rows={3} value={form.escalationReason} onChange={e => setForm(f => ({ ...f, escalationReason: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.escalationReason ? '#F24A00' : 'var(--shell-line)'}`, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Escalate Shortfall" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

// ---------------------------------------------------------------------------
// Action: Request Expedited Staging
// ---------------------------------------------------------------------------

function RequestExpeditedStagingAction({ context, onClose }: { context: ProductionStagingContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ processOrderId: '', requiredBy: '', stagingArea: 'SA-01', reason: '', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.processOrderId.trim()) e.processOrderId = 'Process order is required'
    if (!form.requiredBy.trim()) e.requiredBy = 'Required by time is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    console.info('[production-staging] request-expedited-staging submitted', { plantId: context?.plantId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Request Expedited Staging" onClose={onClose}>
      {submitted ? <SuccessMessage message="Expedited staging request submitted (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Process Order *" error={errors.processOrderId}>
              <input type="text" value={form.processOrderId} onChange={e => setForm(f => ({ ...f, processOrderId: e.target.value }))} placeholder="e.g. PO-4500837295" style={{ ...CTRL, border: `1px solid ${errors.processOrderId ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Required By *" error={errors.requiredBy}>
              <input type="datetime-local" value={form.requiredBy} onChange={e => setForm(f => ({ ...f, requiredBy: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.requiredBy ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Staging Area">
              <select value={form.stagingArea} onChange={e => setForm(f => ({ ...f, stagingArea: e.target.value }))} style={CTRL}>
                <option>SA-01</option><option>SA-02</option><option>SA-03</option>
              </select>
            </Field>
            <Field label="Reason">
              <textarea rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} style={{ ...CTRL, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Request Expedited Staging" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

// ---------------------------------------------------------------------------
// Action: Notify Production
// ---------------------------------------------------------------------------

function NotifyProductionAction({ context, onClose }: { context: ProductionStagingContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ processOrderId: '', message: '', alertType: 'delay', priority: 'high' })
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
    console.info('[production-staging] notify-production submitted', { plantId: context?.plantId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Notify Production" onClose={onClose}>
      {submitted ? <SuccessMessage message="Production notified (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Process Order">
              <input type="text" value={form.processOrderId} onChange={e => setForm(f => ({ ...f, processOrderId: e.target.value }))} placeholder="e.g. PO-4500837295" style={CTRL} />
            </Field>
            <Field label="Alert Type">
              <select value={form.alertType} onChange={e => setForm(f => ({ ...f, alertType: e.target.value }))} style={CTRL}>
                <option value="delay">Staging Delay</option>
                <option value="shortfall">Material Shortfall</option>
                <option value="blocked">Order Blocked</option>
                <option value="ready">Material Ready</option>
              </select>
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={CTRL}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
              </select>
            </Field>
            <Field label="Message *" error={errors.message}>
              <textarea rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.message ? '#F24A00' : 'var(--shell-line)'}`, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
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

type ActiveAction = 'request-move' | 'escalate-shortfall' | 'request-expedited-staging' | 'notify-production' | null

export interface ProductionStagingActionsPanelProps {
  readonly context: ProductionStagingContext | null
}

export function ProductionStagingActionsPanel({ context }: ProductionStagingActionsPanelProps) {
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const disabled = context === null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, background: 'var(--shell-surface)', borderLeft: '1px solid var(--shell-line)', minWidth: 200 }} aria-label="Production staging actions">
      <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>Actions</h3>

      <ActionButton label="Request Internal Move" onClick={() => setActiveAction('request-move')} disabled={disabled} variant="primary" />
      <ActionButton label="Escalate Shortfall" onClick={() => setActiveAction('escalate-shortfall')} disabled={disabled} variant="danger" />
      <ActionButton label="Request Expedited Staging" onClick={() => setActiveAction('request-expedited-staging')} disabled={disabled} variant="warning" />
      <ActionButton label="Notify Production" onClick={() => setActiveAction('notify-production')} disabled={disabled} variant="secondary" />

      {activeAction === 'request-move' && <RequestMoveAction context={context} onClose={() => setActiveAction(null)} />}
      {activeAction === 'escalate-shortfall' && <EscalateShortfallAction context={context} onClose={() => setActiveAction(null)} />}
      {activeAction === 'request-expedited-staging' && <RequestExpeditedStagingAction context={context} onClose={() => setActiveAction(null)} />}
      {activeAction === 'notify-production' && <NotifyProductionAction context={context} onClose={() => setActiveAction(null)} />}
    </div>
  )
}
