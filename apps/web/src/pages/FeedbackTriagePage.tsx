import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@connectio/design-system'
import type { FeedbackCategory, FeedbackStatus, FeedbackPriority } from '@connectio/product-model'
import { useFeedbackContext } from '../feedback/FeedbackContext.js'

type FilterStatus = 'all' | FeedbackStatus
type FilterCategory = 'all' | FeedbackCategory

const STATUSES: readonly FeedbackStatus[] = [
  'new',
  'triaged',
  'accepted',
  'rejected',
  'in-progress',
  'resolved',
  'deferred',
  'blocked',
]

function statusVariant(
  status: FeedbackStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'resolved') return 'default'
  if (status === 'accepted' || status === 'in-progress') return 'secondary'
  if (status === 'rejected' || status === 'blocked') return 'destructive'
  return 'outline'
}

function priorityColor(priority: FeedbackPriority): string {
  if (priority === 'critical') return '#DC2626'
  if (priority === 'high') return '#D97706'
  if (priority === 'medium') return '#CA8A04'
  return 'var(--shell-fg-3)'
}

const SEED_FEEDBACK = [
  {
    feedbackId: 'FB-SEED-001',
    title: 'CoA panel shows placeholder text instead of real data',
    description:
      'When viewing a batch in Batch Release workspace, the CoA Readiness panel shows mock placeholder content.',
    submittedBy: 'Siobhan Walsh',
    submittedRole: 'quality-lead',
    workspaceId: 'quality-batch-release',
    viewId: 'batch-decision',
    panelId: 'CoAReadinessPanel',
    actionId: null,
    route: '?workspace=quality-batch-release&view=batch-decision',
    category: 'data-quality' as FeedbackCategory,
    severity: 'warning' as const,
    priority: 'high' as FeedbackPriority,
    status: 'triaged' as FeedbackStatus,
    owner: 'quality-domain',
    createdAt: '2026-05-10T09:15:00Z',
    updatedAt: '2026-05-11T14:00:00Z',
    targetPhase: 'Phase 8',
    linkedFindingIds: ['FND-PRD-001'],
  },
  {
    feedbackId: 'FB-SEED-002',
    title: 'Trace graph rendering is slow on large batches',
    description:
      'Trace graph panel takes 8-10 seconds to render when trace depth exceeds 3 levels.',
    submittedBy: 'Declan Horgan',
    submittedRole: 'food-safety-lead',
    workspaceId: 'trace-investigation',
    viewId: 'trace-tree',
    panelId: 'TraceGraphPanel',
    actionId: null,
    route: '?workspace=trace-investigation&view=trace-tree',
    category: 'performance' as FeedbackCategory,
    severity: 'warning' as const,
    priority: 'medium' as FeedbackPriority,
    status: 'accepted' as FeedbackStatus,
    owner: 'platform-engineering',
    createdAt: '2026-05-12T11:00:00Z',
    updatedAt: '2026-05-13T10:00:00Z',
    targetPhase: 'Phase 8',
    linkedFindingIds: [],
  },
  {
    feedbackId: 'FB-SEED-003',
    title: 'Missing keyboard navigation in operations plan risk filters',
    description:
      'The date filter and risk status filter buttons in Operations Plan Risk cannot be operated with keyboard alone.',
    submittedBy: 'Aoife Murphy',
    submittedRole: 'operations-supervisor',
    workspaceId: 'operations-plan-risk',
    viewId: 'plan-overview',
    panelId: null,
    actionId: null,
    route: '?workspace=operations-plan-risk',
    category: 'accessibility' as FeedbackCategory,
    severity: 'blocker' as const,
    priority: 'high' as FeedbackPriority,
    status: 'new' as FeedbackStatus,
    owner: 'platform-engineering',
    createdAt: '2026-05-14T08:30:00Z',
    updatedAt: '2026-05-14T08:30:00Z',
    targetPhase: 'Phase 7',
    linkedFindingIds: [],
  },
]

export function FeedbackTriagePage() {
  const { items: contextItems, updateStatus } = useFeedbackContext()
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterCategory] = useState<FilterCategory>('all')

  const allItems = [...SEED_FEEDBACK, ...contextItems]

  const filtered = allItems.filter((item) => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false
    if (filterCategory !== 'all' && item.category !== filterCategory) return false
    return true
  })

  const byStatus = Object.fromEntries(
    STATUSES.map((s) => [s, allItems.filter((i) => i.status === s).length]),
  ) as Record<FeedbackStatus, number>

  return (
    <div data-testid="feedback-triage" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>
            Feedback Triage
          </h1>
          <Badge variant="outline">Phase 7</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Review and triage pilot feedback. Update status, assign owners, and link to readiness
          findings.
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {STATUSES.map((s) => (
          <Card key={s} style={{ flex: '1 1 100px', minWidth: 90 }}>
            <CardContent style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--shell-fg)' }}>
                {byStatus[s] ?? 0}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--shell-fg-3)',
                  marginTop: 2,
                  textTransform: 'uppercase',
                }}
              >
                {s}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <span
            style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', marginRight: 6 }}
          >
            Status:
          </span>
          {(['all', ...STATUSES] as const).map((s) => (
            <Button
              key={s}
              variant={filterStatus === s ? 'default' : 'outline'}
              style={{
                marginRight: 4,
                marginBottom: 4,
                fontSize: 11,
                padding: '2px 8px',
                height: 26,
              }}
              onClick={() => setFilterStatus(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: 'var(--shell-fg-3)', fontSize: 13 }}>
          No feedback items match this filter.
        </p>
      ) : (
        filtered.map((item) => (
          <Card
            key={item.feedbackId}
            data-testid={`feedback-${item.feedbackId}`}
            style={{ marginBottom: 12 }}
          >
            <CardHeader style={{ paddingBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <CardTitle style={{ fontSize: 14 }}>{item.title}</CardTitle>
                <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                <Badge variant="outline" style={{ fontSize: 10 }}>
                  {item.category}
                </Badge>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: priorityColor(item.priority),
                    textTransform: 'uppercase',
                  }}
                >
                  {item.priority}
                </span>
              </div>
              <CardDescription>
                {item.feedbackId} · {item.workspaceId}
                {item.viewId ? ` / ${item.viewId}` : ''}
                {item.panelId ? ` / ${item.panelId}` : ''} · {item.submittedRole} · owner:{' '}
                {item.owner}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--shell-fg-2)' }}>
                {item.description}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Update status:</span>
                {STATUSES.map((s) => (
                  <Button
                    key={s}
                    variant={item.status === s ? 'default' : 'outline'}
                    style={{ fontSize: 10, padding: '1px 6px', height: 22 }}
                    onClick={() => {
                      if (!item.feedbackId.startsWith('FB-SEED-')) {
                        updateStatus(item.feedbackId, s)
                      }
                    }}
                    disabled={item.feedbackId.startsWith('FB-SEED-')}
                    title={
                      item.feedbackId.startsWith('FB-SEED-')
                        ? 'Seed items are read-only'
                        : undefined
                    }
                  >
                    {s}
                  </Button>
                ))}
              </div>
              {item.linkedFindingIds.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--shell-fg-3)' }}>
                  Linked findings: {item.linkedFindingIds.join(', ')}
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--shell-fg-3)' }}>
                Created: {item.createdAt.slice(0, 10)} · Target: {item.targetPhase}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
