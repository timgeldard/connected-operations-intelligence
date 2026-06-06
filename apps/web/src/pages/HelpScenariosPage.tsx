import {
  Badge, Card, CardContent, CardHeader, CardTitle, CardDescription, Separator,
} from '@connectio/design-system'
import { useWorkspaceShellState } from '../shell/useWorkspaceShellState.js'

interface TrainingScenarioLink {
  readonly scenarioId: string
  readonly title: string
  readonly personaRole: string
  readonly primaryWorkspace: string
  readonly primaryWorkspaceId: string
  readonly estimatedMinutes: number
  readonly difficulty: 'introductory' | 'standard' | 'advanced'
  readonly steps: readonly string[]
}

const TRAINING_SCENARIOS: readonly TrainingScenarioLink[] = [
  {
    scenarioId: 'TRN-001',
    title: 'Release your first batch in V2',
    personaRole: 'quality-lead',
    primaryWorkspace: 'Quality Batch Release',
    primaryWorkspaceId: 'quality-batch-release',
    estimatedMinutes: 15,
    difficulty: 'introductory',
    steps: [
      'Open the Quality Batch Release workspace',
      'Select the Release Queue view',
      'Choose a batch with status "under-review"',
      'Switch to the Batch Decision view',
      'Review the 8 evidence panels',
      'Check for SPC signals and quality results',
      'Use "Open Trace Investigation" drill-through to verify trace',
      'Return to Batch Release and initiate the Release Batch action',
    ],
  },
  {
    scenarioId: 'TRN-002',
    title: 'Investigate a trace event',
    personaRole: 'food-safety-lead',
    primaryWorkspace: 'Trace Investigation',
    primaryWorkspaceId: 'trace-investigation',
    estimatedMinutes: 20,
    difficulty: 'standard',
    steps: [
      'Open the Trace Investigation workspace',
      'Create a new investigation using the "New Investigation" action',
      'Review the Trace Graph panel to see supplier exposure',
      'Check the Customer Impact panel for distribution exposure',
      'Review the Event Timeline panel for chronological events',
      'Check Risk Signals panel for associated alerts',
      'Add evidence to the investigation',
      'Escalate the investigation if required',
    ],
  },
  {
    scenarioId: 'TRN-003',
    title: 'Check your shift plan risk',
    personaRole: 'operations-supervisor',
    primaryWorkspace: 'Operations Plan Risk',
    primaryWorkspaceId: 'operations-plan-risk',
    estimatedMinutes: 10,
    difficulty: 'introductory',
    steps: [
      'Open the Operations Plan Risk workspace',
      'Review the Plan Risk Summary panel',
      'Check for late orders in the Late Orders panel',
      'Review material shortages',
      'Check quality blockers panel for release constraints',
      'Use the Escalate Blocker action if critical',
      'Create a Handover Note if passing shift',
    ],
  },
  {
    scenarioId: 'TRN-004',
    title: 'Confirm production staging readiness',
    personaRole: 'warehouse-manager',
    primaryWorkspace: 'Production Staging',
    primaryWorkspaceId: 'production-staging',
    estimatedMinutes: 12,
    difficulty: 'standard',
    steps: [
      'Open the Production Staging workspace',
      'Review the Staging Summary panel for overall readiness',
      'Check missing picks in the Missing Picks panel',
      'Review quality restrictions that may block staging',
      'Prioritise any open picks using the Prioritise Pick action',
      'Check line-side readiness before confirming staging',
      'Use Confirm Staging action to complete the session',
    ],
  },
  {
    scenarioId: 'TRN-005',
    title: 'Monitor environmental risk at plant scope',
    personaRole: 'quality-lead',
    primaryWorkspace: 'Environmental Monitoring',
    primaryWorkspaceId: 'envmon-monitoring',
    estimatedMinutes: 10,
    difficulty: 'introductory',
    steps: [
      'Open the Environmental Monitoring workspace',
      'Review the Plant Risk Summary panel',
      'Check the Environmental Alerts panel for active detections',
      'Review the Heatmap to identify high-risk zones',
      'Check the Organism Trend panel for recurring organisms',
      'Acknowledge active alerts using the Acknowledge Alert action',
      'Create a corrective action if required',
    ],
  },
  {
    scenarioId: 'TRN-006',
    title: 'Plant manager cross-domain site review',
    personaRole: 'plant-manager',
    primaryWorkspace: 'Home Screen (All Domains)',
    primaryWorkspaceId: '',
    estimatedMinutes: 20,
    difficulty: 'advanced',
    steps: [
      'Start at the home screen — review all domain priority sections',
      'Check Quality Batch Release priority items',
      'Check Operations Plan Risk summary',
      'Check Environmental Monitoring active alerts',
      'Check Production Staging readiness',
      'Check SPC active signals',
      'Check Warehouse open holds',
      'Check Maintenance priority work orders',
      'Drill into any workspace needing attention',
      'No legacy app navigation required',
    ],
  },
]

function difficultyVariant(difficulty: TrainingScenarioLink['difficulty']): 'default' | 'secondary' | 'outline' {
  if (difficulty === 'introductory') return 'default'
  if (difficulty === 'standard') return 'secondary'
  return 'outline'
}

export function HelpScenariosPage() {
  const { setWorkspace } = useWorkspaceShellState()

  return (
    <div data-testid="help-scenarios" style={{ padding: '32px 40px', maxWidth: 820 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Scenario Review Guide</h1>
          <Badge variant="outline">Pilot</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--shell-fg-2)', lineHeight: 1.6 }}>
          Step-by-step training scenarios to help you learn ConnectIO-RAD V2 through your real work. Each scenario is based on a business validation scenario from the Scenario Validation Centre.
        </p>
      </div>

      {TRAINING_SCENARIOS.map(scenario => (
        <Card key={scenario.scenarioId} data-testid={`training-scenario-${scenario.scenarioId}`} style={{ marginBottom: 16 }}>
          <CardHeader style={{ paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <CardTitle style={{ fontSize: 15 }}>{scenario.title}</CardTitle>
              <Badge variant={difficultyVariant(scenario.difficulty)}>{scenario.difficulty}</Badge>
              <Badge variant="outline">{scenario.estimatedMinutes} min</Badge>
            </div>
            <CardDescription>
              {scenario.scenarioId} · Role: {scenario.personaRole} · Workspace: {scenario.primaryWorkspace}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Steps</div>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {scenario.steps.map((step, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--shell-fg-2)', marginBottom: 4, lineHeight: 1.5 }}>{step}</li>
                ))}
              </ol>
            </div>
            {scenario.primaryWorkspaceId && (
              <>
                <Separator style={{ marginBottom: 10 }} />
                <button
                  type="button"
                  onClick={() => setWorkspace(scenario.primaryWorkspaceId)}
                  style={{
                    padding: '6px 14px',
                    background: 'var(--shell-rail-active, var(--valentia-slate, #005776))',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  Open {scenario.primaryWorkspace}
                </button>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
