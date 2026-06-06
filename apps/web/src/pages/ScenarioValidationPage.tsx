import { useState } from 'react'
import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle,
  Separator, Tabs, TabsContent, TabsList, TabsTrigger,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import type { ValidationScenario, ValidationScenarioStatus } from '@connectio/product-model'

const VALIDATION_SCENARIOS: readonly ValidationScenario[] = [
  {
    scenarioId: 'SCN-001',
    title: 'Quality Lead releases a batch with cross-domain evidence',
    description: 'Validate that a Quality Lead can access all required evidence and release a batch within the Quality Batch Release workspace.',
    personaRole: 'quality-lead',
    primaryWorkspaceId: 'quality-batch-release',
    supportingWorkspaceIds: ['trace-investigation', 'spc-monitoring', 'warehouse-360-overview'],
    scopeLevel: 'batch',
    businessGoal: 'Demonstrate end-to-end batch release decision with cross-domain evidence assembly.',
    startingContext: 'Quality Lead has a batch under review with a pending release decision. Batch has been flagged by SPC signal.',
    expectedEvidencePanels: ['QualityResultsPanel', 'MICFailuresPanel', 'SPCSignalsPanel', 'ProcessOrderSummaryPanel', 'WarehouseHoldStatusPanel', 'TraceExposurePanel', 'CoAReadinessPanel', 'DeviationSummaryPanel'],
    expectedActions: ['Release Batch', 'Place on Hold', 'Open Trace Investigation'],
    expectedDrillThroughs: ['drill-through to Trace Investigation', 'drill-through to SPC Monitoring'],
    acceptanceCriteria: [
      'All 8 evidence panels visible and load without error',
      'Release Batch action is available and can be initiated',
      'Trace drill-through navigates to Trace Investigation workspace',
      'SPC signal panel shows associated alarms for the batch',
      'Hold status is visible from warehouse evidence panel',
    ],
    status: 'in-progress',
    owner: 'Mary Connolly',
    lastValidatedAt: '2026-05-10T09:00:00Z',
    findings: ['CoA generation not wired to source — mock data only', 'SPCSignalsPanel requires batch context to filter correctly'],
    blocksPilotExit: true,
    blocksProduction: true,
  },
  {
    scenarioId: 'SCN-002',
    title: 'Food Safety Lead investigates a trace event',
    description: 'Validate that a Food Safety Lead can initiate and manage a trace investigation within the Trace Investigation workspace.',
    personaRole: 'food-safety-lead',
    primaryWorkspaceId: 'trace-investigation',
    supportingWorkspaceIds: [],
    scopeLevel: 'batch',
    businessGoal: 'Prove trace investigation capability replaces Intelex-based recall initiation.',
    startingContext: 'Food Safety Lead has received an alert about a potential Listeria positive. They need to initiate a trace investigation.',
    expectedEvidencePanels: ['BatchHeaderPanel', 'TraceGraphPanel', 'MaterialSupplierExposurePanel', 'CustomerImpactPanel', 'EventTimelinePanel', 'RiskSignalsPanel'],
    expectedActions: ['New Investigation', 'Add Evidence', 'Escalate', 'Resolve'],
    expectedDrillThroughs: ['drill-through to affected batch records'],
    acceptanceCriteria: [
      'All 6 evidence panels visible and load without error',
      'Trace graph renders supplier and customer exposure correctly',
      'New Investigation action creates a case with correct metadata',
      'Escalate action is available and creates a record',
      'Resolve action marks the investigation as closed',
    ],
    status: 'passed-with-observations',
    owner: 'Siobhan Walsh',
    lastValidatedAt: '2026-05-12T14:30:00Z',
    findings: ['EventTimelinePanel shows mock timestamps only — source timestamps not yet wired'],
    blocksPilotExit: true,
    blocksProduction: true,
  },
  {
    scenarioId: 'SCN-003',
    title: 'Operations Supervisor assesses today\'s plan risk',
    description: 'Validate that an Operations Supervisor can view and act on plan risk using the Operations Plan Risk workspace.',
    personaRole: 'operations-supervisor',
    primaryWorkspaceId: 'operations-plan-risk',
    supportingWorkspaceIds: ['production-staging'],
    scopeLevel: 'plant',
    businessGoal: 'Replace daily PhaseManager plan risk check with V2 cross-domain risk summary.',
    startingContext: 'Operations Supervisor starts their shift and needs to assess the current plan risk across their plant.',
    expectedEvidencePanels: ['PlanRiskSummaryPanel', 'LateOrdersPanel', 'MaterialShortagePanel', 'WarehouseStagingStatusPanel', 'QualityBlockersPanel', 'LineStatusPanel'],
    expectedActions: ['Escalate Blocker', 'Request Staging', 'Request Quality Review', 'Create Handover Note'],
    expectedDrillThroughs: ['drill-through to Production Staging workspace'],
    acceptanceCriteria: [
      'All 6 evidence panels load with plan date context',
      'Plan risk summary aggregates blockers correctly',
      'Escalate Blocker action records the escalation',
      'Handover note creation is available',
      'Staging status panel cross-references warehouse data',
    ],
    status: 'in-progress',
    owner: 'Declan Horgan',
    lastValidatedAt: '2026-05-09T11:00:00Z',
    findings: ['Action audit log not wired — escalations not persisted', 'PhaseManager integration pending'],
    blocksPilotExit: true,
    blocksProduction: false,
  },
  {
    scenarioId: 'SCN-004',
    title: 'Warehouse Manager prepares production staging',
    description: 'Validate that a Warehouse Manager can assess staging readiness and act on shortfalls using the Production Staging workspace.',
    personaRole: 'warehouse-manager',
    primaryWorkspaceId: 'production-staging',
    supportingWorkspaceIds: ['warehouse-360-overview'],
    scopeLevel: 'warehouse',
    businessGoal: 'Replace manual staging check process with V2 unified staging readiness workspace.',
    startingContext: 'Warehouse Manager needs to confirm staging readiness for today\'s production plan before line start.',
    expectedEvidencePanels: ['StagingSummaryPanel', 'OpenTransferRequirementsPanel', 'ComponentAvailabilityPanel', 'MissingPicksPanel', 'QualityRestrictionsPanel', 'LineSideReadinessPanel'],
    expectedActions: ['Prioritise Pick', 'Request Stock Release', 'Escalate Shortage', 'Confirm Staging'],
    expectedDrillThroughs: ['drill-through to Warehouse 360 holds'],
    acceptanceCriteria: [
      'All 6 evidence panels load with warehouse and plan date context',
      'Missing picks panel identifies shortfalls correctly',
      'Confirm Staging action marks the session as complete',
      'Quality restrictions panel shows active holds',
      'Line-side readiness reflects current pick completion',
    ],
    status: 'passed',
    owner: 'Aoife Murphy',
    lastValidatedAt: '2026-05-14T08:00:00Z',
    findings: [],
    blocksPilotExit: true,
    blocksProduction: true,
  },
  {
    scenarioId: 'SCN-005',
    title: 'Quality user monitors environmental risk at plant scope',
    description: 'Validate that a Quality Lead can monitor environmental risk and act on alerts using the Environmental Monitoring workspace.',
    personaRole: 'quality-lead',
    primaryWorkspaceId: 'envmon-monitoring',
    supportingWorkspaceIds: [],
    scopeLevel: 'plant',
    businessGoal: 'Demonstrate environmental risk monitoring as a unified zone-level heatmap with alert management.',
    startingContext: 'Quality Lead starts their day and checks for any new environmental detections or alerts.',
    expectedEvidencePanels: ['PlantRiskSummaryPanel', 'EnvironmentalAlertsPanel', 'HeatmapSummaryPanel', 'OrganismTrendPanel', 'CorrectiveActionStatusPanel'],
    expectedActions: ['Acknowledge Alert', 'Create Corrective Action', 'Schedule Reswab'],
    expectedDrillThroughs: [],
    acceptanceCriteria: [
      'All 5 evidence panels load at plant scope',
      'Heatmap shows zone risk correctly',
      'Alert acknowledgement action creates a timestamped record',
      'Corrective action creation captures zone and organism context',
      'Organism trend panel shows historical detection pattern',
    ],
    status: 'not-started',
    owner: 'Cliona McCarthy',
    lastValidatedAt: null,
    findings: ['Threshold config hardcoded — cannot simulate threshold breach for validation'],
    blocksPilotExit: false,
    blocksProduction: false,
  },
  {
    scenarioId: 'SCN-006',
    title: 'Plant Manager reviews cross-domain site risk',
    description: 'Validate that a Plant Manager can assess site-level risk across domains from the home screen and drill into workspace detail.',
    personaRole: 'plant-manager',
    primaryWorkspaceId: 'trace-investigation',
    supportingWorkspaceIds: ['operations-plan-risk', 'envmon-monitoring', 'quality-batch-release', 'warehouse-360-overview', 'maintenance-reliability'],
    scopeLevel: 'plant',
    businessGoal: 'Prove Plant Manager can assess cross-domain risk without switching between legacy apps.',
    startingContext: 'Plant Manager arrives on site and checks the home screen for priority items across all domains.',
    expectedEvidencePanels: ['cross-domain risk summary', 'plan risk summary', 'environmental risk summary', 'release blockers', 'staging risk', 'maintenance risk'],
    expectedActions: ['Navigate to priority workspace', 'Drill into risk detail'],
    expectedDrillThroughs: ['home → Operations Plan Risk', 'home → Environmental Monitoring', 'home → Batch Release'],
    acceptanceCriteria: [
      'Home screen shows priority items from all 6 domains',
      'Each domain section allows drill-through to relevant workspace',
      'No legacy app navigation is required',
      'Cross-domain risk summary is visible without scope selection',
      'Maintenance risk section visible for plant manager role',
    ],
    status: 'not-started',
    owner: 'Niall Brennan',
    lastValidatedAt: null,
    findings: ['RoleAwareHome not yet personalised for plant-manager role — Phase 7 polish required'],
    blocksPilotExit: true,
    blocksProduction: true,
  },
]

