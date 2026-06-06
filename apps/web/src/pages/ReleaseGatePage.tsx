import { useState } from 'react'
import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import type { ReleaseGate, ReleaseGateStatus } from '@connectio/product-model'

const RELEASE_GATES: readonly ReleaseGate[] = [
  {
    gateId: 'GATE-001',
    name: 'Product Model Gate',
    description: 'All pilot workspaces are registered with complete lifecycle, scope, role, and route declarations.',
    status: 'passed',
    owner: 'platform-engineering',
    requiredFindingsClosed: [],
    requiredSignoffs: [],
    requiredScenarios: [],
    blockers: [],
    dueAt: '2026-05-15T00:00:00Z',
    evidenceLinks: ['workspace-registry.ts', 'docs/governance/workspace-and-panel-registry.md'],
  },
  {
    gateId: 'GATE-002',
    name: 'UX Consistency Gate',
    description: 'All pilot workspaces use StandardWorkspaceTemplate, EvidencePanel, and design-system components. No custom page chrome.',
    status: 'passed-with-conditions',
    owner: 'platform-engineering',
    requiredFindingsClosed: [],
    requiredSignoffs: [],
    requiredScenarios: [],
    blockers: ['AdminGovernancePage and LegacyRetirementPage contain inline styles — non-blocking for pilot'],
    dueAt: '2026-05-15T00:00:00Z',
    evidenceLinks: ['docs/adr/ADR-013-phase-6-admin-design-system-mandate.md'],
  },
  {
    gateId: 'GATE-003',
    name: 'Data Contract Gate',
    description: 'Data schemas exist, adapters exist, and mock/source integration status is known for all pilot workspaces.',
    status: 'in-progress',
    owner: 'data-architecture',
    requiredFindingsClosed: ['FND-PRD-001'],
    requiredSignoffs: ['SO-007'],
    requiredScenarios: [],
    blockers: ['SPC source connector not available', 'WM source partial — Warehouse360 integration pending', 'CoA adapter mock-only'],
    dueAt: '2026-06-15T00:00:00Z',
    evidenceLinks: ['docs/pilot/data-integration-readiness.md'],
  },
  {
    gateId: 'GATE-004',
    name: 'Role and Scope Gate',
    description: 'Role/scope matrix reviewed, permissions documented, and scope-aware landing validated for pilot roles.',
    status: 'passed-with-conditions',
    owner: 'platform-engineering',
    requiredFindingsClosed: [],
    requiredSignoffs: ['SO-008'],
    requiredScenarios: [],
    blockers: ['No real permission enforcement in pilot (client-only mock)', 'Security sign-off not yet requested'],
    dueAt: '2026-05-30T00:00:00Z',
    evidenceLinks: ['?workspace=admin-role-scope-matrix'],
  },
  {
    gateId: 'GATE-005',
    name: 'Scenario Validation Gate',
    description: 'Required pilot scenarios passed or passed with observations.',
    status: 'in-progress',
    owner: 'pilot-lead',
    requiredFindingsClosed: [],
    requiredSignoffs: [],
    requiredScenarios: ['SCN-001', 'SCN-002', 'SCN-003', 'SCN-004'],
    blockers: ['SCN-001 in-progress', 'SCN-003 in-progress', 'SCN-005 not started', 'SCN-006 not started'],
    dueAt: '2026-06-01T00:00:00Z',
    evidenceLinks: ['?workspace=admin-pilot-scenario-validation'],
  },
  {
    gateId: 'GATE-006',
    name: 'Accessibility Gate',
    description: 'Keyboard navigation, ARIA labels, colour-independent semantics, and accessible governance tables verified.',
    status: 'in-progress',
    owner: 'platform-engineering',
    requiredFindingsClosed: [],
    requiredSignoffs: [],
    requiredScenarios: [],
    blockers: ['Keyboard navigation gap in Operations Plan Risk filters (FB-SEED-003)', 'Governance tables need accessible column headers'],
    dueAt: '2026-06-15T00:00:00Z',
    evidenceLinks: ['docs/adr/ADR-015-phase-6-accessibility-landmarks.md'],
  },
  {
    gateId: 'GATE-007',
    name: 'Performance Gate',
    description: 'Route lazy loading, panel-level loading, slow panel telemetry, and performance budget warnings reviewed.',
    status: 'passed-with-conditions',
    owner: 'platform-engineering',
    requiredFindingsClosed: [],
    requiredSignoffs: [],
    requiredScenarios: [],
    blockers: ['Trace graph slow on large batches (FB-SEED-002) — accepted for pilot, must resolve before production'],
    dueAt: '2026-05-15T00:00:00Z',
    evidenceLinks: ['apps/web/vite.config.ts'],
  },
  {
    gateId: 'GATE-008',
    name: 'Security / Access Gate',
    description: 'Permission model reviewed, no obvious unauthorised visibility, no client-only security assumptions for real permissions.',
    status: 'not-started',
    owner: 'security-access',
    requiredFindingsClosed: [],
    requiredSignoffs: ['SO-008'],
    requiredScenarios: [],
    blockers: ['Security sign-off not yet requested', 'Client-only permission model — not suitable for production'],
    dueAt: '2026-07-01T00:00:00Z',
    evidenceLinks: ['?workspace=admin-pilot-security-access-review'],
  },
  {
    gateId: 'GATE-009',
    name: 'Cutover Simulation Gate',
    description: 'Legacy route simulation complete, rollback documented, and blockers identified for all pilot workspace pairs.',
    status: 'passed-with-conditions',
    owner: 'platform-engineering',
    requiredFindingsClosed: [],
    requiredSignoffs: [],
    requiredScenarios: [],
    blockers: ['M&R simulation pair not yet in observe mode', 'PhaseManager SAP PM integration timeline not confirmed'],
    dueAt: '2026-05-30T00:00:00Z',
    evidenceLinks: ['docs/migration/cutover-simulation-guide.md', '?workspace=admin-cutover-simulation'],
  },
  {
    gateId: 'GATE-010',
    name: 'Stakeholder Sign-Off Gate',
    description: 'Required domain sign-offs approved or approved with conditions.',
    status: 'not-started',
    owner: 'pilot-lead',
    requiredFindingsClosed: [],
    requiredSignoffs: ['SO-001', 'SO-002', 'SO-003', 'SO-005', 'SO-006'],
    requiredScenarios: [],
    blockers: ['No domain sign-offs approved yet', 'Quality, Operations, Warehouse, Plant Leadership sign-offs all pending'],
    dueAt: '2026-08-01T00:00:00Z',
    evidenceLinks: ['?workspace=admin-pilot-signoff'],
  },
]

