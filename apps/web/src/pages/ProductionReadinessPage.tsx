// Phase 6 snapshot — data accurate as of 2026-05-15. Update as workspace readiness changes.
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
  Separator,
} from '@connectio/design-system'
import type { ReadinessFinding, ReadinessStatus, ReadinessSeverity } from '@connectio/product-model'
import { aggregateReadinessStatus, pilotBlockers, productionBlockers } from '@connectio/product-model'

// ─── Static audit findings ────────────────────────────────────────────────────

const FINDINGS: readonly ReadinessFinding[] = [
  // Trace Investigation — live
  {
    findingId: 'trace-001',
    itemType: 'workspace',
    itemId: 'trace-investigation',
    title: 'No keyboard navigation audit completed',
    description: 'WCAG 2.1 AA keyboard navigation has not been validated for the Trace Overview panel.',
    severity: 'warning',
    readinessStatus: 'ready-with-warnings',
    ownerDomain: 'quality',
    lifecycle: 'live',
    recommendation: 'Complete keyboard tab-order review and fix any focus traps in the evidence panels.',
    blocksPilot: false,
    blocksProduction: true,
    createdAt: '2026-05-15T09:00:00.000Z',
    source: 'static-audit',
  },
  {
    findingId: 'trace-002',
    itemType: 'workspace',
    itemId: 'trace-investigation',
    title: 'Live ERP adapter connected',
    description: 'Trace Investigation uses the live SAP integration adapter with real batch data.',
    severity: 'info',
    readinessStatus: 'ready',
    ownerDomain: 'quality',
    lifecycle: 'live',
    recommendation: 'No action required.',
    blocksPilot: false,
    blocksProduction: false,
    createdAt: '2026-05-15T09:00:00.000Z',
    source: 'static-audit',
  },

  // Quality Batch Release — live
  {
    findingId: 'qbr-001',
    itemType: 'workspace',
    itemId: 'quality-batch-release',
    title: 'Batch decision action uses inline form styles',
    description: 'The batch decision action panel uses inline styles for form layout rather than design-system primitives.',
    severity: 'warning',
    readinessStatus: 'ready-with-warnings',
    ownerDomain: 'quality',
    lifecycle: 'live',
    recommendation: 'Migrate action panel form layout to design-system Card + Separator.',
    blocksPilot: false,
    blocksProduction: false,
    createdAt: '2026-05-15T09:00:00.000Z',
    source: 'eslint',
  },
  {
    findingId: 'qbr-002',
    itemType: 'workspace',
    itemId: 'quality-batch-release',
    title: 'Test coverage above threshold',
    description: 'Workspace, adapter, and schema tests all pass with coverage above the 75% threshold.',
    severity: 'info',
    readinessStatus: 'ready',
    ownerDomain: 'quality',
    lifecycle: 'live',
    recommendation: 'No action required.',
    blocksPilot: false,
    blocksProduction: false,
    createdAt: '2026-05-15T09:00:00.000Z',
    source: 'static-audit',
  },

  // Operations Plan Risk — live
  {
    findingId: 'opr-001',
    itemType: 'workspace',
    itemId: 'operations-plan-risk',
    title: 'Live MES adapter not yet connected',
    description: 'Operations Plan Risk uses mock data. The Rockwell PhaseManager MES adapter is scoped for Phase 6.',
    severity: 'blocker',
    readinessStatus: 'blocked',
    ownerDomain: 'operations',
    lifecycle: 'live',
    recommendation: 'Connect the live MES adapter and replace mock data constants before production rollout.',
    blocksPilot: false,
    blocksProduction: true,
    drillThroughTarget: '?workspace=operations-plan-risk',
    createdAt: '2026-05-15T09:00:00.000Z',
    source: 'static-audit',
  },

  // Environmental Monitoring — live
  {
    findingId: 'em-001',
    itemType: 'workspace',
    itemId: 'environmental-monitoring',
    title: 'Live environmental sensor adapter connected',
    description: 'Environmental Monitoring reads from the site sensor API. No mock data in production path.',
    severity: 'info',
    readinessStatus: 'ready',
    ownerDomain: 'operations',
    lifecycle: 'live',
    recommendation: 'No action required.',
    blocksPilot: false,
    blocksProduction: false,
    createdAt: '2026-05-15T09:00:00.000Z',
    source: 'static-audit',
  },
  {
    findingId: 'em-002',
    itemType: 'workspace',
    itemId: 'environmental-monitoring',
    title: 'Alert threshold configuration is hardcoded',
    description: 'CCP alert thresholds are defined as constants rather than being site-configurable via the admin API.',
    severity: 'warning',
    readinessStatus: 'ready-with-warnings',
    ownerDomain: 'operations',
    lifecycle: 'live',
    recommendation: 'Move thresholds to a site configuration API call before multi-site rollout.',
    blocksPilot: false,
    blocksProduction: true,
    createdAt: '2026-05-15T09:00:00.000Z',
    source: 'static-audit',
  },

  // Production Staging — live
  {
    findingId: 'ps-001',
    itemType: 'workspace',
    itemId: 'production-staging',
    title: 'Staging confirmation action audit log not wired',
    description: 'The "Confirm Stage Release" action does not write to the platform audit log. Only console.log is used.',
    severity: 'blocker',
    readinessStatus: 'blocked',
    ownerDomain: 'operations',
    lifecycle: 'live',
    recommendation: 'Wire the action confirmation to the platform audit event bus before pilot go-live.',
    blocksPilot: true,
    blocksProduction: true,
    createdAt: '2026-05-15T09:00:00.000Z',
    source: 'manual',
  },

  // SPC Monitoring — pilot
  {
    findingId: 'spc-001',
    itemType: 'workspace',
    itemId: 'spc-monitoring',
    title: 'Using mock data — Historian adapter not connected',
    description: 'SPC Monitoring uses mock data representing IE10 March 2024. Live OPC-UA or REST adapter is Phase 6 scope.',
    severity: 'warning',
    readinessStatus: 'ready-with-warnings',
    ownerDomain: 'quality',
    lifecycle: 'pilot',
    recommendation: 'Connect the Historian adapter before Phase 6 live rollout. Acceptable for pilot phase.',
    blocksPilot: false,
    blocksProduction: true,
    createdAt: '2026-05-15T09:00:00.000Z',
    source: 'static-audit',
  },
  {
    findingId: 'spc-002',
    itemType: 'workspace',
    itemId: 'spc-monitoring',
    title: 'Control chart zoom and point inspection not implemented',
    description: 'SPC chart rendering is static — no interactive zoom or point selection.',
    severity: 'warning',
    readinessStatus: 'ready-with-warnings',
    ownerDomain: 'quality',
    lifecycle: 'pilot',
    recommendation: 'Implement chart interactivity as part of Phase 6 SPC Monitoring live integration.',
    blocksPilot: false,
    blocksProduction: true,
    createdAt: '2026-05-15T09:00:00.000Z',
    source: 'static-audit',
  },

  // Process Order Review — pilot
  {
    findingId: 'por-001',
    itemType: 'workspace',
    itemId: 'process-order-review',
    title: 'Scope-agnostic in pilot — always shows same order',
    description: 'Process Order Review ignores processOrderId scope in Phase 5 and renders the same mock order.',
    severity: 'blocker',
    readinessStatus: 'blocked',
    ownerDomain: 'operations',
    lifecycle: 'pilot',
    recommendation: 'Wire scope-driven order lookup before Phase 6 live rollout.',
    blocksPilot: false,
    blocksProduction: true,
    drillThroughTarget: '?workspace=process-order-review',
    createdAt: '2026-05-15T09:00:00.000Z',
    source: 'static-audit',
  },

  // Warehouse 360 Overview — pilot
  {
    findingId: 'wh-001',
    itemType: 'workspace',
    itemId: 'warehouse-360-overview',
    title: 'Using mock data — EWM adapter not connected',
    description: 'Warehouse 360 uses mock stock and movement data. SAP EWM adapter design is complete, implementation is Phase 6.',
    severity: 'warning',
    readinessStatus: 'ready-with-warnings',
    ownerDomain: 'warehouse',
    lifecycle: 'pilot',
    recommendation: 'Prioritise EWM adapter implementation in Phase 6 sprint planning.',
    blocksPilot: false,
    blocksProduction: true,
    createdAt: '2026-05-15T09:00:00.000Z',
    source: 'static-audit',
  },
  {
    findingId: 'wh-002',
    itemType: 'workspace',
    itemId: 'warehouse-360-overview',
    title: 'Replenishment request action logs to console only',
    description: 'The "Request Replenishment" action panel submits to console.log. No WMS write-back in Phase 5.',
    severity: 'warning',
    readinessStatus: 'ready-with-warnings',
    ownerDomain: 'warehouse',
    lifecycle: 'pilot',
    recommendation: 'Wire the WMS replenishment API before Phase 6 go-live.',
    blocksPilot: false,
    blocksProduction: true,
    createdAt: '2026-05-15T09:00:00.000Z',
    source: 'static-audit',
  },

  // Maintenance & Reliability — pilot
  {
    findingId: 'mr-001',
    itemType: 'workspace',
    itemId: 'maintenance-reliability',
    title: 'SAP PM adapter contract being finalised',
    description: 'The work order API contract with SAP PM is not yet signed off. Mock data used throughout Phase 5.',
    severity: 'blocker',
    readinessStatus: 'blocked',
    ownerDomain: 'maintenance',
    lifecycle: 'pilot',
    recommendation: 'Finalise PM API contract and begin adapter implementation in Phase 6.',
    blocksPilot: false,
    blocksProduction: true,
    drillThroughTarget: '?workspace=maintenance-reliability',
    createdAt: '2026-05-15T09:00:00.000Z',
    source: 'static-audit',
  },
  {
    findingId: 'mr-002',
    itemType: 'workspace',
    itemId: 'maintenance-reliability',
    title: 'Maintenance backlog filter by equipment ID not implemented',
    description: 'The backlog view shows all work orders regardless of equipment scope. Equipment-ID filtering is hardcoded off.',
    severity: 'warning',
    readinessStatus: 'ready-with-warnings',
    ownerDomain: 'maintenance',
    lifecycle: 'pilot',
    recommendation: 'Implement equipment-ID scope filtering in the backlog panel.',
    blocksPilot: false,
    blocksProduction: true,
    createdAt: '2026-05-15T09:00:00.000Z',
    source: 'static-audit',
  },
]

