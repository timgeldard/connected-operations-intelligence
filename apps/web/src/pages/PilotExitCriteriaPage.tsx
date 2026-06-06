import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Separator,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import type { PilotExitCriteria, ReleaseGateStatus } from '@connectio/product-model'

const EXIT_CRITERIA: readonly PilotExitCriteria[] = [
  {
    criteriaId: 'PEC-001',
    title: '≥80% of required pilot scenarios passed',
    description: 'At least 80% of the 6 required pilot validation scenarios must have a status of passed or passed-with-observations.',
    status: 'in-progress',
    owner: 'pilot-lead',
    measurement: '% scenarios passed',
    target: '≥80% (5 of 6)',
    actual: '33% (2 of 6 — SCN-002 passed-with-observations, SCN-004 passed)',
    blockers: ['SCN-001 in-progress', 'SCN-003 in-progress', 'SCN-005 not-started', 'SCN-006 not-started'],
    recommendation: 'Schedule remaining scenario validation sessions. SCN-005 and SCN-006 must be initiated.',
  },
  {
    criteriaId: 'PEC-002',
    title: 'Zero critical production blockers',
    description: 'No open readiness findings with severity=critical and blocksProduction=true.',
    status: 'in-progress',
    owner: 'platform-engineering',
    measurement: 'count of critical production blockers',
    target: '0',
    actual: '2 open (OPR live MES adapter, M&R SAP PM contract)',
    blockers: ['OPR MES source adapter missing', 'M&R SAP PM contract not signed'],
    recommendation: 'Track via Production Readiness Dashboard. These are pre-conditions for production, not pilot.',
  },
  {
    criteriaId: 'PEC-003',
    title: 'Zero unresolved design-system compliance blockers',
    description: 'No open design-system compliance findings of severity blocker or critical.',
    status: 'passed',
    owner: 'platform-engineering',
    measurement: 'count of design-system compliance blockers',
    target: '0',
    actual: '0 — all compliance findings are info or warning',
    blockers: [],
    recommendation: 'Criteria met. Continue monitoring as new pages are added.',
  },
  {
    criteriaId: 'PEC-004',
    title: 'No unauthorised workspace visibility in role/scope matrix',
    description: 'Every workspace visibility entry in the role/scope matrix has a defined justification.',
    status: 'passed-with-conditions',
    owner: 'security-access',
    measurement: 'count of unauthorised visibility findings',
    target: '0',
    actual: '0 unauthorised — client-only enforcement noted',
    blockers: ['Real permission enforcement not in place (client-only mock)'],
    recommendation: 'Acceptable for pilot. Must be resolved before production rollout with real role claims.',
  },
  {
    criteriaId: 'PEC-005',
    title: 'All pilot workspaces have owner and lifecycle declared',
    description: 'Every workspace in the pilot workspace pack has a declared ownerDomain and lifecycle.',
    status: 'passed',
    owner: 'platform-engineering',
    measurement: '% workspaces with owner and lifecycle',
    target: '100%',
    actual: '100% (9/9)',
    blockers: [],
    recommendation: 'Criteria met. Maintained by workspace-registry governance.',
  },
  {
    criteriaId: 'PEC-006',
    title: 'All pilot evidence panels have owner, freshness, and confidence declared',
    description: 'Every evidence panel registration in the pilot workspaces declares sourceOwnership, freshnessPolicy, and confidencePolicy.',
    status: 'passed-with-conditions',
    owner: 'platform-engineering',
    measurement: '% panels with complete ownership',
    target: '100%',
    actual: '~85% — some pilot-stage panels have partial freshness/confidence declarations',
    blockers: ['SPC and WM source panels have placeholder freshness/confidence values'],
    recommendation: 'Update pilot-stage panel registrations with accurate freshness/confidence before production.',
  },
  {
    criteriaId: 'PEC-007',
    title: 'All pilot actions have validation and telemetry',
    description: 'Every action flow in pilot workspaces has a validation schema and emits a telemetry event on completion.',
    status: 'in-progress',
    owner: 'platform-engineering',
    measurement: '% actions with validation and telemetry',
    target: '100%',
    actual: '~70% — escalation and handover actions not yet wired to telemetry',
    blockers: ['Action audit log not wired for Operations Plan Risk actions', 'Hold release approval workflow not implemented'],
    recommendation: 'Track via telemetry dashboard. Complete action telemetry wiring before pilot exit.',
  },
  {
    criteriaId: 'PEC-008',
    title: 'Accessibility blockers triaged',
    description: 'All accessibility findings of severity blocker or critical must be triaged and have a remediation plan.',
    status: 'in-progress',
    owner: 'platform-engineering',
    measurement: 'count of untriaged accessibility blockers',
    target: '0 untriaged',
    actual: '1 untriaged — keyboard navigation gap in Operations Plan Risk (FB-SEED-003)',
    blockers: ['FB-SEED-003 not yet triaged'],
    recommendation: 'Triage FB-SEED-003 and assign owner. Block pilot exit until resolved or deferred with plan.',
  },
  {
    criteriaId: 'PEC-009',
    title: 'Performance blockers triaged',
    description: 'All performance findings of severity blocker or critical must be triaged and have a remediation plan.',
    status: 'passed-with-conditions',
    owner: 'platform-engineering',
    measurement: 'count of untriaged performance blockers',
    target: '0 untriaged',
    actual: '0 untriaged — FB-SEED-002 (trace graph slow) accepted for pilot, tracked for Phase 8',
    blockers: [],
    recommendation: 'Criteria met for pilot. Trace graph performance must be resolved before production.',
  },
  {
    criteriaId: 'PEC-010',
    title: 'Stakeholder sign-off complete or conditionally approved',
    description: 'Required domain stakeholders have provided approved or approved-with-conditions sign-off.',
    status: 'not-started',
    owner: 'pilot-lead',
    measurement: 'count of required sign-offs approved',
    target: '5 of 8 (Quality, Operations, Warehouse, Plant Leadership, Platform)',
    actual: '0 approved',
    blockers: ['No domain sign-offs approved yet', 'Scenario validation must complete first'],
    recommendation: 'Initiate formal sign-off requests once scenario validation is complete.',
  },
  {
    criteriaId: 'PEC-011',
    title: 'Pilot support model documented',
    description: 'Support runbooks exist covering workspace failures, feedback triage, escalation paths, and mock/source mismatch handling.',
    status: 'passed',
    owner: 'platform-engineering',
    measurement: 'runbooks created',
    target: '3 runbooks',
    actual: '3 (pilot-support-runbook, workspace-troubleshooting, cutover-simulation-troubleshooting)',
    blockers: [],
    recommendation: 'Criteria met. Review runbooks with support team before pilot launch.',
  },
  {
    criteriaId: 'PEC-012',
    title: 'Rollback / cutover simulation documented',
    description: 'Cutover simulation guide and troubleshooting runbook exist and are reviewed.',
    status: 'passed',
    owner: 'platform-engineering',
    measurement: 'guides created and reviewed',
    target: '2 documents',
    actual: '2 (cutover-simulation-guide.md, cutover-simulation-troubleshooting.md)',
    blockers: [],
    recommendation: 'Criteria met. Confirm with cutover simulation gate owner.',
  },
]

