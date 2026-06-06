import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@connectio/design-system'
import type { SupportReadiness, SupportReadinessStatus } from '@connectio/product-model'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'

const SUPPORT_AREAS: readonly SupportReadiness[] = [
  {
    area: 'Quality Batch Release',
    owner: 'quality-lead',
    runbookAvailable: true,
    supportContactDefined: true,
    escalationPathDefined: true,
    knownIssuesDocumented: true,
    status: 'ready',
    blockers: [],
    recommendation: 'Fully support-ready. Runbook, support contact, escalation path, and known issues all in place.',
  },
  {
    area: 'Trace Investigation',
    owner: 'food-safety-lead',
    runbookAvailable: true,
    supportContactDefined: true,
    escalationPathDefined: true,
    knownIssuesDocumented: true,
    status: 'ready',
    blockers: [],
    recommendation: 'Fully support-ready.',
  },
  {
    area: 'Operations Plan Risk',
    owner: 'operations-team',
    runbookAvailable: true,
    supportContactDefined: true,
    escalationPathDefined: false,
    knownIssuesDocumented: true,
    status: 'ready-with-gaps',
    blockers: ['Escalation path to plant manager not formally defined'],
    recommendation: 'Escalation path needs to be defined before production cutover. Acceptable for pilot phase.',
  },
  {
    area: 'SPC Monitoring',
    owner: 'spc-team',
    runbookAvailable: true,
    supportContactDefined: true,
    escalationPathDefined: true,
    knownIssuesDocumented: false,
    status: 'ready-with-gaps',
    blockers: ['Known SPC connector gap not yet formally documented in runbook'],
    recommendation: 'Document the SPC connector gap in the runbook before pilot users encounter it.',
  },
  {
    area: 'Environmental Monitoring',
    owner: 'qa-team',
    runbookAvailable: false,
    supportContactDefined: true,
    escalationPathDefined: false,
    knownIssuesDocumented: false,
    status: 'not-ready',
    blockers: ['Runbook not yet authored', 'Escalation path not defined', 'Known issues from pilot not documented'],
    recommendation: 'Not ready. Runbook authoring required before EnvMon is placed in pilot scope.',
  },
  {
    area: 'Production Staging',
    owner: 'warehouse-team',
    runbookAvailable: true,
    supportContactDefined: true,
    escalationPathDefined: true,
    knownIssuesDocumented: true,
    status: 'ready',
    blockers: [],
    recommendation: 'Fully support-ready.',
  },
  {
    area: 'Warehouse 360 Overview',
    owner: 'warehouse-team',
    runbookAvailable: true,
    supportContactDefined: true,
    escalationPathDefined: true,
    knownIssuesDocumented: false,
    status: 'ready-with-gaps',
    blockers: ['Email notification gap (ISS-010) not yet documented in known issues log'],
    recommendation: 'Document email notification gap in runbook known issues section.',
  },
  {
    area: 'Maintenance Reliability',
    owner: 'maintenance-team',
    runbookAvailable: false,
    supportContactDefined: false,
    escalationPathDefined: false,
    knownIssuesDocumented: false,
    status: 'blocked',
    blockers: ['SAP PM integration contract not signed (ISS-007)', 'Workspace not yet in pilot scope — support prep cannot begin'],
    recommendation: 'Blocked by SAP PM contract. Do not begin support preparation until integration is confirmed.',
  },
]

function statusVariant(status: SupportReadinessStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'ready') return 'default'
  if (status === 'ready-with-gaps') return 'secondary'
  if (status === 'not-ready') return 'destructive'
  if (status === 'blocked') return 'destructive'
  return 'outline'
}

function statusLabel(status: SupportReadinessStatus): string {
  const labels: Record<SupportReadinessStatus, string> = {
    'ready': 'Ready',
    'ready-with-gaps': 'Ready — With Gaps',
    'not-ready': 'Not Ready',
    'blocked': 'Blocked',
  }
  return labels[status]
}

function CheckIcon({ ok }: { ok: boolean }) {
  return (
    <span style={{ fontSize: 13, color: ok ? '#16A34A' : '#DC2626' }} aria-label={ok ? 'Yes' : 'No'}>
      {ok ? '✓' : '✗'}
    </span>
  )
}

export function SupportReadinessPage() {
  const readyCount = SUPPORT_AREAS.filter(a => a.status === 'ready').length
  const gapCount = SUPPORT_AREAS.filter(a => a.status === 'ready-with-gaps').length
  const notReadyCount = SUPPORT_AREAS.filter(a => a.status === 'not-ready' || a.status === 'blocked').length

  return (
    <div data-testid="support-readiness" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Support Readiness</h1>
          <Badge variant="outline">Phase 8</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Support readiness per workspace area. {readyCount} fully ready, {gapCount} ready with gaps, {notReadyCount} not ready or blocked.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: 'Ready', value: readyCount },
          { label: 'Ready — With Gaps', value: gapCount },
          { label: 'Not Ready / Blocked', value: notReadyCount, danger: notReadyCount > 0 },
        ].map(({ label, value, danger }) => (
          <Card key={label} style={{ flex: '1 1 150px', minWidth: 120, border: danger ? '1px solid #DC2626' : undefined }}>
            <CardContent style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: danger ? '#DC2626' : 'var(--shell-fg)' }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {SUPPORT_AREAS.map(area => (
        <Card key={area.area} data-testid={`support-area-${area.area.toLowerCase().replace(/\s+/g, '-')}`} style={{ marginBottom: 14 }}>
          <CardHeader style={{ paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <CardTitle style={{ fontSize: 14 }}>{area.area}</CardTitle>
              <Badge variant={statusVariant(area.status)}>{statusLabel(area.status)}</Badge>
            </div>
            <CardDescription>Owner: {area.owner}</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 10 }}>
              {[
                { label: 'Runbook', ok: area.runbookAvailable },
                { label: 'Support Contact', ok: area.supportContactDefined },
                { label: 'Escalation Path', ok: area.escalationPathDefined },
                { label: 'Known Issues Documented', ok: area.knownIssuesDocumented },
              ].map(({ label, ok }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--shell-fg-2)' }}>
                  <CheckIcon ok={ok} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            {area.blockers.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Blockers</div>
                <ul style={{ margin: 0, paddingLeft: 14 }}>
                  {area.blockers.map((b, i) => <li key={i} style={{ fontSize: 12, color: '#DC2626', marginBottom: 2 }}>{b}</li>)}
                </ul>
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', fontStyle: 'italic' }}>{area.recommendation}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
