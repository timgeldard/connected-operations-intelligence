import { useState } from 'react'
import {
  Button, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@connectio/design-system'
import type { FeedbackCategory, FeedbackPriority, ReadinessSeverity } from '@connectio/product-model'
import { useFeedbackContext } from './FeedbackContext.js'

interface FeedbackDrawerProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly workspaceId: string
  readonly viewId?: string | null
  readonly panelId?: string | null
  readonly actionId?: string | null
  readonly submittedRole?: string
}

const CATEGORIES: readonly FeedbackCategory[] = [
  'usability', 'data-quality', 'missing-evidence', 'wrong-owner',
  'performance', 'accessibility', 'navigation', 'terminology',
  'training', 'defect', 'enhancement',
]

const SEVERITIES: readonly ReadinessSeverity[] = ['info', 'warning', 'blocker', 'critical']
const PRIORITIES: readonly FeedbackPriority[] = ['low', 'medium', 'high', 'critical']

export function FeedbackDrawer({
  open, onClose, workspaceId, viewId = null, panelId = null, actionId = null, submittedRole = 'unknown',
}: FeedbackDrawerProps) {
  const { submit } = useFeedbackContext()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<FeedbackCategory>('usability')
  const [severity, setSeverity] = useState<ReadinessSeverity>('info')
  const [priority, setPriority] = useState<FeedbackPriority>('medium')
  const [owner, setOwner] = useState('')
  const [targetPhase, setTargetPhase] = useState('Phase 8')

  function handleSubmit() {
    if (!title.trim()) return
    submit({
      title: title.trim(),
      description: description.trim(),
      submittedBy: 'pilot-user',
      submittedRole,
      workspaceId,
      viewId,
      panelId,
      actionId,
      route: window.location.search,
      category,
      severity,
      priority,
      owner: owner.trim() || 'unassigned',
      targetPhase,
      linkedFindingIds: [],
    })
    setTitle('')
    setDescription('')
    setCategory('usability')
    setSeverity('info')
    setPriority('medium')
    setOwner('')
    onClose()
  }

  const inputStyle = {
    width: '100%',
    padding: '6px 10px',
    fontSize: 13,
    border: '1px solid var(--shell-line)',
    borderRadius: 4,
    background: 'var(--shell-bg)',
    color: 'var(--shell-fg)',
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--shell-fg-2)',
    marginBottom: 4,
  }

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent style={{ maxWidth: 520 }}>
        <DialogHeader>
          <DialogTitle>Submit Feedback</DialogTitle>
          <DialogDescription>
            Feedback will be captured against workspace: <Badge variant="outline">{workspaceId}</Badge>
            {viewId && <> · view: <Badge variant="outline">{viewId}</Badge></>}
            {panelId && <> · panel: <Badge variant="outline">{panelId}</Badge></>}
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
          <div>
            <label style={labelStyle}>Title *</label>
            <input
              style={inputStyle}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Short summary of the issue or suggestion"
            />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detailed description, steps to reproduce, or improvement suggestion"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Category</label>
              <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value as FeedbackCategory)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Severity</label>
              <select style={inputStyle} value={severity} onChange={e => setSeverity(e.target.value as ReadinessSeverity)}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select style={inputStyle} value={priority} onChange={e => setPriority(e.target.value as FeedbackPriority)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Owner (optional)</label>
              <input
                style={inputStyle}
                value={owner}
                onChange={e => setOwner(e.target.value)}
                placeholder="e.g. platform-engineering"
              />
            </div>
            <div>
              <label style={labelStyle}>Target Phase</label>
              <input
                style={inputStyle}
                value={targetPhase}
                onChange={e => setTargetPhase(e.target.value)}
                placeholder="e.g. Phase 8"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>Submit Feedback</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
