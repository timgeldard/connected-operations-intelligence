import {
  Badge, Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@connectio/design-system'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'

type LessonCategory =
  | 'product'
  | 'process'
  | 'data-integration'
  | 'training'
  | 'support'
  | 'governance'
  | 'stakeholder'
  | 'technical'

type LessonPriority = 'high' | 'medium' | 'low'
type LessonStatus = 'actioned' | 'in-progress' | 'logged'

interface LessonLearned {
  readonly lessonId: string
  readonly category: LessonCategory
  readonly title: string
  readonly observation: string
  readonly recommendation: string
  readonly owner: string
  readonly priority: LessonPriority
  readonly status: LessonStatus
  readonly linkedIssues: readonly string[]
  readonly targetWave: string
}

const LESSONS_LEARNED: readonly LessonLearned[] = [
  {
    lessonId: 'LL-001', category: 'process', title: 'Sign-off process should start earlier in pilot', observation: 'Stakeholder sign-offs cannot be initiated until scenarios are complete, but the sign-off briefing process is long. Waiting until all scenarios are done adds weeks to the timeline.', recommendation: 'Begin stakeholder briefings and pre-sign-off readiness reviews as soon as individual scenarios pass. Do not wait for all 6 before initiating.', owner: 'programme-manager', priority: 'high', status: 'in-progress', linkedIssues: [], targetWave: 'Wave 0 → Wave 1',
  },
  {
    lessonId: 'LL-002', category: 'data-integration', title: 'Source API readiness must be confirmed before pilot start', observation: 'CoA API (ISS-001) and PhaseManager integration (ISS-005) were not available at pilot start. This forced mock workarounds and left users uncertain about production-readiness.', recommendation: 'Define a source readiness gate that blocks pilot start until all critical source APIs are available or formally accepted-as-mock.', owner: 'data-team', priority: 'high', status: 'logged', linkedIssues: ['ISS-001', 'ISS-005', 'DQG-001', 'DQG-003'], targetWave: 'Wave 1 prep',
  },
  {
    lessonId: 'LL-003', category: 'technical', title: 'Action audit log persistence gap caught late', observation: 'ISS-004 (action audit log not persisted) was discovered during scenario execution, not in pre-pilot testing. This is a production-blocking issue that should have been caught earlier.', recommendation: 'Add an action persistence integration test to the pre-pilot acceptance criteria. All action flows must be verified against a real backend before pilot users encounter them.', owner: 'operations-team', priority: 'high', status: 'in-progress', linkedIssues: ['ISS-004'], targetWave: 'Wave 0 → Wave 1',
  },
  {
    lessonId: 'LL-004', category: 'product', title: 'Pilot users adapt quickly to workspace navigation', observation: 'Despite initial concerns, pilot users found the workspace-per-role navigation model intuitive. Average session length of 14–22 minutes suggests users are spending meaningful time in context.', recommendation: 'Reinforce the workspace model in training materials. Use actual session data to demonstrate navigation efficiency compared to legacy app workflows.', owner: 'ux-team', priority: 'medium', status: 'actioned', linkedIssues: [], targetWave: 'Wave 1',
  },
  {
    lessonId: 'LL-005', category: 'training', title: 'Role-specific training modules are more effective than general V2 overview', observation: 'Pilot users who completed their role-specific workspace training (e.g., Quality Lead — Batch Release Workflow) adopted faster and raised fewer support questions than those who only completed the general V2 Concepts Overview.', recommendation: 'Make role-specific workspace training mandatory before pilot access. General V2 overview should be a prerequisite, not the only training.', owner: 'l-and-d-lead', priority: 'high', status: 'actioned', linkedIssues: [], targetWave: 'Wave 1',
  },
  {
    lessonId: 'LL-006', category: 'governance', title: 'Contract and integration dependencies must be resolved before scope inclusion', observation: 'Maintenance Reliability workspace could not be piloted due to SAP PM contract not being signed (ISS-007). This disrupted pilot scope communications and left maintenance technicians excluded.', recommendation: 'Any workspace that depends on an unsigned contract or unavailable source system must be formally excluded from the pilot scope before pilot kick-off communications.', owner: 'procurement-team', priority: 'high', status: 'logged', linkedIssues: ['ISS-007'], targetWave: 'Wave 1 prep',
  },
  {
    lessonId: 'LL-007', category: 'stakeholder', title: 'Pilot briefing format improved after Week 1 feedback', observation: 'Initial pilot briefings used written documentation only. After Week 1 feedback, live walkthroughs were added for quality and warehouse roles, significantly increasing confidence and adoption.', recommendation: 'Use interactive walkthroughs (not just docs) as the primary briefing format. Reserve written docs for reference. Schedule per-role Q&A sessions in the first week.', owner: 'pilot-lead', priority: 'medium', status: 'actioned', linkedIssues: [], targetWave: 'Wave 1',
  },
  {
    lessonId: 'LL-008', category: 'product', title: 'Cross-domain panel load time is a usability concern at scale', observation: 'ISS-002 identified SPC signal filter latency >3s on batch scope. This is currently a pilot-only performance issue but would worsen at production scale with real-time data.', recommendation: 'Add a performance budget to the cross-domain panel integration contract. Panels must load in <2s at production data volumes. Add load tests before Wave 1.', owner: 'spc-team', priority: 'medium', status: 'in-progress', linkedIssues: ['ISS-002'], targetWave: 'Wave 1',
  },
  {
    lessonId: 'LL-009', category: 'process', title: 'Issue triage cadence should be daily for blockers', observation: 'ISS-006 (accessibility critical) was raised but not triaged for 48 hours due to no formal triage cadence. This delayed owner assignment and remediation.', recommendation: 'Establish a daily triage stand-up for any issue rated critical or above. All critical issues must have an owner within 24 hours of creation.', owner: 'pilot-lead', priority: 'high', status: 'in-progress', linkedIssues: ['ISS-006'], targetWave: 'Wave 0 immediate',
  },
  {
    lessonId: 'LL-010', category: 'support', title: 'Runbook gaps surface quickly in live pilot', observation: 'Operations Plan Risk (LL-003) and EnvMon (support not ready) both had runbook gaps that only became obvious when pilot users asked questions that runbooks should have covered.', recommendation: 'Conduct a structured runbook walkthrough with support contacts before each workspace is placed in pilot scope. Use a checklist rather than self-certification.', owner: 'operations-team', priority: 'medium', status: 'logged', linkedIssues: [], targetWave: 'Wave 1 prep',
  },
  {
    lessonId: 'LL-011', category: 'data-integration', title: 'Mock data fidelity matters more than expected', observation: 'DQG-008 (batch master attribute mismatches) caused confusion among quality leads who noticed discrepancies between V2 mock data and their expected values from legacy Coda reports.', recommendation: 'For future pilots, generate mock data from a real data snapshot (anonymised if needed) rather than hand-authored fixtures. Users notice mismatches quickly.', owner: 'data-team', priority: 'medium', status: 'logged', linkedIssues: ['DQG-008'], targetWave: 'Wave 1 prep',
  },
  {
    lessonId: 'LL-012', category: 'technical', title: 'Accessibility testing should gate pilot launch, not follow it', observation: 'ISS-006 was found during pilot execution. WCAG 2.1 AA compliance is a hard requirement and should have been verified pre-launch.', recommendation: 'Add a WCAG 2.1 AA automated and manual audit to the pre-pilot launch gate. Treat accessibility failures the same as functional test failures — blocking release.', owner: 'ux-team', priority: 'high', status: 'logged', linkedIssues: ['ISS-006'], targetWave: 'Wave 0 → Wave 1',
  },
]

const CATEGORY_LABELS: Record<LessonCategory, string> = {
  'product': 'Product', 'process': 'Process', 'data-integration': 'Data Integration',
  'training': 'Training', 'support': 'Support', 'governance': 'Governance',
  'stakeholder': 'Stakeholder', 'technical': 'Technical',
}

function statusVariant(status: LessonStatus): 'default' | 'secondary' | 'outline' {
  if (status === 'actioned') return 'default'
  if (status === 'in-progress') return 'secondary'
  return 'outline'
}

function priorityColor(priority: LessonPriority): string {
  if (priority === 'high') return '#DC2626'
  if (priority === 'medium') return '#D97706'
  return '#6B7280'
}

export function LessonsLearnedPage() {
  const actionedCount = LESSONS_LEARNED.filter(l => l.status === 'actioned').length
  const inProgressCount = LESSONS_LEARNED.filter(l => l.status === 'in-progress').length
  const loggedCount = LESSONS_LEARNED.filter(l => l.status === 'logged').length
  const highPriority = LESSONS_LEARNED.filter(l => l.priority === 'high').length

  return (
    <div data-testid="lessons-learned" style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Lessons Learned</h1>
          <Badge variant="outline">Phase 8</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Lessons and recommendations captured during the IE10 controlled pilot. {actionedCount} actioned, {inProgressCount} in progress, {loggedCount} logged. {highPriority} high-priority lessons.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: 'Total', value: LESSONS_LEARNED.length },
          { label: 'Actioned', value: actionedCount },
          { label: 'In Progress', value: inProgressCount },
          { label: 'Logged (Pending)', value: loggedCount },
          { label: 'High Priority', value: highPriority, danger: highPriority > 0 },
        ].map(({ label, value, danger }) => (
          <Card key={label} style={{ flex: '1 1 120px', minWidth: 100, border: danger ? '1px solid #DC2626' : undefined }}>
            <CardContent style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: danger ? '#DC2626' : 'var(--shell-fg)' }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {LESSONS_LEARNED.map(lesson => (
        <Card key={lesson.lessonId} data-testid={`lesson-${lesson.lessonId}`} style={{ marginBottom: 14 }}>
          <CardHeader style={{ paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <CardTitle style={{ fontSize: 14 }}>{lesson.title}</CardTitle>
              <Badge variant={statusVariant(lesson.status)}>{lesson.status.replace(/-/g, ' ')}</Badge>
              <span style={{ fontSize: 11, fontWeight: 600, color: priorityColor(lesson.priority) }}>{lesson.priority} priority</span>
              <Badge variant="outline">{CATEGORY_LABELS[lesson.category]}</Badge>
            </div>
            <CardDescription>
              {lesson.lessonId} · Target: {lesson.targetWave} · Owner: {lesson.owner}
              {lesson.linkedIssues.length > 0 ? ` · Issues: ${lesson.linkedIssues.join(', ')}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Observation</div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--shell-fg-2)' }}>{lesson.observation}</p>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Recommendation</div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--shell-fg-2)', fontStyle: 'italic' }}>{lesson.recommendation}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
