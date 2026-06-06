import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'

interface WorkspaceAdoptionRecord {
  readonly workspaceId: string
  readonly displayName: string
  readonly pilotRoles: readonly string[]
  readonly activeUsers: number
  readonly totalPilotUsers: number
  readonly sessionsLastWeek: number
  readonly avgSessionMinutes: number
  readonly feedbackSubmitted: number
  readonly issuesRaised: number
  readonly scenariosCovered: readonly string[]
  readonly notes: string
}

const ADOPTION_RECORDS: readonly WorkspaceAdoptionRecord[] = [
  {
    workspaceId: 'quality-batch-release', displayName: 'Quality Batch Release', pilotRoles: ['quality-lead', 'qa-technician'], activeUsers: 3, totalPilotUsers: 3, sessionsLastWeek: 14, avgSessionMinutes: 22, feedbackSubmitted: 2, issuesRaised: 3, scenariosCovered: ['SCN-001'], notes: 'High engagement. CoA gap well-understood by users.',
  },
  {
    workspaceId: 'trace-investigation', displayName: 'Trace Investigation', pilotRoles: ['food-safety-lead'], activeUsers: 2, totalPilotUsers: 2, sessionsLastWeek: 9, avgSessionMinutes: 18, feedbackSubmitted: 0, issuesRaised: 1, scenariosCovered: ['SCN-002'], notes: 'Scenario passed. Strong adoption among food safety leads.',
  },
  {
    workspaceId: 'operations-plan-risk', displayName: 'Operations Plan Risk', pilotRoles: ['operations-supervisor'], activeUsers: 2, totalPilotUsers: 2, sessionsLastWeek: 11, avgSessionMinutes: 14, feedbackSubmitted: 1, issuesRaised: 2, scenariosCovered: ['SCN-003'], notes: 'Action persistence gap noted. Users continue to use workspace despite issue.',
  },
  {
    workspaceId: 'warehouse-360-overview', displayName: 'Warehouse 360 Overview', pilotRoles: ['warehouse-manager'], activeUsers: 2, totalPilotUsers: 2, sessionsLastWeek: 6, avgSessionMinutes: 11, feedbackSubmitted: 0, issuesRaised: 1, scenariosCovered: ['SCN-004'], notes: 'Fully adopted. Warehouse team positive about staging workflow.',
  },
  {
    workspaceId: 'spc-monitoring', displayName: 'SPC Monitoring', pilotRoles: ['quality-lead', 'qa-technician'], activeUsers: 2, totalPilotUsers: 5, sessionsLastWeek: 3, avgSessionMinutes: 8, feedbackSubmitted: 0, issuesRaised: 1, scenariosCovered: ['SCN-005'], notes: 'Low adoption — SPC connector gap limits utility. SCN-005 not yet executed.',
  },
  {
    workspaceId: 'envmon-monitoring', displayName: 'Environmental Monitoring', pilotRoles: ['qa-technician'], activeUsers: 0, totalPilotUsers: 4, sessionsLastWeek: 0, avgSessionMinutes: 0, feedbackSubmitted: 0, issuesRaised: 0, scenariosCovered: [], notes: 'No adoption — pilot scope deferred pending training readiness for QA Technician role.',
  },
  {
    workspaceId: 'production-staging', displayName: 'Production Staging', pilotRoles: ['warehouse-manager'], activeUsers: 2, totalPilotUsers: 2, sessionsLastWeek: 8, avgSessionMinutes: 9, feedbackSubmitted: 0, issuesRaised: 0, scenariosCovered: ['SCN-004'], notes: 'Good adoption. Scenario passed cleanly.',
  },
  {
    workspaceId: 'maintenance-reliability', displayName: 'Maintenance Reliability', pilotRoles: ['maintenance-technician'], activeUsers: 0, totalPilotUsers: 0, sessionsLastWeek: 0, avgSessionMinutes: 0, feedbackSubmitted: 0, issuesRaised: 0, scenariosCovered: [], notes: 'Excluded from pilot scope pending SAP PM contract.',
  },
  {
    workspaceId: 'process-order-review', displayName: 'Process Order Review', pilotRoles: ['operations-supervisor', 'quality-lead'], activeUsers: 1, totalPilotUsers: 4, sessionsLastWeek: 2, avgSessionMinutes: 6, feedbackSubmitted: 0, issuesRaised: 0, scenariosCovered: [], notes: 'Low adoption — not yet a primary pilot scenario target. Exploratory use only.',
  },
]

