import { useState } from 'react'
import { NewInvestigationAction } from './new-investigation-action.js'
import { AddEvidenceAction } from './add-evidence-action.js'
import { EscalateInvestigationAction } from './escalate-investigation-action.js'
import { ResolveInvestigationAction } from './resolve-investigation-action.js'
import type { TraceInvestigationContext } from '@connectio/data-contracts'

/** Which action sheet (if any) is currently open. */
type ActiveAction = 'new-investigation' | 'add-evidence' | 'escalate' | 'resolve' | null

/** Props for TraceActionsPanel. */
export interface TraceActionsPanelProps {
  /** Current investigation context; null while loading. */
  readonly context: TraceInvestigationContext | null
}

/**
 * Right-rail action panel for Trace Investigation workspace.
 *
 * @remarks
 * Renders four primary action buttons. Each button opens a modal/sheet
 * form for the corresponding action flow. Only one action sheet can be
 * open at a time. Action buttons are disabled while context is loading.
 *
 * No real backend mutation is performed in Phase 1 — mock submit handlers
 * emit console telemetry only.
 */
export function TraceActionsPanel({ context }: TraceActionsPanelProps) {
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const disabled = context === null

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
      aria-label="Investigation actions"
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

      <ActionButton
        label="New Investigation"
        onClick={() => setActiveAction('new-investigation')}
        disabled={disabled}
        variant="primary"
      />
      <ActionButton
        label="Add Evidence"
        onClick={() => setActiveAction('add-evidence')}
        disabled={disabled}
        variant="secondary"
      />
      <ActionButton
        label="Escalate"
        onClick={() => setActiveAction('escalate')}
        disabled={disabled}
        variant="warning"
      />
      <ActionButton
        label="Resolve"
        onClick={() => setActiveAction('resolve')}
        disabled={disabled || context?.status === 'resolved' || context?.status === 'closed'}
        variant="secondary"
      />

      {/* Action sheets — only one open at a time */}
      {activeAction === 'new-investigation' && (
        <NewInvestigationAction
          context={context}
          onClose={() => setActiveAction(null)}
        />
      )}
      {activeAction === 'add-evidence' && (
        <AddEvidenceAction
          context={context}
          onClose={() => setActiveAction(null)}
        />
      )}
      {activeAction === 'escalate' && (
        <EscalateInvestigationAction
          context={context}
          onClose={() => setActiveAction(null)}
        />
      )}
      {activeAction === 'resolve' && (
        <ResolveInvestigationAction
          context={context}
          onClose={() => setActiveAction(null)}
        />
      )}
    </div>
  )
}

/** Visual variant for the action button. */
type ActionButtonVariant = 'primary' | 'secondary' | 'warning'

/** Single action button in the rail. */
function ActionButton({
  label,
  onClick,
  disabled,
  variant,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  variant: ActionButtonVariant
}) {
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
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
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
      aria-label={label}
    >
      {label}
    </button>
  )
}
