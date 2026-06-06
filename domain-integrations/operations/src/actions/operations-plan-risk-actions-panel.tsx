import { useState } from 'react'
import type { OperationsPlanRiskContext } from '@connectio/data-contracts'

// ---------------------------------------------------------------------------
// Shared sheet primitives
// ---------------------------------------------------------------------------

export function ActionSheet({
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

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--shell-fg-2)', marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'contents' }}>{children}</div>
      {error && <span style={{ fontSize: 11, color: 'var(--sunset, #F24A00)', marginTop: 2, display: 'block' }} role="alert">{error}</span>}
    </div>
  )
}

export function SheetActions({ onClose, submitLabel }: { onClose: () => void; submitLabel: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
      <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--shell-line)', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>Cancel</button>
      <button type="submit" style={{ padding: '8px 16px', background: 'var(--shell-rail-active, #005776)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff' }}>{submitLabel}</button>
    </div>
  )
}

export function SuccessMessage({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 32 }} aria-hidden="true">✓</div>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--shell-fg)' }}>{message}</p>
      <button type="button" onClick={onClose} style={{ padding: '8px 20px', background: 'var(--shell-rail-active, #005776)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff', margin: '0 auto' }}>Done</button>
    </div>
  )
}

export type ActionButtonVariant = 'primary' | 'secondary' | 'warning' | 'danger'

