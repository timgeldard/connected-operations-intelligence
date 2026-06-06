import { useState } from 'react'
import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Separator,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import type { ScenarioExecutionResult, ScenarioExecutionResultStatus } from '@connectio/product-model'

const SCENARIO_EXECUTIONS: readonly ScenarioExecutionResult[] = [
  {
    executionId: 'EXE-001',
    scenarioId: 'SCN-001',
    executedBy: 'Mary Connolly',
    executedRole: 'quality-lead',
    executedAt: '2026-05-14T09:00:00Z',
    scope: 'batch',
    status: 'passed-with-observations',
    durationMinutes: 22,
    observations: [
      'CoA panel shows placeholder text — confirmed mock-only',
      'SPCSignalsPanel filters correctly by batch context',
      'Release Batch action completes successfully with correct telemetry',
    ],
    issuesRaised: ['ISS-001', 'ISS-002'],
    evidenceCaptured: ['QualityResultsPanel loaded', 'TraceExposurePanel drill-through confirmed'],
    recommendation: 'Scenario passes with CoA source integration gap documented as known issue for production.',
    blocksPilotExit: false,
    blocksProduction: true,
  },
  {
    executionId: 'EXE-002',
    scenarioId: 'SCN-002',
    executedBy: 'Siobhan Walsh',
    executedRole: 'food-safety-lead',
    executedAt: '2026-05-12T14:30:00Z',
    scope: 'plant',
    status: 'passed',
    durationMinutes: 18,
    observations: ['EventTimelinePanel timestamps are mock — noted for source integration phase'],
    issuesRaised: ['ISS-003'],
    evidenceCaptured: ['TraceGraphPanel rendered complete supplier chain', 'CustomerImpactPanel accurate for batch scope'],
    recommendation: 'Scenario passed. Trace Investigation workspace is pilot-ready for food safety lead.',
    blocksPilotExit: false,
    blocksProduction: false,
  },
  {
    executionId: 'EXE-003',
    scenarioId: 'SCN-003',
    executedBy: 'Declan Horgan',
    executedRole: 'operations-supervisor',
    executedAt: '2026-05-13T10:00:00Z',
    scope: 'plant',
    status: 'passed-with-observations',
    durationMinutes: 14,
    observations: [
      'Action audit log not wired — escalations not persisted between sessions',
      'PhaseManager integration data not available — mock data only',
    ],
    issuesRaised: ['ISS-004', 'ISS-005'],
    evidenceCaptured: ['PlanRiskSummaryPanel aggregated blockers correctly', 'MaterialShortagePanel accurate for mock data'],
    recommendation: 'Scenario passes with action persistence gap. Must be resolved before production.',
    blocksPilotExit: false,
    blocksProduction: true,
  },
  {
    executionId: 'EXE-004',
    scenarioId: 'SCN-004',
    executedBy: 'Aoife Murphy',
    executedRole: 'warehouse-manager',
    executedAt: '2026-05-14T08:00:00Z',
    scope: 'warehouse',
    status: 'passed',
    durationMinutes: 11,
    observations: [],
    issuesRaised: [],
    evidenceCaptured: ['All 6 panels loaded without error', 'Confirm Staging action completed successfully'],
    recommendation: 'Scenario fully passed. Production Staging workspace is ready for pilot.',
    blocksPilotExit: false,
    blocksProduction: false,
  },
  {
    executionId: 'EXE-005',
    scenarioId: 'SCN-005',
    executedBy: 'Not yet executed',
    executedRole: 'quality-lead',
    executedAt: '',
    scope: 'plant',
    status: 'not-run',
    durationMinutes: 0,
    observations: [],
    issuesRaised: [],
    evidenceCaptured: [],
    recommendation: 'Pending — threshold config hardcoded, cannot simulate alert for validation without source override.',
    blocksPilotExit: false,
    blocksProduction: false,
  },
  {
    executionId: 'EXE-006',
    scenarioId: 'SCN-006',
    executedBy: 'Not yet executed',
    executedRole: 'plant-manager',
    executedAt: '',
    scope: 'plant',
    status: 'not-run',
    durationMinutes: 0,
    observations: [],
    issuesRaised: [],
    evidenceCaptured: [],
    recommendation: 'Pending — RoleAwareHome pilot polish required before plant manager cross-domain scenario.',
    blocksPilotExit: true,
    blocksProduction: true,
  },
]

const SCENARIO_TITLES: Record<string, string> = {
  'SCN-001': 'Quality Lead releases a batch (cross-domain)',
  'SCN-002': 'Food Safety Lead investigates a trace event',
  'SCN-003': 'Operations Supervisor assesses plan risk',
  'SCN-004': 'Warehouse Manager prepares production staging',
  'SCN-005': 'Quality user monitors environmental risk',
  'SCN-006': 'Plant Manager reviews cross-domain site risk',
}

