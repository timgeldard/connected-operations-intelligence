// Phase 6 snapshot — parity data accurate as of 2026-05-15.
import { useState } from 'react'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Separator,
} from '@connectio/design-system'
import type { WorkspaceParityAssessment, WorkspaceParityStatus, ReadinessFinding } from '@connectio/product-model'
import { aggregateReadinessStatus } from '@connectio/product-model'

// ─── Static parity data ───────────────────────────────────────────────────────

const PARITY_ASSESSMENTS: readonly WorkspaceParityAssessment[] = [
  {
    workspaceId: 'trace-investigation',
    legacySystemId: 'intelex-trace',
    legacySystemName: 'Intelex Traceability Platform',
    parityStatus: 'full-parity',
    coverageScore: 94,
    assessedAt: '2026-05-15T09:00:00.000Z',
    findings: [
      {
        findingId: 'trace-parity-001',
        itemType: 'feature',
        itemId: 'trace-investigation',
        title: 'CAPA linkage from trace view not yet implemented',
        description: 'Intelex allows direct CAPA ticket creation from a trace result. ConnectIO links to CAPA via drill-through only.',
        severity: 'warning',
        readinessStatus: 'ready-with-warnings',
        ownerDomain: 'quality',
        lifecycle: 'live',
        recommendation: 'Add direct CAPA creation action to trace investigation in Phase 6.',
        blocksPilot: false,
        blocksProduction: false,
        createdAt: '2026-05-15T09:00:00.000Z',
        source: 'parity-audit',
      },
    ],
  },
  {
    workspaceId: 'quality-batch-release',
    legacySystemId: 'labware-lims',
    legacySystemName: 'LabWare LIMS',
    parityStatus: 'full-parity',
    coverageScore: 91,
    assessedAt: '2026-05-15T09:00:00.000Z',
    findings: [
      {
        findingId: 'qbr-parity-001',
        itemType: 'feature',
        itemId: 'quality-batch-release',
        title: 'Certificate of Analysis generation not in scope',
        description: 'LabWare generates PDFs (CoA) from batch results. ConnectIO surfaces the decision UI but does not generate CoA documents.',
        severity: 'warning',
        readinessStatus: 'ready-with-warnings',
        ownerDomain: 'quality',
        lifecycle: 'live',
        recommendation: 'Scope CoA generation as a Phase 7 integration with the document management system.',
        blocksPilot: false,
        blocksProduction: false,
        createdAt: '2026-05-15T09:00:00.000Z',
        source: 'parity-audit',
      },
    ],
  },
  {
    workspaceId: 'spc-monitoring',
    legacySystemId: 'labware-lims',
    legacySystemName: 'LabWare LIMS (SPC module)',
    parityStatus: 'partial-parity',
    coverageScore: 72,
    assessedAt: '2026-05-15T09:00:00.000Z',
    findings: [
      {
        findingId: 'spc-parity-001',
        itemType: 'feature',
        itemId: 'spc-monitoring',
        title: 'Western Electric rules not fully implemented',
        description: 'LabWare SPC supports all 8 Western Electric rule violations. ConnectIO SPC Monitoring supports rules 1, 2, and 5 only.',
        severity: 'blocker',
        readinessStatus: 'blocked',
        ownerDomain: 'quality',
        lifecycle: 'pilot',
        recommendation: 'Implement remaining 5 WE rules in the SPC signal engine before Phase 6 live rollout.',
        blocksPilot: false,
        blocksProduction: true,
        createdAt: '2026-05-15T09:00:00.000Z',
        source: 'parity-audit',
      },
      {
        findingId: 'spc-parity-002',
        itemType: 'feature',
        itemId: 'spc-monitoring',
        title: 'No specification limits editor in ConnectIO',
        description: 'LabWare allows QA engineers to adjust UCL/LCL in-system. ConnectIO reads limits from the Historian only.',
        severity: 'warning',
        readinessStatus: 'ready-with-warnings',
        ownerDomain: 'quality',
        lifecycle: 'pilot',
        recommendation: 'Add a specification limits override panel in Phase 6, or document this as an out-of-scope feature.',
        blocksPilot: false,
        blocksProduction: false,
        createdAt: '2026-05-15T09:00:00.000Z',
        source: 'parity-audit',
      },
    ],
  },
  {
    workspaceId: 'operations-plan-risk',
    legacySystemId: 'rockwell-phasemanager',
    legacySystemName: 'Rockwell PhaseManager MES',
    parityStatus: 'partial-parity',
    coverageScore: 68,
    assessedAt: '2026-05-15T09:00:00.000Z',
    findings: [
      {
        findingId: 'opr-parity-001',
        itemType: 'feature',
        itemId: 'operations-plan-risk',
        title: 'Recipe management not in scope',
        description: 'PhaseManager includes recipe authoring and version control. ConnectIO is read-only against the MES recipe library.',
        severity: 'info',
        readinessStatus: 'ready',
        ownerDomain: 'operations',
        lifecycle: 'live',
        recommendation: 'Document recipe management as out-of-scope — this is a PhaseManager-specific capability retained for Phase 7 assessment.',
        blocksPilot: false,
        blocksProduction: false,
        createdAt: '2026-05-15T09:00:00.000Z',
        source: 'parity-audit',
      },
      {
        findingId: 'opr-parity-002',
        itemType: 'feature',
        itemId: 'operations-plan-risk',
        title: 'Phase transition approval workflow missing',
        description: 'PhaseManager enforces electronic approval at each production phase gate. ConnectIO shows risk indicators but does not enforce phase transition approval.',
        severity: 'blocker',
        readinessStatus: 'blocked',
        ownerDomain: 'operations',
        lifecycle: 'live',
        recommendation: 'Design and implement phase gate approval flow in Phase 6 — this is a GMP-critical gap.',
        blocksPilot: true,
        blocksProduction: true,
        createdAt: '2026-05-15T09:00:00.000Z',
        source: 'parity-audit',
      },
    ],
  },
  {
    workspaceId: 'process-order-review',
    legacySystemId: 'rockwell-phasemanager',
    legacySystemName: 'Rockwell PhaseManager MES',
    parityStatus: 'partial-parity',
    coverageScore: 61,
    assessedAt: '2026-05-15T09:00:00.000Z',
    findings: [
      {
        findingId: 'por-parity-001',
        itemType: 'feature',
        itemId: 'process-order-review',
        title: 'Order exception raising not implemented',
        description: 'PhaseManager allows supervisors to raise production exceptions from the order view. This action is not yet in ConnectIO Process Order Review.',
        severity: 'warning',
        readinessStatus: 'ready-with-warnings',
        ownerDomain: 'operations',
        lifecycle: 'pilot',
        recommendation: 'Add an "Raise Exception" action panel to Process Order Review in Phase 6.',
        blocksPilot: false,
        blocksProduction: true,
        createdAt: '2026-05-15T09:00:00.000Z',
        source: 'parity-audit',
      },
    ],
  },
  {
    workspaceId: 'environmental-monitoring',
    legacySystemId: 'em-excel-sharepoint',
    legacySystemName: 'In-house Excel/SharePoint EM Tracker',
    parityStatus: 'exceeds-legacy',
    coverageScore: 100,
    assessedAt: '2026-05-15T09:00:00.000Z',
    findings: [],
  },
  {
    workspaceId: 'production-staging',
    legacySystemId: 'manhattan-wms',
    legacySystemName: 'Manhattan SCALE WMS (Staging module)',
    parityStatus: 'full-parity',
    coverageScore: 88,
    assessedAt: '2026-05-15T09:00:00.000Z',
    findings: [
      {
        findingId: 'ps-parity-001',
        itemType: 'feature',
        itemId: 'production-staging',
        title: 'Batch hold reason codes not mapped to WMS codes',
        description: 'Manhattan uses numeric hold reason codes. ConnectIO uses human-readable labels. The mapping table is not yet defined.',
        severity: 'warning',
        readinessStatus: 'ready-with-warnings',
        ownerDomain: 'operations',
        lifecycle: 'live',
        recommendation: 'Define the reason code mapping table and include it in the WMS integration adapter.',
        blocksPilot: false,
        blocksProduction: true,
        createdAt: '2026-05-15T09:00:00.000Z',
        source: 'parity-audit',
      },
    ],
  },
  {
    workspaceId: 'warehouse-360-overview',
    legacySystemId: 'manhattan-wms',
    legacySystemName: 'Manhattan SCALE WMS',
    parityStatus: 'partial-parity',
    coverageScore: 74,
    assessedAt: '2026-05-15T09:00:00.000Z',
    findings: [
      {
        findingId: 'wh-parity-001',
        itemType: 'feature',
        itemId: 'warehouse-360-overview',
        title: 'Goods receipt not in scope',
        description: 'Manhattan handles goods receipt workflows. ConnectIO Warehouse 360 is read-only over stock and movements.',
        severity: 'info',
        readinessStatus: 'ready',
        ownerDomain: 'warehouse',
        lifecycle: 'pilot',
        recommendation: 'Document goods receipt as out-of-scope for Phase 6. Assess in Phase 7 WMS migration.',
        blocksPilot: false,
        blocksProduction: false,
        createdAt: '2026-05-15T09:00:00.000Z',
        source: 'parity-audit',
      },
      {
        findingId: 'wh-parity-002',
        itemType: 'feature',
        itemId: 'warehouse-360-overview',
        title: 'No wave planning view',
        description: 'Manhattan SCALE includes wave and pick planning. ConnectIO Warehouse 360 covers stock, holds, and replenishment only.',
        severity: 'warning',
        readinessStatus: 'ready-with-warnings',
        ownerDomain: 'warehouse',
        lifecycle: 'pilot',
        recommendation: 'Scope wave planning for Phase 7 or document it as out-of-scope for the pilot workspace.',
        blocksPilot: false,
        blocksProduction: false,
        createdAt: '2026-05-15T09:00:00.000Z',
        source: 'parity-audit',
      },
    ],
  },
  {
    workspaceId: 'maintenance-reliability',
    legacySystemId: 'sap-pm',
    legacySystemName: 'SAP Plant Maintenance',
    parityStatus: 'partial-parity',
    coverageScore: 58,
    assessedAt: '2026-05-15T09:00:00.000Z',
    findings: [
      {
        findingId: 'mr-parity-001',
        itemType: 'feature',
        itemId: 'maintenance-reliability',
        title: 'Work order creation not implemented',
        description: 'SAP PM allows technicians to create new work orders. ConnectIO M&R is read-only for Phase 5 pilot.',
        severity: 'blocker',
        readinessStatus: 'blocked',
        ownerDomain: 'maintenance',
        lifecycle: 'pilot',
        recommendation: 'Implement work order creation action panel in Phase 6 before pilot go-live.',
        blocksPilot: true,
        blocksProduction: true,
        createdAt: '2026-05-15T09:00:00.000Z',
        source: 'parity-audit',
      },
      {
        findingId: 'mr-parity-002',
        itemType: 'feature',
        itemId: 'maintenance-reliability',
        title: 'Parts and materials tracking not in scope',
        description: 'SAP PM tracks spare parts against work orders. ConnectIO M&R does not surface materials management.',
        severity: 'info',
        readinessStatus: 'ready',
        ownerDomain: 'maintenance',
        lifecycle: 'pilot',
        recommendation: 'Document as out-of-scope for Phase 5 and 6. Assess for Phase 7 CMMS integration.',
        blocksPilot: false,
        blocksProduction: false,
        createdAt: '2026-05-15T09:00:00.000Z',
        source: 'parity-audit',
      },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WORKSPACE_LABELS: Record<string, string> = {
  'trace-investigation': 'Trace Investigation',
  'quality-batch-release': 'Quality Batch Release',
  'spc-monitoring': 'SPC Monitoring',
  'operations-plan-risk': 'Operations Plan Risk',
  'process-order-review': 'Process Order Review',
  'environmental-monitoring': 'Environmental Monitoring',
  'production-staging': 'Production Staging',
  'warehouse-360-overview': 'Warehouse 360 Overview',
  'maintenance-reliability': 'Maintenance & Reliability',
}

function parityStatusVariant(status: WorkspaceParityStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'exceeds-legacy':
    case 'full-parity':
      return 'default'
    case 'partial-parity':
      return 'secondary'
    case 'no-parity':
      return 'destructive'
  }
}

function parityStatusLabel(status: WorkspaceParityStatus): string {
  switch (status) {
    case 'exceeds-legacy': return 'Exceeds Legacy'
    case 'full-parity': return 'Full Parity'
    case 'partial-parity': return 'Partial Parity'
    case 'no-parity': return 'No Parity'
  }
}

function CoverageBar({ score }: { readonly score: number }) {
  const color = score >= 90 ? '#16A34A' : score >= 70 ? '#D97706' : '#DC2626'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--shell-line)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg-2)', minWidth: 32 }}>{score}%</span>
    </div>
  )
}

