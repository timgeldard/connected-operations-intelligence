import type {
  PilotIssue,
  PilotIssueStatus,
  GoNoGoRecommendation,
  PilotSuccessMetric,
  PilotSuccessMetricStatus,
  BurnDownSummary,
  PilotIssueCategory,
  CutoverRecommendation,
  ScenarioExecutionResult,
} from '../types/execution.js'

export function isIssueOpen(status: PilotIssueStatus): boolean {
  return status === 'new' || status === 'triaged' || status === 'in-progress' || status === 'waiting-on-owner' || status === 'blocked'
}

export function isIssueResolved(status: PilotIssueStatus): boolean {
  return status === 'resolved' || status === 'closed' || status === 'accepted-risk'
}

export function countOpenIssues(issues: readonly PilotIssue[]): number {
  return issues.filter(i => isIssueOpen(i.status)).length
}

export function pilotExitBlockingIssues(issues: readonly PilotIssue[]): PilotIssue[] {
  return issues.filter(i => i.blocksPilotExit && isIssueOpen(i.status))
}

export function productionBlockingIssues(issues: readonly PilotIssue[]): PilotIssue[] {
  return issues.filter(i => i.blocksProduction && isIssueOpen(i.status))
}

export function deriveBurnDownSummary(issues: readonly PilotIssue[]): BurnDownSummary {
  const openIssues = issues.filter(i => isIssueOpen(i.status)).length
  const resolvedIssues = issues.filter(i => isIssueResolved(i.status)).length
  const blockers = issues.filter(i => i.severity === 'blocker' || i.severity === 'critical').length
  const criticalIssues = issues.filter(i => i.severity === 'critical').length

  const issuesByCategory = {} as Record<PilotIssueCategory, number>
  for (const issue of issues) {
    issuesByCategory[issue.category] = (issuesByCategory[issue.category] ?? 0) + 1
  }

  const issuesByWorkspace: Record<string, number> = {}
  for (const issue of issues) {
    issuesByWorkspace[issue.workspaceId] = (issuesByWorkspace[issue.workspaceId] ?? 0) + 1
  }

  const issuesByOwner: Record<string, number> = {}
  for (const issue of issues) {
    issuesByOwner[issue.owner] = (issuesByOwner[issue.owner] ?? 0) + 1
  }

  const trend: BurnDownSummary['trend'] =
    resolvedIssues > openIssues ? 'improving' :
    resolvedIssues === openIssues ? 'stable' : 'worsening'

  const recommendation = blockers > 0
    ? `${blockers} blocker(s) require immediate attention before pilot exit.`
    : openIssues > 0
    ? `${openIssues} open issue(s) — track to closure before production.`
    : 'All issues resolved. Ready for pilot exit assessment.'

  return {
    totalIssues: issues.length,
    openIssues,
    resolvedIssues,
    blockers,
    criticalIssues,
    issuesByCategory,
    issuesByWorkspace,
    issuesByOwner,
    trend,
    recommendation,
  }
}

export function deriveGoNoGo(
  recommendation: CutoverRecommendation,
): GoNoGoRecommendation {
  if (recommendation.blockers.length > 0) return 'no-go'
  if (recommendation.conditions.length > 0) return 'go-with-conditions'
  return 'go'
}

export function computeScenarioPassRate(executions: readonly ScenarioExecutionResult[]): number {
  if (executions.length === 0) return 0
  const passed = executions.filter(
    e => e.status === 'passed' || e.status === 'passed-with-observations',
  ).length
  return Math.round((passed / executions.length) * 100)
}

export function metricStatusRank(status: PilotSuccessMetricStatus): number {
  if (status === 'missed') return 0
  if (status === 'blocked') return 1
  if (status === 'met-with-warning') return 2
  if (status === 'not-measured') return 3
  return 4
}

export function aggregateMetricStatus(metrics: readonly PilotSuccessMetric[]): PilotSuccessMetricStatus {
  if (metrics.length === 0) return 'not-measured'
  const sorted = [...metrics].sort((a, b) => metricStatusRank(a.status) - metricStatusRank(b.status))
  return sorted[0].status
}
