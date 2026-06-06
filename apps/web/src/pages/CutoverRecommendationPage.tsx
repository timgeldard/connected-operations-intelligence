import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Separator,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import type { CutoverRecommendation, GoNoGoRecommendation } from '@connectio/product-model'
import { deriveGoNoGo } from '@connectio/product-model'

const CUTOVER_RECOMMENDATION: CutoverRecommendation = {
  recommendationId: 'CR-001',
  recommendation: 'no-go',
  summary: 'Pilot is in active execution — key blockers prevent production cutover recommendation at this time.',
  rationale: 'Scenario pass rate is 66% against a target of ≥80%. No stakeholder sign-offs have been approved. Four open production blockers remain untriaged or in-progress. The pilot has demonstrated strong adoption in core workspaces (Quality, Trace, Warehouse) but critical gaps in SPC data integration, action persistence, and accessibility must be resolved.',
  conditions: [
    'SPC and WM source connectors must be confirmed and deployed to Wave 1 environment before Wave 2 activation.',
    'Accessibility blockers (ISS-006) must be remediated or formally accepted-as-risk by the steering committee.',
    'CoA generation API must be wired before production use of Quality Batch Release.',
    'All 8 domain stakeholder sign-offs must be approved before production cutover.',
  ],
  blockers: [
    '0 of 8 domain stakeholder sign-offs approved',
    'Scenario pass rate 66% — target ≥80% (SCN-005 and SCN-006 not yet executed)',
    'ISS-006 critical accessibility issue not yet triaged or assigned',
    'ISS-004 action audit log persistence gap is a production blocker',
  ],
  acceptedRisks: [
    'Maintenance Reliability workspace excluded from Wave 1 pilot scope (SAP PM contract pending)',
    'SPC data in pilot uses simulated connector — accepted as known pilot limitation',
    'Batch master data attributes may not exactly match live Coda values during pilot (DQG-008)',
  ],
  requiredActions: [
    'Complete SCN-005 and SCN-006 scenario validation',
    'Initiate stakeholder sign-off process immediately after SCN-006 completion',
    'Assign ISS-006 accessibility remediation owner and resolve before exit criteria assessment',
    'Resolve ISS-004 action persistence bug — confirm server-side audit log wired',
    'Confirm SAP PM integration contract timeline',
    'Achieve ≥90% training readiness across all in-scope roles',
  ],
  recommendedWave: 'Wave 1 — IE10 Kerry Listowel (on hold until blockers resolved)',
  rollbackReadiness: 'ready',
  supportReadiness: 'partial',
  trainingReadiness: 'partial',
  dataReadiness: 'not-ready',
  securityReadiness: 'partial',
  stakeholderSignoffStatus: 'missing',
  createdAt: '2026-05-15',
  createdBy: 'programme-manager',
}

function goNoGoVariant(rec: GoNoGoRecommendation): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (rec === 'go') return 'default'
  if (rec === 'go-with-conditions') return 'secondary'
  if (rec === 'no-go' || rec === 'blocked') return 'destructive'
  return 'outline'
}

function goNoGoLabel(rec: GoNoGoRecommendation): string {
  const labels: Record<GoNoGoRecommendation, string> = {
    'go': 'GO',
    'go-with-conditions': 'GO — With Conditions',
    'no-go': 'NO-GO',
    'defer': 'DEFER',
    'blocked': 'BLOCKED',
  }
  return labels[rec]
}

function readinessVariant(status: 'ready' | 'not-ready' | 'partial'): 'default' | 'secondary' | 'destructive' {
  if (status === 'ready') return 'default'
  if (status === 'partial') return 'secondary'
  return 'destructive'
}

function signoffVariant(status: 'complete' | 'partial' | 'missing'): 'default' | 'secondary' | 'destructive' {
  if (status === 'complete') return 'default'
  if (status === 'partial') return 'secondary'
  return 'destructive'
}

