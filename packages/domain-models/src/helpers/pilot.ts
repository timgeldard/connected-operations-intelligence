import type { ValidationScenarioStatus, StakeholderSignoffStatus, ReleaseGateStatus, ReleaseGate, PilotExitCriteria, ValidationScenario } from '../types/pilot.js'

export function isValidationPassed(status: ValidationScenarioStatus): boolean {
  return status === 'passed' || status === 'passed-with-observations'
}

export function isSignoffApproved(status: StakeholderSignoffStatus): boolean {
  return status === 'approved' || status === 'approved-with-conditions'
}

export function isGatePassed(status: ReleaseGateStatus): boolean {
  return status === 'passed' || status === 'passed-with-conditions'
}

export function aggregateGateStatus(gates: readonly ReleaseGate[]): ReleaseGateStatus {
  if (gates.length === 0) return 'not-started'
  if (gates.some(g => g.status === 'failed')) return 'failed'
  if (gates.some(g => g.status === 'blocked')) return 'blocked'
  if (gates.some(g => g.status === 'in-progress')) return 'in-progress'
  if (gates.every(g => isGatePassed(g.status))) return 'passed'
  return 'not-started'
}

export function pilotExitBlocking(criteria: readonly PilotExitCriteria[]): PilotExitCriteria[] {
  return criteria.filter(c => c.status === 'failed' || c.status === 'blocked')
}

export function scenarioPilotBlockers(scenarios: readonly ValidationScenario[]): ValidationScenario[] {
  return scenarios.filter(s => s.blocksPilotExit && s.status !== 'passed' && s.status !== 'passed-with-observations')
}
