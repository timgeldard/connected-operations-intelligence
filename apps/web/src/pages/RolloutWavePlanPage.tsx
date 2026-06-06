import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Separator,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import type { RolloutWave, RolloutWaveStatus } from '@connectio/product-model'

const ROLLOUT_WAVES: readonly RolloutWave[] = [
  {
    waveId: 'WAVE-0',
    name: 'Wave 0 — Controlled Pilot (IE10)',
    description: 'Single-plant controlled pilot at Kerry Listowel (IE10). Core pilot roles only. No production data writes from V2.',
    targetRoles: ['quality-lead', 'food-safety-lead', 'operations-supervisor', 'warehouse-manager'],
    targetPlants: ['IE10 — Kerry Listowel'],
    targetWorkspaces: ['quality-batch-release', 'trace-investigation', 'operations-plan-risk', 'warehouse-360-overview', 'production-staging'],
    prerequisites: [],
    entryCriteria: ['Pilot environment provisioned', 'Mock data configured', 'Training for Wave 0 roles completed', 'Support contacts defined'],
    exitCriteria: ['All 6 pilot scenarios executed', 'Scenario pass rate ≥80%', 'All 8 stakeholder sign-offs approved', '0 open production blockers', '≥9 of 10 release gates passed', 'All 12 pilot exit criteria met'],
    rollbackPlan: 'Legacy apps remain fully operational throughout Wave 0. No V2 production writes enabled.',
    owner: 'pilot-lead',
    plannedStart: '2026-05-15',
    plannedEnd: '2026-08-31',
    status: 'active',
  },
  {
    waveId: 'WAVE-1',
    name: 'Wave 1 — Production Go-Live (IE10)',
    description: 'Production go-live at Kerry Listowel (IE10). All Wave 0 roles move to V2 as primary interface. Legacy apps available in read-only fallback mode.',
    targetRoles: ['quality-lead', 'food-safety-lead', 'operations-supervisor', 'warehouse-manager', 'qa-technician', 'plant-manager'],
    targetPlants: ['IE10 — Kerry Listowel'],
    targetWorkspaces: ['quality-batch-release', 'trace-investigation', 'operations-plan-risk', 'warehouse-360-overview', 'production-staging', 'spc-monitoring', 'envmon-monitoring', 'process-order-review'],
    prerequisites: ['WAVE-0 exit criteria all met', 'Production environment provisioned and tested', 'SPC and WM connectors deployed', 'Accessibility blockers resolved or formally accepted'],
    entryCriteria: ['All WAVE-0 exit criteria met', 'Production source connectors tested', 'Support runbooks reviewed', 'Rollback procedure rehearsed'],
    exitCriteria: ['V2 used as primary interface for ≥95% of daily workflows', 'Zero P1 incidents in first 30 days', '≥80% satisfaction score from pilot users', 'Legacy app usage <5% of sessions'],
    rollbackPlan: 'Legacy apps restored to primary interface within 4 hours. V2 set to read-only fallback. Data written to V2 action store to be manually reconciled.',
    owner: 'programme-manager',
    plannedStart: '2026-09-01',
    plannedEnd: '2026-10-31',
    status: 'planned',
  },
  {
    waveId: 'WAVE-2',
    name: 'Wave 2 — Expansion (Additional Plants)',
    description: 'Expand V2 to additional Kerry plants following successful Wave 1 at IE10. Specific plants, scope, and timing to be confirmed in the Wave 1 exit review. Maintenance Reliability workspace included if SAP PM contract is signed.',
    targetRoles: ['quality-lead', 'food-safety-lead', 'operations-supervisor', 'warehouse-manager', 'qa-technician', 'plant-manager', 'maintenance-technician'],
    targetPlants: ['IE10 — Kerry Listowel (baseline)', 'Additional plants — TBD in Wave 1 exit review'],
    targetWorkspaces: ['quality-batch-release', 'trace-investigation', 'operations-plan-risk', 'warehouse-360-overview', 'production-staging', 'spc-monitoring', 'envmon-monitoring', 'process-order-review', 'maintenance-reliability'],
    prerequisites: ['WAVE-1 exit criteria met', 'SAP PM contract signed', 'Maintenance Reliability workspace validated at IE10', 'Wave 2 plant scope formally agreed'],
    entryCriteria: ['WAVE-1 exit criteria all met', 'Wave 2 plant environments provisioned', 'Training delivered to Wave 2 cohort', 'Local support contacts identified'],
    exitCriteria: ['V2 primary across Wave 2 plants', 'Zero P1 incidents in first 30 days per plant', 'Maintenance Reliability scenario validated at each plant'],
    rollbackPlan: 'Per-plant rollback available. Legacy apps remain accessible throughout Wave 2. IE10 Wave 1 state not affected by Wave 2 rollback.',
    owner: 'programme-manager',
    plannedStart: 'TBD — pending Wave 1 exit',
    plannedEnd: 'TBD',
    status: 'not-started',
  },
  {
    waveId: 'WAVE-3',
    name: 'Wave 3 — Broader Rollout',
    description: 'Continued rollout to remaining Kerry plants. Scope, sequence, and timing to be defined following Wave 2. Legacy app retirement is managed separately through the existing Legacy Retirement Readiness process — no retirement actions are taken within this screen.',
    targetRoles: ['quality-lead', 'food-safety-lead', 'operations-supervisor', 'warehouse-manager', 'qa-technician', 'plant-manager', 'maintenance-technician'],
    targetPlants: ['TBD — to be scoped in Wave 2 exit review'],
    targetWorkspaces: ['all in-scope workspaces per plant'],
    prerequisites: ['WAVE-2 exit criteria met', 'All source connectors proven in production', 'Global support model established'],
    entryCriteria: ['WAVE-2 exit criteria met', 'Plant environments provisioned', 'L&D programme delivered to Wave 3 cohort'],
    exitCriteria: ['V2 adopted as primary interface across Wave 3 plants', 'Zero P1 incidents in first 30 days per plant'],
    rollbackPlan: 'Per-plant rollback with legacy app availability window. Rollback plan to be confirmed for each plant in Wave 3 scoping.',
    owner: 'cto-office',
    plannedStart: 'TBD — pending Wave 2 exit',
    plannedEnd: 'TBD',
    status: 'not-started',
  },
]

