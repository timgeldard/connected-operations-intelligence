import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Separator,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import type { PilotSuccessMetric, PilotSuccessMetricStatus } from '@connectio/product-model'
import { aggregateMetricStatus } from '@connectio/product-model'

const SUCCESS_METRICS: readonly PilotSuccessMetric[] = [
  {
    metricId: 'PSM-001', title: 'Scenario pass rate', description: 'Percentage of pilot scenarios that pass or pass-with-observations.', target: '≥80%', actual: '66%', unit: '%', status: 'missed', source: 'ScenarioExecutionTracking', owner: 'pilot-lead', recommendation: 'Complete SCN-005 and SCN-006. Current rate 66% — 2 remaining scenarios must pass to reach target.',
  },
  {
    metricId: 'PSM-002', title: 'Stakeholder sign-off completion', description: 'Number of domain stakeholder sign-offs approved of 8 required.', target: '8 of 8', actual: '0 of 8', unit: 'sign-offs', status: 'missed', source: 'StakeholderSignoffPage', owner: 'programme-manager', recommendation: 'Initiate sign-off process immediately after scenario completion. No sign-offs currently approved.',
  },
  {
    metricId: 'PSM-003', title: 'Release gate pass rate', description: 'Percentage of release gates that have passed their readiness check.', target: '≥90%', actual: '50%', unit: '%', status: 'missed', source: 'ReleaseGatePage', owner: 'programme-manager', recommendation: 'Gates GATE-006 through GATE-010 require active work — source integrations and sign-offs must progress.',
  },
  {
    metricId: 'PSM-004', title: 'Pilot exit criteria met', description: 'Number of PilotExitCriteria items marked as met.', target: '12 of 12', actual: '5 of 12', unit: 'criteria', status: 'missed', source: 'PilotExitCriteriaPage', owner: 'pilot-lead', recommendation: 'PEC-006 through PEC-012 require scenario completion, sign-offs, and remediation to progress.',
  },
  {
    metricId: 'PSM-005', title: 'Open production blockers', description: 'Number of open issues that block production cutover.', target: '0', actual: '5', unit: 'issues', status: 'missed', source: 'PilotIssueRegisterPage', owner: 'pilot-lead', recommendation: 'ISS-001, ISS-003, ISS-004, ISS-005, ISS-006 are open production blockers. Target zero before cutover.',
  },
  {
    metricId: 'PSM-006', title: 'Feedback triage completion', description: 'Percentage of submitted feedback items that have been triaged and actioned.', target: '≥90%', actual: '75%', unit: '%', status: 'met-with-warning', source: 'FeedbackTriagePage', owner: 'programme-manager', recommendation: 'FB-SEED-003 (accessibility critical) requires immediate triage before this metric can be marked met.',
  },
  {
    metricId: 'PSM-007', title: 'Data integration readiness', description: 'Number of data sources confirmed as ready for pilot use.', target: '≥8 of 10', actual: '4 of 10', unit: 'sources', status: 'missed', source: 'DataIntegrationReadinessPage', owner: 'data-team', recommendation: 'SPC connector, SAP PM, WM integration, and ERP event log require work before target is reachable.',
  },
  {
    metricId: 'PSM-008', title: 'Training readiness', description: 'Percentage of pilot users who have completed required training.', target: '≥90%', actual: '72%', unit: '%', status: 'met-with-warning', source: 'TrainingReadinessPage', owner: 'l-and-d-lead', recommendation: 'Plant Manager role (SCN-006 dependent) and Warehouse Manager role need completion before target.',
  },
  {
    metricId: 'PSM-009', title: 'Security access review completion', description: 'Number of security access review items confirmed as compliant.', target: '17 of 17', actual: '15 of 17', unit: 'items', status: 'met-with-warning', source: 'SecurityAccessReviewPage', owner: 'security-lead', recommendation: 'SAP PM access and SCN-006 plant manager cross-workspace access items remain open.',
  },
  {
    metricId: 'PSM-010', title: 'Workspace adoption score', description: 'Percentage of pilot users who have actively used the V2 workspaces in scope.', target: '≥80%', actual: '82%', unit: '%', status: 'met', source: 'WorkspaceAdoptionPage', owner: 'pilot-lead', recommendation: 'On track. Monitor drop-off after SCN-006 execution is scheduled.',
  },
]

function statusVariant(status: PilotSuccessMetricStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'met') return 'default'
  if (status === 'met-with-warning') return 'secondary'
  if (status === 'missed' || status === 'blocked') return 'destructive'
  return 'outline'
}

function statusLabel(status: PilotSuccessMetricStatus): string {
  const labels: Record<PilotSuccessMetricStatus, string> = {
    'met': 'Met',
    'met-with-warning': 'Met — With Warning',
    'missed': 'Missed',
    'blocked': 'Blocked',
    'not-measured': 'Not Measured',
  }
  return labels[status]
}

export function PilotSuccessMetricsPage() {
  const overall = aggregateMetricStatus(SUCCESS_METRICS)
  const metCount = SUCCESS_METRICS.filter(m => m.status === 'met').length
  const metWithWarningCount = SUCCESS_METRICS.filter(m => m.status === 'met-with-warning').length
  const missedCount = SUCCESS_METRICS.filter(m => m.status === 'missed').length

  return (
    <div data-testid="pilot-success-metrics" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Pilot Success Metrics</h1>
          <Badge variant="outline">Phase 8</Badge>
          <Badge variant={statusVariant(overall)}>Overall: {statusLabel(overall)}</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          10 success metrics defined for this pilot. {metCount} met, {metWithWarningCount} met with warning, {missedCount} missed.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: 'Total', value: SUCCESS_METRICS.length },
          { label: 'Met', value: metCount },
          { label: 'Met w/ Warning', value: metWithWarningCount },
          { label: 'Missed', value: missedCount, danger: missedCount > 0 },
        ].map(({ label, value, danger }) => (
          <Card key={label} style={{ flex: '1 1 120px', minWidth: 100, border: danger ? '1px solid #DC2626' : undefined }}>
            <CardContent style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: danger ? '#DC2626' : 'var(--shell-fg)' }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {SUCCESS_METRICS.map(metric => (
        <Card key={metric.metricId} data-testid={`metric-${metric.metricId}`} style={{ marginBottom: 14 }}>
          <CardHeader style={{ paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <CardTitle style={{ fontSize: 14 }}>{metric.title}</CardTitle>
              <Badge variant={statusVariant(metric.status)}>{statusLabel(metric.status)}</Badge>
            </div>
            <CardDescription>
              {metric.metricId} · Target: {metric.target} · Actual: {metric.actual} {metric.unit} · Source: {metric.source}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--shell-fg-2)' }}>{metric.description}</p>
            <Separator style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 11, color: '#D97706', fontStyle: 'italic' }}>Recommendation: {metric.recommendation}</div>
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 4 }}>Owner: {metric.owner}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
