import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import type { DataIntegrationReadiness, DataIntegrationStatus } from '@connectio/product-model'

const DATA_SOURCES: readonly DataIntegrationReadiness[] = [
  {
    sourceCapability: 'Trace2 source',
    sourceSystem: 'Intelex / Trace2',
    adapterName: 'TraceAdapter',
    targetWorkspaceIds: ['trace-investigation', 'quality-batch-release'],
    status: 'adapter-backed',
    dataContractCoverage: 'full',
    freshnessSupport: true,
    confidenceSupport: true,
    knownGaps: ['Trace graph depth beyond 3 levels causes performance degradation'],
    owner: 'traceability-domain',
    nextAction: 'Investigate trace graph virtualisation for deep graphs',
  },
  {
    sourceCapability: 'SPC source',
    sourceSystem: 'SPC Platform (TBD)',
    adapterName: 'SPCAdapter (mock)',
    targetWorkspaceIds: ['spc-monitoring', 'quality-batch-release'],
    status: 'mocked',
    dataContractCoverage: 'partial',
    freshnessSupport: false,
    confidenceSupport: false,
    knownGaps: ['SPC source connector not available', 'Control chart data is static mock only', 'Freshness/confidence not wired'],
    owner: 'quality-domain',
    nextAction: 'Confirm SPC source system and begin connector development',
  },
  {
    sourceCapability: 'EnvMon source',
    sourceSystem: 'EnvMon Platform',
    adapterName: 'EnvMonAdapter',
    targetWorkspaceIds: ['envmon-monitoring'],
    status: 'adapter-backed',
    dataContractCoverage: 'partial',
    freshnessSupport: true,
    confidenceSupport: false,
    knownGaps: ['Threshold config hardcoded — no source-driven override', 'Confidence scoring not available from source'],
    owner: 'quality-domain',
    nextAction: 'Request threshold config API from EnvMon platform team',
  },
  {
    sourceCapability: 'POH / Process Order source',
    sourceSystem: 'SAP ERP (POH)',
    adapterName: 'OperationsAdapter',
    targetWorkspaceIds: ['operations-plan-risk', 'process-order-review', 'quality-batch-release'],
    status: 'adapter-backed',
    dataContractCoverage: 'partial',
    freshnessSupport: true,
    confidenceSupport: false,
    knownGaps: ['PhaseManager integration pending for operations actions', 'Action audit log not persisted'],
    owner: 'operations-domain',
    nextAction: 'Confirm PhaseManager integration scope and timeline',
  },
  {
    sourceCapability: 'Warehouse360 / WM source',
    sourceSystem: 'Manhattan WM',
    adapterName: 'WarehouseAdapter (partial)',
    targetWorkspaceIds: ['production-staging', 'warehouse-360-overview', 'quality-batch-release'],
    status: 'adapter-backed',
    dataContractCoverage: 'partial',
    freshnessSupport: true,
    confidenceSupport: false,
    knownGaps: ['Warehouse360 full inventory integration pending', 'Hold release approval not yet implemented'],
    owner: 'warehouse-domain',
    nextAction: 'Complete Warehouse360 full integration contract with WM team',
  },
  {
    sourceCapability: 'Quality / inspection source',
    sourceSystem: 'LabWare LIMS',
    adapterName: 'QualityAdapter',
    targetWorkspaceIds: ['quality-batch-release', 'envmon-monitoring'],
    status: 'adapter-backed',
    dataContractCoverage: 'full',
    freshnessSupport: true,
    confidenceSupport: true,
    knownGaps: ['CoA generation API not wired — returns mock data', 'Deviation tracking partial'],
    owner: 'quality-domain',
    nextAction: 'Wire CoA generation API from LabWare before production',
  },
  {
    sourceCapability: 'Maintenance source',
    sourceSystem: 'SAP PM',
    adapterName: 'MaintenanceAdapter (mock)',
    targetWorkspaceIds: ['maintenance-reliability'],
    status: 'mocked',
    dataContractCoverage: 'partial',
    freshnessSupport: false,
    confidenceSupport: false,
    knownGaps: ['SAP PM source contract not signed', 'All maintenance data is mock-only', 'No live work order feed'],
    owner: 'maintenance-domain',
    nextAction: 'Sign SAP PM source contract and begin adapter development',
  },
  {
    sourceCapability: 'Dashboard / query source',
    sourceSystem: 'Internal API Gateway',
    adapterName: 'QueryAdapter',
    targetWorkspaceIds: ['trace-investigation', 'quality-batch-release', 'operations-plan-risk'],
    status: 'adapter-backed',
    dataContractCoverage: 'full',
    freshnessSupport: true,
    confidenceSupport: false,
    knownGaps: ['Cross-domain query aggregation not yet optimised for plant-scope queries'],
    owner: 'platform-engineering',
    nextAction: 'Profile and optimise plant-scope cross-domain queries',
  },
  {
    sourceCapability: 'Auth / session / scope source',
    sourceSystem: 'Identity Provider (Azure AD)',
    adapterName: 'AuthScopeProvider',
    targetWorkspaceIds: ['trace-investigation', 'quality-batch-release', 'operations-plan-risk', 'envmon-monitoring', 'production-staging'],
    status: 'adapter-backed',
    dataContractCoverage: 'full',
    freshnessSupport: false,
    confidenceSupport: false,
    knownGaps: ['Role claims not yet enforced at API level — client-only in pilot'],
    owner: 'platform-engineering',
    nextAction: 'Implement server-side role claim enforcement before production',
  },
  {
    sourceCapability: 'Telemetry source',
    sourceSystem: 'Internal Telemetry (mock)',
    adapterName: 'TelemetryHandler',
    targetWorkspaceIds: ['trace-investigation', 'quality-batch-release', 'operations-plan-risk'],
    status: 'mocked',
    dataContractCoverage: 'partial',
    freshnessSupport: false,
    confidenceSupport: false,
    knownGaps: ['Telemetry events not persisted to backend', 'Aggregation is front-end mock only', 'No real analytics pipeline'],
    owner: 'platform-engineering',
    nextAction: 'Design telemetry pipeline for pilot event capture',
  },
]

