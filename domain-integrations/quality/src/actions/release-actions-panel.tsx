import { useState } from 'react'
import type { BatchReleaseContext, UATEvidencePayload } from '@connectio/data-contracts'
import { featureFlags } from '@connectio/feature-flags'
import { ReleaseBatchAction } from './release-batch-action.js'
import { PlaceOnHoldAction } from './place-on-hold-action.js'
import { RequestRetestAction } from './request-retest-action.js'
import { EscalateDeviationAction } from './escalate-deviation-action.js'
import { OpenTraceInvestigationAction } from './open-trace-investigation-action.js'

// ---------------------------------------------------------------------------
// Shared sheet primitives — imported by all action files in this directory
// ---------------------------------------------------------------------------

/** Overlay + card shell for action sheets. */
export function ActionSheet({
  title,
  onClose,
  children,
  'aria-label': ariaLabel,
}: {
  /** Sheet heading shown in the header bar. */
  title: string
  /** Callback invoked when the sheet should be dismissed. */
  onClose: () => void
  /** Sheet body content. */
  children: React.ReactNode
  /** Accessible label for the dialog element; defaults to the title. */
  'aria-label'?: string
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 1000,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: '100vw',
          background: 'var(--shell-bg, #fff)',
          borderLeft: '1px solid var(--shell-line)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Sheet header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--shell-line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--shell-fg)' }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--shell-fg-3)',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>
        {/* Sheet body */}
        <div style={{ padding: '20px', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}

/** Labelled form field with optional inline error message. */
export function Field({
  label,
  error,
  children,
}: {
  /** Visible label text shown above the field control. */
  label: string
  /** Validation error message; when present a role="alert" span is rendered. */
  error?: string
  /** The form control (input, select, textarea, etc.). */
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--shell-fg-2)',
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      <div style={{ display: 'contents' }}>{children}</div>
      {error && (
        <span
          style={{ fontSize: 11, color: 'var(--sunset, #F24A00)', marginTop: 2, display: 'block' }}
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  )
}

/** Submit + cancel button row rendered at the bottom of an action sheet form. */
export function SheetActions({
  onClose,
  submitLabel,
}: {
  /** Callback invoked when the cancel button is clicked. */
  onClose: () => void
  /** Text for the primary submit button. */
  submitLabel: string
}) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
      <button
        type="button"
        onClick={onClose}
        style={{
          padding: '8px 16px',
          background: 'transparent',
          border: '1px solid var(--shell-line)',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--shell-fg)',
        }}
      >
        Cancel
      </button>
      <button
        type="submit"
        style={{
          padding: '8px 16px',
          background: 'var(--shell-rail-active, var(--valentia-slate, #005776))',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          color: '#fff',
        }}
      >
        {submitLabel}
      </button>
    </div>
  )
}

/** Success confirmation screen shown after a form is submitted successfully. */
export function SuccessMessage({
  message,
  onClose,
}: {
  /** Human-readable success copy to display. */
  message: string
  /** Callback invoked when the Done button is clicked. */
  onClose: () => void
}) {
  return (
    <div style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 32 }} aria-hidden="true">
        ✓
      </div>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--shell-fg)' }}>{message}</p>
      <button
        type="button"
        onClick={onClose}
        style={{
          padding: '8px 20px',
          background: 'var(--shell-rail-active, var(--valentia-slate, #005776))',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          color: '#fff',
          margin: '0 auto',
        }}
      >
        Done
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ActionButton
// ---------------------------------------------------------------------------

/**
 * Visual variant for an action rail button.
 *
 * - `primary` — filled slate background, white text
 * - `secondary` — transparent background, default foreground text
 * - `warning` — transparent background, amber border and text
 * - `secondary-orange` — transparent background, orange (#EA580C) border and
 *   text; used for Escalate Deviation to distinguish it from the amber warning
 *   style used by Place on Hold
 */
export type ActionButtonVariant = 'primary' | 'secondary' | 'warning' | 'secondary-orange'

/** Props for ActionButton. */
export interface ActionButtonProps {
  /** Button label rendered as visible text and aria-label. */
  readonly label: string
  /** Click handler. */
  readonly onClick: () => void
  /** When true the button is visually dimmed and non-interactive. */
  readonly disabled: boolean
  /** Controls the colour/fill style of the button. */
  readonly variant: ActionButtonVariant
}

/**
 * Single labelled button in the quality actions rail.
 *
 * @remarks
 * Renders full-width with left-aligned text to match the rail layout.
 * The `secondary-orange` variant uses a deeper orange (#EA580C) so that
 * it remains visually distinct from the amber `warning` variant (#D97706)
 * used by Place on Hold.
 */
