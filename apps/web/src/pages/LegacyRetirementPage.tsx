import { useState } from 'react'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'

type RetirementStatus = 'not-started' | 'in-progress' | 'ready' | 'retired'
type MigrationRisk = 'low' | 'medium' | 'high'

interface LegacySystem {
  readonly systemId: string
  readonly systemName: string
  readonly vendor: string
  readonly domain: string
  readonly retirementStatus: RetirementStatus
  readonly supersededBy: readonly string[]
  readonly dataVolume: string
  readonly userCount: number
  readonly integrationCount: number
  readonly migrationRisk: MigrationRisk
  readonly targetRetirementDate: string
  readonly notes: string
  readonly readinessChecks: readonly {
    readonly label: string
    readonly passed: boolean
  }[]
}

const LEGACY_SYSTEMS: readonly LegacySystem[] = [
  {
    systemId: 'SAP-PM',
    systemName: 'SAP Plant Maintenance',
    vendor: 'SAP',
    domain: 'maintenance',
    retirementStatus: 'in-progress',
    supersededBy: ['maintenance-reliability'],
    dataVolume: '12 years work order history',
    userCount: 38,
    integrationCount: 5,
    migrationRisk: 'high',
    targetRetirementDate: '2027-03-31',
    notes: 'Pilot running at IE10. 3 sites remaining. Data migration scoping in progress.',
    readinessChecks: [
      { label: 'ConnectIO workspace live at pilot site', passed: true },
      { label: 'Historical work order migration scoped', passed: true },
      { label: 'Integration with CMMS decommissioned', passed: false },
      { label: 'All site rollouts complete', passed: false },
      { label: 'User training completed', passed: false },
      { label: 'Hypercare period complete', passed: false },
    ],
  },
  {
    systemId: 'LEGACY-LIMS',
    systemName: 'Legacy LIMS (LabWare)',
    vendor: 'LabWare',
    domain: 'quality',
    retirementStatus: 'ready',
    supersededBy: ['quality-batch-release', 'spc-monitoring'],
    dataVolume: '8 years lab results',
    userCount: 24,
    integrationCount: 7,
    migrationRisk: 'medium',
    targetRetirementDate: '2026-09-30',
    notes: 'All functionality replicated. Waiting on final data archive sign-off from QA Director.',
    readinessChecks: [
      { label: 'ConnectIO workspace live at all sites', passed: true },
      { label: 'Historical lab result archive completed', passed: true },
      { label: 'ERP integration migrated to new layer', passed: true },
      { label: 'All site rollouts complete', passed: true },
      { label: 'User training completed', passed: true },
      { label: 'Hypercare period complete', passed: false },
    ],
  },
  {
    systemId: 'LEGACY-MES',
    systemName: 'Legacy MES (Rockwell PhaseManager)',
    vendor: 'Rockwell Automation',
    domain: 'operations',
    retirementStatus: 'in-progress',
    supersededBy: ['process-order-review', 'spc-monitoring', 'operations-plan-risk'],
    dataVolume: '6 years production records',
    userCount: 52,
    integrationCount: 9,
    migrationRisk: 'high',
    targetRetirementDate: '2027-12-31',
    notes: 'Complex batch record replacement. Regulatory dossier update required. EMA pre-submission meeting scheduled Q3 2026.',
    readinessChecks: [
      { label: 'ConnectIO workspace live at pilot site', passed: true },
      { label: 'Batch record equivalence validated', passed: false },
      { label: 'Regulatory submission prepared', passed: false },
      { label: 'All site rollouts complete', passed: false },
      { label: 'User training completed', passed: false },
      { label: 'Hypercare period complete', passed: false },
    ],
  },
  {
    systemId: 'LEGACY-WMS',
    systemName: 'Legacy WMS (Manhattan SCALE)',
    vendor: 'Manhattan Associates',
    domain: 'warehouse',
    retirementStatus: 'in-progress',
    supersededBy: ['warehouse-360-overview', 'production-staging'],
    dataVolume: '5 years goods movements',
    userCount: 31,
    integrationCount: 6,
    migrationRisk: 'medium',
    targetRetirementDate: '2027-06-30',
    notes: 'Pilot at IE10 warehouse in progress. SAP EWM integration design complete.',
    readinessChecks: [
      { label: 'ConnectIO workspace live at pilot site', passed: true },
      { label: 'SAP EWM integration designed', passed: true },
      { label: 'Historical stock data migrated', passed: false },
      { label: 'All site rollouts complete', passed: false },
      { label: 'User training completed', passed: false },
      { label: 'Hypercare period complete', passed: false },
    ],
  },
  {
    systemId: 'LEGACY-EM',
    systemName: 'Legacy EM Tracker (in-house Excel/SharePoint)',
    vendor: 'Internal',
    domain: 'environmental-monitoring',
    retirementStatus: 'ready',
    supersededBy: ['envmon-monitoring'],
    dataVolume: '3 years swab results',
    userCount: 12,
    integrationCount: 0,
    migrationRisk: 'low',
    targetRetirementDate: '2026-07-31',
    notes: 'All sites migrated. SharePoint decommission scheduled. Simple CSV archive in progress.',
    readinessChecks: [
      { label: 'ConnectIO workspace live at all sites', passed: true },
      { label: 'Historical swab data imported', passed: true },
      { label: 'ERP integration migrated to new layer', passed: true },
      { label: 'All site rollouts complete', passed: true },
      { label: 'User training completed', passed: true },
      { label: 'Hypercare period complete', passed: true },
    ],
  },
  {
    systemId: 'LEGACY-TRACE',
    systemName: 'Legacy Traceability (Intelex)',
    vendor: 'Intelex',
    domain: 'traceability',
    retirementStatus: 'not-started',
    supersededBy: ['trace-investigation'],
    dataVolume: '10 years trace events',
    userCount: 18,
    integrationCount: 4,
    migrationRisk: 'high',
    targetRetirementDate: '2028-03-31',
    notes: 'ConnectIO Trace Investigation workspace live but full regulatory equivalence assessment pending. Intelex contract renewal being extended.',
    readinessChecks: [
      { label: 'ConnectIO workspace live at pilot site', passed: true },
      { label: 'Regulatory equivalence assessed', passed: false },
      { label: 'Historical trace data migrated', passed: false },
      { label: 'All site rollouts complete', passed: false },
      { label: 'User training completed', passed: false },
      { label: 'Hypercare period complete', passed: false },
    ],
  },
]

