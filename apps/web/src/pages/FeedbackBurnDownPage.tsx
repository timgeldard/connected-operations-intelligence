import { useState } from 'react'
import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Separator,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import type { PilotIssue, PilotIssueCategory, PilotIssueStatus } from '@connectio/product-model'
import { deriveBurnDownSummary, isIssueOpen, pilotExitBlockingIssues, productionBlockingIssues } from '@connectio/product-model'

const ALL_ISSUES: readonly PilotIssue[] = [
  {
    issueId: 'ISS-001', title: 'CoA generation API not wired', description: 'Certificate of Analysis panel shows placeholder — source API not integrated.', category: 'source-integration', severity: 'critical', priority: 'critical', status: 'triaged', owner: 'integration-team', workspaceId: 'quality-batch-release', viewId: 'release-decision', panelId: 'coa-panel', actionId: null, source: 'EXE-001', createdAt: '2026-05-14', updatedAt: '2026-05-14', dueAt: '2026-06-30', linkedFeedbackIds: [], linkedScenarioIds: ['SCN-001'], linkedReadinessFindingIds: [], blocksPilotExit: false, blocksProduction: true, resolutionSummary: '',
  },
  {
    issueId: 'ISS-002', title: 'SPC signal filter latency >3s', description: 'SPCSignalsPanel cross-domain load time exceeds 3s on batch scope context.', category: 'performance', severity: 'warning', priority: 'high', status: 'in-progress', owner: 'spc-team', workspaceId: 'quality-batch-release', viewId: 'quality-evidence', panelId: 'spc-signals-panel', actionId: null, source: 'EXE-001', createdAt: '2026-05-14', updatedAt: '2026-05-15', dueAt: '2026-06-15', linkedFeedbackIds: ['FB-SEED-001'], linkedScenarioIds: ['SCN-001'], linkedReadinessFindingIds: [], blocksPilotExit: false, blocksProduction: false, resolutionSummary: '',
  },
  {
    issueId: 'ISS-003', title: 'EventTimelinePanel timestamps are mock', description: 'Trace event timestamps sourced from mock data — not connected to real ERP event log.', category: 'data-quality', severity: 'warning', priority: 'high', status: 'triaged', owner: 'data-team', workspaceId: 'trace-investigation', viewId: 'timeline-view', panelId: 'event-timeline-panel', actionId: null, source: 'EXE-002', createdAt: '2026-05-12', updatedAt: '2026-05-13', dueAt: '2026-07-01', linkedFeedbackIds: [], linkedScenarioIds: ['SCN-002'], linkedReadinessFindingIds: [], blocksPilotExit: false, blocksProduction: true, resolutionSummary: '',
  },
  {
    issueId: 'ISS-004', title: 'Action audit log not persisted between sessions', description: 'Escalation actions submitted in Operations Plan Risk do not persist across browser reload.', category: 'workflow-gap', severity: 'blocker', priority: 'critical', status: 'in-progress', owner: 'operations-team', workspaceId: 'operations-plan-risk', viewId: 'risk-actions', panelId: null, actionId: 'escalate-risk', source: 'EXE-003', createdAt: '2026-05-13', updatedAt: '2026-05-15', dueAt: '2026-05-30', linkedFeedbackIds: ['FB-SEED-002'], linkedScenarioIds: ['SCN-003'], linkedReadinessFindingIds: [], blocksPilotExit: true, blocksProduction: true, resolutionSummary: '',
  },
  {
    issueId: 'ISS-005', title: 'PhaseManager data not available', description: 'MaterialShortagePanel relies on PhaseManager integration which is not yet available in pilot environment.', category: 'source-integration', severity: 'warning', priority: 'high', status: 'waiting-on-owner', owner: 'integration-team', workspaceId: 'operations-plan-risk', viewId: 'material-risk', panelId: 'material-shortage-panel', actionId: null, source: 'EXE-003', createdAt: '2026-05-13', updatedAt: '2026-05-14', dueAt: '2026-06-30', linkedFeedbackIds: [], linkedScenarioIds: ['SCN-003'], linkedReadinessFindingIds: [], blocksPilotExit: false, blocksProduction: true, resolutionSummary: '',
  },
  {
    issueId: 'ISS-006', title: 'Accessibility: missing focus ring on action buttons', description: 'Action confirmation buttons in Batch Release and Operations Plan Risk fail WCAG 2.1 AA focus-visible requirement.', category: 'accessibility', severity: 'critical', priority: 'critical', status: 'new', owner: 'ux-team', workspaceId: 'quality-batch-release', viewId: null, panelId: null, actionId: null, source: 'FB-SEED-003', createdAt: '2026-05-15', updatedAt: '2026-05-15', dueAt: '2026-05-30', linkedFeedbackIds: ['FB-SEED-003'], linkedScenarioIds: [], linkedReadinessFindingIds: [], blocksPilotExit: true, blocksProduction: true, resolutionSummary: '',
  },
  {
    issueId: 'ISS-007', title: 'SAP PM integration contract not signed', description: 'Maintenance Reliability workspace cannot be piloted until SAP PM source contract is finalised.', category: 'governance', severity: 'blocker', priority: 'critical', status: 'waiting-on-owner', owner: 'procurement-team', workspaceId: 'maintenance-reliability', viewId: null, panelId: null, actionId: null, source: 'scoping', createdAt: '2026-05-01', updatedAt: '2026-05-15', dueAt: '2026-06-01', linkedFeedbackIds: [], linkedScenarioIds: [], linkedReadinessFindingIds: [], blocksPilotExit: false, blocksProduction: true, resolutionSummary: '',
  },
  {
    issueId: 'ISS-008', title: 'SPC connector not available in pilot environment', description: 'SPC Monitoring workspace uses simulated SPC data. Real SPC connector not deployed to IE10.', category: 'source-integration', severity: 'warning', priority: 'high', status: 'resolved', owner: 'spc-team', workspaceId: 'spc-monitoring', viewId: null, panelId: null, actionId: null, source: 'scoping', createdAt: '2026-05-01', updatedAt: '2026-05-12', dueAt: '2026-06-15', linkedFeedbackIds: [], linkedScenarioIds: ['SCN-005'], linkedReadinessFindingIds: [], blocksPilotExit: false, blocksProduction: false, resolutionSummary: 'Accepted as known mock-only gap for pilot phase. Production target set for Wave 2.',
  },
  {
    issueId: 'ISS-009', title: 'RoleAwareHome pilot banner not localised', description: 'Pilot banner content appears in English regardless of user locale setting.', category: 'ux', severity: 'info', priority: 'low', status: 'deferred', owner: 'ux-team', workspaceId: 'home', viewId: null, panelId: null, actionId: null, source: 'internal', createdAt: '2026-05-10', updatedAt: '2026-05-12', dueAt: null, linkedFeedbackIds: [], linkedScenarioIds: [], linkedReadinessFindingIds: [], blocksPilotExit: false, blocksProduction: false, resolutionSummary: 'Deferred to post-pilot. English-only acceptable for IE10 pilot cohort.',
  },
  {
    issueId: 'ISS-010', title: 'Warehouse 360 staging confirmation missing email notification', description: 'Confirm Staging action completes but sends no email confirmation to logistics team.', category: 'workflow-gap', severity: 'info', priority: 'medium', status: 'triaged', owner: 'warehouse-team', workspaceId: 'warehouse-360-overview', viewId: 'staging', panelId: null, actionId: 'confirm-staging', source: 'EXE-004', createdAt: '2026-05-14', updatedAt: '2026-05-15', dueAt: '2026-07-01', linkedFeedbackIds: [], linkedScenarioIds: ['SCN-004'], linkedReadinessFindingIds: [], blocksPilotExit: false, blocksProduction: false, resolutionSummary: '',
  },
]

