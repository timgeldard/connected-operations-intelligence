import { describe, it, expect } from 'vitest'
import {
  isIssueOpen, isIssueResolved, countOpenIssues, pilotExitBlockingIssues,
  productionBlockingIssues, deriveBurnDownSummary, deriveGoNoGo,
  computeScenarioPassRate, aggregateMetricStatus,
} from './execution.js'
import type { PilotIssue, PilotSuccessMetric, CutoverRecommendation, ScenarioExecutionResult } from '../types/execution.js'

function makeIssue(status: PilotIssue['status'], opts: Partial<PilotIssue> = {}): PilotIssue {
  return {
    issueId: 'I1', title: 'Test', description: '', category: 'ux',
    severity: 'warning', priority: 'medium', status, owner: 'owner',
    workspaceId: 'ws1', viewId: null, panelId: null, actionId: null,
    source: 'test', createdAt: '2026-05-01', updatedAt: '2026-05-01', dueAt: null,
    linkedFeedbackIds: [], linkedScenarioIds: [], linkedReadinessFindingIds: [],
    blocksPilotExit: false, blocksProduction: false, resolutionSummary: '',
    ...opts,
  }
}

function makeMetric(status: PilotSuccessMetric['status']): PilotSuccessMetric {
  return { metricId: 'M1', title: 'Test', description: '', target: '80%',
    actual: '75%', unit: '%', status, source: 'test', owner: 'owner', recommendation: '' }
}

function makeExecution(status: ScenarioExecutionResult['status']): ScenarioExecutionResult {
  return { executionId: 'E1', scenarioId: 'S1', executedBy: 'user', executedRole: 'quality-lead',
    executedAt: '2026-05-01', scope: 'plant', status, durationMinutes: 15,
    observations: [], issuesRaised: [], evidenceCaptured: [], recommendation: '',
    blocksPilotExit: false, blocksProduction: false }
}

function makeRecommendation(blockers: string[], conditions: string[]): CutoverRecommendation {
  return {
    recommendationId: 'R1', recommendation: 'no-go', summary: '', rationale: '',
    conditions, blockers, acceptedRisks: [], requiredActions: [], recommendedWave: 'Wave 1',
    rollbackReadiness: 'ready', supportReadiness: 'ready', trainingReadiness: 'ready',
    dataReadiness: 'ready', securityReadiness: 'partial', stakeholderSignoffStatus: 'partial',
    createdAt: '2026-05-15', createdBy: 'system',
  }
}

describe('isIssueOpen', () => {
  it('returns true for new', () => expect(isIssueOpen('new')).toBe(true))
  it('returns true for in-progress', () => expect(isIssueOpen('in-progress')).toBe(true))
  it('returns true for blocked', () => expect(isIssueOpen('blocked')).toBe(true))
  it('returns false for resolved', () => expect(isIssueOpen('resolved')).toBe(false))
  it('returns false for closed', () => expect(isIssueOpen('closed')).toBe(false))
  it('returns false for accepted-risk', () => expect(isIssueOpen('accepted-risk')).toBe(false))
  it('returns false for deferred', () => expect(isIssueOpen('deferred')).toBe(false))
})

describe('isIssueResolved', () => {
  it('returns true for resolved', () => expect(isIssueResolved('resolved')).toBe(true))
  it('returns true for closed', () => expect(isIssueResolved('closed')).toBe(true))
  it('returns true for accepted-risk', () => expect(isIssueResolved('accepted-risk')).toBe(true))
  it('returns false for new', () => expect(isIssueResolved('new')).toBe(false))
  it('returns false for in-progress', () => expect(isIssueResolved('in-progress')).toBe(false))
})

describe('countOpenIssues', () => {
  it('counts open issues', () => {
    const issues = [makeIssue('new'), makeIssue('resolved'), makeIssue('in-progress')]
    expect(countOpenIssues(issues)).toBe(2)
  })
  it('returns 0 for empty array', () => expect(countOpenIssues([])).toBe(0))
})

describe('pilotExitBlockingIssues', () => {
  it('returns only open issues that block pilot exit', () => {
    const issues = [
      makeIssue('new', { blocksPilotExit: true }),
      makeIssue('resolved', { blocksPilotExit: true }),
      makeIssue('in-progress', { blocksPilotExit: false }),
    ]
    expect(pilotExitBlockingIssues(issues)).toHaveLength(1)
  })
})

describe('productionBlockingIssues', () => {
  it('returns only open issues that block production', () => {
    const issues = [
      makeIssue('new', { blocksProduction: true }),
      makeIssue('closed', { blocksProduction: true }),
    ]
    expect(productionBlockingIssues(issues)).toHaveLength(1)
  })
})

describe('deriveBurnDownSummary', () => {
  it('computes correct counts', () => {
    const issues = [
      makeIssue('new', { severity: 'critical', category: 'ux', workspaceId: 'ws1', owner: 'team-a' }),
      makeIssue('resolved', { severity: 'info', category: 'ux', workspaceId: 'ws1', owner: 'team-a' }),
      makeIssue('in-progress', { severity: 'warning', category: 'data-quality', workspaceId: 'ws2', owner: 'team-b' }),
    ]
    const summary = deriveBurnDownSummary(issues)
    expect(summary.totalIssues).toBe(3)
    expect(summary.openIssues).toBe(2)
    expect(summary.resolvedIssues).toBe(1)
    expect(summary.criticalIssues).toBe(1)
    expect(summary.issuesByCategory['ux']).toBe(2)
    expect(summary.issuesByWorkspace['ws1']).toBe(2)
    expect(summary.issuesByOwner['team-a']).toBe(2)
  })

  it('trend is improving when resolved > open', () => {
    const issues = [makeIssue('resolved'), makeIssue('resolved'), makeIssue('new')]
    expect(deriveBurnDownSummary(issues).trend).toBe('improving')
  })

  it('trend is worsening when open > resolved', () => {
    const issues = [makeIssue('new'), makeIssue('new'), makeIssue('resolved')]
    expect(deriveBurnDownSummary(issues).trend).toBe('worsening')
  })
})

describe('deriveGoNoGo', () => {
  it('returns no-go when blockers exist', () => {
    expect(deriveGoNoGo(makeRecommendation(['blocker'], []))).toBe('no-go')
  })
  it('returns go-with-conditions when conditions but no blockers', () => {
    expect(deriveGoNoGo(makeRecommendation([], ['condition']))).toBe('go-with-conditions')
  })
  it('returns go when no blockers or conditions', () => {
    expect(deriveGoNoGo(makeRecommendation([], []))).toBe('go')
  })
})

describe('computeScenarioPassRate', () => {
  it('returns 0 for empty array', () => expect(computeScenarioPassRate([])).toBe(0))
  it('returns 100 when all passed', () => {
    expect(computeScenarioPassRate([makeExecution('passed'), makeExecution('passed-with-observations')])).toBe(100)
  })
  it('returns 50 for half passed', () => {
    expect(computeScenarioPassRate([makeExecution('passed'), makeExecution('failed')])).toBe(50)
  })
})

describe('aggregateMetricStatus', () => {
  it('returns not-measured for empty array', () => expect(aggregateMetricStatus([])).toBe('not-measured'))
  it('returns worst status (missed before met-with-warning)', () => {
    const metrics = [makeMetric('met'), makeMetric('missed'), makeMetric('met-with-warning')]
    expect(aggregateMetricStatus(metrics)).toBe('missed')
  })
  it('returns met when all met', () => {
    expect(aggregateMetricStatus([makeMetric('met'), makeMetric('met')])).toBe('met')
  })
})
