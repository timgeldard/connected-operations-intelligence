import { render } from '@testing-library/react'
import { expect, describe, it } from 'vitest'

import {
  UnavailableValue,
  UnknownValue,
  NotEvaluatedValue,
  GovernancePendingBadge,
} from '../../index.js'

describe('design-system: Shared Evidence State Primitives', () => {
  it('UnavailableValue renders unavailable/— and does not render OK', () => {
    const { container } = render(<UnavailableValue />)
    const text = container.textContent ?? ''

    expect(text.toLowerCase()).toMatch(/unavailable|—/)
    expect(text.toLowerCase()).not.toContain('ok')
    expect(text.toLowerCase()).not.toContain('safe')
  })

  it('UnknownValue renders Unknown and does not render Low risk', () => {
    const { container } = render(<UnknownValue />)
    const text = container.textContent ?? ''

    expect(text).toMatch(/unknown/i)
    expect(text.toLowerCase()).not.toContain('low risk')
  })

  it('NotEvaluatedValue renders Not evaluated and does not render In control', () => {
    const { container } = render(<NotEvaluatedValue />)
    const text = container.textContent ?? ''

    expect(text).toMatch(/not evaluated/i)
    expect(text.toLowerCase()).not.toContain('in control')
  })

  it('GovernancePendingBadge renders Governance pending and does not render Approved', () => {
    const { container } = render(<GovernancePendingBadge reason="test reason" />)
    const text = container.textContent ?? ''

    expect(text).toMatch(/governance pending/i)
    expect(text.toLowerCase()).not.toContain('approved')
  })
})