export function ActionButton({ label, onClick, disabled, variant }: { label: string; onClick: () => void; disabled: boolean; variant: ActionButtonVariant }) {
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
// Action: Escalate Blocker
// ---------------------------------------------------------------------------

function EscalateBlockerAction({ context, onClose }: { context: OperationsPlanRiskContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ blockerType: '', linkedEntity: '', escalationReason: '', targetRole: 'Plant Manager', severity: 'high', dueDate: '', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.blockerType.trim()) e.blockerType = 'Blocker type is required'
    if (!form.escalationReason.trim()) e.escalationReason = 'Reason is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    console.info('[operations-plan-risk] escalate-blocker submitted', { plantId: context?.plantId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Escalate Blocker" onClose={onClose}>
      {submitted ? <SuccessMessage message="Blocker escalated (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Blocker Type *" error={errors.blockerType}>
              <select value={form.blockerType} onChange={e => setForm(f => ({ ...f, blockerType: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.blockerType ? '#F24A00' : 'var(--shell-line)'}` }}>
                <option value="">Select type…</option>
                <option>Material shortage</option>
                <option>Quality hold</option>
                <option>Maintenance breakdown</option>
                <option>Staging delay</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Linked Entity (order / line / material)">
              <input type="text" value={form.linkedEntity} onChange={e => setForm(f => ({ ...f, linkedEntity: e.target.value }))} style={CTRL} placeholder="e.g. 4500837291" />
            </Field>
            <Field label="Escalation Reason *" error={errors.escalationReason}>
              <textarea rows={3} value={form.escalationReason} onChange={e => setForm(f => ({ ...f, escalationReason: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.escalationReason ? '#F24A00' : 'var(--shell-line)'}`, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <Field label="Target Role / Group">
              <select value={form.targetRole} onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))} style={CTRL}>
                <option>Plant Manager</option>
                <option>Operations Manager</option>
                <option>Quality Lead</option>
                <option>Warehouse Manager</option>
                <option>Maintenance Supervisor</option>
              </select>
            </Field>
            <Field label="Severity">
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} style={CTRL}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
            <Field label="Due Date">
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={CTRL} />
            </Field>
            <Field label="Notes">
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...CTRL, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Escalate Blocker" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

// ---------------------------------------------------------------------------
// Action: Request Staging
// ---------------------------------------------------------------------------

function RequestStagingAction({ context, onClose }: { context: OperationsPlanRiskContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ processOrder: '', material: '', batch: '', requiredQty: '', requiredBy: '', stagingArea: 'STG-01A', priority: 'normal', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.processOrder.trim()) e.processOrder = 'Process order is required'
    if (!form.material.trim()) e.material = 'Material is required'
    if (!form.requiredQty.trim()) e.requiredQty = 'Quantity is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    console.info('[operations-plan-risk] request-staging submitted', { plantId: context?.plantId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Request Staging" onClose={onClose}>
      {submitted ? <SuccessMessage message="Staging request submitted (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Process Order *" error={errors.processOrder}>
              <input type="text" value={form.processOrder} onChange={e => setForm(f => ({ ...f, processOrder: e.target.value }))} placeholder="e.g. 4500837291" style={{ ...CTRL, border: `1px solid ${errors.processOrder ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Material *" error={errors.material}>
              <input type="text" value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))} placeholder="e.g. CHIP-VAR-001" style={{ ...CTRL, border: `1px solid ${errors.material ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Batch">
              <input type="text" value={form.batch} onChange={e => setForm(f => ({ ...f, batch: e.target.value }))} placeholder="e.g. 2026-W20-A" style={CTRL} />
            </Field>
            <Field label="Required Quantity (KG) *" error={errors.requiredQty}>
              <input type="number" value={form.requiredQty} onChange={e => setForm(f => ({ ...f, requiredQty: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.requiredQty ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Required By">
              <input type="datetime-local" value={form.requiredBy} onChange={e => setForm(f => ({ ...f, requiredBy: e.target.value }))} style={CTRL} />
            </Field>
            <Field label="Staging Area">
              <select value={form.stagingArea} onChange={e => setForm(f => ({ ...f, stagingArea: e.target.value }))} style={CTRL}>
                <option>STG-01A</option><option>STG-01B</option><option>STG-02A</option><option>STG-02B</option><option>STG-03A</option>
              </select>
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={CTRL}>
                <option value="urgent">Urgent</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </Field>
            <Field label="Notes">
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...CTRL, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Submit Staging Request" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

// ---------------------------------------------------------------------------
// Action: Request Quality Review
// ---------------------------------------------------------------------------

function RequestQualityReviewAction({ context, onClose }: { context: OperationsPlanRiskContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ material: '', batch: '', processOrder: '', inspectionLot: '', reason: '', priority: 'normal', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.material.trim()) e.material = 'Material is required'
    if (!form.reason.trim()) e.reason = 'Reason is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    console.info('[operations-plan-risk] request-quality-review submitted', { plantId: context?.plantId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Request Quality Review" onClose={onClose}>
      {submitted ? <SuccessMessage message="Quality review request submitted (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Material *" error={errors.material}>
              <input type="text" value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.material ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Batch">
              <input type="text" value={form.batch} onChange={e => setForm(f => ({ ...f, batch: e.target.value }))} style={CTRL} />
            </Field>
            <Field label="Process Order">
              <input type="text" value={form.processOrder} onChange={e => setForm(f => ({ ...f, processOrder: e.target.value }))} style={CTRL} />
            </Field>
            <Field label="Inspection Lot / Release Case">
              <input type="text" value={form.inspectionLot} onChange={e => setForm(f => ({ ...f, inspectionLot: e.target.value }))} style={CTRL} />
            </Field>
            <Field label="Reason *" error={errors.reason}>
              <textarea rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.reason ? '#F24A00' : 'var(--shell-line)'}`, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={CTRL}>
                <option value="critical">Critical</option>
                <option value="expedited">Expedited</option>
                <option value="normal">Normal</option>
              </select>
            </Field>
            <Field label="Notes">
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...CTRL, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Submit Request" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

// ---------------------------------------------------------------------------
// Action: Create Handover Note
// ---------------------------------------------------------------------------

function CreateHandoverNoteAction({ context, onClose }: { context: OperationsPlanRiskContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ shift: context?.shiftId ?? 'SHIFT-AM', category: 'operations', title: '', description: '', linkedOrders: '', linkedLines: '', severity: 'medium', owner: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = 'Title is required'
    if (!form.description.trim()) e.description = 'Description is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    console.info('[operations-plan-risk] create-handover-note submitted', { plantId: context?.plantId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Create Handover Note" onClose={onClose}>
      {submitted ? <SuccessMessage message="Handover note created (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Shift">
              <input type="text" value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))} style={CTRL} />
            </Field>
            <Field label="Category">
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={CTRL}>
                <option value="quality">Quality</option>
                <option value="safety">Safety</option>
                <option value="maintenance">Maintenance</option>
                <option value="operations">Operations</option>
                <option value="material">Material</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Title *" error={errors.title}>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.title ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Description *" error={errors.description}>
              <textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.description ? '#F24A00' : 'var(--shell-line)'}`, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <Field label="Linked Orders (comma-separated)">
              <input type="text" value={form.linkedOrders} onChange={e => setForm(f => ({ ...f, linkedOrders: e.target.value }))} placeholder="4500837291, 4500837295" style={CTRL} />
            </Field>
            <Field label="Linked Lines (comma-separated)">
              <input type="text" value={form.linkedLines} onChange={e => setForm(f => ({ ...f, linkedLines: e.target.value }))} placeholder="L-04, L-02" style={CTRL} />
            </Field>
            <Field label="Severity">
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} style={CTRL}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
            <SheetActions onClose={onClose} submitLabel="Create Note" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

// ---------------------------------------------------------------------------
// Action: Open Process Order Review (governed placeholder)
// ---------------------------------------------------------------------------

function OpenProcessOrderReviewAction({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ processOrder: '', targetView: 'overview', reason: '' })
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!form.processOrder.trim()) return
    console.info('[operations-plan-risk] open-process-order-review', { form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Open Process Order Review" onClose={onClose}>
      {submitted ? (
        <div style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 32 }} aria-hidden="true">ℹ</div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--shell-fg)' }}>
            Process Order Review workspace is not yet available. Your context has been captured for when it is implemented.
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--shell-fg-3)' }}>Process Order: {form.processOrder}</p>
          <button type="button" onClick={onClose} style={{ padding: '8px 20px', background: 'var(--shell-rail-active, #005776)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff', margin: '0 auto' }}>Close</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ padding: '10px 12px', background: 'var(--shell-surface-2)', borderRadius: 4, fontSize: 12, color: 'var(--shell-fg-2)', borderLeft: '3px solid #D97706' }}>
              Process Order Review workspace is planned for Phase 4. This action captures your context for cross-workspace navigation when it becomes available.
            </div>
            <Field label="Process Order *">
              <input type="text" value={form.processOrder} onChange={e => setForm(f => ({ ...f, processOrder: e.target.value }))} placeholder="e.g. 4500837291" style={CTRL} />
            </Field>
            <Field label="Reason / Context">
              <textarea rows={2} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} style={{ ...CTRL, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Capture Context" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

// ---------------------------------------------------------------------------
// Action: Open Batch Release (drill-through)
// ---------------------------------------------------------------------------

function OpenBatchReleaseAction({ context, onClose, onNavigateToBatchRelease }: { context: OperationsPlanRiskContext | null; onClose: () => void; onNavigateToBatchRelease?: (releaseCaseId: string, viewId?: string) => void }) {
  const [form, setForm] = useState({ releaseCase: '', batch: '', reason: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.releaseCase.trim() && !form.batch.trim()) e.releaseCase = 'Release case or batch is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    const caseId = form.releaseCase.trim() || `RC-for-${form.batch.trim()}`
    console.info('[operations-plan-risk] open-batch-release', { plantId: context?.plantId, caseId, reason: form.reason })
    if (onNavigateToBatchRelease) {
      onNavigateToBatchRelease(caseId, 'batch-decision')
      onClose()
    } else {
      setSubmitted(true)
    }
  }

  return (
    <ActionSheet title="Open Batch Release" onClose={onClose}>
      {submitted ? <SuccessMessage message="Navigating to Batch Release workspace (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Release Case / Batch *" error={errors.releaseCase}>
              <input type="text" value={form.releaseCase} onChange={e => setForm(f => ({ ...f, releaseCase: e.target.value }))} placeholder="RC-2026-001847 or 2026-W20-A" style={{ ...CTRL, border: `1px solid ${errors.releaseCase ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Reason / Context">
              <textarea rows={2} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} style={{ ...CTRL, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Open Batch Release" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

// ---------------------------------------------------------------------------
// Actions Panel
// ---------------------------------------------------------------------------

type ActiveAction = 'escalate-blocker' | 'request-staging' | 'request-quality-review' | 'create-handover-note' | 'open-process-order-review' | 'open-batch-release' | null

export interface OperationsPlanRiskActionsPanelProps {
  readonly context: OperationsPlanRiskContext | null
  readonly onNavigateToBatchRelease?: (releaseCaseId: string, viewId?: string) => void
}

export function OperationsPlanRiskActionsPanel({ context, onNavigateToBatchRelease }: OperationsPlanRiskActionsPanelProps) {
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const disabled = context === null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, background: 'var(--shell-surface)', borderLeft: '1px solid var(--shell-line)', minWidth: 200 }} aria-label="Operations plan risk actions">
      <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>Actions</h3>

      <ActionButton label="Escalate Blocker" onClick={() => setActiveAction('escalate-blocker')} disabled={disabled} variant="danger" />
      <ActionButton label="Request Staging" onClick={() => setActiveAction('request-staging')} disabled={disabled} variant="primary" />
      <ActionButton label="Request Quality Review" onClick={() => setActiveAction('request-quality-review')} disabled={disabled} variant="warning" />
      <ActionButton label="Create Handover Note" onClick={() => setActiveAction('create-handover-note')} disabled={disabled} variant="secondary" />
      <ActionButton label="Open Process Order Review" onClick={() => setActiveAction('open-process-order-review')} disabled={disabled} variant="secondary" />
      <ActionButton label="Open Batch Release" onClick={() => setActiveAction('open-batch-release')} disabled={disabled} variant="secondary" />

      {activeAction === 'escalate-blocker' && <EscalateBlockerAction context={context} onClose={() => setActiveAction(null)} />}
      {activeAction === 'request-staging' && <RequestStagingAction context={context} onClose={() => setActiveAction(null)} />}
      {activeAction === 'request-quality-review' && <RequestQualityReviewAction context={context} onClose={() => setActiveAction(null)} />}
      {activeAction === 'create-handover-note' && <CreateHandoverNoteAction context={context} onClose={() => setActiveAction(null)} />}
      {activeAction === 'open-process-order-review' && <OpenProcessOrderReviewAction onClose={() => setActiveAction(null)} />}
      {activeAction === 'open-batch-release' && <OpenBatchReleaseAction context={context} onClose={() => setActiveAction(null)} onNavigateToBatchRelease={onNavigateToBatchRelease} />}
    </div>
  )
}
