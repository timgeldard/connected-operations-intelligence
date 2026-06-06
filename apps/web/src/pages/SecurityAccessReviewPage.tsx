import {
  Badge, Card, CardContent,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import type { SecurityAccessReviewItem, AccessStatus } from '@connectio/product-model'

const REVIEW_ITEMS: readonly SecurityAccessReviewItem[] = [
  { reviewId: 'SAR-001', roleId: 'quality-lead', workspaceId: 'quality-batch-release', scopeLevel: 'plant', permission: 'workspace.view', accessExpected: true, accessActual: true, status: 'correct', finding: 'Quality Lead has correct access to Batch Release at plant scope.', recommendation: 'No action required.' },
  { reviewId: 'SAR-002', roleId: 'quality-lead', workspaceId: 'trace-investigation', scopeLevel: 'plant', permission: 'workspace.view', accessExpected: true, accessActual: true, status: 'correct', finding: 'Quality Lead has correct access to Trace Investigation.', recommendation: 'No action required.' },
  { reviewId: 'SAR-003', roleId: 'quality-lead', workspaceId: 'spc-monitoring', scopeLevel: 'plant', permission: 'workspace.view', accessExpected: true, accessActual: true, status: 'correct', finding: 'Quality Lead has correct access to SPC Monitoring.', recommendation: 'No action required.' },
  { reviewId: 'SAR-004', roleId: 'quality-lead', workspaceId: 'operations-plan-risk', scopeLevel: 'plant', permission: 'workspace.view', accessExpected: false, accessActual: true, status: 'over-permissioned', finding: 'Quality Lead can view Operations Plan Risk in current mock model — not expected.', recommendation: 'Restrict via role claim once server-side enforcement is active.' },
  { reviewId: 'SAR-005', roleId: 'qa-technician', workspaceId: 'quality-batch-release', scopeLevel: 'batch', permission: 'workspace.view', accessExpected: true, accessActual: true, status: 'correct', finding: 'QA Technician has correct access to Batch Release at batch scope.', recommendation: 'No action required.' },
  { reviewId: 'SAR-006', roleId: 'qa-technician', workspaceId: 'trace-investigation', scopeLevel: 'batch', permission: 'workspace.view', accessExpected: true, accessActual: true, status: 'correct', finding: 'QA Technician has correct access to Trace Investigation.', recommendation: 'No action required.' },
  { reviewId: 'SAR-007', roleId: 'food-safety-lead', workspaceId: 'trace-investigation', scopeLevel: 'plant', permission: 'workspace.view', accessExpected: true, accessActual: true, status: 'correct', finding: 'Food Safety Lead has correct access to Trace Investigation at plant scope.', recommendation: 'No action required.' },
  { reviewId: 'SAR-008', roleId: 'food-safety-lead', workspaceId: 'envmon-monitoring', scopeLevel: 'plant', permission: 'workspace.view', accessExpected: true, accessActual: true, status: 'correct', finding: 'Food Safety Lead has correct access to Environmental Monitoring.', recommendation: 'No action required.' },
  { reviewId: 'SAR-009', roleId: 'operations-supervisor', workspaceId: 'operations-plan-risk', scopeLevel: 'plant', permission: 'workspace.view', accessExpected: true, accessActual: true, status: 'correct', finding: 'Operations Supervisor has correct access to Operations Plan Risk.', recommendation: 'No action required.' },
  { reviewId: 'SAR-010', roleId: 'operations-supervisor', workspaceId: 'quality-batch-release', scopeLevel: 'plant', permission: 'workspace.view', accessExpected: false, accessActual: true, status: 'over-permissioned', finding: 'Operations Supervisor can view Batch Release in current mock model — read-only access only expected.', recommendation: 'Restrict write actions via role claim in production.' },
  { reviewId: 'SAR-011', roleId: 'warehouse-manager', workspaceId: 'production-staging', scopeLevel: 'warehouse', permission: 'workspace.view', accessExpected: true, accessActual: true, status: 'correct', finding: 'Warehouse Manager has correct access to Production Staging.', recommendation: 'No action required.' },
  { reviewId: 'SAR-012', roleId: 'warehouse-manager', workspaceId: 'warehouse-360-overview', scopeLevel: 'warehouse', permission: 'workspace.view', accessExpected: true, accessActual: true, status: 'correct', finding: 'Warehouse Manager has correct access to Warehouse 360.', recommendation: 'No action required.' },
  { reviewId: 'SAR-013', roleId: 'maintenance-lead', workspaceId: 'maintenance-reliability', scopeLevel: 'plant', permission: 'workspace.view', accessExpected: true, accessActual: true, status: 'correct', finding: 'Maintenance Lead has correct access to Maintenance & Reliability.', recommendation: 'No action required.' },
  { reviewId: 'SAR-014', roleId: 'plant-manager', workspaceId: 'trace-investigation', scopeLevel: 'plant', permission: 'workspace.view', accessExpected: true, accessActual: true, status: 'correct', finding: 'Plant Manager has correct access to all pilot workspaces.', recommendation: 'No action required.' },
  { reviewId: 'SAR-015', roleId: 'admin', workspaceId: 'admin-governance', scopeLevel: 'plant', permission: 'workspace.view', accessExpected: true, accessActual: true, status: 'correct', finding: 'Admin has correct access to governance dashboards.', recommendation: 'No action required.' },
  { reviewId: 'SAR-016', roleId: 'qa-technician', workspaceId: 'admin-governance', scopeLevel: 'plant', permission: 'workspace.view', accessExpected: false, accessActual: true, status: 'over-permissioned', finding: 'Governance dashboards are accessible to all roles in current mock model — should be admin-only.', recommendation: 'Restrict admin routes to admin role via server-side enforcement in production.' },
  { reviewId: 'SAR-017', roleId: 'operations-supervisor', workspaceId: 'traceability-workspace', scopeLevel: 'plant', permission: 'workspace.view', accessExpected: false, accessActual: false, status: 'correct', finding: 'Concept lab workspaces correctly hidden from navigation for operations-supervisor.', recommendation: 'No action required. Lifecycle=concept-lab enforced by isNavigable().' },
]

function statusVariant(status: AccessStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'correct') return 'default'
  if (status === 'over-permissioned') return 'destructive'
  if (status === 'under-permissioned') return 'destructive'
  return 'outline'
}

