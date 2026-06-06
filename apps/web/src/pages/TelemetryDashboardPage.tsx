// Phase 6 — telemetry dashboard with mock event data representing IE10 pilot usage.
import { useState } from 'react'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
  Separator,
} from '@connectio/design-system'
import type { TelemetryEvent } from '@connectio/telemetry'

// ─── Mock event log ───────────────────────────────────────────────────────────
//
// Representative sample of telemetry events that would be captured in a real
// deployment. Format matches TelemetryEvent from @connectio/telemetry.

const MOCK_EVENTS: readonly TelemetryEvent[] = [
  { name: 'workspace.viewed', workspaceId: 'trace-investigation', userId: 'u-001', timestamp: '2026-05-15T08:03:12.000Z', properties: { viewId: 'overview', durationMs: 12400 } },
  { name: 'workspace.viewed', workspaceId: 'quality-batch-release', userId: 'u-002', timestamp: '2026-05-15T08:11:34.000Z', properties: { viewId: 'batch-decision', durationMs: 8700 } },
  { name: 'panel.loaded', panelId: 'batch-kpi-summary', workspaceId: 'quality-batch-release', userId: 'u-002', timestamp: '2026-05-15T08:11:41.000Z', properties: { loadMs: 234 } },
  { name: 'panel.loaded', panelId: 'batch-timeline', workspaceId: 'quality-batch-release', userId: 'u-002', timestamp: '2026-05-15T08:11:42.000Z', properties: { loadMs: 187 } },
  { name: 'action.completed', workspaceId: 'quality-batch-release', userId: 'u-002', timestamp: '2026-05-15T08:18:05.000Z', properties: { actionId: 'batch-decision', outcome: 'approved' } },
  { name: 'drill-through.navigated', workspaceId: 'quality-batch-release', userId: 'u-002', timestamp: '2026-05-15T08:18:06.000Z', properties: { targetWorkspaceId: 'trace-investigation', targetViewId: 'overview' } },
  { name: 'workspace.viewed', workspaceId: 'trace-investigation', userId: 'u-002', timestamp: '2026-05-15T08:18:08.000Z', properties: { viewId: 'overview', durationMs: 3400 } },
  { name: 'workspace.viewed', workspaceId: 'environmental-monitoring', userId: 'u-003', timestamp: '2026-05-15T08:22:17.000Z', properties: { viewId: 'ccp-overview', durationMs: 19200 } },
  { name: 'panel.loaded', panelId: 'ccp-status-panel', workspaceId: 'environmental-monitoring', userId: 'u-003', timestamp: '2026-05-15T08:22:19.000Z', properties: { loadMs: 412 } },
  { name: 'workspace.viewed', workspaceId: 'spc-monitoring', userId: 'u-004', timestamp: '2026-05-15T08:30:01.000Z', properties: { viewId: 'chart-overview', durationMs: 6800 } },
  { name: 'panel.loaded', panelId: 'spc-signal-list', workspaceId: 'spc-monitoring', userId: 'u-004', timestamp: '2026-05-15T08:30:04.000Z', properties: { loadMs: 298 } },
  { name: 'workspace.viewed', workspaceId: 'operations-plan-risk', userId: 'u-005', timestamp: '2026-05-15T08:45:33.000Z', properties: { viewId: 'plan-overview', durationMs: 15100 } },
  { name: 'drill-through.navigated', workspaceId: 'operations-plan-risk', userId: 'u-005', timestamp: '2026-05-15T08:55:44.000Z', properties: { targetWorkspaceId: 'production-staging', targetViewId: 'staging-overview' } },
  { name: 'workspace.viewed', workspaceId: 'production-staging', userId: 'u-005', timestamp: '2026-05-15T08:55:46.000Z', properties: { viewId: 'staging-overview', durationMs: 9200 } },
  { name: 'workspace.viewed', workspaceId: 'warehouse-360-overview', userId: 'u-006', timestamp: '2026-05-15T09:01:22.000Z', properties: { viewId: 'holds-management', durationMs: 22400 } },
  { name: 'panel.loaded', panelId: 'warehouse-stock-panel', workspaceId: 'warehouse-360-overview', userId: 'u-006', timestamp: '2026-05-15T09:01:25.000Z', properties: { loadMs: 341 } },
  { name: 'action.completed', workspaceId: 'warehouse-360-overview', userId: 'u-006', timestamp: '2026-05-15T09:18:09.000Z', properties: { actionId: 'request-replenishment', outcome: 'submitted' } },
  { name: 'workspace.viewed', workspaceId: 'maintenance-reliability', userId: 'u-007', timestamp: '2026-05-15T09:10:44.000Z', properties: { viewId: 'work-orders', durationMs: 31200 } },
  { name: 'panel.loaded', panelId: 'maintenance-kpi-summary', workspaceId: 'maintenance-reliability', userId: 'u-007', timestamp: '2026-05-15T09:10:47.000Z', properties: { loadMs: 276 } },
  { name: 'action.completed', workspaceId: 'maintenance-reliability', userId: 'u-007', timestamp: '2026-05-15T09:28:15.000Z', properties: { actionId: 'raise-maintenance-request', outcome: 'submitted' } },
  { name: 'workspace.viewed', workspaceId: 'quality-batch-release', userId: 'u-001', timestamp: '2026-05-15T09:33:12.000Z', properties: { viewId: 'batch-decision', durationMs: 7600 } },
  { name: 'drill-through.navigated', workspaceId: 'quality-batch-release', userId: 'u-001', timestamp: '2026-05-15T09:38:44.000Z', properties: { targetWorkspaceId: 'spc-monitoring', targetViewId: 'chart-overview' } },
  { name: 'workspace.viewed', workspaceId: 'spc-monitoring', userId: 'u-001', timestamp: '2026-05-15T09:38:46.000Z', properties: { viewId: 'chart-overview', durationMs: 4100 } },
  { name: 'workspace.viewed', workspaceId: 'trace-investigation', userId: 'u-003', timestamp: '2026-05-15T10:02:33.000Z', properties: { viewId: 'forward-trace', durationMs: 18900 } },
  { name: 'action.completed', workspaceId: 'quality-batch-release', userId: 'u-001', timestamp: '2026-05-15T10:15:22.000Z', properties: { actionId: 'batch-decision', outcome: 'rejected' } },
]

