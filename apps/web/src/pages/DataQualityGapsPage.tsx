import { useState } from 'react'
import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import type { DataQualityGap } from '@connectio/product-model'

const DATA_QUALITY_GAPS: readonly DataQualityGap[] = [
  {
    gapId: 'DQG-001', sourceSystem: 'Coda (ERP)', workspaceId: 'quality-batch-release', panelId: 'coa-panel', description: 'CoA data not available via API — panel shows placeholder content. Source API contract not yet agreed.', severity: 'critical', owner: 'integration-team', status: 'open', workaround: 'Panel shows placeholder with disclaimer. Users informed via pilot briefing.', targetResolution: '2026-06-30', blocksProduction: true,
  },
  {
    gapId: 'DQG-002', sourceSystem: 'eDMS', workspaceId: 'trace-investigation', panelId: 'event-timeline-panel', description: 'EventTimelinePanel uses mock timestamps — ERP event log integration not connected to eDMS.', severity: 'warning', owner: 'data-team', status: 'open', workaround: 'Mock timestamps clearly labelled as demo data. Not blocking pilot scenario execution.', targetResolution: '2026-07-01', blocksProduction: true,
  },
  {
    gapId: 'DQG-003', sourceSystem: 'PhaseManager (MES)', workspaceId: 'operations-plan-risk', panelId: 'material-shortage-panel', description: 'PhaseManager batch schedule data not available in IE10 pilot environment. MaterialShortagePanel uses seeded mock data.', severity: 'warning', owner: 'integration-team', status: 'open', workaround: 'Seeded mock data used. Risk is that mock data does not reflect real production schedule shape.', targetResolution: '2026-06-30', blocksProduction: true,
  },
  {
    gapId: 'DQG-004', sourceSystem: 'SPC Connector (OSIsoft PI)', workspaceId: 'spc-monitoring', panelId: 'spc-summary-panel', description: 'SPC source connector not deployed to IE10. All SPC data is simulated from static mock fixtures.', severity: 'warning', owner: 'spc-team', status: 'workaround-in-place', workaround: 'Simulated SPC data clearly labelled in UI. Users aware this is non-production data during pilot.', targetResolution: '2026-06-15', blocksProduction: false,
  },
  {
    gapId: 'DQG-005', sourceSystem: 'SAP PM (CMMS)', workspaceId: 'maintenance-reliability', panelId: 'work-order-panel', description: 'SAP PM integration not started. Workspace cannot be piloted. All Maintenance Reliability data is placeholder.', severity: 'blocker', owner: 'procurement-team', status: 'open', workaround: 'Workspace excluded from pilot scope until contract signed.', targetResolution: '2026-06-01', blocksProduction: true,
  },
  {
    gapId: 'DQG-006', sourceSystem: 'WM System (SAP WM)', workspaceId: 'warehouse-360-overview', panelId: 'staging-allocation-panel', description: 'Warehouse staging allocation data sourced from mock — SAP WM connector configured but data refresh not enabled.', severity: 'info', owner: 'warehouse-team', status: 'workaround-in-place', workaround: 'Mock data covers the main scenarios. Confirm Staging action wired to correct workflow endpoint.', targetResolution: '2026-07-01', blocksProduction: false,
  },
  {
    gapId: 'DQG-007', sourceSystem: 'EnvMon Sensor API', workspaceId: 'envmon-monitoring', panelId: 'sensor-status-panel', description: 'Environmental monitoring sensor readings use simulated data. Sensor API available but not yet connected to V2 data contract.', severity: 'warning', owner: 'qa-team', status: 'open', workaround: 'Simulated sensor readings. Users informed this is mock data for pilot evaluation only.', targetResolution: '2026-06-30', blocksProduction: true,
  },
  {
    gapId: 'DQG-008', sourceSystem: 'Coda (ERP) — Batch Master', workspaceId: 'quality-batch-release', panelId: 'batch-summary-panel', description: 'Batch master data comes from mock fixture. Some batch attributes (ingredient lots, yield) do not match live Coda values.', severity: 'info', owner: 'data-team', status: 'accepted-risk', workaround: 'Accepted for pilot. Batch master gap documented as known pilot limitation.', targetResolution: '2026-06-30', blocksProduction: false,
  },
  {
    gapId: 'DQG-009', sourceSystem: 'SPC Connector (OSIsoft PI) — Control Limits', workspaceId: 'spc-monitoring', panelId: 'control-chart-panel', description: 'Control chart limits are hardcoded in mock data. Real SPC connector would derive limits from process history.', severity: 'warning', owner: 'spc-team', status: 'open', workaround: 'Hardcoded limits approximate real values from manual review. Will be replaced when connector deployed.', targetResolution: '2026-06-15', blocksProduction: false,
  },
  {
    gapId: 'DQG-010', sourceSystem: 'IAM / SSO (Azure AD)', workspaceId: 'all', panelId: null, description: 'Role assignments derived from Azure AD groups. Pilot test users may not have exact production group memberships.', severity: 'info', owner: 'security-team', status: 'resolved', workaround: '', targetResolution: '2026-05-10', blocksProduction: false,
  },
]

