import { describe, expect, it } from 'vitest'
import { buildUsageDecisionDisplay } from './usage-decision-display.js'

const PROHIBITED_TERMS = ['Released', 'Can release', 'Approved', 'Cleared', 'Release ready']

function assertNoProhibitedTerms(output: ReturnType<typeof buildUsageDecisionDisplay>) {
  const allText = [output.displayLabel, output.detailText, ...output.warnings].join(' ')
  for (const term of PROHIBITED_TERMS) {
    expect(allText, `Output must not contain "${term}"`).not.toContain(term)
  }
}

const baseWithLot = { inspectionLotId: '000000123456' }

describe('buildUsageDecisionDisplay', () => {
  describe('governed code A', () => {
    it('contains "source UD label only" in displayLabel', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'A' })
      expect(result.displayLabel).toContain('source UD label only')
    })

    it('preserves raw code', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'A' })
      expect(result.rawCode).toBe('A')
    })

    it('does not contain prohibited release terms', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'A' })
      assertNoProhibitedTerms(result)
    })

    it('evidenceState is loaded', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'A' })
      expect(result.evidenceState).toBe('loaded')
    })

    it('mappingStatus is governed-label', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'A' })
      expect(result.mappingStatus).toBe('governed-label')
    })
  })

  describe('governed code R', () => {
    it('contains "source UD label only" in displayLabel', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'R' })
      expect(result.displayLabel).toContain('source UD label only')
    })

    it('preserves raw code', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'R' })
      expect(result.rawCode).toBe('R')
    })

    it('does not contain prohibited release terms', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'R' })
      assertNoProhibitedTerms(result)
    })
  })

  describe('governed code AE', () => {
    it('label contains variant/EM and source UD label only', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'AE' })
      expect(result.displayLabel).toContain('variant/EM')
      expect(result.displayLabel).toContain('source UD label only')
    })

    it('does not contain prohibited release terms', () => {
      assertNoProhibitedTerms(buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'AE' }))
    })
  })

  describe('governed code AC', () => {
    it('label contains concession and source UD label only', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'AC' })
      expect(result.displayLabel).toContain('concession')
      expect(result.displayLabel).toContain('source UD label only')
    })

    it('does not contain prohibited release terms', () => {
      assertNoProhibitedTerms(buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'AC' }))
    })
  })

  describe('governed code ACE', () => {
    it('label contains concession, variant/EM, and source UD label only', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'ACE' })
      expect(result.displayLabel).toContain('concession')
      expect(result.displayLabel).toContain('variant/EM')
      expect(result.displayLabel).toContain('source UD label only')
    })

    it('does not contain prohibited release terms', () => {
      assertNoProhibitedTerms(buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'ACE' }))
    })
  })

  describe('governed code A9', () => {
    it('label contains batch restricted and source UD label only', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'A9' })
      expect(result.displayLabel).toContain('batch restricted')
      expect(result.displayLabel).toContain('source UD label only')
    })

    it('does not contain prohibited release terms', () => {
      assertNoProhibitedTerms(buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'A9' }))
    })
  })

  describe('governed code RE', () => {
    it('label contains Rejected, variant/EM, and source UD label only', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'RE' })
      expect(result.displayLabel).toContain('Rejected')
      expect(result.displayLabel).toContain('variant/EM')
      expect(result.displayLabel).toContain('source UD label only')
    })

    it('does not contain prohibited release terms', () => {
      assertNoProhibitedTerms(buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'RE' }))
    })
  })

  describe('governed code RR', () => {
    it('label contains Rejected, batch restricted globally, and source UD label only', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'RR' })
      expect(result.displayLabel).toContain('Rejected')
      expect(result.displayLabel).toContain('batch restricted globally')
      expect(result.displayLabel).toContain('source UD label only')
    })

    it('does not contain prohibited release terms', () => {
      assertNoProhibitedTerms(buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'RR' }))
    })
  })

  describe('empty string code (lot open)', () => {
    it('displayLabel contains Pending and lot open', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: '' })
      expect(result.displayLabel).toContain('Pending')
      expect(result.displayLabel).toMatch(/lot open/i)
    })

    it('rawCode is empty string', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: '' })
      expect(result.rawCode).toBe('')
    })

    it('evidenceState is loaded', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: '' })
      expect(result.evidenceState).toBe('loaded')
    })

    it('does not contain prohibited release terms', () => {
      assertNoProhibitedTerms(buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: '' }))
    })

    it('uses provided usageDecisionText when available', () => {
      const result = buildUsageDecisionDisplay({
        ...baseWithLot,
        usageDecisionCode: '',
        usageDecisionText: 'Under inspection — awaiting QA',
      })
      expect(result.detailText).toBe('Under inspection — awaiting QA')
    })
  })

  describe('null usage-decision code (lot present, no UD row)', () => {
    it('evidenceState is no-records', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: null })
      expect(result.evidenceState).toBe('no-records')
    })

    it('rawCode is null', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: null })
      expect(result.rawCode).toBeNull()
    })

    it('displayLabel contains source gap', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: null })
      expect(result.displayLabel).toMatch(/source gap/i)
    })

    it('does not contain prohibited release terms', () => {
      assertNoProhibitedTerms(buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: null }))
    })
  })

  describe('null inspection lot (no lot found)', () => {
    it('evidenceState is no-records', () => {
      const result = buildUsageDecisionDisplay({ inspectionLotId: null })
      expect(result.evidenceState).toBe('no-records')
    })

    it('displayLabel contains source gap', () => {
      const result = buildUsageDecisionDisplay({ inspectionLotId: null })
      expect(result.displayLabel).toMatch(/source gap/i)
    })

    it('warnings contain source gap message', () => {
      const result = buildUsageDecisionDisplay({ inspectionLotId: null })
      const warningsText = result.warnings.join(' ')
      expect(warningsText).toMatch(/source gap/i)
    })

    it('warnings contain no-records-not-absence message', () => {
      const result = buildUsageDecisionDisplay({ inspectionLotId: null })
      const warningsText = result.warnings.join(' ')
      expect(warningsText).toMatch(/not be interpreted as absence/i)
    })

    it('does not contain prohibited release terms', () => {
      assertNoProhibitedTerms(buildUsageDecisionDisplay({ inspectionLotId: null }))
    })
  })

  describe('undefined inspection lot (no lot context)', () => {
    it('evidenceState is no-records', () => {
      const result = buildUsageDecisionDisplay({})
      expect(result.evidenceState).toBe('no-records')
    })

    it('does not contain prohibited release terms', () => {
      assertNoProhibitedTerms(buildUsageDecisionDisplay({}))
    })
  })

  describe('unknown code', () => {
    it('displayLabel contains governance required or unknown', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'Z99' })
      const label = result.displayLabel.toLowerCase()
      expect(label.includes('governance') || label.includes('unknown')).toBe(true)
    })

    it('preserves raw code verbatim', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'Z99' })
      expect(result.rawCode).toBe('Z99')
    })

    it('does not contain prohibited release terms', () => {
      assertNoProhibitedTerms(buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'Z99' }))
    })

    it('mappingStatus is unknown-code', () => {
      const result = buildUsageDecisionDisplay({ ...baseWithLot, usageDecisionCode: 'Z99' })
      expect(result.mappingStatus).toBe('unknown-code')
    })
  })

  describe('usageDecisionText passthrough', () => {
    it('uses provided text for governed code', () => {
      const result = buildUsageDecisionDisplay({
        ...baseWithLot,
        usageDecisionCode: 'A',
        usageDecisionText: 'Accepted by QA team after full inspection',
      })
      expect(result.detailText).toBe('Accepted by QA team after full inspection')
    })

    it('falls back gracefully when text is null', () => {
      const result = buildUsageDecisionDisplay({
        ...baseWithLot,
        usageDecisionCode: 'A',
        usageDecisionText: null,
      })
      expect(result.detailText).toBeTruthy()
    })
  })

  describe('universal invariants — no output ever contains prohibited terms', () => {
    const inputs = [
      {},
      { inspectionLotId: null },
      { inspectionLotId: '000001', usageDecisionCode: null },
      { inspectionLotId: '000001', usageDecisionCode: '' },
      { inspectionLotId: '000001', usageDecisionCode: 'A' },
      { inspectionLotId: '000001', usageDecisionCode: 'AE' },
      { inspectionLotId: '000001', usageDecisionCode: 'AC' },
      { inspectionLotId: '000001', usageDecisionCode: 'ACE' },
      { inspectionLotId: '000001', usageDecisionCode: 'A9' },
      { inspectionLotId: '000001', usageDecisionCode: 'R' },
      { inspectionLotId: '000001', usageDecisionCode: 'RE' },
      { inspectionLotId: '000001', usageDecisionCode: 'RR' },
      { inspectionLotId: '000001', usageDecisionCode: 'UNKNOWN_CODE_X' },
    ]

    it.each(inputs)('no prohibited terms for input %j', (input) => {
      assertNoProhibitedTerms(buildUsageDecisionDisplay(input))
    })
  })

  describe('warnings always present', () => {
    it('all outputs include the no-records-not-absence warning', () => {
      const inputs = [
        {},
        { inspectionLotId: null },
        { inspectionLotId: '000001', usageDecisionCode: 'A' },
        { inspectionLotId: '000001', usageDecisionCode: 'R' },
        { inspectionLotId: '000001', usageDecisionCode: '' },
      ]
      for (const input of inputs) {
        const result = buildUsageDecisionDisplay(input)
        expect(
          result.warnings.join(' '),
          `Warnings for input ${JSON.stringify(input)} must contain absence warning`
        ).toMatch(/not be interpreted as absence/i)
      }
    })

    it('all outputs include the read-only evidence warning', () => {
      const inputs = [
        {},
        { inspectionLotId: '000001', usageDecisionCode: 'A' },
        { inspectionLotId: '000001', usageDecisionCode: 'R' },
      ]
      for (const input of inputs) {
        const result = buildUsageDecisionDisplay(input)
        expect(
          result.warnings.join(' '),
          `Warnings for input ${JSON.stringify(input)} must contain read-only evidence warning`
        ).toMatch(/source evidence only/i)
      }
    })
  })
})