function adoptionVariant(pct: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (pct >= 80) return 'default'
  if (pct >= 40) return 'secondary'
  if (pct === 0) return 'outline'
  return 'destructive'
}

function adoptionColor(pct: number): string {
  if (pct >= 80) return '#16A34A'
  if (pct >= 40) return '#D97706'
  return '#DC2626'
}

export function WorkspaceAdoptionPage() {
  const totalUsers = ADOPTION_RECORDS.reduce((acc, r) => acc + r.totalPilotUsers, 0)
  const totalActive = ADOPTION_RECORDS.reduce((acc, r) => acc + r.activeUsers, 0)
  const overallAdoptionPct = totalUsers === 0 ? 0 : Math.round((totalActive / totalUsers) * 100)
  const totalSessions = ADOPTION_RECORDS.reduce((acc, r) => acc + r.sessionsLastWeek, 0)
  const totalFeedback = ADOPTION_RECORDS.reduce((acc, r) => acc + r.feedbackSubmitted, 0)

  return (
    <div data-testid="workspace-adoption" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Workspace Adoption</h1>
          <Badge variant="outline">Phase 8</Badge>
          <Badge variant={adoptionVariant(overallAdoptionPct)}>Overall: {overallAdoptionPct}% active users</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Active user counts and engagement metrics per workspace for the IE10 pilot cohort.
          {totalActive}/{totalUsers} pilot users active across {ADOPTION_RECORDS.length} workspaces · {totalSessions} sessions last week.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: 'Workspaces', value: ADOPTION_RECORDS.length },
          { label: 'Active Users', value: totalActive },
          { label: 'Adoption Rate', value: `${overallAdoptionPct}%` },
          { label: 'Sessions (7d)', value: totalSessions },
          { label: 'Feedback Items', value: totalFeedback },
        ].map(({ label, value }) => (
          <Card key={label} style={{ flex: '1 1 120px', minWidth: 100 }}>
            <CardContent style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--shell-fg)' }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {ADOPTION_RECORDS.map(record => {
        const pct = record.totalPilotUsers === 0 ? 0 : Math.round((record.activeUsers / record.totalPilotUsers) * 100)
        return (
          <Card key={record.workspaceId} data-testid={`adoption-${record.workspaceId}`} style={{ marginBottom: 14 }}>
            <CardHeader style={{ paddingBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <CardTitle style={{ fontSize: 14 }}>{record.displayName}</CardTitle>
                <Badge variant={adoptionVariant(pct)}>{pct}% active</Badge>
                {record.scenariosCovered.length > 0 && (
                  <Badge variant="outline">{record.scenariosCovered.join(', ')}</Badge>
                )}
              </div>
              <CardDescription>
                {record.activeUsers}/{record.totalPilotUsers} users active · {record.sessionsLastWeek} sessions (7d) · avg {record.avgSessionMinutes} min/session
                · roles: {record.pilotRoles.join(', ')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ height: 6, background: 'var(--shell-line)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: adoptionColor(pct), borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--shell-fg-3)', marginBottom: 6 }}>
                <span>Feedback: {record.feedbackSubmitted}</span>
                <span>Issues raised: {record.issuesRaised}</span>
              </div>
              {record.notes && (
                <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', fontStyle: 'italic' }}>{record.notes}</div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
