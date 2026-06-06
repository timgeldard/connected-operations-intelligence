import { useState } from 'react'
import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle,
  Separator, Tabs, TabsContent, TabsList, TabsTrigger,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import type { PilotStatus } from '@connectio/product-model'
import type { ReadinessStatus, WorkspaceParityStatus } from '@connectio/product-model'

interface PilotWorkspaceEntry {
  readonly workspaceId: string
  readonly displayName: string
  readonly ownerDomain: string
  readonly lifecycle: 'live' | 'pilot' | 'concept-lab'
  readonly pilotStatus: PilotStatus
  readonly supportedRoles: readonly string[]
  readonly supportedScopes: readonly string[]
  readonly readinessStatus: ReadinessStatus
  readonly parityStatus: WorkspaceParityStatus
  readonly keyEvidencePanels: readonly string[]
  readonly keyActions: readonly string[]
  readonly knownGaps: readonly string[]
  readonly pilotRecommendation: string
}

const PILOT_WORKSPACES: readonly PilotWorkspaceEntry[] = [
  {
    workspaceId: 'trace-investigation',
    displayName: 'Trace Investigation',
    ownerDomain: 'traceability',
    lifecycle: 'live',
    pilotStatus: 'included',
    supportedRoles: ['food-safety-lead', 'quality-lead', 'qa-technician', 'plant-manager'],
    supportedScopes: ['plant', 'batch', 'material'],
    readinessStatus: 'ready',
    parityStatus: 'full-parity',
    keyEvidencePanels: ['BatchHeaderPanel', 'TraceGraphPanel', 'MaterialSupplierExposurePanel', 'CustomerImpactPanel', 'EventTimelinePanel', 'RiskSignalsPanel'],
    keyActions: ['New Investigation', 'Add Evidence', 'Escalate', 'Resolve'],
    knownGaps: [],
    pilotRecommendation: 'Ready for pilot validation. Highest priority scenario workspace.',
  },
  {
    workspaceId: 'quality-batch-release',
    displayName: 'Quality Batch Release',
    ownerDomain: 'quality',
    lifecycle: 'live',
    pilotStatus: 'included',
    supportedRoles: ['quality-lead', 'qa-technician', 'plant-manager'],
    supportedScopes: ['plant', 'batch'],
    readinessStatus: 'ready',
    parityStatus: 'full-parity',
    keyEvidencePanels: ['QualityResultsPanel', 'MICFailuresPanel', 'SPCSignalsPanel', 'ProcessOrderSummaryPanel', 'WarehouseHoldStatusPanel', 'TraceExposurePanel', 'CoAReadinessPanel', 'DeviationSummaryPanel'],
    keyActions: ['Release Batch', 'Place on Hold', 'Open Trace Investigation'],
    knownGaps: ['CoA generation not yet wired to source adapter'],
    pilotRecommendation: 'Core pilot workspace. Validate cross-domain evidence assembly.',
  },
  {
    workspaceId: 'operations-plan-risk',
    displayName: 'Operations Plan Risk',
    ownerDomain: 'operations',
    lifecycle: 'live',
    pilotStatus: 'included',
    supportedRoles: ['operations-supervisor', 'plant-manager'],
    supportedScopes: ['plant', 'line'],
    readinessStatus: 'ready-with-warnings',
    parityStatus: 'partial-parity',
    keyEvidencePanels: ['PlanRiskSummaryPanel', 'LateOrdersPanel', 'MaterialShortagePanel', 'WarehouseStagingStatusPanel', 'QualityBlockersPanel', 'LineStatusPanel'],
    keyActions: ['Escalate Blocker', 'Request Staging', 'Request Quality Review', 'Create Handover Note'],
    knownGaps: ['Action audit log not wired to telemetry', 'PhaseManager SAP integration pending'],
    pilotRecommendation: 'Include in pilot with known gap documentation. Validate operations supervisor scenario.',
  },
  {
    workspaceId: 'envmon-monitoring',
    displayName: 'Environmental Monitoring',
    ownerDomain: 'quality',
    lifecycle: 'live',
    pilotStatus: 'included',
    supportedRoles: ['quality-lead', 'qa-technician', 'plant-manager'],
    supportedScopes: ['plant', 'work-centre'],
    readinessStatus: 'ready-with-warnings',
    parityStatus: 'partial-parity',
    keyEvidencePanels: ['PlantRiskSummaryPanel', 'EnvironmentalAlertsPanel', 'HeatmapSummaryPanel', 'OrganismTrendPanel', 'CorrectiveActionStatusPanel'],
    keyActions: ['Acknowledge Alert', 'Create Corrective Action', 'Schedule Reswab'],
    knownGaps: ['Threshold config hardcoded — no source-driven override', 'EnvMon source read-only in pilot'],
    pilotRecommendation: 'Include in pilot. Validate quality user environmental monitoring scenario.',
  },
  {
    workspaceId: 'production-staging',
    displayName: 'Production Staging',
    ownerDomain: 'warehouse',
    lifecycle: 'live',
    pilotStatus: 'included',
    supportedRoles: ['warehouse-manager', 'operations-supervisor'],
    supportedScopes: ['plant', 'warehouse'],
    readinessStatus: 'ready',
    parityStatus: 'full-parity',
    keyEvidencePanels: ['StagingSummaryPanel', 'OpenTransferRequirementsPanel', 'ComponentAvailabilityPanel', 'MissingPicksPanel', 'QualityRestrictionsPanel', 'LineSideReadinessPanel'],
    keyActions: ['Prioritise Pick', 'Request Stock Release', 'Escalate Shortage', 'Confirm Staging'],
    knownGaps: [],
    pilotRecommendation: 'Ready for pilot. Validate warehouse manager staging scenario.',
  },
  {
    workspaceId: 'spc-monitoring',
    displayName: 'SPC Monitoring',
    ownerDomain: 'quality',
    lifecycle: 'pilot',
    pilotStatus: 'in-validation',
    supportedRoles: ['quality-lead', 'qa-technician'],
    supportedScopes: ['plant', 'line'],
    readinessStatus: 'ready-with-warnings',
    parityStatus: 'partial-parity',
    keyEvidencePanels: ['SPCSummaryPanel', 'ActiveSPCSignalsPanel', 'ControlChartPanel', 'AlarmHistoryPanel'],
    keyActions: ['Acknowledge Signal', 'Create Corrective Action'],
    knownGaps: ['SPC source connector not yet available', 'Control chart runs on mock data only'],
    pilotRecommendation: 'Include as pilot candidate. Flag SPC source dependency as blocker for production.',
  },
  {
    workspaceId: 'process-order-review',
    displayName: 'Process Order Review',
    ownerDomain: 'operations',
    lifecycle: 'pilot',
    pilotStatus: 'in-validation',
    supportedRoles: ['operations-supervisor', 'quality-lead'],
    supportedScopes: ['plant', 'process-order'],
    readinessStatus: 'ready-with-warnings',
    parityStatus: 'partial-parity',
    keyEvidencePanels: ['ProcessOrderHeaderPanel', 'OrderProgressPanel', 'QualityCheckpointPanel'],
    keyActions: ['Review Order', 'Flag Issue'],
    knownGaps: ['POH source integration pending', 'Action flows in draft state'],
    pilotRecommendation: 'Include as foundation pilot candidate. Validate process order visibility.',
  },
  {
    workspaceId: 'warehouse-360-overview',
    displayName: 'Warehouse 360 Overview',
    ownerDomain: 'warehouse',
    lifecycle: 'pilot',
    pilotStatus: 'in-validation',
    supportedRoles: ['warehouse-manager', 'plant-manager'],
    supportedScopes: ['plant', 'warehouse'],
    readinessStatus: 'ready-with-warnings',
    parityStatus: 'partial-parity',
    keyEvidencePanels: ['WarehouseOverviewPanel', 'HoldsManagementPanel', 'InventoryStatusPanel'],
    keyActions: ['Release Hold', 'Investigate Hold'],
    knownGaps: ['Warehouse360 WM source integration pending', 'Hold release action needs approval workflow'],
    pilotRecommendation: 'Include as pilot candidate. Cross-reference with Batch Release workspace.',
  },
  {
    workspaceId: 'maintenance-reliability',
    displayName: 'Maintenance & Reliability',
    ownerDomain: 'maintenance',
    lifecycle: 'pilot',
    pilotStatus: 'proposed',
    supportedRoles: ['maintenance-lead', 'plant-manager'],
    supportedScopes: ['plant', 'line', 'work-centre'],
    readinessStatus: 'ready-with-warnings',
    parityStatus: 'partial-parity',
    keyEvidencePanels: ['CriticalWorkOrdersPanel', 'MaintenanceRiskSummaryPanel', 'PMSchedulePanel'],
    keyActions: ['Acknowledge Work Order', 'Escalate to Supervisor'],
    knownGaps: ['SAP PM source contract pending', 'Maintenance M&R integration at foundation stage only'],
    pilotRecommendation: 'Include as foundation/pilot candidate. Validate plant manager cross-domain scenario.',
  },
]