function statusVariant(status: ValidationScenarioStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'passed') return 'default'
  if (status === 'passed-with-observations') return 'secondary'
  if (status === 'failed') return 'destructive'
  if (status === 'blocked') return 'destructive'
  if (status === 'in-progress') return 'secondary'
  return 'outline'
}

function statusLabel(status: ValidationScenarioStatus): string {
  return status.replace(/-/g, ' ')
}

function KpiBar() {
  const passed = VALIDATION_SCENARIOS.filter(s => s.status === 'passed' || s.status === 'passed-with-observations').length
  const failed = VALIDATION_SCENARIOS.filter(s => s.status === 'failed').length
  const inProgress = VALIDATION_SCENARIOS.filter(s => s.status === 'in-progress').length
  const notStarted = VALIDATION_SCENARIOS.filter(s => s.status === 'not-started').length
  const blocking = VALIDATION_SCENARIOS.filter(s => s.blocksPilotExit).length

  const kpis = [
    { label: 'Total Scenarios', value: VALIDATION_SCENARIOS.length },
    { label: 'Passed', value: passed },
    { label: 'In Progress', value: inProgress },
    { label: 'Failed', value: failed },
    { label: 'Not Started', value: notStarted },
    { label: 'Blocks Pilot Exit', value: blocking },
  ]

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      {kpis.map(({ label, value }) => (
        <Card key={label} style={{ flex: '1 1 120px', minWidth: 100 }}>
          <CardContent style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--shell-fg)' }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>{label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ScenarioCard({ scenario }: { readonly scenario: ValidationScenario }) {
  return (
    <Card
      data-testid={`scenario-${scenario.scenarioId}`}
      style={{ marginBottom: 16 }}
    >
      <CardHeader style={{ paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <CardTitle style={{ fontSize: 15 }}>{scenario.title}</CardTitle>
          <Badge variant={statusVariant(scenario.status)}>{statusLabel(scenario.status)}</Badge>
          {scenario.blocksPilotExit && <Badge variant="destructive">blocks pilot exit</Badge>}
          {scenario.blocksProduction && <Badge variant="destructive">blocks production</Badge>}
        </div>
        <CardDescription>
          {scenario.scenarioId} · {scenario.personaRole} · {scenario.primaryWorkspaceId} · scope: {scenario.scopeLevel}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Business Goal</div>
          <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{scenario.businessGoal}</div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Starting Context</div>
          <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{scenario.startingContext}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Evidence Panels</div>
            <ul style={{ margin: 0, paddingLeft: 14 }}>
              {scenario.expectedEvidencePanels.map((p, i) => (
                <li key={i} style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginBottom: 1 }}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Actions</div>
            <ul style={{ margin: 0, paddingLeft: 14 }}>
              {scenario.expectedActions.map((a, i) => (
                <li key={i} style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginBottom: 1 }}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Acceptance Criteria</div>
          <ul style={{ margin: 0, paddingLeft: 14 }}>
            {scenario.acceptanceCriteria.map((c, i) => (
              <li key={i} style={{ fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 2 }}>{c}</li>
            ))}
          </ul>
        </div>
        {scenario.findings.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Findings</div>
            <ul style={{ margin: 0, paddingLeft: 14 }}>
              {scenario.findings.map((f, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 2 }}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        <Separator style={{ marginBottom: 10 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--shell-fg-3)' }}>
          <span>Owner: {scenario.owner}</span>
          <span>{scenario.lastValidatedAt ? `Last validated: ${scenario.lastValidatedAt.slice(0, 10)}` : 'Not yet validated'}</span>
        </div>
      </CardContent>
    </Card>
  )
}

type ScenarioFilter = 'all' | 'passed' | 'in-progress' | 'not-started' | 'blocking'

export function ScenarioValidationPage() {
  const [activeTab, setActiveTab] = useState<ScenarioFilter>('all')

  const filtered = VALIDATION_SCENARIOS.filter(s => {
    if (activeTab === 'passed') return s.status === 'passed' || s.status === 'passed-with-observations'
    if (activeTab === 'in-progress') return s.status === 'in-progress'
    if (activeTab === 'not-started') return s.status === 'not-started'
    if (activeTab === 'blocking') return s.blocksPilotExit
    return true
  })

  return (
    <div data-testid="scenario-validation-centre" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Scenario Validation Centre</h1>
          <Badge variant="outline">Phase 7</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Validate V2 by business scenario, not by app. Each scenario maps a real user journey to required evidence, actions, and acceptance criteria.
        </p>
      </div>

      <KpiBar />

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as ScenarioFilter)}>
        <TabsList style={{ marginBottom: 20 }}>
          <TabsTrigger value="all">All ({VALIDATION_SCENARIOS.length})</TabsTrigger>
          <TabsTrigger value="passed">Passed</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress</TabsTrigger>
          <TabsTrigger value="not-started">Not Started</TabsTrigger>
          <TabsTrigger value="blocking">Pilot Exit Blockers</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {filtered.length === 0 ? (
            <p style={{ color: 'var(--shell-fg-3)', fontSize: 13 }}>No scenarios match this filter.</p>
          ) : (
            filtered.map(s => <ScenarioCard key={s.scenarioId} scenario={s} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
