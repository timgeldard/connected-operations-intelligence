import { useState } from 'react'
import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle,
  Separator, Tabs, TabsContent, TabsList, TabsTrigger,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import type { StakeholderSignoff, StakeholderSignoffStatus } from '@connectio/product-model'

const SIGNOFFS: readonly StakeholderSignoff[] = [
  {
    signoffId: 'SO-001',
    stakeholderName: 'Dr. Siobhan Walsh',
    stakeholderRole: 'Head of Food Safety & Quality',
    domain: 'Quality & Food Safety',
    workspaceIds: ['quality-batch-release', 'trace-investigation', 'envmon-monitoring', 'spc-monitoring'],
    status: 'requested',
    conditions: ['CoA panel must show live data before final sign-off', 'SPC signal source connector must be confirmed in scope'],
    blockers: ['CoA adapter not source-integrated — mock data only'],
    signedAt: null,
    expiresAt: '2026-09-01T00:00:00Z',
    notes: 'Stakeholder has reviewed pilot workspace pack. Conditions documented. Follow-up scheduled for 2026-06-01.',
  },
  {
    signoffId: 'SO-002',
    stakeholderName: 'Declan Horgan',
    stakeholderRole: 'Manufacturing Operations Director',
    domain: 'Manufacturing Operations',
    workspaceIds: ['operations-plan-risk', 'process-order-review', 'production-staging'],
    status: 'requested',
    conditions: ['PhaseManager integration must be confirmed for production', 'Action audit log must be wired before rollout'],
    blockers: ['PhaseManager SAP PM integration pending', 'Escalation actions not persisted to backend'],
    signedAt: null,
    expiresAt: '2026-09-01T00:00:00Z',
    notes: 'Meeting scheduled for 2026-05-20 to review Operations Plan Risk scenario validation results.',
  },
  {
    signoffId: 'SO-003',
    stakeholderName: 'Aoife Murphy',
    stakeholderRole: 'Warehouse & Supply Chain Lead',
    domain: 'Warehouse & Supply Chain',
    workspaceIds: ['production-staging', 'warehouse-360-overview'],
    status: 'in-progress',
    conditions: ['Hold release action must include approval workflow before production', 'WM source integration timeline must be confirmed'],
    blockers: [],
    signedAt: null,
    expiresAt: '2026-09-01T00:00:00Z',
    notes: 'Production Staging scenario passed validation. Warehouse 360 in-validation. Stakeholder engaged.',
  },
  {
    signoffId: 'SO-004',
    stakeholderName: 'Brian O\'Sullivan',
    stakeholderRole: 'Maintenance & Reliability Manager',
    domain: 'Maintenance & Reliability',
    workspaceIds: ['maintenance-reliability'],
    status: 'not-requested',
    conditions: [],
    blockers: ['SAP PM source contract not yet signed', 'M&R workspace at foundation/pilot candidate stage only'],
    signedAt: null,
    expiresAt: null,
    notes: 'Sign-off not requested until M&R workspace reaches in-validation status.',
  },
  {
    signoffId: 'SO-005',
    stakeholderName: 'Niall Brennan',
    stakeholderRole: 'Plant Manager — Kerry Listowel',
    domain: 'Plant Leadership',
    workspaceIds: ['trace-investigation', 'quality-batch-release', 'operations-plan-risk', 'envmon-monitoring', 'production-staging', 'maintenance-reliability'],
    status: 'requested',
    conditions: ['Cross-domain home screen must show plant-manager pilot view', 'RoleAwareHome polish required before plant manager scenario validation'],
    blockers: ['SCN-006 (Plant Manager cross-domain scenario) not yet validated'],
    signedAt: null,
    expiresAt: '2026-09-01T00:00:00Z',
    notes: 'Plant manager scenario validation (SCN-006) scheduled for 2026-05-25.',
  },
  {
    signoffId: 'SO-006',
    stakeholderName: 'Cliona McCarthy',
    stakeholderRole: 'Platform Engineering Lead',
    domain: 'Platform Engineering',
    workspaceIds: ['trace-investigation', 'quality-batch-release', 'operations-plan-risk', 'envmon-monitoring', 'production-staging', 'spc-monitoring', 'process-order-review', 'warehouse-360-overview', 'maintenance-reliability'],
    status: 'in-progress',
    conditions: ['Performance budget must be reviewed post-pilot', 'Telemetry aggregation must be confirmed end-to-end'],
    blockers: [],
    signedAt: null,
    expiresAt: '2026-09-01T00:00:00Z',
    notes: 'Architecture and design-system compliance verified. Accessibility gap items tracked. In-progress.',
  },
  {
    signoffId: 'SO-007',
    stakeholderName: 'Fiona Gallagher',
    stakeholderRole: 'Data Architecture Lead',
    domain: 'Data Architecture',
    workspaceIds: ['trace-investigation', 'quality-batch-release', 'operations-plan-risk'],
    status: 'not-requested',
    conditions: [],
    blockers: ['Data contract coverage for SPC and WM sources incomplete'],
    signedAt: null,
    expiresAt: null,
    notes: 'Data Architecture sign-off blocked pending data integration readiness review.',
  },
  {
    signoffId: 'SO-008',
    stakeholderName: 'Paul Hennessy',
    stakeholderRole: 'Security & Access Lead',
    domain: 'Security / Access',
    workspaceIds: ['trace-investigation', 'quality-batch-release', 'operations-plan-risk', 'envmon-monitoring', 'production-staging'],
    status: 'not-requested',
    conditions: [],
    blockers: ['Role/scope matrix review not yet formally submitted', 'No real permission enforcement in pilot (client-only mock)'],
    signedAt: null,
    expiresAt: null,
    notes: 'Security review to be initiated when security access review matrix is complete.',
  },
]

