import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Separator,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import type { PilotExecutionStatus } from '@connectio/product-model'

interface PilotSummary {
  readonly pilotName: string
  readonly status: PilotExecutionStatus
  readonly startDate: string
  readonly targetEndDate: string
  readonly pilotScope: string
  readonly pilotRoles: readonly string[]
  readonly pilotWorkspaces: readonly string[]
  readonly pilotPlants: readonly string[]
  readonly activeBlockers: readonly string[]
  readonly recommendation: string
}

interface ScenarioSummary {
  readonly planned: number
  readonly executed: number
  readonly passed: number
  readonly passedWithObservations: number
  readonly failed: number
  readonly blocked: number
  readonly deferred: number
}

interface FeedbackIssueSummary {
  readonly feedbackSubmitted: number
  readonly issuesCreated: number
  readonly openIssues: number
  readonly resolvedIssues: number
  readonly criticalBlockers: number
  readonly productionBlockers: number
}

interface ReadinessSummary {
  readonly releaseGatesPassed: number
  readonly releaseGatesTotal: number
  readonly exitCriteriaMet: number
  readonly exitCriteriaTotal: number
  readonly signoffsApproved: number
  readonly signoffsTotal: number
  readonly dataIntegrationReady: number
  readonly dataIntegrationTotal: number
}

interface CutoverPreview {
  readonly recommendation: 'go' | 'go-with-conditions' | 'no-go' | 'defer' | 'blocked'
  readonly conditions: readonly string[]
  readonly blockers: readonly string[]
  readonly nextActions: readonly string[]
}

const PILOT_SUMMARY: PilotSummary = {
  pilotName: 'ConnectIO-RAD V2 — Kerry Listowel Controlled Pilot',
  status: 'active',
  startDate: '2026-05-15',
  targetEndDate: '2026-08-31',
  pilotScope: 'Kerry Listowel (IE10) — single plant controlled pilot',
  pilotRoles: ['quality-lead', 'qa-technician', 'food-safety-lead', 'operations-supervisor', 'warehouse-manager', 'plant-manager'],
  pilotWorkspaces: ['trace-investigation', 'quality-batch-release', 'operations-plan-risk', 'envmon-monitoring', 'production-staging', 'spc-monitoring', 'process-order-review', 'warehouse-360-overview', 'maintenance-reliability'],
  pilotPlants: ['IE10 — Kerry Listowel'],
  activeBlockers: [
    'SCN-001 (Batch Release cross-domain scenario) in-progress — not yet passed',
    'SCN-003 (Operations Plan Risk) in-progress — not yet passed',
    'SCN-006 (Plant Manager cross-domain) not started',
    'Stakeholder sign-off not yet approved for any domain',
    'SPC source connector not available',
    'SAP PM integration not started',
  ],
  recommendation: 'Pilot is active. 2 of 6 scenarios passed. Continue execution and track blockers to closure before pilot exit assessment.',
}

const SCENARIO_SUMMARY: ScenarioSummary = {
  planned: 6,
  executed: 4,
  passed: 1,
  passedWithObservations: 1,
  failed: 0,
  blocked: 0,
  deferred: 0,
}

const FEEDBACK_ISSUE_SUMMARY: FeedbackIssueSummary = {
  feedbackSubmitted: 3,
  issuesCreated: 7,
  openIssues: 5,
  resolvedIssues: 2,
  criticalBlockers: 1,
  productionBlockers: 4,
}

const READINESS_SUMMARY: ReadinessSummary = {
  releaseGatesPassed: 5,
  releaseGatesTotal: 10,
  exitCriteriaMet: 5,
  exitCriteriaTotal: 12,
  signoffsApproved: 0,
  signoffsTotal: 8,
  dataIntegrationReady: 4,
  dataIntegrationTotal: 10,
}

const CUTOVER_PREVIEW: CutoverPreview = {
  recommendation: 'no-go',
  conditions: [
    'SPC and WM source connectors must be confirmed before Wave 2',
    'Accessibility blockers must be remediated or formally accepted',
    'CoA generation API must be wired before production',
  ],
  blockers: [
    '0 of 8 domain stakeholder sign-offs approved',
    'Scenario pass rate 33% (target ≥80%)',
    'Critical accessibility blocker untriaged (FB-SEED-003)',
    'SAP PM source contract not signed',
  ],
  nextActions: [
    'Complete SCN-001, SCN-003, SCN-005, SCN-006 scenario validation',
    'Initiate stakeholder sign-off process after scenario validation',
    'Triage FB-SEED-003 and assign accessibility remediation owner',
    'Confirm SAP PM integration scope and timeline',
  ],
}

function statusVariant(status: PilotExecutionStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') return 'default'
  if (status === 'completed' || status === 'completed-with-conditions') return 'default'
  if (status === 'blocked' || status === 'cancelled') return 'destructive'
  if (status === 'paused') return 'secondary'
  return 'outline'
}

function goNoGoVariant(rec: CutoverPreview['recommendation']): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (rec === 'go') return 'default'
  if (rec === 'go-with-conditions') return 'secondary'
  if (rec === 'no-go') return 'destructive'
  if (rec === 'blocked') return 'destructive'
  return 'outline'
}