function statusColor(status: RetirementStatus): string {
  switch (status) {
    case 'retired': return '#16A34A'
    case 'ready': return '#2563EB'
    case 'in-progress': return '#D97706'
    case 'not-started': return '#9CA3AF'
  }
}

function riskColor(risk: MigrationRisk): string {
  if (risk === 'high') return '#DC2626'
  if (risk === 'medium') return '#D97706'
  return '#16A34A'
}

const BADGE: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 7px',
  borderRadius: 3,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#fff',
}

const CARD: React.CSSProperties = {
  background: 'var(--shell-surface)',
  border: '1px solid var(--shell-line)',
  borderRadius: 6,
  padding: 16,
  marginBottom: 12,
}

type FilterStatus = 'all' | RetirementStatus

/** Admin legacy retirement readiness dashboard. */
export function LegacyRetirementPage() {
  const [filter, setFilter] = useState<FilterStatus>('all')

  const statusCounts = LEGACY_SYSTEMS.reduce<Record<RetirementStatus, number>>(
    (acc, s) => { acc[s.retirementStatus]++ ; return acc },
    { 'not-started': 0, 'in-progress': 0, ready: 0, retired: 0 },
  )

  const filtered = filter === 'all'
    ? LEGACY_SYSTEMS
    : LEGACY_SYSTEMS.filter(s => s.retirementStatus === filter)

  const filterBtns: { id: FilterStatus; label: string }[] = [
    { id: 'all', label: `All (${LEGACY_SYSTEMS.length})` },
    { id: 'not-started', label: `Not Started (${statusCounts['not-started']})` },
    { id: 'in-progress', label: `In Progress (${statusCounts['in-progress']})` },
    { id: 'ready', label: `Ready (${statusCounts.ready})` },
    { id: 'retired', label: `Retired (${statusCounts.retired})` },
  ]

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: 'var(--shell-fg)' }}>
          Legacy Retirement Readiness
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Track retirement readiness for legacy systems being superseded by ConnectIO workspaces.
        </p>
      </div>

      {/* Summary KPI bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {([
          { label: 'Not Started', status: 'not-started' as const },
          { label: 'In Progress', status: 'in-progress' as const },
          { label: 'Ready to Retire', status: 'ready' as const },
          { label: 'Retired', status: 'retired' as const },
        ]).map(({ label, status }) => (
          <div
            key={status}
            style={{
              padding: '12px 16px',
              background: 'var(--shell-surface)',
              border: '1px solid var(--shell-line)',
              borderTop: `3px solid ${statusColor(status)}`,
              borderRadius: 5,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--shell-fg)' }}>
              {statusCounts[status]}
            </div>
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--shell-line)', paddingBottom: 0 }}>
        {filterBtns.map(btn => (
          <button
            key={btn.id}
            type="button"
            onClick={() => setFilter(btn.id)}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: 'none',
              borderBottom: filter === btn.id ? '2px solid var(--shell-rail-active, #005776)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: filter === btn.id ? 600 : 400,
              color: filter === btn.id ? 'var(--shell-rail-active, #005776)' : 'var(--shell-fg-2)',
              marginBottom: -1,
              whiteSpace: 'nowrap',
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* System cards */}
      {filtered.map(system => {
        const passedCount = system.readinessChecks.filter(c => c.passed).length
        const totalChecks = system.readinessChecks.length
        const pct = Math.round((passedCount / totalChecks) * 100)

        return (
          <div key={system.systemId} style={{ ...CARD, borderLeft: `3px solid ${statusColor(system.retirementStatus)}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--shell-fg)', marginBottom: 2 }}>
                  {system.systemName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--shell-fg-3)' }}>
                  {system.vendor} · {system.domain} domain · {system.userCount} users · {system.integrationCount} integrations
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                <span style={{ ...BADGE, background: statusColor(system.retirementStatus) }}>
                  {system.retirementStatus.replace(/-/g, ' ')}
                </span>
                <span style={{ ...BADGE, background: riskColor(system.migrationRisk) }}>
                  {system.migrationRisk} risk
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
                  System ID
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--shell-fg-2)' }}>{system.systemId}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
                  Target Retirement
                </div>
                <div style={{ fontSize: 12, color: 'var(--shell-fg)' }}>{system.targetRetirementDate}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
                  Data Volume
                </div>
                <div style={{ fontSize: 12, color: 'var(--shell-fg)' }}>{system.dataVolume}</div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                Superseded By
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {system.supersededBy.map(wsId => (
                  <span
                    key={wsId}
                    style={{
                      padding: '2px 7px',
                      background: 'var(--shell-surface-2, #f3f4f6)',
                      border: '1px solid var(--shell-line)',
                      borderRadius: 3,
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: 'var(--shell-fg-2)',
                    }}
                  >
                    {wsId}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Readiness Checks ({passedCount}/{totalChecks})
                </div>
                <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', fontWeight: 600 }}>{pct}%</div>
              </div>
              <div style={{ height: 4, background: 'var(--shell-line)', borderRadius: 2, marginBottom: 8 }}>
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: pct === 100 ? '#16A34A' : pct >= 50 ? '#2563EB' : '#D97706',
                    borderRadius: 2,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 4 }}>
                {system.readinessChecks.map((check, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    <span style={{ color: check.passed ? '#16A34A' : '#D97706', flexShrink: 0, fontSize: 13 }}>
                      {check.passed ? '✓' : '○'}
                    </span>
                    <span style={{ color: check.passed ? 'var(--shell-fg-2)' : 'var(--shell-fg-3)' }}>
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {system.notes && (
              <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', borderTop: '1px solid var(--shell-line)', paddingTop: 10, marginTop: 4 }}>
                <strong style={{ color: 'var(--shell-fg-2)' }}>Notes: </strong>{system.notes}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