function statusVariant(status: ReleaseGateStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'passed') return 'default'
  if (status === 'passed-with-conditions') return 'secondary'
  if (status === 'failed') return 'destructive'
  if (status === 'blocked') return 'destructive'
  if (status === 'in-progress') return 'secondary'
  return 'outline'
}

function KpiBar() {
  const passed = EXIT_CRITERIA.filter(c => c.status === 'passed' || c.status === 'passed-with-conditions').length
  const inProgress = EXIT_CRITERIA.filter(c => c.status === 'in-progress').length
  const notMet = EXIT_CRITERIA.filter(c => c.status === 'failed' || c.status === 'blocked').length
  const notStarted = EXIT_CRITERIA.filter(c => c.status === 'not-started').length

  const kpis = [
    { label: 'Total Criteria', value: EXIT_CRITERIA.length },
    { label: 'Met / Conditional', value: passed },
    { label: 'In Progress', value: inProgress },
    { label: 'Not Started', value: notStarted },
    { label: 'Failed / Blocked', value: notMet },
  ]
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      {kpis.map(({ label, value }) => (
        <Card key={label} style={{ flex: '1 1 130px', minWidth: 110 }}>
          <CardContent style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--shell-fg)' }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>{label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function PilotExitCriteriaPage() {
  return (
    <div data-testid="pilot-exit-criteria" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Pilot Exit Criteria</h1>
          <Badge variant="outline">Phase 7</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          12 criteria must be met before ConnectIO-RAD V2 exits the controlled pilot phase.
        </p>
      </div>
      <KpiBar />
      {EXIT_CRITERIA.map(criteria => (
        <Card key={criteria.criteriaId} data-testid={`exit-criteria-${criteria.criteriaId}`} style={{ marginBottom: 12 }}>
          <CardHeader style={{ paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <CardTitle style={{ fontSize: 14 }}>{criteria.title}</CardTitle>
              <Badge variant={statusVariant(criteria.status)}>{criteria.status.replace(/-/g, ' ')}</Badge>
            </div>
            <CardDescription>{criteria.criteriaId} · owner: {criteria.owner} · target: {criteria.target}</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Actual</div>
                <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{criteria.actual}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Measurement</div>
                <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{criteria.measurement}</div>
              </div>
            </div>
            {criteria.blockers.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Blockers</div>
                <ul style={{ margin: 0, paddingLeft: 14 }}>
                  {criteria.blockers.map((b, i) => <li key={i} style={{ fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 2 }}>{b}</li>)}
                </ul>
              </div>
            )}
            <Separator style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 12, color: 'var(--shell-fg-2)', fontStyle: 'italic' }}>{criteria.recommendation}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
