import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@connectio/design-system'
import type { TrainingReadiness } from '@connectio/product-model'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'

const TRAINING_READINESS: readonly TrainingReadiness[] = [
  {
    roleId: 'quality-lead',
    roleName: 'Quality Lead',
    requiredTrainingItems: ['V2 Concepts Overview', 'Quality Batch Release Workspace', 'Batch Release Workflow', 'Evidence Capture Guide', 'Cross-Domain Navigation'],
    completedTrainingItems: ['V2 Concepts Overview', 'Quality Batch Release Workspace', 'Batch Release Workflow', 'Evidence Capture Guide', 'Cross-Domain Navigation'],
    completionPercent: 100,
    usersReady: 3,
    usersNotReady: 0,
    blockers: [],
    recommendation: 'Quality Lead role is fully training-ready. All 3 pilot users completed required modules.',
  },
  {
    roleId: 'food-safety-lead',
    roleName: 'Food Safety Lead',
    requiredTrainingItems: ['V2 Concepts Overview', 'Trace Investigation Workspace', 'Supplier Chain Drill-Through', 'Evidence Capture Guide'],
    completedTrainingItems: ['V2 Concepts Overview', 'Trace Investigation Workspace', 'Supplier Chain Drill-Through', 'Evidence Capture Guide'],
    completionPercent: 100,
    usersReady: 2,
    usersNotReady: 0,
    blockers: [],
    recommendation: 'Food Safety Lead role is fully training-ready. Both pilot users completed all modules.',
  },
  {
    roleId: 'operations-supervisor',
    roleName: 'Operations Supervisor',
    requiredTrainingItems: ['V2 Concepts Overview', 'Operations Plan Risk Workspace', 'Risk Escalation Workflow', 'Material Shortage Navigation'],
    completedTrainingItems: ['V2 Concepts Overview', 'Operations Plan Risk Workspace', 'Risk Escalation Workflow'],
    completionPercent: 75,
    usersReady: 1,
    usersNotReady: 1,
    blockers: ['Material Shortage Navigation module not completed by 1 of 2 users'],
    recommendation: 'Almost ready. Ensure Material Shortage Navigation is completed before SCN-003 re-run.',
  },
  {
    roleId: 'warehouse-manager',
    roleName: 'Warehouse Manager',
    requiredTrainingItems: ['V2 Concepts Overview', 'Production Staging Workspace', 'Staging Confirmation Workflow', 'Warehouse 360 Navigation'],
    completedTrainingItems: ['V2 Concepts Overview', 'Production Staging Workspace', 'Staging Confirmation Workflow', 'Warehouse 360 Navigation'],
    completionPercent: 100,
    usersReady: 2,
    usersNotReady: 0,
    blockers: [],
    recommendation: 'Warehouse Manager role fully training-ready. All modules completed.',
  },
  {
    roleId: 'qa-technician',
    roleName: 'QA Technician',
    requiredTrainingItems: ['V2 Concepts Overview', 'SPC Monitoring Workspace', 'EnvMon Workspace', 'Evidence Panel Navigation'],
    completedTrainingItems: ['V2 Concepts Overview', 'Evidence Panel Navigation'],
    completionPercent: 50,
    usersReady: 0,
    usersNotReady: 4,
    blockers: ['SPC Monitoring Workspace module requires SPC source connector availability', 'EnvMon Workspace module requires envmon mock data configuration'],
    recommendation: 'Blocked by source availability. SPC and EnvMon training modules depend on pilot environment configuration.',
  },
  {
    roleId: 'plant-manager',
    roleName: 'Plant Manager',
    requiredTrainingItems: ['V2 Concepts Overview', 'Cross-Domain Site Risk Review', 'RoleAwareHome Navigation', 'Workspace Switching Guide'],
    completedTrainingItems: ['V2 Concepts Overview'],
    completionPercent: 25,
    usersReady: 0,
    usersNotReady: 1,
    blockers: ['Cross-Domain Site Risk Review module pending RoleAwareHome pilot polish (SCN-006 prerequisite)', 'Workspace Switching Guide not yet released'],
    recommendation: 'Blocked. Plant Manager training depends on SCN-006 readiness work being completed first.',
  },
]

function completionColor(pct: number): string {
  if (pct >= 90) return '#16A34A'
  if (pct >= 60) return '#D97706'
  return '#DC2626'
}

function readinessVariant(pct: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (pct >= 90) return 'default'
  if (pct >= 60) return 'secondary'
  return 'destructive'
}

export function TrainingReadinessPage() {
  const fullyReady = TRAINING_READINESS.filter(r => r.completionPercent === 100).length
  const totalUsers = TRAINING_READINESS.reduce((acc, r) => acc + r.usersReady + r.usersNotReady, 0)
  const readyUsers = TRAINING_READINESS.reduce((acc, r) => acc + r.usersReady, 0)
  const overallPct = totalUsers === 0 ? 0 : Math.round((readyUsers / totalUsers) * 100)

  return (
    <div data-testid="training-readiness" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Training Readiness</h1>
          <Badge variant="outline">Phase 8</Badge>
          <Badge variant={readinessVariant(overallPct)}>Overall: {overallPct}% ready</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Training completion by role for the IE10 pilot cohort. {fullyReady} of {TRAINING_READINESS.length} roles fully ready. {readyUsers}/{totalUsers} users training-complete.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: 'Roles Fully Ready', value: fullyReady },
          { label: 'Roles in Progress', value: TRAINING_READINESS.filter(r => r.completionPercent > 0 && r.completionPercent < 100).length },
          { label: 'Users Ready', value: readyUsers },
          { label: 'Users Not Ready', value: totalUsers - readyUsers, danger: (totalUsers - readyUsers) > 0 },
        ].map(({ label, value, danger }) => (
          <Card key={label} style={{ flex: '1 1 120px', minWidth: 100, border: danger ? '1px solid #DC2626' : undefined }}>
            <CardContent style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: danger ? '#DC2626' : 'var(--shell-fg)' }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {TRAINING_READINESS.map(role => (
        <Card key={role.roleId} data-testid={`training-role-${role.roleId}`} style={{ marginBottom: 14 }}>
          <CardHeader style={{ paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <CardTitle style={{ fontSize: 14 }}>{role.roleName}</CardTitle>
              <Badge variant={readinessVariant(role.completionPercent)}>{role.completionPercent}% complete</Badge>
              {role.blockers.length > 0 && <Badge variant="destructive">blocked</Badge>}
            </div>
            <CardDescription>
              {role.roleId} · {role.usersReady} of {role.usersReady + role.usersNotReady} users ready · {role.completedTrainingItems.length}/{role.requiredTrainingItems.length} modules
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ marginBottom: 10 }}>
              <div style={{ height: 6, background: 'var(--shell-line)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${role.completionPercent}%`, background: completionColor(role.completionPercent), borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            </div>
            {role.blockers.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Blockers</div>
                <ul style={{ margin: 0, paddingLeft: 14 }}>
                  {role.blockers.map((b, i) => <li key={i} style={{ fontSize: 12, color: '#DC2626', marginBottom: 2 }}>{b}</li>)}
                </ul>
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', fontStyle: 'italic' }}>{role.recommendation}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
