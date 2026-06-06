import { describe, it, expect } from 'vitest'
import {
  isValidationPassed, isSignoffApproved, isGatePassed,
  aggregateGateStatus, pilotExitBlocking, scenarioPilotBlockers,
} from './pilot.js'
import type { ReleaseGate, PilotExitCriteria, ValidationScenario } from '../types/pilot.js'

function makeGate(status: ReleaseGate['status']): ReleaseGate {
  return {
    gateId: 'G1', name: 'Test Gate', description: '', status,
    owner: 'owner', requiredFindingsClosed: [], requiredSignoffs: [],
    requiredScenarios: [], blockers: [], dueAt: '2026-06-01', evidenceLinks: [],
  }
}

function makeCriteria(status: PilotExitCriteria['status']): PilotExitCriteria {
  return {
    criteriaId: 'C1', title: 'Test', description: '', status,
    owner: 'owner', measurement: 'count', target: '100%', actual: '80%',
    blockers: [], recommendation: '',
  }
}

function makeScenario(status: ValidationScenario['status'], blocksPilotExit: boolean): ValidationScenario {
  return {
    scenarioId: 'S1', title: 'Test', description: '', personaRole: 'quality-lead',
    primaryWorkspaceId: 'quality-batch-release', supportingWorkspaceIds: [],
    scopeLevel: 'batch', businessGoal: '', startingContext: '',
    expectedEvidencePanels: [], expectedActions: [], expectedDrillThroughs: [],
    acceptanceCriteria: [], status, owner: 'owner',
    lastValidatedAt: null, findings: [], blocksPilotExit, blocksProduction: false,
  }
}

describe('isValidationPassed', () => {
  it('returns true for passed', () => expect(isValidationPassed('passed')).toBe(true))
  it('returns true for passed-with-observations', () => expect(isValidationPassed('passed-with-observations')).toBe(true))
  it('returns false for failed', () => expect(isValidationPassed('failed')).toBe(false))
  it('returns false for not-started', () => expect(isValidationPassed('not-started')).toBe(false))
})

describe('isSignoffApproved', () => {
  it('returns true for approved', () => expect(isSignoffApproved('approved')).toBe(true))
  it('returns true for approved-with-conditions', () => expect(isSignoffApproved('approved-with-conditions')).toBe(true))
  it('returns false for requested', () => expect(isSignoffApproved('requested')).toBe(false))
  it('returns false for rejected', () => expect(isSignoffApproved('rejected')).toBe(false))
})

describe('isGatePassed', () => {
  it('returns true for passed', () => expect(isGatePassed('passed')).toBe(true))
  it('returns true for passed-with-conditions', () => expect(isGatePassed('passed-with-conditions')).toBe(true))
  it('returns false for in-progress', () => expect(isGatePassed('in-progress')).toBe(false))
})

describe('aggregateGateStatus', () => {
  it('returns not-started for empty array', () => expect(aggregateGateStatus([])).toBe('not-started'))
  it('returns failed if any gate failed', () => {
    expect(aggregateGateStatus([makeGate('passed'), makeGate('failed')])).toBe('failed')
  })
  it('returns blocked if any gate blocked (no failed)', () => {
    expect(aggregateGateStatus([makeGate('passed'), makeGate('blocked')])).toBe('blocked')
  })
  it('returns in-progress if any gate in-progress (no failed/blocked)', () => {
    expect(aggregateGateStatus([makeGate('passed'), makeGate('in-progress')])).toBe('in-progress')
  })
  it('returns passed if all gates passed', () => {
    expect(aggregateGateStatus([makeGate('passed'), makeGate('passed-with-conditions')])).toBe('passed')
  })
})

describe('pilotExitBlocking', () => {
  it('returns only failed or blocked criteria', () => {
    const criteria = [makeCriteria('passed'), makeCriteria('failed'), makeCriteria('blocked')]
    const blocking = pilotExitBlocking(criteria)
    expect(blocking).toHaveLength(2)
    expect(blocking.map(c => c.status)).toEqual(['failed', 'blocked'])
  })
})

describe('scenarioPilotBlockers', () => {
  it('returns scenarios that block pilot exit and are not passed', () => {
    const scenarios = [
      makeScenario('passed', true),
      makeScenario('failed', true),
      makeScenario('in-progress', true),
      makeScenario('failed', false),
    ]
    const blockers = scenarioPilotBlockers(scenarios)
    expect(blockers).toHaveLength(2)
  })
})