function statusVariant(status: ScenarioExecutionResultStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'passed') return 'default'
  if (status === 'passed-with-observations') return 'secondary'
  if (status === 'failed') return 'destructive'
  if (status === 'blocked') return 'destructive'
  return 'outline'
}

type ExecFilter = 'all' | 'passed' | 'in-progress' | 'not-run'

export function ScenarioExecutionTrackingPage() {
  const [filter, setFilter] = useState<ExecFilter>('all')

  const filtered = SCENARIO_EXECUTIONS.filter(e => {
    if (filter === 'passed') return e.status === 'passed' || e.status === 'passed-with-observations'
    if (filter === 'in-progress') return e.status === 'blocked' || e.status === 'deferred'
    if (filter === 'not-run') return e.status === 'not-run'
    return true
  })

  const passed = SCENARIO_EXECUTIONS.filter(e => e.status === 'passed' || e.status === 'passed-with-observations').length
  const passRate = Math.round((passed / SCENARIO_EXECUTIONS.length) * 100)

  return (
    <div data-testid="scenario-execution-tracking" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Scenario Execution Tracking</h1>
          <Badge variant="outline">Phase 8</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Execution results for the 6 pilot validation scenarios. Pass rate: <strong>{passRate}%</strong> ({passed}/{SCENARIO_EXECUTIONS.length}) — target ≥80%.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Total', value: SCENARIO_EXECUTIONS.length },
          { label: 'Passed (inc. w/ obs)', value: passed },
          { label: 'Pass Rate', value: `${passRate}%` },
          { label: 'Not Run', value: SCENARIO_EXECUTIONS.filter(e => e.status === 'not-run').length },
          { label: 'Blocks Prod Exit', value: SCENARIO_EXECUTIONS.filter(e => e.blocksPilotExit || e.blocksProduction).length },
        ].map(({ label, value }) => (
          <Card key={label} style={{ flex: '1 1 120px', minWidth: 100 }}>
            <CardContent style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--shell-fg)' }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={filter} onValueChange={v => setFilter(v as ExecFilter)}>
        <TabsList style={{ marginBottom: 16 }}>
          <TabsTrigger value="all">All ({SCENARIO_EXECUTIONS.length})</TabsTrigger>
          <TabsTrigger value="passed">Passed ({passed})</TabsTrigger>
          <TabsTrigger value="not-run">Not Run</TabsTrigger>
        </TabsList>
        <TabsContent value={filter}>
          {filtered.map(exe => (
            <Card key={exe.executionId} data-testid={`execution-${exe.executionId}`} style={{ marginBottom: 14 }}>
              <CardHeader style={{ paddingBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <CardTitle style={{ fontSize: 14 }}>{SCENARIO_TITLES[exe.scenarioId] ?? exe.scenarioId}</CardTitle>
                  <Badge variant={statusVariant(exe.status)}>{exe.status.replace(/-/g, ' ')}</Badge>
                  {exe.blocksProduction && <Badge variant="destructive">blocks production</Badge>}
                  {exe.blocksPilotExit && <Badge variant="destructive">blocks pilot exit</Badge>}
                </div>
                <CardDescription>
                  {exe.executionId} · {exe.scenarioId} · {exe.executedRole}
                  {exe.executedAt ? ` · ${exe.executedAt.slice(0, 10)}` : ' · not yet executed'}
                  {exe.durationMinutes > 0 ? ` · ${exe.durationMinutes} min` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {exe.observations.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Observations</div>
                    <ul style={{ margin: 0, paddingLeft: 14 }}>
                      {exe.observations.map((o, i) => <li key={i} style={{ fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 2 }}>{o}</li>)}
                    </ul>
                  </div>
                )}
                {exe.evidenceCaptured.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Evidence Captured</div>
                    <ul style={{ margin: 0, paddingLeft: 14 }}>
                      {exe.evidenceCaptured.map((e, i) => <li key={i} style={{ fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 2 }}>{e}</li>)}
                    </ul>
                  </div>
                )}
                {exe.issuesRaised.length > 0 && (
                  <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--shell-fg-3)' }}>
                    Issues raised: {exe.issuesRaised.join(', ')}
                  </div>
                )}
                <Separator style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 12, color: 'var(--shell-fg-2)', fontStyle: 'italic' }}>{exe.recommendation}</div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p style={{ color: 'var(--shell-fg-3)', fontSize: 13 }}>No executions match this filter.</p>}
        </TabsContent>
      </Tabs>
    </div>
  )
}