function ReadinessMeter({ label, met, total }: { label: string; met: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((met / total) * 100)
  const color = pct >= 80 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626'
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span style={{ color: 'var(--shell-fg)' }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{met}/{total}</span>
      </div>
      <div style={{ height: 6, background: 'var(--shell-line)', borderRadius: 3 }}>
        <div style={{ height: 6, borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

export function PilotExecutionDashboardPage() {
  return (
    <div data-testid="pilot-execution-dashboard" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Pilot Execution Dashboard</h1>
          <Badge variant={statusVariant(PILOT_SUMMARY.status)}>{PILOT_SUMMARY.status.replace(/-/g, ' ')}</Badge>
          <Badge variant="outline">Phase 8</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>{PILOT_SUMMARY.pilotName}</p>
      </div>

      {/* Row 1: Pilot Status + Cutover Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <CardHeader style={{ paddingBottom: 8 }}><CardTitle>Pilot Status</CardTitle><CardDescription>{PILOT_SUMMARY.startDate} → {PILOT_SUMMARY.targetEndDate}</CardDescription></CardHeader>
          <CardContent>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Scope</div>
              <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{PILOT_SUMMARY.pilotScope}</div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Pilot Roles</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {PILOT_SUMMARY.pilotRoles.map(r => <Badge key={r} variant="outline" style={{ fontSize: 10 }}>{r}</Badge>)}
              </div>
            </div>
            {PILOT_SUMMARY.activeBlockers.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Active Blockers ({PILOT_SUMMARY.activeBlockers.length})</div>
                <ul style={{ margin: 0, paddingLeft: 14 }}>
                  {PILOT_SUMMARY.activeBlockers.slice(0, 3).map((b, i) => <li key={i} style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginBottom: 2 }}>{b}</li>)}
                  {PILOT_SUMMARY.activeBlockers.length > 3 && <li style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>+{PILOT_SUMMARY.activeBlockers.length - 3} more</li>}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader style={{ paddingBottom: 8 }}><CardTitle>Cutover Recommendation</CardTitle><CardDescription>Based on current pilot evidence</CardDescription></CardHeader>
          <CardContent>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Badge variant={goNoGoVariant(CUTOVER_PREVIEW.recommendation)} style={{ fontSize: 14, padding: '4px 12px' }}>
                {CUTOVER_PREVIEW.recommendation.replace(/-/g, ' ').toUpperCase()}
              </Badge>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Blockers ({CUTOVER_PREVIEW.blockers.length})</div>
              <ul style={{ margin: 0, paddingLeft: 14 }}>
                {CUTOVER_PREVIEW.blockers.slice(0, 3).map((b, i) => <li key={i} style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginBottom: 2 }}>{b}</li>)}
              </ul>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Next Actions</div>
              <ul style={{ margin: 0, paddingLeft: 14 }}>
                {CUTOVER_PREVIEW.nextActions.slice(0, 2).map((a, i) => <li key={i} style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginBottom: 2 }}>{a}</li>)}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Scenario + Feedback/Issue KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <CardHeader style={{ paddingBottom: 8 }}><CardTitle>Scenario Execution</CardTitle></CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Planned', value: SCENARIO_SUMMARY.planned },
                { label: 'Executed', value: SCENARIO_SUMMARY.executed },
                { label: 'Passed', value: SCENARIO_SUMMARY.passed + SCENARIO_SUMMARY.passedWithObservations },
                { label: 'Failed', value: SCENARIO_SUMMARY.failed },
                { label: 'Blocked', value: SCENARIO_SUMMARY.blocked },
                { label: 'Deferred', value: SCENARIO_SUMMARY.deferred },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--shell-surface)', borderRadius: 4, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--shell-fg)' }}>{value}</div>
                  <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', textTransform: 'uppercase' }}>{label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader style={{ paddingBottom: 8 }}><CardTitle>Feedback & Issues</CardTitle></CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Feedback', value: FEEDBACK_ISSUE_SUMMARY.feedbackSubmitted },
                { label: 'Issues', value: FEEDBACK_ISSUE_SUMMARY.issuesCreated },
                { label: 'Open', value: FEEDBACK_ISSUE_SUMMARY.openIssues },
                { label: 'Resolved', value: FEEDBACK_ISSUE_SUMMARY.resolvedIssues },
                { label: 'Critical', value: FEEDBACK_ISSUE_SUMMARY.criticalBlockers },
                { label: 'Prod Block', value: FEEDBACK_ISSUE_SUMMARY.productionBlockers },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--shell-surface)', borderRadius: 4, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--shell-fg)' }}>{value}</div>
                  <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', textTransform: 'uppercase' }}>{label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Readiness Summary */}
      <Card>
        <CardHeader style={{ paddingBottom: 8 }}><CardTitle>Readiness Summary</CardTitle></CardHeader>
        <CardContent>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <ReadinessMeter label="Release Gates" met={READINESS_SUMMARY.releaseGatesPassed} total={READINESS_SUMMARY.releaseGatesTotal} />
              <ReadinessMeter label="Exit Criteria" met={READINESS_SUMMARY.exitCriteriaMet} total={READINESS_SUMMARY.exitCriteriaTotal} />
            </div>
            <div>
              <ReadinessMeter label="Stakeholder Sign-Offs" met={READINESS_SUMMARY.signoffsApproved} total={READINESS_SUMMARY.signoffsTotal} />
              <ReadinessMeter label="Data Integration Ready" met={READINESS_SUMMARY.dataIntegrationReady} total={READINESS_SUMMARY.dataIntegrationTotal} />
            </div>
          </div>
          <Separator style={{ margin: '12px 0 10px' }} />
          <div style={{ fontSize: 12, color: 'var(--shell-fg-2)', fontStyle: 'italic' }}>{PILOT_SUMMARY.recommendation}</div>
        </CardContent>
      </Card>
    </div>
  )
}