function KpiBar() {
  const correct = REVIEW_ITEMS.filter(r => r.status === 'correct').length
  const overPermissioned = REVIEW_ITEMS.filter(r => r.status === 'over-permissioned').length
  const underPermissioned = REVIEW_ITEMS.filter(r => r.status === 'under-permissioned').length
  const notAssessed = REVIEW_ITEMS.filter(r => r.status === 'not-assessed').length

  const kpis = [
    { label: 'Total Reviews', value: REVIEW_ITEMS.length },
    { label: 'Correct', value: correct },
    { label: 'Over-Permissioned', value: overPermissioned },
    { label: 'Under-Permissioned', value: underPermissioned },
    { label: 'Not Assessed', value: notAssessed },
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

export function SecurityAccessReviewPage() {
  return (
    <div data-testid="security-access-review" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Security & Access Review Matrix</h1>
          <Badge variant="outline">Phase 7</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Role × Workspace × Scope access review using the mock auth-scope model. Over-permissioned entries require server-side enforcement before production.
        </p>
      </div>
      <KpiBar />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--shell-line)' }}>
              {['Review ID', 'Role', 'Workspace', 'Scope', 'Permission', 'Expected', 'Actual', 'Status', 'Finding'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REVIEW_ITEMS.map((item, i) => (
              <tr
                key={item.reviewId}
                data-testid={`sar-${item.reviewId}`}
                style={{ borderBottom: '1px solid var(--shell-line)', background: i % 2 === 0 ? 'transparent' : 'var(--shell-surface)' }}
              >
                <td style={{ padding: '8px 10px', color: 'var(--shell-fg-3)' }}>{item.reviewId}</td>
                <td style={{ padding: '8px 10px', color: 'var(--shell-fg)' }}>{item.roleId}</td>
                <td style={{ padding: '8px 10px', color: 'var(--shell-fg-2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.workspaceId}</td>
                <td style={{ padding: '8px 10px', color: 'var(--shell-fg-2)' }}>{item.scopeLevel}</td>
                <td style={{ padding: '8px 10px', color: 'var(--shell-fg-2)' }}>{item.permission}</td>
                <td style={{ padding: '8px 10px' }}>{item.accessExpected ? '✓' : '✗'}</td>
                <td style={{ padding: '8px 10px' }}>{item.accessActual ? '✓' : '✗'}</td>
                <td style={{ padding: '8px 10px' }}><Badge variant={statusVariant(item.status)} style={{ fontSize: 10 }}>{item.status.replace(/-/g, ' ')}</Badge></td>
                <td style={{ padding: '8px 10px', color: 'var(--shell-fg-2)', maxWidth: 220 }}>{item.finding}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
