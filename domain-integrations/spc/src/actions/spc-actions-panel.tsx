import { useState } from 'react'
import type { SPCMonitoringContext, UATEvidencePayload } from '@connectio/data-contracts'

// ---------------------------------------------------------------------------
// Shared sheet primitives
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
// Action: Acknowledge Signal
// ---------------------------------------------------------------------------

function AcknowledgeSignalAction({ context, onClose }: { context: SPCMonitoringContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ signalId: '', notes: '', disposition: 'investigate' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.signalId.trim()) e.signalId = 'Signal ID is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    console.info('[spc] acknowledge-signal submitted', { plantId: context?.plantId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Acknowledge Signal" onClose={onClose}>
      {submitted ? <SuccessMessage message="Signal acknowledged (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Signal ID *" error={errors.signalId}>
              <input type="text" value={form.signalId} onChange={e => setForm(f => ({ ...f, signalId: e.target.value }))} placeholder="e.g. SIG-2024-00412" style={{ ...CTRL, border: `1px solid ${errors.signalId ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Disposition">
              <select value={form.disposition} onChange={e => setForm(f => ({ ...f, disposition: e.target.value }))} style={CTRL}>
                <option value="investigate">Investigate — root cause analysis required</option>
                <option value="monitor">Monitor — under observation</option>
                <option value="false-positive">False positive — no action needed</option>
              </select>
            </Field>
            <Field label="Notes">
              <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Reviewed with process technician — checking vat calibration" style={{ ...CTRL, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Acknowledge" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

// ---------------------------------------------------------------------------
// Action: Request Investigation
// ---------------------------------------------------------------------------

function RequestInvestigationAction({ context, onClose }: { context: SPCMonitoringContext | null; onClose: () => void }) {
  const [form, setForm] = useState({ characteristicId: '', priority: 'high', assignee: '', description: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.characteristicId.trim()) e.characteristicId = 'Characteristic ID is required'
    if (!form.assignee.trim()) e.assignee = 'Assignee is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    console.info('[spc] request-investigation submitted', { plantId: context?.plantId, form })
    setSubmitted(true)
  }

  return (
    <ActionSheet title="Request Investigation" onClose={onClose}>
      {submitted ? <SuccessMessage message="Investigation request submitted (mock)." onClose={onClose} /> : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Characteristic ID *" error={errors.characteristicId}>
              <input type="text" value={form.characteristicId} onChange={e => setForm(f => ({ ...f, characteristicId: e.target.value }))} placeholder="e.g. CHAR-PH-001" style={{ ...CTRL, border: `1px solid ${errors.characteristicId ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={CTRL}>
                <option value="critical">Critical — same shift</option>
                <option value="high">High — within 4 hours</option>
                <option value="medium">Medium — today</option>
                <option value="low">Low — scheduled</option>
              </select>
            </Field>
            <Field label="Assignee *" error={errors.assignee}>
              <input type="text" value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))} placeholder="e.g. c.moriarty@listowel.ie" style={{ ...CTRL, border: `1px solid ${errors.assignee ? '#F24A00' : 'var(--shell-line)'}` }} />
            </Field>
            <Field label="Description">
              <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...CTRL, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <SheetActions onClose={onClose} submitLabel="Submit Request" />
          </div>
        </form>
      )}
    </ActionSheet>
  )
}

// ---------------------------------------------------------------------------
// Link actions (navigate to other workspaces)
// ---------------------------------------------------------------------------

function LinkAction({ label, href, onClose }: { label: string; href: string; onClose: () => void }) {
  return (
    <ActionSheet title={label} onClose={onClose}>
      <div style={{ display: 'grid', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Navigate to the target workspace to continue your investigation.
        </p>
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

// ---------------------------------------------------------------------------
// Actions Panel
// ---------------------------------------------------------------------------

type ActiveAction = 'acknowledge-signal' | 'open-batch-release' | 'open-trace' | 'request-investigation' | 'copy-success' | 'copy-failed' | null

export interface SPCActionsPanelProps {
  readonly context: SPCMonitoringContext | null
}

export function SPCActionsPanel({ context }: SPCActionsPanelProps) {
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const disabled = context === null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, background: 'var(--shell-surface)', borderLeft: '1px solid var(--shell-line)', minWidth: 200 }} aria-label="SPC monitoring actions">
      <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>Actions</h3>

      <ActionButton label="Acknowledge Signal" onClick={() => setActiveAction('acknowledge-signal')} disabled={disabled} variant="warning" />
      <ActionButton label="Request Investigation" onClick={() => setActiveAction('request-investigation')} disabled={disabled} variant="primary" />
      <ActionButton label="Open Batch Release" onClick={() => setActiveAction('open-batch-release')} disabled={disabled} variant="secondary" />
      <ActionButton label="Open Trace Investigation" onClick={() => setActiveAction('open-trace')} disabled={disabled} variant="secondary" />
      
      <div style={{ marginTop: 16, borderTop: '1px solid var(--shell-line)', paddingTop: 16 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>UAT Readiness</h3>
        <ActionButton 
          label={activeAction === 'copy-success' ? 'Copied Evidence!' : activeAction === 'copy-failed' ? 'Copy Failed!' : 'Copy SPC UAT Evidence'} 
          onClick={() => {
            const payload: UATEvidencePayload = {
              domain: 'spc',
              workspace: 'SPC Monitoring',
              capturedAt: new Date().toISOString(),
              adapterMode: import.meta.env.VITE_ADAPTER_MODE || 'mock',
              inputs: {
                plantId: context?.plantId ?? null,
                materialId: context?.materialId ?? null,
                batchId: context?.batchId ?? null,
                workCentreId: context?.workCentreId ?? null
              },
              sourceSummary: {
                overall: 'mock', // SPC is currently mock-only
                sections: {
                  summary: 'mock',
                  signals: 'mock',
                  characteristics: 'mock',
                  charts: 'mock'
                }
              },
              evidenceCompleteness: {
                status: 'loaded',
                sections: {
                  summary: 'loaded',
                  signals: 'loaded',
                  characteristics: 'loaded',
                  charts: 'loaded'
                }
              },
              warnings: [
                'SPC sandbox mode — simulated data for validation only.',
                'Native Databricks integration is pending catalog alignment.'
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

      {activeAction === 'acknowledge-signal' && <AcknowledgeSignalAction context={context} onClose={() => setActiveAction(null)} />}
      {activeAction === 'request-investigation' && <RequestInvestigationAction context={context} onClose={() => setActiveAction(null)} />}
      {activeAction === 'open-batch-release' && (
        <LinkAction label="Quality Batch Release" href={`/?workspace=quality-batch-release&batchId=${context?.batchId ?? ''}`} onClose={() => setActiveAction(null)} />
      )}
      {activeAction === 'open-trace' && (
        <LinkAction label="Trace Investigation" href={`/?workspace=trace-investigation&batchId=${context?.batchId ?? ''}`} onClose={() => setActiveAction(null)} />
      )}
    </div>
  )
}