function FindingRows({ findings }: { readonly findings: readonly ReadinessFinding[] }) {
  if (findings.length === 0) return null
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {findings.map(f => (
        <div key={f.findingId} style={{
          padding: '8px 10px',
          background: 'var(--shell-bg)',
          borderRadius: 4,
          borderLeft: `3px solid ${f.severity === 'blocker' || f.severity === 'critical' ? '#DC2626' : f.severity === 'warning' ? '#D97706' : '#6B7280'}`,
        }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--shell-fg)', marginBottom: 2 }}>{f.title}</div>
          <div style={{ fontSize: 11, color: 'var(--shell-fg-2)' }}>{f.description}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function SummaryKpiBar() {
  const byStatus = {
    exceeds: PARITY_ASSESSMENTS.filter(a => a.parityStatus === 'exceeds-legacy').length,
    full: PARITY_ASSESSMENTS.filter(a => a.parityStatus === 'full-parity').length,
    partial: PARITY_ASSESSMENTS.filter(a => a.parityStatus === 'partial-parity').length,
    none: PARITY_ASSESSMENTS.filter(a => a.parityStatus === 'no-parity').length,
  }
  const avgCoverage = Math.round(
    PARITY_ASSESSMENTS.reduce((sum, a) => sum + a.coverageScore, 0) / PARITY_ASSESSMENTS.length,
  )
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
      {[
        { label: 'Average Coverage', value: `${avgCoverage}%`, variant: 'outline' as const },
        { label: 'Exceeds Legacy', value: byStatus.exceeds, variant: 'default' as const },
        { label: 'Full Parity', value: byStatus.full, variant: 'default' as const },
        { label: 'Partial Parity', value: byStatus.partial, variant: 'secondary' as const },
        { label: 'No Parity', value: byStatus.none, variant: 'destructive' as const },
      ].map(({ label, value, variant }) => (
        <Card key={label} style={{ minWidth: 130 }}>
          <CardContent style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{value}</span>
              <Badge variant={variant}>{label.includes('Partial') || label.includes('None') ? '!' : '✓'}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function AssessmentCards() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {PARITY_ASSESSMENTS.map(a => {
        const overallStatus = aggregateReadinessStatus(a.findings)
        return (
          <Card key={a.workspaceId}>
            <CardHeader style={{ paddingBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <CardTitle style={{ fontSize: 14 }}>{WORKSPACE_LABELS[a.workspaceId] ?? a.workspaceId}</CardTitle>
                  <CardDescription style={{ fontSize: 11 }}>vs. {a.legacySystemName}</CardDescription>
                </div>
                <Badge variant={parityStatusVariant(a.parityStatus)}>{parityStatusLabel(a.parityStatus)}</Badge>
              </div>
            </CardHeader>
            <CardContent style={{ paddingTop: 0 }}>
              <CoverageBar score={a.coverageScore} />
              {a.findings.length > 0 && (
                <>
                  <Separator style={{ margin: '10px 0' }} />
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginBottom: 6 }}>
                    {a.findings.length} parity gap{a.findings.length !== 1 ? 's' : ''} — overall: {overallStatus}
                  </div>
                  <FindingRows findings={a.findings} />
                </>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function GapsView() {
  const allGaps = PARITY_ASSESSMENTS.flatMap(a => a.findings)
  const blockers = allGaps.filter(f => f.severity === 'blocker' || f.severity === 'critical')
  const warnings = allGaps.filter(f => f.severity === 'warning')
  const info = allGaps.filter(f => f.severity === 'info')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {blockers.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', marginBottom: 8 }}>
            Blockers ({blockers.length})
          </h3>
          <FindingRows findings={blockers} />
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', marginBottom: 8 }}>
            Warnings ({warnings.length})
          </h3>
          <FindingRows findings={warnings} />
        </div>
      )}
      {info.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', marginBottom: 8 }}>
            Informational ({info.length})
          </h3>
          <FindingRows findings={info} />
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ParityTab = 'assessments' | 'gaps'

export function WorkspaceParityPage() {
  const [activeTab, setActiveTab] = useState<ParityTab>('assessments')

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--shell-fg)', margin: 0, marginBottom: 4 }}>
          Workspace Parity Assessment
        </h1>
        <p style={{ fontSize: 13, color: 'var(--shell-fg-2)', margin: 0 }}>
          Functional coverage of each ConnectIO workspace relative to the legacy system it supersedes.
          Coverage scores are Phase 6 snapshot (2026-05-15) based on feature-level parity audit.
        </p>
      </div>

      <SummaryKpiBar />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ParityTab)}>
        <TabsList style={{ marginBottom: 16 }}>
          <TabsTrigger value="assessments">Per-Workspace ({PARITY_ASSESSMENTS.length})</TabsTrigger>
          <TabsTrigger value="gaps">
            All Gaps ({PARITY_ASSESSMENTS.flatMap(a => a.findings).length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="assessments">
          <AssessmentCards />
        </TabsContent>
        <TabsContent value="gaps">
          <GapsView />
        </TabsContent>
      </Tabs>
    </div>
  )
}