// ─── Derived data ─────────────────────────────────────────────────────────────

const WORKSPACE_IDS = [
  'trace-investigation',
  'quality-batch-release',
  'operations-plan-risk',
  'environmental-monitoring',
  'production-staging',
  'spc-monitoring',
  'process-order-review',
  'warehouse-360-overview',
  'maintenance-reliability',
] as const

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityVariant(severity: ReadinessSeverity): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (severity) {
    case 'critical':
    case 'blocker':
      return 'destructive'
    case 'warning':
      return 'secondary'
    default:
      return 'outline'
  }
}

function statusLabel(status: ReadinessStatus): string {
  switch (status) {
    case 'ready': return 'Ready'
    case 'ready-with-warnings': return 'Warnings'
    case 'blocked': return 'Blocked'
    case 'not-assessed': return 'Not Assessed'
    case 'not-applicable': return 'N/A'
  }
}

function statusVariant(status: ReadinessStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ready': return 'default'
    case 'ready-with-warnings': return 'secondary'
    case 'blocked': return 'destructive'
    default: return 'outline'
  }
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function KpiBar() {
  const blocked = FINDINGS.filter(f => f.readinessStatus === 'blocked').length
  const warnings = FINDINGS.filter(f => f.readinessStatus === 'ready-with-warnings').length
  const ready = FINDINGS.filter(f => f.readinessStatus === 'ready').length
  const total = FINDINGS.length

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
      {[
        { label: 'Total Findings', value: total, variant: 'outline' as const },
        { label: 'Blocked', value: blocked, variant: 'destructive' as const },
        { label: 'Ready-with-Warnings', value: warnings, variant: 'secondary' as const },
        { label: 'Ready / Info', value: ready, variant: 'default' as const },
        { label: 'Pilot Blockers', value: pilotBlockers(FINDINGS).length, variant: 'destructive' as const },
        { label: 'Production Blockers', value: productionBlockers(FINDINGS).length, variant: 'destructive' as const },
      ].map(({ label, value, variant }) => (
        <Card key={label} style={{ minWidth: 140 }}>
          <CardContent style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{value}</span>
              <Badge variant={variant}>{value === 0 ? '✓' : '!'}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function FindingsTable({ findings }: { readonly findings: readonly ReadinessFinding[] }) {
  if (findings.length === 0) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--shell-fg-3)', fontSize: 13 }}>
        No findings in this category.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {findings.map(f => (
        <Card key={f.findingId}>
          <CardContent style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--shell-fg)', flex: 1 }}>
                {f.title}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <Badge variant={severityVariant(f.severity)}>{f.severity}</Badge>
                <Badge variant={statusVariant(f.readinessStatus)}>{statusLabel(f.readinessStatus)}</Badge>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 6 }}>
              {f.description}
            </div>
            <Separator style={{ marginBottom: 6 }} />
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--shell-fg-3)', flexWrap: 'wrap' }}>
              <span><strong>Workspace:</strong> {WORKSPACE_LABELS[f.itemId] ?? f.itemId}</span>
              <span><strong>Owner:</strong> {f.ownerDomain}</span>
              <span><strong>Source:</strong> {f.source}</span>
              {f.blocksPilot && <Badge variant="destructive" style={{ fontSize: 10 }}>Blocks Pilot</Badge>}
              {f.blocksProduction && <Badge variant="secondary" style={{ fontSize: 10 }}>Blocks Production</Badge>}
            </div>
            {f.recommendation && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--shell-fg-2)' }}>
                <strong>Recommendation:</strong> {f.recommendation}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function WorkspaceSummaryView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {WORKSPACE_IDS.map(wsId => {
        const wsFindings = FINDINGS.filter(f => f.itemId === wsId)
        const status = aggregateReadinessStatus(wsFindings)
        const blockers = wsFindings.filter(f => f.severity === 'blocker' || f.severity === 'critical')
        const warnings = wsFindings.filter(f => f.severity === 'warning')
        return (
          <Card key={wsId}>
            <CardHeader style={{ paddingBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <CardTitle style={{ fontSize: 14 }}>{WORKSPACE_LABELS[wsId]}</CardTitle>
                <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
              </div>
            </CardHeader>
            <CardContent style={{ paddingTop: 0 }}>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--shell-fg-2)' }}>
                <span>{wsFindings.length} finding{wsFindings.length !== 1 ? 's' : ''}</span>
                {blockers.length > 0 && (
                  <span style={{ color: 'var(--destructive, #DC2626)' }}>{blockers.length} blocker{blockers.length !== 1 ? 's' : ''}</span>
                )}
                {warnings.length > 0 && (
                  <span style={{ color: 'var(--warning, #D97706)' }}>{warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>
                )}
                {wsFindings.length === 0 && <span style={{ color: 'var(--shell-fg-3)' }}>No findings recorded</span>}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ReadinessTab = 'all' | 'blockers' | 'pilot-blockers' | 'by-workspace'

export function ProductionReadinessPage() {
  const [activeTab, setActiveTab] = useState<ReadinessTab>('all')

  const tabFindings: Record<ReadinessTab, readonly ReadinessFinding[]> = {
    all: FINDINGS,
    blockers: productionBlockers(FINDINGS),
    'pilot-blockers': pilotBlockers(FINDINGS),
    'by-workspace': FINDINGS,
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--shell-fg)', margin: 0, marginBottom: 4 }}>
          Production Readiness Dashboard
        </h1>
        <p style={{ fontSize: 13, color: 'var(--shell-fg-2)', margin: 0 }}>
          Static readiness assessment across all 9 ConnectIO workspaces — Phase 6 snapshot (2026-05-15).
          Findings are generated from static audit, ESLint analysis, and manual review.
        </p>
      </div>

      <KpiBar />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReadinessTab)}>
        <TabsList style={{ marginBottom: 16 }}>
          <TabsTrigger value="all">All Findings ({FINDINGS.length})</TabsTrigger>
          <TabsTrigger value="blockers">
            Production Blockers ({productionBlockers(FINDINGS).length})
          </TabsTrigger>
          <TabsTrigger value="pilot-blockers">
            Pilot Blockers ({pilotBlockers(FINDINGS).length})
          </TabsTrigger>
          <TabsTrigger value="by-workspace">By Workspace</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <FindingsTable findings={tabFindings.all} />
        </TabsContent>
        <TabsContent value="blockers">
          <FindingsTable findings={tabFindings.blockers} />
        </TabsContent>
        <TabsContent value="pilot-blockers">
          <FindingsTable findings={tabFindings['pilot-blockers']} />
        </TabsContent>
        <TabsContent value="by-workspace">
          <WorkspaceSummaryView />
        </TabsContent>
      </Tabs>
    </div>
  )
}
