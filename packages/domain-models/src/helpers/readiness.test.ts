import { describe, it, expect } from 'vitest'
import {
  isReadinessBlocker,
  blocksProduction,
  blocksPilot,
  aggregateReadinessStatus,
  pilotBlockers,
  productionBlockers,
} from './readiness.js'
import type { ReadinessFinding } from '../types/readiness.js'

function makeFinding(overrides: Partial<ReadinessFinding>): ReadinessFinding {
  return {
    findingId: 'f-001',
    itemType: 'workspace',
    itemId: 'trace-investigation',
    title: 'Missing parity check',
    description: 'No coverage data for this workspace.',
    severity: 'info',
    readinessStatus: 'not-assessed',
    ownerDomain: 'quality',
    lifecycle: 'live',
    recommendation: 'Run the parity assessment.',
    blocksPilot: false,
    blocksProduction: false,
    createdAt: '2024-03-08T10:00:00.000Z',
    source: 'static-audit',
    ...overrides,
  }
}

describe('isReadinessBlocker', () => {
  it('returns true for blocker severity', () => {
    expect(isReadinessBlocker(makeFinding({ severity: 'blocker' }))).toBe(true)
  })

  it('returns true for critical severity', () => {
    expect(isReadinessBlocker(makeFinding({ severity: 'critical' }))).toBe(true)
  })

  it('returns false for warning severity', () => {
    expect(isReadinessBlocker(makeFinding({ severity: 'warning' }))).toBe(false)
  })

  it('returns false for info severity', () => {
    expect(isReadinessBlocker(makeFinding({ severity: 'info' }))).toBe(false)
  })
})

describe('blocksProduction', () => {
  it('returns true when blocksProduction is true', () => {
    expect(blocksProduction(makeFinding({ blocksProduction: true }))).toBe(true)
  })

  it('returns false when blocksProduction is false', () => {
    expect(blocksProduction(makeFinding({ blocksProduction: false }))).toBe(false)
  })
})

describe('blocksPilot', () => {
  it('returns true when blocksPilot is true', () => {
    expect(blocksPilot(makeFinding({ blocksPilot: true }))).toBe(true)
  })

  it('returns false when blocksPilot is false', () => {
    expect(blocksPilot(makeFinding({ blocksPilot: false }))).toBe(false)
  })
})

describe('aggregateReadinessStatus', () => {
  it('returns ready for an empty findings list', () => {
    expect(aggregateReadinessStatus([])).toBe('ready')
  })

  it('returns ready when all findings are info', () => {
    const findings = [makeFinding({ severity: 'info' }), makeFinding({ severity: 'info', findingId: 'f-002' })]
    expect(aggregateReadinessStatus(findings)).toBe('ready')
  })

  it('returns ready-with-warnings when there is a warning finding', () => {
    const findings = [
      makeFinding({ severity: 'info' }),
      makeFinding({ severity: 'warning', findingId: 'f-002' }),
    ]
    expect(aggregateReadinessStatus(findings)).toBe('ready-with-warnings')
  })

  it('returns blocked when there is a blocker finding', () => {
    const findings = [
      makeFinding({ severity: 'warning' }),
      makeFinding({ severity: 'blocker', findingId: 'f-002' }),
    ]
    expect(aggregateReadinessStatus(findings)).toBe('blocked')
  })

  it('returns blocked when there is a critical finding', () => {
    const findings = [
      makeFinding({ severity: 'info' }),
      makeFinding({ severity: 'critical', findingId: 'f-002' }),
    ]
    expect(aggregateReadinessStatus(findings)).toBe('blocked')
  })

  it('returns blocked for critical even when other findings are info', () => {
    const findings = [
      makeFinding({ severity: 'info' }),
      makeFinding({ severity: 'info', findingId: 'f-002' }),
      makeFinding({ severity: 'critical', findingId: 'f-003' }),
    ]
    expect(aggregateReadinessStatus(findings)).toBe('blocked')
  })
})

describe('pilotBlockers', () => {
  it('returns only findings with blocksPilot true', () => {
    const findings = [
      makeFinding({ findingId: 'f-001', blocksPilot: true }),
      makeFinding({ findingId: 'f-002', blocksPilot: false }),
      makeFinding({ findingId: 'f-003', blocksPilot: true }),
    ]
    const result = pilotBlockers(findings)
    expect(result).toHaveLength(2)
    expect(result.map((f) => f.findingId)).toEqual(['f-001', 'f-003'])
  })

  it('returns empty array when no findings block pilot', () => {
    const findings = [makeFinding({ blocksPilot: false })]
    expect(pilotBlockers(findings)).toHaveLength(0)
  })
})

describe('productionBlockers', () => {
  it('returns only findings with blocksProduction true', () => {
    const findings = [
      makeFinding({ findingId: 'f-001', blocksProduction: true }),
      makeFinding({ findingId: 'f-002', blocksProduction: false }),
    ]
    const result = productionBlockers(findings)
    expect(result).toHaveLength(1)
    expect(result[0].findingId).toBe('f-001')
  })

  it('returns empty array when no findings block production', () => {
    const findings = [makeFinding({ blocksProduction: false })]
    expect(productionBlockers(findings)).toHaveLength(0)
  })
})