// ─── Derived stats ────────────────────────────────────────────────────────────

function getWorkspaceViewCounts(): Array<{ workspaceId: string; count: number }> {
  const counts: Record<string, number> = {}
  for (const e of MOCK_EVENTS) {
    if (e.name === 'workspace.viewed' && e.workspaceId) {
      counts[e.workspaceId] = (counts[e.workspaceId] ?? 0) + 1
    }
  }
  return Object.entries(counts)
    .map(([workspaceId, count]) => ({ workspaceId, count }))
    .sort((a, b) => b.count - a.count)
}

function getEventTypeCounts(): Array<{ name: string; count: number }> {
  const counts: Record<string, number> = {}
  for (const e of MOCK_EVENTS) {
    counts[e.name] = (counts[e.name] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

function getActionOutcomes(): Array<{ workspaceId: string; actionId: string; outcome: string; timestamp: string }> {
  return MOCK_EVENTS
    .filter(e => e.name === 'action.completed')
    .map(e => ({
      workspaceId: e.workspaceId ?? '',
      actionId: String(e.properties?.actionId ?? ''),
      outcome: String(e.properties?.outcome ?? ''),
      timestamp: e.timestamp,
    }))
}

function getDrillThroughs(): Array<{ from: string; to: string; count: number }> {
  const map: Record<string, number> = {}
  for (const e of MOCK_EVENTS) {
    if (e.name === 'drill-through.navigated' && e.workspaceId && e.properties?.targetWorkspaceId) {
      const key = `${e.workspaceId}→${e.properties.targetWorkspaceId}`
      map[key] = (map[key] ?? 0) + 1
    }
  }
  return Object.entries(map).map(([key, count]) => {
    const [from, to] = key.split('→')
    return { from, to, count }
  }).sort((a, b) => b.count - a.count)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WORKSPACE_LABELS: Record<string, string> = {
  'trace-investigation': 'Trace Investigation',
  'quality-batch-release': 'Quality Batch Release',
  'operations-plan-risk': 'Operations Plan Risk',
  'environmental-monitoring': 'Environmental Monitoring',
  'production-staging': 'Production Staging',
  'spc-monitoring': 'SPC Monitoring',
  'process-order-review': 'Process Order Review',
  'warehouse-360-overview': 'Warehouse 360 Overview',
  'maintenance-reliability': 'Maintenance & Reliability',
}

function eventNameVariant(name: string): 'default' | 'secondary' | 'outline' {
  if (name === 'action.completed') return 'default'
  if (name === 'drill-through.navigated') return 'secondary'
  return 'outline'
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function KpiBar() {
  const totalEvents = MOCK_EVENTS.length
  const uniqueUsers = new Set(MOCK_EVENTS.map(e => e.userId)).size
  const workspaceViews = MOCK_EVENTS.filter(e => e.name === 'workspace.viewed').length
  const actions = MOCK_EVENTS.filter(e => e.name === 'action.completed').length
  const drillThroughs = MOCK_EVENTS.filter(e => e.name === 'drill-through.navigated').length

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
      {[
        { label: 'Total Events', value: totalEvents },
        { label: 'Active Users', value: uniqueUsers },
        { label: 'Workspace Views', value: workspaceViews },
        { label: 'Actions Completed', value: actions },
        { label: 'Drill-Throughs', value: drillThroughs },
      ].map(({ label, value }) => (
        <Card key={label} style={{ minWidth: 130 }}>
          <CardContent style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {label}
            </div>
            <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{value}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function UsageView() {
  const viewCounts = getWorkspaceViewCounts()
  const maxCount = viewCounts[0]?.count ?? 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Card>
        <CardHeader style={{ paddingBottom: 8 }}>
          <CardTitle style={{ fontSize: 14 }}>Workspace Views (Today)</CardTitle>
        </CardHeader>
        <CardContent style={{ paddingTop: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {viewCounts.map(({ workspaceId, count }) => (
              <div key={workspaceId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 180, fontSize: 12, color: 'var(--shell-fg-2)' }}>
                  {WORKSPACE_LABELS[workspaceId] ?? workspaceId}
                </div>
                <div style={{ flex: 1, height: 6, background: 'var(--shell-line)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(count / maxCount) * 100}%`,
                    height: '100%',
                    background: 'var(--valentia-slate, #005776)',
                    borderRadius: 3,
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, minWidth: 24, textAlign: 'right', color: 'var(--shell-fg)' }}>{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader style={{ paddingBottom: 8 }}>
          <CardTitle style={{ fontSize: 14 }}>Events by Type</CardTitle>
        </CardHeader>
        <CardContent style={{ paddingTop: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {getEventTypeCounts().map(({ name, count }) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'var(--shell-bg)', borderRadius: 4 }}>
                <Badge variant={eventNameVariant(name)}>{name}</Badge>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader style={{ paddingBottom: 8 }}>
          <CardTitle style={{ fontSize: 14 }}>Drill-Through Usage</CardTitle>
        </CardHeader>
        <CardContent style={{ paddingTop: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {getDrillThroughs().map(({ from, to, count }) => (
              <div key={`${from}-${to}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--shell-fg-2)' }}>
                <span style={{ fontWeight: 500 }}>{WORKSPACE_LABELS[from] ?? from}</span>
                <span style={{ color: 'var(--shell-fg-3)' }}>→</span>
                <span style={{ fontWeight: 500 }}>{WORKSPACE_LABELS[to] ?? to}</span>
                <Badge variant="outline" style={{ marginLeft: 'auto' }}>{count}×</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ActionsView() {
  const actions = getActionOutcomes()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {actions.length === 0 && (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--shell-fg-3)', fontSize: 13 }}>
          No action events recorded.
        </div>
      )}
      {actions.map((a, i) => (
        <Card key={i}>
          <CardContent style={{ padding: '10px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--shell-fg)' }}>{a.actionId}</div>
                <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                  {WORKSPACE_LABELS[a.workspaceId] ?? a.workspaceId} · {a.timestamp.slice(11, 16)} UTC
                </div>
              </div>
              <Badge variant={a.outcome === 'approved' || a.outcome === 'submitted' ? 'default' : 'secondary'}>
                {a.outcome}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function EventLogView() {
  const [filter, setFilter] = useState<string>('all')
  const eventTypes = ['all', ...new Set(MOCK_EVENTS.map(e => e.name))]

  const filtered = filter === 'all' ? MOCK_EVENTS : MOCK_EVENTS.filter(e => e.name === filter)

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {eventTypes.map(t => (
          <Button
            key={t}
            size="sm"
            variant={filter === t ? 'default' : 'outline'}
            onClick={() => setFilter(t)}
          >
            {t === 'all' ? `All (${MOCK_EVENTS.length})` : t}
          </Button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[...filtered].reverse().map((e, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '6px 8px',
            background: i % 2 === 0 ? 'var(--shell-bg)' : 'transparent',
            borderRadius: 4,
            fontSize: 11,
          }}>
            <span style={{ color: 'var(--shell-fg-3)', minWidth: 60 }}>{e.timestamp.slice(11, 19)}</span>
            <Badge variant={eventNameVariant(e.name)} style={{ fontSize: 10, minWidth: 120 }}>{e.name}</Badge>
            <span style={{ color: 'var(--shell-fg-2)', flex: 1 }}>
              {e.workspaceId ? WORKSPACE_LABELS[e.workspaceId] ?? e.workspaceId : ''}
              {e.panelId ? ` · ${e.panelId}` : ''}
              {e.userId ? ` · ${e.userId}` : ''}
            </span>
            {e.properties && (
              <span style={{ color: 'var(--shell-fg-3)', fontFamily: 'monospace', fontSize: 10 }}>
                {Object.entries(e.properties).map(([k, v]) => `${k}=${v}`).join(' ')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TelemetryTab = 'usage' | 'actions' | 'event-log'

export function TelemetryDashboardPage() {
  const [activeTab, setActiveTab] = useState<TelemetryTab>('usage')

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--shell-fg)', margin: 0, marginBottom: 4 }}>
          Telemetry Dashboard
        </h1>
        <p style={{ fontSize: 13, color: 'var(--shell-fg-2)', margin: 0 }}>
          Platform event log and workspace usage statistics.
          Data represents mock telemetry from the IE10 pilot on 2026-05-15.
          In production, this view would query the live telemetry store.
        </p>
      </div>

      <KpiBar />
      <Separator style={{ marginBottom: 20 }} />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TelemetryTab)}>
        <TabsList style={{ marginBottom: 16 }}>
          <TabsTrigger value="usage">Usage Overview</TabsTrigger>
          <TabsTrigger value="actions">Action Outcomes ({getActionOutcomes().length})</TabsTrigger>
          <TabsTrigger value="event-log">Event Log ({MOCK_EVENTS.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="usage">
          <UsageView />
        </TabsContent>
        <TabsContent value="actions">
          <ActionsView />
        </TabsContent>
        <TabsContent value="event-log">
          <EventLogView />
        </TabsContent>
      </Tabs>
    </div>
  )
}
