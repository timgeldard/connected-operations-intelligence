import { useState } from 'react'
import type { Warehouse360OverviewContext, UATEvidencePayload } from '@connectio/data-contracts'
import { featureFlags } from '@connectio/feature-flags'

function ActionSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }} role="dialog" aria-modal="true" aria-label={title} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
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
      {error && <span style={{ fontSize: 11, color: '#F24A00', marginTop: 2, display: 'block' }} role="alert">{error}</span>}
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 24 }}>
      <div style={{ fontSize: 36 }}>✓</div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--shell-fg)', textAlign: 'center' }}>{message}</p>
      <button type="button" onClick={onClose} style={{ padding: '8px 20px', background: 'var(--shell-rail-active, #005776)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff' }}>Close</button>
    </div>
  )
}

type ActionButtonVariant = 'primary' | 'secondary' | 'warning'

const BTN_STYLE: Record<ActionButtonVariant, React.CSSProperties> = {
  primary: { background: 'var(--shell-rail-active, #005776)', color: '#fff', border: 'none' },
  secondary: { background: 'transparent', color: 'var(--shell-fg)', border: '1px solid var(--shell-line)' },
  warning: { background: '#F57C00', color: '#fff', border: 'none' },
}

function ActionButton({ label, onClick, disabled, variant = 'secondary' }: { label: string; onClick: () => void; disabled: boolean; variant?: ActionButtonVariant }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ padding: '8px 12px', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, opacity: disabled ? 0.5 : 1, textAlign: 'left', width: '100%', ...BTN_STYLE[variant] }}
    >
      {label}
    </button>
  )
}

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

function RaiseHoldInquiryAction({ context, onClose }: { context: Warehouse360OverviewContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ holdId: '', description: '', assignee: '' })
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
    console.info('[w360] raise-hold-inquiry submitted', { warehouseId: context?.warehouseId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Raise Hold Inquiry" onClose={onClose}>
      {submitted ? <SuccessMessage message="Hold inquiry raised (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Hold ID / Batch">
              <input type="text" value={form.holdId} onChange={e => setForm(f => ({ ...f, holdId: e.target.value }))} placeholder="e.g. HOLD-2024-00312" style={CTRL} />
            </Field>
            <Field label="Description *" error={errors.description}>
              <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...CTRL, border: `1px solid ${errors.description ? '#F24A00' : 'var(--shell-line)'}`, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <Field label="Assignee">
              <input type="text" value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))} placeholder="e.g. quality.ie10@kerry.com" style={CTRL} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Raise Inquiry" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