function statusVariant(status: DataQualityGap['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'resolved' || status === 'accepted-risk') return 'default'
  if (status === 'workaround-in-place') return 'secondary'
  if (status === 'open') return 'destructive'
  return 'outline'
}

function severityColor(severity: string): string {
  if (severity === 'blocker' || severity === 'critical') return '#DC2626'
  if (severity === 'warning') return '#D97706'
  return '#6B7280'
}

type GapFilter = 'all' | 'open' | 'prod-blockers' | 'resolved'

export function DataQualityGapsPage() {
  const [filter, setFilter] = useState<GapFilter>('all')

  const openGaps = DATA_QUALITY_GAPS.filter(g => g.status === 'open').length
  const prodBlockers = DATA_QUALITY_GAPS.filter(g => g.blocksProduction && g.status === 'open').length
  const resolved = DATA_QUALITY_GAPS.filter(g => g.status === 'resolved' || g.status === 'accepted-risk').length

  const filtered = DATA_QUALITY_GAPS.filter(gap => {
    if (filter === 'open') return gap.status === 'open'
    if (filter === 'prod-blockers') return gap.blocksProduction && gap.status === 'open'
    if (filter === 'resolved') return gap.status === 'resolved' || gap.status === 'accepted-risk'
    return true
  })

  return (
    <div data-testid="data-quality-gaps" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Data Quality Gaps</h1>
          <Badge variant="outline">Phase 8</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Gaps between mock/simulated data and real source system data identified during pilot execution. {openGaps} open, {prodBlockers} blocking production.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: 'Total Gaps', value: DATA_QUALITY_GAPS.length },
          { label: 'Open', value: openGaps, danger: openGaps > 0 },
          { label: 'Workaround In Place', value: DATA_QUALITY_GAPS.filter(g => g.status === 'workaround-in-place').length },
          { label: 'Production Blockers', value: prodBlockers, danger: prodBlockers > 0 },
          { label: 'Resolved / Accepted', value: resolved },
        ].map(({ label, value, danger }) => (
          <Card key={label} style={{ flex: '1 1 120px', minWidth: 100, border: danger ? '1px solid #DC2626' : undefined }}>
            <CardContent style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: danger ? '#DC2626' : 'var(--shell-fg)' }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={filter} onValueChange={v => setFilter(v as GapFilter)}>
        <TabsList style={{ marginBottom: 16 }}>
          <TabsTrigger value="all">All ({DATA_QUALITY_GAPS.length})</TabsTrigger>
          <TabsTrigger value="open">Open ({openGaps})</TabsTrigger>
          <TabsTrigger value="prod-blockers">Prod Blockers ({prodBlockers})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolved})</TabsTrigger>
        </TabsList>
        <TabsContent value={filter}>
          {filtered.map(gap => (
            <Card key={gap.gapId} data-testid={`gap-${gap.gapId}`} style={{ marginBottom: 12 }}>
              <CardHeader style={{ paddingBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <CardTitle style={{ fontSize: 14 }}>{gap.sourceSystem}</CardTitle>
                  <Badge variant={statusVariant(gap.status)}>{gap.status.replace(/-/g, ' ')}</Badge>
                  <span style={{ fontSize: 11, fontWeight: 600, color: severityColor(gap.severity) }}>{gap.severity}</span>
                  {gap.blocksProduction && gap.status === 'open' && <Badge variant="destructive">blocks production</Badge>}
                </div>
                <CardDescription>
                  {gap.gapId} · {gap.workspaceId}{gap.panelId ? ` / ${gap.panelId}` : ''} · owner: {gap.owner} · target: {gap.targetResolution}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--shell-fg-2)' }}>{gap.description}</p>
                {gap.workaround && (
                  <div style={{ fontSize: 11, color: '#D97706', fontStyle: 'italic' }}>Workaround: {gap.workaround}</div>
                )}
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p style={{ color: 'var(--shell-fg-3)', fontSize: 13 }}>No gaps match this filter.</p>}
        </TabsContent>
      </Tabs>
    </div>
  )
}
