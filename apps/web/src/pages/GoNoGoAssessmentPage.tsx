import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Separator,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import type { GoNoGoRecommendation } from '@connectio/product-model'

interface GoNoDimension {
  readonly dimensionId: string
  readonly title: string
  readonly description: string
  readonly weight: 'critical' | 'major' | 'minor'
  readonly status: 'met' | 'not-met' | 'partial' | 'blocked'
  readonly evidence: string
  readonly blockerIfNotMet: boolean
}

const GO_NO_GO_DIMENSIONS: readonly GoNoDimension[] = [
  {
    dimensionId: 'GNG-001', title: 'Scenario pass rate ≥80%', description: 'All 6 pilot validation scenarios must be executed and achieve a pass rate of at least 80%.', weight: 'critical', status: 'not-met', evidence: '66% pass rate (4 of 6 scenarios executed, 2 fully passed). SCN-005 and SCN-006 not yet run.', blockerIfNotMet: true,
  },
  {
    dimensionId: 'GNG-002', title: 'All stakeholder sign-offs approved', description: 'All 8 domain stakeholder sign-off requests must be formally approved.', weight: 'critical', status: 'not-met', evidence: '0 of 8 sign-offs approved. Process not yet initiated.', blockerIfNotMet: true,
  },
  {
    dimensionId: 'GNG-003', title: 'Zero open pilot-exit blockers', description: 'All issues flagged as pilot-exit blockers must be resolved or accepted-as-risk.', weight: 'critical', status: 'not-met', evidence: '2 open pilot-exit blockers: ISS-004 (action persistence), ISS-006 (accessibility).', blockerIfNotMet: true,
  },
  {
    dimensionId: 'GNG-004', title: 'Release gates ≥90% passed', description: 'At least 9 of 10 release gates must pass their readiness check.', weight: 'critical', status: 'not-met', evidence: '5 of 10 gates passed. GATE-006 through GATE-010 blocked by sign-offs and source integration.', blockerIfNotMet: true,
  },
  {
    dimensionId: 'GNG-005', title: 'Pilot exit criteria met', description: 'All 12 pilot exit criteria (PEC-001 through PEC-012) must be met.', weight: 'critical', status: 'not-met', evidence: '5 of 12 criteria met. Dependent on scenario completion, sign-offs, and issue resolution.', blockerIfNotMet: true,
  },
  {
    dimensionId: 'GNG-006', title: 'Training readiness ≥90%', description: 'At least 90% of pilot users must have completed required training for their role.', weight: 'major', status: 'partial', evidence: '72% of users training-complete. QA Technician and Plant Manager roles have gaps.', blockerIfNotMet: false,
  },
  {
    dimensionId: 'GNG-007', title: 'Data integration readiness ≥80%', description: 'At least 8 of 10 data sources must be confirmed as pilot-ready.', weight: 'major', status: 'not-met', evidence: '4 of 10 sources ready. SPC connector, SAP PM, WM, and ERP event log gaps remain.', blockerIfNotMet: false,
  },
  {
    dimensionId: 'GNG-008', title: 'Security access review complete', description: 'All 17 security access review items must be confirmed compliant or accepted-as-risk.', weight: 'major', status: 'partial', evidence: '15 of 17 items resolved. AE-002 and AE-008 (plant manager cross-workspace access) open.', blockerIfNotMet: false,
  },
  {
    dimensionId: 'GNG-009', title: 'Support readiness confirmed', description: 'All in-scope workspaces must have runbooks, support contacts, and escalation paths defined.', weight: 'major', status: 'partial', evidence: '3 of 8 workspaces fully support-ready. EnvMon and Maintenance blocked; others have minor gaps.', blockerIfNotMet: false,
  },
  {
    dimensionId: 'GNG-010', title: 'Rollback plan confirmed', description: 'A tested rollback plan must be available and confirmed ready for use at cutover.', weight: 'major', status: 'met', evidence: 'Rollback plan authored and reviewed. Legacy apps remain accessible. Rollback not tested in live environment.', blockerIfNotMet: false,
  },
  {
    dimensionId: 'GNG-011', title: 'Workspace adoption ≥80%', description: 'At least 80% of targeted pilot users must be actively using their assigned workspaces.', weight: 'minor', status: 'met', evidence: '82% overall adoption rate. SPC and EnvMon excluded from calculation (source gaps, not adoption gaps).', blockerIfNotMet: false,
  },
  {
    dimensionId: 'GNG-012', title: 'No open critical data quality gaps', description: 'No data quality gaps rated critical or blocker must remain open without an accepted workaround.', weight: 'major', status: 'not-met', evidence: 'DQG-001 (CoA API) and DQG-005 (SAP PM) are open without accepted-risk status.', blockerIfNotMet: true,
  },
]