const CATEGORY_LABELS: Record<PilotIssueCategory, string> = {
  'ux': 'UX', 'data-quality': 'Data Quality', 'access': 'Access', 'performance': 'Performance',
  'accessibility': 'Accessibility', 'source-integration': 'Source Integration', 'missing-evidence': 'Missing Evidence',
  'workflow-gap': 'Workflow Gap', 'defect': 'Defect', 'training': 'Training', 'support': 'Support',
  'governance': 'Governance', 'cutover': 'Cutover',
}

function statusVariant(status: PilotIssueStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'resolved' || status === 'closed' || status === 'accepted-risk') return 'default'
  if (status === 'in-progress' || status === 'triaged') return 'secondary'
  if (status === 'new' || status === 'waiting-on-owner') return 'outline'
  if (status === 'blocked') return 'destructive'
  return 'outline'
}

function severityColor(severity: string): string {
  if (severity === 'blocker' || severity === 'critical') return '#DC2626'
  if (severity === 'warning') return '#D97706'
  if (severity === 'minor') return '#6B7280'
  return '#6B7280'
}

type IssueFilter = 'all' | 'open' | 'blockers' | 'resolved'

export function FeedbackBurnDownPage() {
  const [filter, setFilter] = useState<IssueFilter>('all')

  const burnDown = deriveBurnDownSummary(ALL_ISSUES)
  const pilotBlockers = pilotExitBlockingIssues(ALL_ISSUES)
  const prodBlockers = productionBlockingIssues(ALL_ISSUES)

  const filtered = ALL_ISSUES.filter(issue => {
    if (filter === 'open') return isIssueOpen(issue.status)
    if (filter === 'blockers') return issue.blocksPilotExit || issue.blocksProduction
    if (filter === 'resolved') return !isIssueOpen(issue.status)
    return true
  })

  const trendColor = burnDown.trend === 'improving' ? '#16A34A' : burnDown.trend === 'stable' ? '#D97706' : '#DC2626'

  return (
    <div data-testid="feedback-burndown" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Feedback Burn-Down</h1>
          <Badge variant="outline">Phase 8</Badge>
          <Badge variant={burnDown.trend === 'improving' ? 'default' : 'destructive'} style={{ background: trendColor }}>
            {burnDown.trend}
          </Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>{burnDown.recommendation}</p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Total Issues', value: burnDown.totalIssues },
          { label: 'Open', value: burnDown.openIssues },
          { label: 'Resolved', value: burnDown.resolvedIssues },
          { label: 'Blockers', value: burnDown.blockers, danger: burnDown.blockers > 0 },
          { label: 'Pilot Exit Blockers', value: pilotBlockers.length, danger: pilotBlockers.length > 0 },
          { label: 'Prod Blockers', value: prodBlockers.length, danger: prodBlockers.length > 0 },
        ].map(({ label, value, danger }) => (
          <Card key={label} style={{ flex: '1 1 120px', minWidth: 100, border: danger ? '1px solid #DC2626' : undefined }}>
            <CardContent style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: danger ? '#DC2626' : 'var(--shell-fg)' }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        <Card style={{ flex: '1 1 300px' }}>
          <CardHeader style={{ paddingBottom: 6 }}>
            <CardTitle style={{ fontSize: 14 }}>Issues by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {(Object.entries(burnDown.issuesByCategory) as [PilotIssueCategory, number][]).map(([cat, count]) => (
              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 4 }}>
                <span>{CATEGORY_LABELS[cat] ?? cat}</span>
                <span style={{ fontWeight: 600 }}>{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card style={{ flex: '1 1 300px' }}>
          <CardHeader style={{ paddingBottom: 6 }}>
            <CardTitle style={{ fontSize: 14 }}>Issues by Workspace</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(burnDown.issuesByWorkspace).map(([ws, count]) => (
              <div key={ws} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 4 }}>
                <span>{ws}</span>
                <span style={{ fontWeight: 600 }}>{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card style={{ flex: '1 1 300px' }}>
          <CardHeader style={{ paddingBottom: 6 }}>
            <CardTitle style={{ fontSize: 14 }}>Issues by Owner</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(burnDown.issuesByOwner).map(([owner, count]) => (
              <div key={owner} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 4 }}>
                <span>{owner}</span>
                <span style={{ fontWeight: 600 }}>{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Tabs value={filter} onValueChange={v => setFilter(v as IssueFilter)}>
        <TabsList style={{ marginBottom: 16 }}>
          <TabsTrigger value="all">All ({ALL_ISSUES.length})</TabsTrigger>
          <TabsTrigger value="open">Open ({burnDown.openIssues})</TabsTrigger>
          <TabsTrigger value="blockers">Blockers ({pilotBlockers.length + prodBlockers.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({burnDown.resolvedIssues})</TabsTrigger>
        </TabsList>
        <TabsContent value={filter}>
          {filtered.map(issue => (
            <Card key={issue.issueId} data-testid={`issue-${issue.issueId}`} style={{ marginBottom: 12 }}>
              <CardHeader style={{ paddingBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <CardTitle style={{ fontSize: 14 }}>{issue.title}</CardTitle>
                  <Badge variant={statusVariant(issue.status)}>{issue.status.replace(/-/g, ' ')}</Badge>
                  <span style={{ fontSize: 11, fontWeight: 600, color: severityColor(issue.severity) }}>{issue.severity}</span>
                  {issue.blocksPilotExit && <Badge variant="destructive">pilot exit blocker</Badge>}
                  {issue.blocksProduction && <Badge variant="destructive">prod blocker</Badge>}
                </div>
                <CardDescription>
                  {issue.issueId} · {CATEGORY_LABELS[issue.category]} · owner: {issue.owner}
                  {issue.dueAt ? ` · due: ${issue.dueAt}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--shell-fg-2)' }}>{issue.description}</p>
                {issue.resolutionSummary && (
                  <>
                    <Separator style={{ marginBottom: 8 }} />
                    <p style={{ margin: 0, fontSize: 12, color: '#16A34A', fontStyle: 'italic' }}>Resolution: {issue.resolutionSummary}</p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p style={{ color: 'var(--shell-fg-3)', fontSize: 13 }}>No issues match this filter.</p>}
        </TabsContent>
      </Tabs>
    </div>
  )
}
