import { useEffect, useState } from 'react'
import type { IndexedChartPoint } from '../utils/spc-types.js'

export const REASONS = [
  'Special-cause investigation',
  'Sampling / transcription error',
  'Instrument or lab issue',
  'Phase I stabilization',
  'Manual review override',
]

export interface ExclusionDialogState {
  action: 'manual_exclude' | 'manual_restore' | 'clear_exclusions' | 'auto_clean_phase_i'
  point: IndexedChartPoint | null
  excludedCount?: number
}

export interface ExclusionSubmitPayload {
  reason: string
  comment: string
  justification: string
}

interface SPCExclusionsModalProps {
  readonly dialog: ExclusionDialogState | null
  readonly saving: boolean
  readonly onCancel: () => void
  readonly onSubmit: (payload: ExclusionSubmitPayload) => void
}

function resolveContent(action: string) {
  switch (action) {
    case 'manual_restore':
      return {
        heading: 'Restore Point to Calculation Set',
        description: 'Restoring a point changes the active control limits and capability results. Provide an attributable reason before continuing.',
        primaryButtonText: 'Restore',
        danger: false,
        defaultReason: 'Manual review override',
      }
    case 'clear_exclusions':
      return {
        heading: 'Restore All Excluded Points',
        description: 'This will restore every excluded point for the active chart scope. Provide a justification for the audit trail.',
        primaryButtonText: 'Restore All',
        danger: true,
        defaultReason: 'Manual review override',
      }
    case 'auto_clean_phase_i':
      return {
        heading: 'Apply Phase I Auto-clean',
        description: 'This will persist the auto-cleaned exclusion set as the active baseline. Confirm the rationale before applying it.',
        primaryButtonText: 'Apply',
        danger: false,
        defaultReason: 'Phase I stabilization',
      }
    default: // 'manual_exclude'
      return {
        heading: 'Exclude Point from Control Limits',
        description: 'Excluding a point changes the active control limits and capability results. Provide a justification before continuing.',
        primaryButtonText: 'Exclude Point',
        danger: true,
        defaultReason: REASONS[0],
      }
  }
}

export function SPCExclusionsModal({
  dialog,
  saving,
  onCancel,
  onSubmit,
}: SPCExclusionsModalProps) {
  const [reason, setReason] = useState(REASONS[0])
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (!dialog) return
    const { defaultReason } = resolveContent(dialog.action)
    setReason(defaultReason)
    setComment('')
  }, [dialog])

  // ESC key listener
  useEffect(() => {
    if (!dialog) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dialog, onCancel])

  if (!dialog) return null

  const content = resolveContent(dialog.action)
  const targetLabel = dialog.point
    ? `${dialog.point.batch_id ?? 'Point'} · sample ${dialog.point.sample_seq ?? '—'}`
    : `${dialog.excludedCount ?? 0} point${dialog.excludedCount === 1 ? '' : 's'}`

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const justification = comment.trim() ? `${reason} — ${comment.trim()}` : reason
    onSubmit({ reason, comment: comment.trim(), justification })
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'var(--shell-surface, #18181c)',
          border: '1px solid var(--shell-line, #2d2d34)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          padding: '24px',
          color: 'var(--shell-fg, #ffffff)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-heading"
      >
        <h3
          id="modal-heading"
          style={{
            margin: '0 0 8px 0',
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--shell-fg)',
          }}
        >
          {content.heading}
        </h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--shell-fg-2, #a0a0a5)', lineHeight: 1.5 }}>
          {content.description}
        </p>

        {/* Target Info */}
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--shell-surface-2, #212126)',
            borderRadius: 6,
            borderLeft: '3px solid var(--sunset, #F24A00)',
            marginBottom: '16px',
          }}
        >
          <span
            style={{
              display: 'block',
              fontSize: '9px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--shell-fg-3, #75757a)',
              marginBottom: 4,
            }}
          >
            Target Batch Point
          </span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>{targetLabel}</span>
            {dialog.point?.value != null && (
              <span style={{ fontSize: '12px', color: 'var(--sunset, #F24A00)', fontWeight: 600 }}>
                Value: {dialog.point.value.toFixed(4)}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              htmlFor="exclusion-reason"
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                marginBottom: '6px',
                color: 'var(--shell-fg-2)',
              }}
            >
              Reason
            </label>
            <select
              id="exclusion-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={saving}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'var(--shell-surface-2, #212126)',
                border: '1px solid var(--shell-line, #2d2d34)',
                borderRadius: 4,
                color: 'var(--shell-fg)',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              {REASONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="exclusion-comment"
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                marginBottom: '6px',
                color: 'var(--shell-fg-2)',
              }}
            >
              Comment (optional)
            </label>
            <textarea
              id="exclusion-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={saving}
              placeholder="Provide context for the audit trail..."
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'var(--shell-surface-2, #212126)',
                border: '1px solid var(--shell-line, #2d2d34)',
                borderRadius: 4,
                color: 'var(--shell-fg)',
                fontSize: '13px',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Modal Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              style={{
                padding: '8px 14px',
                background: 'transparent',
                border: '1px solid var(--shell-line, #2d2d34)',
                borderRadius: 4,
                color: 'var(--shell-fg-2)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '8px 14px',
                background: content.danger ? 'var(--shell-bad, #C73315)' : 'var(--sunset, #F24A00)',
                border: 'none',
                borderRadius: 4,
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {saving ? 'Processing...' : content.primaryButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