function gateVariant(status: ReleaseGateStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'passed') return 'default'
  if (status === 'passed-with-conditions') return 'secondary'
  if (status === 'failed') return 'destructive'
  if (status === 'blocked') return 'destructive'
  if (status === 'in-progress') return 'secondary'
  return 'outline'
}

function KpiBar() {
  const passed = RELEASE_GATES.filter(g => g.status === 'passed' || g.status === 'passed-with-conditions').length
  const inProgress = RELEASE_GATES.filter(g => g.status === 'in-progress').length
  const notStarted = RELEASE_GATES.filter(g => g.status === 'not-started').length
  const withBlockers = RELEASE_GATES.filter(g => g.blockers.length > 0).length

  const kpis = [
    { label: 'Total Gates', value: RELEASE_GATES.length },
    { label: 'Passed', value: passed },
    { label: 'In Progress', value: inProgress },
    { label: 'Not Started', value: notStarted },
    { label: 'With Blockers', value: withBlockers },
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

export function ReleaseGatePage() {
  const [filter, setFilter] = useState<'all' | ReleaseGateStatus>('all')

  const filtered = RELEASE_GATES.filter(g => filter === 'all' || g.status === filter)

  return (
    <div data-testid="release-gate-dashboard" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Release Gate Dashboard</h1>
          <Badge variant="outline">Phase 7</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          10 release gates must be passed or passed-with-conditions before controlled production rollout.
        </p>
      </div>

      <KpiBar />

      <Tabs value={filter} onValueChange={v => setFilter(v as 'all' | ReleaseGateStatus)}>
        <TabsList style={{ marginBottom: 20 }}>
          <TabsTrigger value="all">All ({RELEASE_GATES.length})</TabsTrigger>
          <TabsTrigger value="passed">Passed</TabsTrigger>
          <TabsTrigger value="passed-with-conditions">With Conditions</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress</TabsTrigger>
          <TabsTrigger value="not-started">Not Started</TabsTrigger>
        </TabsList>

        <TabsContent value={filter}>
          {filtered.map(gate => (
            <Card key={gate.gateId} data-testid={`gate-${gate.gateId}`} style={{ marginBottom: 14 }}>
              <CardHeader style={{ paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <CardTitle style={{ fontSize: 15 }}>{gate.name}</CardTitle>
                  <Badge variant={gateVariant(gate.status)}>{gate.status.replace(/-/g, ' ')}</Badge>
                </div>
                <CardDescription>{gate.gateId} · owner: {gate.owner} · due: {gate.dueAt.slice(0, 10)}</CardDescription>
              </CardHeader>
              <CardContent>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--shell-fg-2)' }}>{gate.description}</p>
                {gate.blockers.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Blockers</div>
                    <ul style={{ margin: 0, paddingLeft: 14 }}>
                      {gate.blockers.map((b, i) => <li key={i} style={{ fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 2 }}>{b}</li>)}
                    </ul>
                  </div>
                )}
                {gate.requiredSignoffs.length > 0 && (
                  <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--shell-fg-3)' }}>
                    Required sign-offs: {gate.requiredSignoffs.join(', ')}
                  </div>
                )}
                {gate.requiredScenarios.length > 0 && (
                  <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--shell-fg-3)' }}>
                    Required scenarios: {gate.requiredScenarios.join(', ')}
                  </div>
                )}
                {gate.evidenceLinks.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
                    Evidence: {gate.evidenceLinks.join(' · ')}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p style={{ color: 'var(--shell-fg-3)', fontSize: 13 }}>No gates match this filter.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