export function ActionButton({ label, onClick, disabled, variant }: ActionButtonProps) {
  const variantStyle: Record<ActionButtonVariant, React.CSSProperties> = {
    primary: {
      background: 'var(--shell-rail-active, var(--valentia-slate, #005776))',
      color: '#fff',
      border: 'none',
    },
    secondary: {
      background: 'transparent',
      color: 'var(--shell-fg)',
      border: '1px solid var(--shell-line)',
    },
    warning: {
      background: 'transparent',
      color: '#D97706',
      border: '1px solid #D97706',
    },
    'secondary-orange': {
      background: 'transparent',
      color: '#EA580C',
      border: '1px solid #EA580C',
    },
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        ...variantStyle[variant],
        padding: '8px 12px',
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontWeight: 600,
        textAlign: 'left',
        opacity: disabled ? 0.4 : 1,
        width: '100%',
      }}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

/** Which action sheet (if any) is currently open. */
type ActiveAction = 'release' | 'hold' | 'retest' | 'escalate-deviation' | 'open-trace' | 'copy-success' | 'copy-failed' | null

/** Props for ReleaseActionsPanel. */
export interface ReleaseActionsPanelProps {
  /**
   * Current batch release context; null while the workspace is still loading.
   * Used to drive button disabled states and to pre-populate action form fields.
   */
  readonly context: BatchReleaseContext | null
}

/**
 * Right-rail action panel for the Quality Batch Release workspace.
 *
 * @remarks
 * Renders five primary action buttons. Each button opens a modal sheet form for
 * the corresponding action flow. Only one action sheet can be open at a time.
 * Action buttons are disabled while context is loading (null) and individual
 * buttons carry additional status-based guards:
 *
 * - "Release Batch" is disabled when the batch is already released or rejected.
 * - "Place on Hold" is disabled when the batch is already on hold.
 *
 * No real backend mutation is performed in Phase 1 — mock submit handlers emit
 * console telemetry only.
 */
export function ReleaseActionsPanel({ context }: ReleaseActionsPanelProps) {
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const disabled = context === null
  const writeBackDisabled = !featureFlags.writeBack.qualityReleaseAction

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '16px',
        background: 'var(--shell-surface)',
        borderLeft: '1px solid var(--shell-line)',
        minWidth: 200,
      }}
      aria-label="Batch release actions"
    >
      <h3
        style={{
          margin: '0 0 8px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--shell-fg-3)',
        }}
      >
        Actions
      </h3>

      {writeBackDisabled && (
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
          Write-back actions disabled by configuration.
        </div>
      )}

      <ActionButton
        label="Release Batch"
        onClick={() => setActiveAction('release')}
        disabled={disabled || writeBackDisabled || context?.status === 'released' || context?.status === 'rejected'}
        variant="primary"
      />
      <ActionButton
        label="Place on Hold"
        onClick={() => setActiveAction('hold')}
        disabled={disabled || writeBackDisabled || context?.status === 'on-hold'}
        variant="warning"
      />
      <ActionButton
        label="Request Retest"
        onClick={() => setActiveAction('retest')}
        disabled={disabled || writeBackDisabled}
        variant="secondary"
      />
      <ActionButton
        label="Escalate Deviation"
        onClick={() => setActiveAction('escalate-deviation')}
        disabled={disabled || writeBackDisabled}
        variant="secondary-orange"
      />
      <ActionButton
        label="Open Trace Investigation"
        onClick={() => setActiveAction('open-trace')}
        disabled={disabled || writeBackDisabled}
        variant="secondary"
      />

      <div style={{ marginTop: 16, borderTop: '1px solid var(--shell-line)', paddingTop: 16 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>UAT Readiness</h3>
        <ActionButton 
          label={activeAction === 'copy-success' ? 'Copied Evidence!' : activeAction === 'copy-failed' ? 'Copy Failed!' : 'Copy Quality UAT Evidence'} 
          onClick={() => {
            const payload: UATEvidencePayload = {
              domain: 'quality',
              workspace: 'Quality Batch Release',
              capturedAt: new Date().toISOString(),
              adapterMode: import.meta.env.VITE_ADAPTER_MODE || 'mock',
              inputs: {
                batchId: context?.batchId ?? null
              },
              sourceSummary: {
                overall: 'mock',
                sections: {
                  summary: 'mock',
                  results: 'mock',
                  coa: 'mock',
                  deviations: 'mock'
                }
              },
              evidenceCompleteness: {
                status: 'mock-only',
                sections: {
                  summary: 'mock-only',
                  results: 'mock-only',
                  coa: 'mock-only',
                  deviations: 'mock-only'
                }
              },
              warnings: [
                'Quality sandbox mode — simulated data for validation only.',
                'Usage decisions do not write back to SAP QM.'
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

      {/* Action sheets — only one open at a time */}
      {activeAction === 'release' && (
        <ReleaseBatchAction context={context} onClose={() => setActiveAction(null)} />
      )}
      {activeAction === 'hold' && (
        <PlaceOnHoldAction context={context} onClose={() => setActiveAction(null)} />
      )}
      {activeAction === 'retest' && (
        <RequestRetestAction context={context} onClose={() => setActiveAction(null)} />
      )}
      {activeAction === 'escalate-deviation' && (
        <EscalateDeviationAction context={context} onClose={() => setActiveAction(null)} />
      )}
      {activeAction === 'open-trace' && (
        <OpenTraceInvestigationAction context={context} onClose={() => setActiveAction(null)} />
      )}
    </div>
  )
}