export function CutoverRecommendationPage() {
  const derived = deriveGoNoGo(CUTOVER_RECOMMENDATION)

  return (
    <div data-testid="cutover-recommendation" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Cutover Recommendation</h1>
          <Badge variant="outline">Phase 8</Badge>
          <Badge variant={goNoGoVariant(derived)} style={{ fontSize: 14, padding: '4px 12px' }}>
            {goNoGoLabel(derived)}
          </Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>{CUTOVER_RECOMMENDATION.summary}</p>
      </div>

      <Card style={{ marginBottom: 20, border: '1px solid #DC2626' }}>
        <CardHeader style={{ paddingBottom: 6 }}>
          <CardTitle style={{ fontSize: 14 }}>Rationale</CardTitle>
          <CardDescription>{CUTOVER_RECOMMENDATION.recommendationId} · Created: {CUTOVER_RECOMMENDATION.createdAt} · By: {CUTOVER_RECOMMENDATION.createdBy}</CardDescription>
        </CardHeader>
        <CardContent>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>{CUTOVER_RECOMMENDATION.rationale}</p>
        </CardContent>
      </Card>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <Card style={{ flex: '1 1 280px' }}>
          <CardHeader style={{ paddingBottom: 6 }}>
            <CardTitle style={{ fontSize: 13, color: '#DC2626' }}>Blockers ({CUTOVER_RECOMMENDATION.blockers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul style={{ margin: 0, paddingLeft: 14 }}>
              {CUTOVER_RECOMMENDATION.blockers.map((b, i) => (
                <li key={i} style={{ fontSize: 12, color: '#DC2626', marginBottom: 6 }}>{b}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card style={{ flex: '1 1 280px' }}>
          <CardHeader style={{ paddingBottom: 6 }}>
            <CardTitle style={{ fontSize: 13, color: '#D97706' }}>Conditions ({CUTOVER_RECOMMENDATION.conditions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul style={{ margin: 0, paddingLeft: 14 }}>
              {CUTOVER_RECOMMENDATION.conditions.map((c, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 6 }}>{c}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card style={{ flex: '1 1 280px' }}>
          <CardHeader style={{ paddingBottom: 6 }}>
            <CardTitle style={{ fontSize: 13 }}>Accepted Risks ({CUTOVER_RECOMMENDATION.acceptedRisks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul style={{ margin: 0, paddingLeft: 14 }}>
              {CUTOVER_RECOMMENDATION.acceptedRisks.map((r, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--shell-fg-3)', marginBottom: 6, fontStyle: 'italic' }}>{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <CardHeader style={{ paddingBottom: 6 }}>
          <CardTitle style={{ fontSize: 14 }}>Required Actions Before Cutover</CardTitle>
        </CardHeader>
        <CardContent>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {CUTOVER_RECOMMENDATION.requiredActions.map((a, i) => (
              <li key={i} style={{ fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 8 }}>{a}</li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader style={{ paddingBottom: 6 }}>
          <CardTitle style={{ fontSize: 14 }}>Readiness Summary</CardTitle>
          <CardDescription>Recommended Wave: {CUTOVER_RECOMMENDATION.recommendedWave}</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Rollback', status: CUTOVER_RECOMMENDATION.rollbackReadiness },
              { label: 'Support', status: CUTOVER_RECOMMENDATION.supportReadiness },
              { label: 'Training', status: CUTOVER_RECOMMENDATION.trainingReadiness },
              { label: 'Data', status: CUTOVER_RECOMMENDATION.dataReadiness },
              { label: 'Security', status: CUTOVER_RECOMMENDATION.securityReadiness },
            ].map(({ label, status }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{label}</span>
                <Badge variant={readinessVariant(status)}>{status}</Badge>
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Stakeholder Sign-off</span>
              <Badge variant={signoffVariant(CUTOVER_RECOMMENDATION.stakeholderSignoffStatus)}>
                {CUTOVER_RECOMMENDATION.stakeholderSignoffStatus}
              </Badge>
            </div>
          </div>
          <Separator style={{ margin: '14px 0' }} />
          <div style={{ fontSize: 12, color: 'var(--shell-fg-3)', fontStyle: 'italic' }}>
            This recommendation is derived automatically from current blocker and condition data. Do not mark as production-ready until all blockers are cleared and sign-offs are complete.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
