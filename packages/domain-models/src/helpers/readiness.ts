import type { ReadinessFinding, ReadinessStatus } from '../types/readiness.js'

/** Returns true when a finding severity is blocker or critical. */
export function isReadinessBlocker(finding: ReadinessFinding): boolean {
  return finding.severity === 'blocker' || finding.severity === 'critical'
}

/** Returns true when a finding must be resolved before any production release. */
export function blocksProduction(finding: ReadinessFinding): boolean {
  return finding.blocksProduction
}

/** Returns true when a finding must be resolved before a pilot release. */
export function blocksPilot(finding: ReadinessFinding): boolean {
  return finding.blocksPilot
}

/** Returns the worst-case ReadinessStatus across a collection of findings. */
export function aggregateReadinessStatus(findings: readonly ReadinessFinding[]): ReadinessStatus {
  if (findings.length === 0) return 'ready'
  const hasCritical = findings.some((f) => f.severity === 'critical')
  if (hasCritical) return 'blocked'
  const hasBlocker = findings.some((f) => f.severity === 'blocker')
  if (hasBlocker) return 'blocked'
  const hasWarning = findings.some((f) => f.severity === 'warning')
  if (hasWarning) return 'ready-with-warnings'
  return 'ready'
}

/** Filters findings to those that must be resolved before the next pilot release. */
export function pilotBlockers(findings: readonly ReadinessFinding[]): ReadinessFinding[] {
  return findings.filter(blocksPilot)
}

/** Filters findings to those that must be resolved before a full production release. */
export function productionBlockers(findings: readonly ReadinessFinding[]): ReadinessFinding[] {
  return findings.filter(blocksProduction)
}
