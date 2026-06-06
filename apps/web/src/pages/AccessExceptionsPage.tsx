import { useState } from 'react'
import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import type { AccessException } from '@connectio/product-model'

const ACCESS_EXCEPTIONS: readonly AccessException[] = [
  {
    exceptionId: 'AE-001', roleId: 'quality-lead', workspaceId: 'quality-batch-release', scopeLevel: 'batch', expectedAccess: true, actualAccess: true, severity: 'info', owner: 'security-team', status: 'resolved', recommendation: 'No exception — access is as expected.', blocksProduction: false,
  },
  {
    exceptionId: 'AE-002', roleId: 'plant-manager', workspaceId: 'quality-batch-release', scopeLevel: 'plant', expectedAccess: true, actualAccess: false, severity: 'warning', owner: 'security-team', status: 'open', recommendation: 'Plant manager cross-workspace read access not yet provisioned. Required for SCN-006.', blocksProduction: true,
  },
  {
    exceptionId: 'AE-003', roleId: 'qa-technician', workspaceId: 'operations-plan-risk', scopeLevel: 'plant', expectedAccess: false, actualAccess: true, severity: 'critical', owner: 'security-team', status: 'open', recommendation: 'QA Technician should not have write access to Operations Plan Risk. Review and correct Azure AD group assignment.', blocksProduction: true,
  },
  {
    exceptionId: 'AE-004', roleId: 'food-safety-lead', workspaceId: 'trace-investigation', scopeLevel: 'batch', expectedAccess: true, actualAccess: true, severity: 'info', owner: 'security-team', status: 'resolved', recommendation: 'No exception — access confirmed as expected.', blocksProduction: false,
  },
  {
    exceptionId: 'AE-005', roleId: 'warehouse-manager', workspaceId: 'warehouse-360-overview', scopeLevel: 'warehouse', expectedAccess: true, actualAccess: true, severity: 'info', owner: 'security-team', status: 'resolved', recommendation: 'No exception — access confirmed as expected.', blocksProduction: false,
  },
  {
    exceptionId: 'AE-006', roleId: 'operations-supervisor', workspaceId: 'quality-batch-release', scopeLevel: 'batch', expectedAccess: false, actualAccess: false, severity: 'info', owner: 'security-team', status: 'resolved', recommendation: 'No exception — access correctly restricted for this role.', blocksProduction: false,
  },
  {
    exceptionId: 'AE-007', roleId: 'maintenance-technician', workspaceId: 'maintenance-reliability', scopeLevel: 'plant', expectedAccess: true, actualAccess: false, severity: 'warning', owner: 'security-team', status: 'deferred', recommendation: 'Maintenance Reliability excluded from pilot scope (SAP PM contract not signed). Defer access exception until workspace is in scope.', blocksProduction: false,
  },
  {
    exceptionId: 'AE-008', roleId: 'plant-manager', workspaceId: 'trace-investigation', scopeLevel: 'plant', expectedAccess: true, actualAccess: false, severity: 'critical', owner: 'security-team', status: 'open', recommendation: 'Plant manager cross-workspace read required for SCN-006. Must be resolved before SCN-006 can be executed.', blocksProduction: true,
  },
  {
    exceptionId: 'AE-009', roleId: 'quality-lead', workspaceId: 'spc-monitoring', scopeLevel: 'plant', expectedAccess: true, actualAccess: true, severity: 'info', owner: 'security-team', status: 'resolved', recommendation: 'No exception — quality lead cross-domain access to SPC confirmed.', blocksProduction: false,
  },
  {
    exceptionId: 'AE-010', roleId: 'external-auditor', workspaceId: 'quality-batch-release', scopeLevel: 'batch', expectedAccess: false, actualAccess: false, severity: 'info', owner: 'security-team', status: 'resolved', recommendation: 'External auditor correctly denied access during pilot phase. Production will use read-only auditor role.', blocksProduction: false,
  },
]