type FilterView = 'all' | 'live' | 'pilot' | 'ready' | 'in-validation'

function pilotStatusVariant(status: PilotStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'included') return 'default'
  if (status === 'in-validation') return 'secondary'
  if (status === 'accepted' || status === 'accepted-with-actions') return 'default'
  if (status === 'rejected' || status === 'blocked') return 'destructive'
  return 'outline'
}

function readinessVariant(status: ReadinessStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'ready') return 'default'
  if (status === 'ready-with-warnings') return 'secondary'
  if (status === 'blocked') return 'destructive'
  return 'outline'
}

function readinessLabel(status: ReadinessStatus): string {
  if (status === 'ready') return 'Ready'
  if (status === 'ready-with-warnings') return 'Ready (warnings)'
  if (status === 'blocked') return 'Blocked'
  if (status === 'not-applicable') return 'N/A'
  return 'Not Assessed'
}

function KpiBar() {
  const included = PILOT_WORKSPACES.filter(w => w.pilotStatus === 'included' || w.pilotStatus === 'in-validation' || w.pilotStatus === 'accepted').length
  const ready = PILOT_WORKSPACES.filter(w => w.readinessStatus === 'ready').length
  const live = PILOT_WORKSPACES.filter(w => w.lifecycle === 'live').length
  const withGaps = PILOT_WORKSPACES.filter(w => w.knownGaps.length > 0).length

  const kpis = [
    { label: 'Total Workspaces', value: PILOT_WORKSPACES.length },
    { label: 'In Pilot', value: included },
    { label: 'Fully Ready', value: ready },
    { label: 'Live Lifecycle', value: live },
    { label: 'With Known Gaps', value: withGaps },
  ]

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      {kpis.map(({ label, value }) => (
        <Card key={label} style={{ flex: '1 1 140px', minWidth: 120 }}>
          <CardContent style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--shell-fg)' }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>{label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function WorkspaceCard({ entry }: { readonly entry: PilotWorkspaceEntry }) {
  return (
    <Card data-testid={`pilot-workspace-${entry.workspaceId}`} style={{ marginBottom: 16 }}>
      <CardHeader style={{ paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <CardTitle style={{ fontSize: 15 }}>{entry.displayName}</CardTitle>
          <Badge variant={pilotStatusVariant(entry.pilotStatus)}>{entry.pilotStatus.replace(/-/g, ' ')}</Badge>
          <Badge variant={readinessVariant(entry.readinessStatus)}>{readinessLabel(entry.readinessStatus)}</Badge>
          <Badge variant="outline">{entry.lifecycle}</Badge>
        </div>
        <CardDescription>{entry.workspaceId} · {entry.ownerDomain}</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Roles</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {entry.supportedRoles.map(r => <Badge key={r} variant="outline" style={{ fontSize: 10 }}>{r}</Badge>)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Scopes</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {entry.supportedScopes.map(s => <Badge key={s} variant="outline" style={{ fontSize: 10 }}>{s}</Badge>)}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Key Evidence Panels</div>
          <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{entry.keyEvidencePanels.join(' · ')}</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Key Actions</div>
          <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{entry.keyActions.join(' · ')}</div>
        </div>
        {entry.knownGaps.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Known Gaps</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {entry.knownGaps.map((gap, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 2 }}>{gap}</li>
              ))}
            </ul>
          </div>
        )}
        <Separator style={{ marginBottom: 10 }} />
        <div style={{ fontSize: 12, color: 'var(--shell-fg-2)', fontStyle: 'italic' }}>{entry.pilotRecommendation}</div>
      </CardContent>
    </Card>
  )
}

export function PilotWorkspacePackPage() {
  const [activeTab, setActiveTab] = useState<FilterView>('all')

  const filtered = PILOT_WORKSPACES.filter(w => {
    if (activeTab === 'live') return w.lifecycle === 'live'
    if (activeTab === 'pilot') return w.lifecycle === 'pilot'
    if (activeTab === 'ready') return w.readinessStatus === 'ready'
    if (activeTab === 'in-validation') return w.pilotStatus === 'in-validation'
    return true
  })

  return (
    <div data-testid="pilot-workspace-pack" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Pilot Workspace Pack</h1>
          <Badge variant="outline">Phase 7</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Which V2 workspaces are included in the controlled pilot, their readiness status, and pilot recommendation.
        </p>
      </div>

      <KpiBar />

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as FilterView)}>
        <TabsList style={{ marginBottom: 20 }}>
          <TabsTrigger value="all">All ({PILOT_WORKSPACES.length})</TabsTrigger>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="pilot">Pilot Lifecycle</TabsTrigger>
          <TabsTrigger value="ready">Fully Ready</TabsTrigger>
          <TabsTrigger value="in-validation">In Validation</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {filtered.length === 0 ? (
            <p style={{ color: 'var(--shell-fg-3)', fontSize: 13 }}>No workspaces match this filter.</p>
          ) : (
            filtered.map(entry => <WorkspaceCard key={entry.workspaceId} entry={entry} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