function signoffVariant(status: StakeholderSignoffStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'approved') return 'default'
  if (status === 'approved-with-conditions') return 'secondary'
  if (status === 'rejected') return 'destructive'
  if (status === 'blocked') return 'destructive'
  if (status === 'requested' || status === 'in-progress') return 'secondary'
  return 'outline'
}

function KpiBar() {
  const requested = SIGNOFFS.filter(s => s.status === 'requested' || s.status === 'in-progress').length
  const approved = SIGNOFFS.filter(s => s.status === 'approved' || s.status === 'approved-with-conditions').length
  const notRequested = SIGNOFFS.filter(s => s.status === 'not-requested').length
  const blocked = SIGNOFFS.filter(s => s.blockers.length > 0).length

  const kpis = [
    { label: 'Total Sign-Offs', value: SIGNOFFS.length },
    { label: 'Requested / In Progress', value: requested },
    { label: 'Approved', value: approved },
    { label: 'Not Requested', value: notRequested },
    { label: 'With Blockers', value: blocked },
  ]
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      {kpis.map(({ label, value }) => (
        <Card key={label} style={{ flex: '1 1 140px', minWidth: 110 }}>
          <CardContent style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--shell-fg)' }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>{label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function StakeholderSignoffPage() {
  const [filter, setFilter] = useState<'all' | StakeholderSignoffStatus>('all')

  const filtered = SIGNOFFS.filter(s => filter === 'all' || s.status === filter)

  return (
    <div data-testid="stakeholder-signoff" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Stakeholder Sign-Off</h1>
          <Badge variant="outline">Phase 7</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Track stakeholder review and sign-off status by domain. No sign-off is marked as approved — pilot sign-offs are pending stakeholder engagement.
        </p>
      </div>

      <KpiBar />

      <Tabs value={filter} onValueChange={v => setFilter(v as 'all' | StakeholderSignoffStatus)}>
        <TabsList style={{ marginBottom: 20 }}>
          <TabsTrigger value="all">All ({SIGNOFFS.length})</TabsTrigger>
          <TabsTrigger value="requested">Requested</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress</TabsTrigger>
          <TabsTrigger value="not-requested">Not Requested</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
        </TabsList>

        <TabsContent value={filter}>
          {filtered.map(signoff => (
            <Card key={signoff.signoffId} data-testid={`signoff-${signoff.signoffId}`} style={{ marginBottom: 16 }}>
              <CardHeader style={{ paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <CardTitle style={{ fontSize: 15 }}>{signoff.stakeholderName}</CardTitle>
                  <Badge variant={signoffVariant(signoff.status)}>{signoff.status.replace(/-/g, ' ')}</Badge>
                </div>
                <CardDescription>
                  {signoff.stakeholderRole} · {signoff.domain} · {signoff.signoffId}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Workspaces Covered</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {signoff.workspaceIds.map(w => <Badge key={w} variant="outline" style={{ fontSize: 10 }}>{w}</Badge>)}
                  </div>
                </div>
                {signoff.conditions.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Conditions</div>
                    <ul style={{ margin: 0, paddingLeft: 14 }}>
                      {signoff.conditions.map((c, i) => <li key={i} style={{ fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 2 }}>{c}</li>)}
                    </ul>
                  </div>
                )}
                {signoff.blockers.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Blockers</div>
                    <ul style={{ margin: 0, paddingLeft: 14 }}>
                      {signoff.blockers.map((b, i) => <li key={i} style={{ fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 2 }}>{b}</li>)}
                    </ul>
                  </div>
                )}
                {signoff.notes && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Notes</div>
                    <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{signoff.notes}</div>
                  </div>
                )}
                <Separator style={{ marginBottom: 8 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--shell-fg-3)' }}>
                  <span>{signoff.signedAt ? `Signed: ${signoff.signedAt.slice(0, 10)}` : 'Not yet signed'}</span>
                  <span>{signoff.expiresAt ? `Expires: ${signoff.expiresAt.slice(0, 10)}` : 'No expiry set'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p style={{ color: 'var(--shell-fg-3)', fontSize: 13 }}>No sign-offs match this filter.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