function statusVariant(status: AccessException['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'resolved') return 'default'
  if (status === 'accepted-risk') return 'secondary'
  if (status === 'deferred') return 'outline'
  if (status === 'open') return 'destructive'
  return 'outline'
}

function severityColor(severity: string): string {
  if (severity === 'critical') return '#DC2626'
  if (severity === 'warning') return '#D97706'
  if (severity === 'info') return '#6B7280'
  return '#6B7280'
}

type ExFilter = 'all' | 'open' | 'prod-blockers' | 'resolved'

export function AccessExceptionsPage() {
  const [filter, setFilter] = useState<ExFilter>('all')

  const openCount = ACCESS_EXCEPTIONS.filter(e => e.status === 'open').length
  const prodBlockers = ACCESS_EXCEPTIONS.filter(e => e.blocksProduction && e.status === 'open').length
  const resolvedCount = ACCESS_EXCEPTIONS.filter(e => e.status === 'resolved' || e.status === 'accepted-risk').length

  const filtered = ACCESS_EXCEPTIONS.filter(ex => {
    if (filter === 'open') return ex.status === 'open'
    if (filter === 'prod-blockers') return ex.blocksProduction && ex.status === 'open'
    if (filter === 'resolved') return ex.status === 'resolved' || ex.status === 'accepted-risk'
    return true
  })

  return (
    <div data-testid="access-exceptions" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Access Exceptions</h1>
          <Badge variant="outline">Phase 8</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Access discrepancies identified during pilot — where actual workspace access differs from expected access by role and scope. {openCount} open, {prodBlockers} blocking production.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: 'Total', value: ACCESS_EXCEPTIONS.length },
          { label: 'Open', value: openCount, danger: openCount > 0 },
          { label: 'Production Blockers', value: prodBlockers, danger: prodBlockers > 0 },
          { label: 'Deferred', value: ACCESS_EXCEPTIONS.filter(e => e.status === 'deferred').length },
          { label: 'Resolved', value: resolvedCount },
        ].map(({ label, value, danger }) => (
          <Card key={label} style={{ flex: '1 1 120px', minWidth: 100, border: danger ? '1px solid #DC2626' : undefined }}>
            <CardContent style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: danger ? '#DC2626' : 'var(--shell-fg)' }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={filter} onValueChange={v => setFilter(v as ExFilter)}>
        <TabsList style={{ marginBottom: 16 }}>
          <TabsTrigger value="all">All ({ACCESS_EXCEPTIONS.length})</TabsTrigger>
          <TabsTrigger value="open">Open ({openCount})</TabsTrigger>
          <TabsTrigger value="prod-blockers">Prod Blockers ({prodBlockers})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolvedCount})</TabsTrigger>
        </TabsList>
        <TabsContent value={filter}>
          {filtered.map(ex => (
            <Card key={ex.exceptionId} data-testid={`access-exception-${ex.exceptionId}`} style={{ marginBottom: 12, border: ex.status === 'open' && ex.blocksProduction ? '1px solid #DC2626' : undefined }}>
              <CardHeader style={{ paddingBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <CardTitle style={{ fontSize: 14 }}>{ex.exceptionId} — {ex.roleId} → {ex.workspaceId}</CardTitle>
                  <Badge variant={statusVariant(ex.status)}>{ex.status.replace(/-/g, ' ')}</Badge>
                  <span style={{ fontSize: 11, fontWeight: 600, color: severityColor(ex.severity) }}>{ex.severity}</span>
                  {ex.blocksProduction && ex.status === 'open' && <Badge variant="destructive">blocks production</Badge>}
                </div>
                <CardDescription>
                  Scope: {ex.scopeLevel} · Expected: {ex.expectedAccess ? 'has access' : 'no access'} · Actual: {ex.actualAccess ? 'has access' : 'no access'} · Owner: {ex.owner}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ fontSize: 12, color: 'var(--shell-fg-2)', fontStyle: 'italic' }}>{ex.recommendation}</div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p style={{ color: 'var(--shell-fg-3)', fontSize: 13 }}>No exceptions match this filter.</p>}
        </TabsContent>
      </Tabs>
    </div>
  )
}