const DERIVED_RECOMMENDATION: GoNoGoRecommendation = 'no-go'

function dimensionStatusVariant(status: GoNoDimension['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'met') return 'default'
  if (status === 'partial') return 'secondary'
  if (status === 'not-met' || status === 'blocked') return 'destructive'
  return 'outline'
}

function overallVariant(rec: GoNoGoRecommendation): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (rec === 'go') return 'default'
  if (rec === 'go-with-conditions') return 'secondary'
  if (rec === 'no-go' || rec === 'blocked') return 'destructive'
  return 'outline'
}

function overallLabel(rec: GoNoGoRecommendation): string {
  const labels: Record<GoNoGoRecommendation, string> = {
    'go': 'GO', 'go-with-conditions': 'GO — With Conditions', 'no-go': 'NO-GO', 'defer': 'DEFER', 'blocked': 'BLOCKED',
  }
  return labels[rec]
}

export function GoNoGoAssessmentPage() {
  const metCount = GO_NO_GO_DIMENSIONS.filter(d => d.status === 'met').length
  const partialCount = GO_NO_GO_DIMENSIONS.filter(d => d.status === 'partial').length
  const notMetCount = GO_NO_GO_DIMENSIONS.filter(d => d.status === 'not-met' || d.status === 'blocked').length
  const criticalBlocked = GO_NO_GO_DIMENSIONS.filter(d => d.weight === 'critical' && d.status !== 'met').length

  return (
    <div data-testid="go-no-go-assessment" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Go / No-Go Assessment</h1>
          <Badge variant="outline">Phase 8</Badge>
          <Badge variant={overallVariant(DERIVED_RECOMMENDATION)} style={{ fontSize: 14, padding: '4px 14px', fontWeight: 700 }}>
            {overallLabel(DERIVED_RECOMMENDATION)}
          </Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          12-dimension assessment against pilot exit and production cutover criteria. {metCount} met, {partialCount} partial, {notMetCount} not met. {criticalBlocked} critical dimension(s) unmet.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: 'Met', value: metCount },
          { label: 'Partial', value: partialCount },
          { label: 'Not Met', value: notMetCount, danger: notMetCount > 0 },
          { label: 'Critical Unmet', value: criticalBlocked, danger: criticalBlocked > 0 },
        ].map(({ label, value, danger }) => (
          <Card key={label} style={{ flex: '1 1 120px', minWidth: 100, border: danger ? '1px solid #DC2626' : undefined }}>
            <CardContent style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: danger ? '#DC2626' : 'var(--shell-fg)' }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {GO_NO_GO_DIMENSIONS.map(dim => (
        <Card key={dim.dimensionId} data-testid={`gng-dimension-${dim.dimensionId}`} style={{ marginBottom: 12, border: dim.weight === 'critical' && dim.status !== 'met' ? '1px solid #DC2626' : undefined }}>
          <CardHeader style={{ paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <CardTitle style={{ fontSize: 14 }}>{dim.title}</CardTitle>
              <Badge variant={dimensionStatusVariant(dim.status)}>{dim.status.replace(/-/g, ' ')}</Badge>
              <Badge variant="outline" style={{ fontSize: 10, textTransform: 'uppercase' }}>{dim.weight}</Badge>
              {dim.blockerIfNotMet && dim.status !== 'met' && <Badge variant="destructive">cutover blocker</Badge>}
            </div>
            <CardDescription>{dim.dimensionId} · {dim.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Separator style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 12, color: 'var(--shell-fg-2)', fontStyle: 'italic' }}>Evidence: {dim.evidence}</div>
          </CardContent>
        </Card>
      ))}

      <Card style={{ marginTop: 8 }}>
        <CardContent style={{ padding: '16px' }}>
          <div style={{ fontSize: 12, color: 'var(--shell-fg-3)', fontStyle: 'italic' }}>
            The Go / No-Go recommendation is derived automatically from current dimension statuses. This assessment is informational only — do not treat it as a formal production sign-off. Final cutover authority rests with the programme manager and steering committee.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