function RequestReplenishmentAction({ context, onClose }: { context: Warehouse360OverviewContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ materialId: '', quantity: '', urgency: 'medium', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.materialId.trim()) e.materialId = 'Material ID is required'
    if (!form.quantity.trim()) e.quantity = 'Quantity is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    console.info('[w360] request-replenishment submitted', { warehouseId: context?.warehouseId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Request Replenishment" onClose={onClose}>
      {submitted ? <SuccessMessage message="Replenishment request submitted (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Material ID *" error={errors.materialId}>
              <input type="text" value={form.materialId} onChange={e => setForm(f => ({ ...f, materialId: e.target.value }))} placeholder="e.g. MAT-START-CULTURE-B10" style={{ ...CTRL, border: `1px solid ${errors.materialId ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Quantity *" error={errors.quantity}>
              <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="e.g. 20" style={{ ...CTRL, border: `1px solid ${errors.quantity ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Urgency">
              <select value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))} style={CTRL}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
            <Field label="Notes">
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...CTRL, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Request Replenishment" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

type ActiveAction = 'raise-hold-inquiry' | 'request-replenishment' | 'open-batch-release' | 'open-staging' | 'open-trace' | 'copy-success' | 'copy-failed' | null

export interface Warehouse360ActionsPanelProps {
  readonly context: Warehouse360OverviewContext | null
}

export function Warehouse360ActionsPanel({ context }: Warehouse360ActionsPanelProps) {
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const disabled = context === null
  const postingDisabled = !featureFlags.warehouse.postingActions

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, background: 'var(--shell-surface)', borderLeft: '1px solid var(--shell-line)', minWidth: 200 }} aria-label="Warehouse 360 actions">
      <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>Actions</h3>

      {postingDisabled && (
        <div
          style={{
            padding: '8px 12px',
            background: 'rgba(217, 119, 6, 0.1)',
            border: '1px solid #D97706',
            borderRadius: 4,
            fontSize: 11,
            color: '#D97706',
            marginBottom: 8,
            fontWeight: 500,
          }}
        >
          Posting actions disabled by configuration.
        </div>
      )}

      <ActionButton label="Raise Hold Inquiry" onClick={() => setActiveAction('raise-hold-inquiry')} disabled={disabled || postingDisabled} variant="warning" />
      <ActionButton label="Request Replenishment" onClick={() => setActiveAction('request-replenishment')} disabled={disabled || postingDisabled} variant="primary" />
      <ActionButton label="Open Batch Release" onClick={() => setActiveAction('open-batch-release')} disabled={disabled} variant="secondary" />
      <ActionButton label="Open Production Staging" onClick={() => setActiveAction('open-staging')} disabled={disabled} variant="secondary" />
      <ActionButton label="Open Trace Investigation" onClick={() => setActiveAction('open-trace')} disabled={disabled} variant="secondary" />

      <div style={{ marginTop: 16, borderTop: '1px solid var(--shell-line)', paddingTop: 16 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>UAT Readiness</h3>
        <ActionButton 
          label={activeAction === 'copy-success' ? 'Copied Evidence!' : activeAction === 'copy-failed' ? 'Copy Failed!' : 'Copy Warehouse UAT Evidence'} 
          onClick={() => {
            const mode = (import.meta.env.VITE_ADAPTER_MODE as 'mock' | 'legacy-api' | 'databricks-api') || 'mock'
            const overallSource = mode
            const overallStatus = mode === 'mock' ? 'mock-only' : 'loaded'

            const payload: UATEvidencePayload = {
              domain: 'warehouse',
              workspace: 'Warehouse 360',
              capturedAt: new Date().toISOString(),
              adapterMode: mode,
              inputs: {
                warehouseId: context?.warehouseId ?? null
              },
              sourceSummary: {
                overall: overallSource,
                sections: {
                  summary: overallSource,
                  stock: overallSource,
                  holds: overallSource,
                  exceptions: overallSource
                }
              },
              evidenceCompleteness: {
                status: overallStatus,
                sections: {
                  summary: overallStatus,
                  stock: overallStatus,
                  holds: overallStatus,
                  exceptions: overallStatus
                }
              },
              warnings: [
                'Warehouse sandbox mode — simulated data for validation only.',
                'Movements and holds do not write back to WMS/SAP.'
              ],
              uatNotes: [
                'No live validation claimed.',
                'Unavailable evidence must not be interpreted as zero exposure or no risk.'
              ]
            }
            if (navigator.clipboard) {
              navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
                .then(() => {
                  setActiveAction('copy-success')
                  setTimeout(() => setActiveAction(null), 2000)
                })
                .catch(() => {
                  setActiveAction('copy-failed')
                  setTimeout(() => setActiveAction(null), 2000)
                })
            } else {
              setActiveAction('copy-failed')
              setTimeout(() => setActiveAction(null), 2000)
            }
          }} 
          disabled={disabled} 
          variant="secondary" 
        />
      </div>

      {activeAction === 'raise-hold-inquiry' && <RaiseHoldInquiryAction context={context} onClose={() => setActiveAction(null)} />}
      {activeAction === 'request-replenishment' && <RequestReplenishmentAction context={context} onClose={() => setActiveAction(null)} />}
      {activeAction === 'open-batch-release' && (
        <LinkAction label="Quality Batch Release" href={`/?workspace=quality-batch-release`} onClose={() => setActiveAction(null)} />
      )}
      {activeAction === 'open-staging' && (
        <LinkAction label="Production Staging" href={`/?workspace=production-staging`} onClose={() => setActiveAction(null)} />
      )}
      {activeAction === 'open-trace' && (
        <LinkAction label="Trace Investigation" href={`/?workspace=trace-investigation`} onClose={() => setActiveAction(null)} />
      )}
    </div>
  )
}