function waveStatusVariant(status: RolloutWaveStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed') return 'default'
  if (status === 'active') return 'secondary'
  if (status === 'blocked') return 'destructive'
  if (status === 'planned') return 'outline'
  return 'outline'
}

function waveStatusLabel(status: RolloutWaveStatus): string {
  const labels: Record<RolloutWaveStatus, string> = {
    'not-started': 'Not Started',
    'planned': 'Planned',
    'active': 'Active',
    'completed': 'Completed',
    'blocked': 'Blocked',
    'deferred': 'Deferred',
  }
  return labels[status]
}

export function RolloutWavePlanPage() {
  return (
    <div data-testid="rollout-wave-plan" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Rollout Wave Plan</h1>
          <Badge variant="outline">Phase 8</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Illustrative production rollout plan for ConnectIO-RAD V2. Wave 0 (controlled pilot) is currently active at IE10. Waves 1–3 are planning targets only — scope, plant selection, and timing are subject to steering committee approval at each wave exit review.
        </p>
      </div>

      {ROLLOUT_WAVES.map((wave, idx) => (
        <Card key={wave.waveId} data-testid={`wave-${wave.waveId}`} style={{ marginBottom: 20 }}>
          <CardHeader style={{ paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: wave.status === 'active' ? 'var(--shell-rail-active, #005776)' : 'var(--shell-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: wave.status === 'active' ? '#fff' : 'var(--shell-fg-3)', flexShrink: 0 }}>
                {idx}
              </div>
              <CardTitle style={{ fontSize: 15 }}>{wave.name}</CardTitle>
              <Badge variant={waveStatusVariant(wave.status)}>{waveStatusLabel(wave.status)}</Badge>
            </div>
            <CardDescription>
              {wave.waveId} · Owner: {wave.owner} · {wave.plannedStart} → {wave.plannedEnd}
              · Plants: {wave.targetPlants.join(', ')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--shell-fg-2)' }}>{wave.description}</p>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {wave.prerequisites.length > 0 && (
                <div style={{ flex: '1 1 200px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Prerequisites</div>
                  <ul style={{ margin: 0, paddingLeft: 14 }}>
                    {wave.prerequisites.map((p, i) => <li key={i} style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginBottom: 2 }}>{p}</li>)}
                  </ul>
                </div>
              )}
              <div style={{ flex: '1 1 200px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Exit Criteria</div>
                <ul style={{ margin: 0, paddingLeft: 14 }}>
                  {wave.exitCriteria.map((c, i) => <li key={i} style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginBottom: 2 }}>{c}</li>)}
                </ul>
              </div>
            </div>

            <Separator style={{ margin: '12px 0' }} />
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
              <strong>Rollback:</strong> {wave.rollbackPlan}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--shell-fg-3)' }}>
              <strong>Workspaces:</strong> {wave.targetWorkspaces.join(', ')}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