function statusVariant(status: DataIntegrationStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'source-integrated') return 'default'
  if (status === 'adapter-backed') return 'secondary'
  if (status === 'mocked') return 'outline'
  if (status === 'blocked') return 'destructive'
  return 'outline'
}

function coverageVariant(coverage: DataIntegrationReadiness['dataContractCoverage']): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (coverage === 'full') return 'default'
  if (coverage === 'partial') return 'secondary'
  return 'destructive'
}

function KpiBar() {
  const sourceIntegrated = DATA_SOURCES.filter(d => d.status === 'source-integrated').length
  const adapterBacked = DATA_SOURCES.filter(d => d.status === 'adapter-backed').length
  const mocked = DATA_SOURCES.filter(d => d.status === 'mocked').length
  const fullCoverage = DATA_SOURCES.filter(d => d.dataContractCoverage === 'full').length

  const kpis = [
    { label: 'Total Sources', value: DATA_SOURCES.length },
    { label: 'Source Integrated', value: sourceIntegrated },
    { label: 'Adapter Backed', value: adapterBacked },
    { label: 'Mock Only', value: mocked },
    { label: 'Full Contract Coverage', value: fullCoverage },
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

export function DataIntegrationReadinessPage() {
  return (
    <div data-testid="data-integration-readiness" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Data Integration Readiness Matrix</h1>
          <Badge variant="outline">Phase 7</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Source capability readiness for each data integration feeding pilot workspaces.
        </p>
      </div>
      <KpiBar />
      {DATA_SOURCES.map(source => (
        <Card key={source.sourceCapability} data-testid={`data-source-${source.sourceCapability.replace(/\s+/g, '-').toLowerCase()}`} style={{ marginBottom: 12 }}>
          <CardHeader style={{ paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <CardTitle style={{ fontSize: 14 }}>{source.sourceCapability}</CardTitle>
              <Badge variant={statusVariant(source.status)}>{source.status.replace(/-/g, ' ')}</Badge>
              <Badge variant={coverageVariant(source.dataContractCoverage)}>contract: {source.dataContractCoverage}</Badge>
              {source.freshnessSupport && <Badge variant="outline">freshness</Badge>}
              {source.confidenceSupport && <Badge variant="outline">confidence</Badge>}
            </div>
            <CardDescription>
              {source.sourceSystem} · adapter: {source.adapterName} · owner: {source.owner}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Target Workspaces</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {source.targetWorkspaceIds.map(w => <Badge key={w} variant="outline" style={{ fontSize: 10 }}>{w}</Badge>)}
              </div>
            </div>
            {source.knownGaps.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Known Gaps</div>
                <ul style={{ margin: 0, paddingLeft: 14 }}>
                  {source.knownGaps.map((g, i) => <li key={i} style={{ fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 1 }}>{g}</li>)}
                </ul>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--shell-fg-2)', fontStyle: 'italic' }}>Next: {source.nextAction}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
