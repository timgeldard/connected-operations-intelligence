import { render } from '@testing-library/react'
import { expect, describe, it } from 'vitest'

import {
  EvidenceErrorState,
  ConfirmedEmptyState,
  FreshnessBadge,
  EvidenceCaveatList,
} from '../index.js'

describe('evidence-panel-runtime: Shared Evidence State Primitives', () => {
  it('EvidenceErrorState does not render "no data"', () => {
    const { container } = render(<EvidenceErrorState message="failed to load" />)
    const text = container.textContent ?? ''

    expect(text.toLowerCase()).not.toContain('no data')
    expect(text).toContain('failed to load')
  })

  it('ConfirmedEmptyState does not render "no issue found"', () => {
    const { container } = render(<ConfirmedEmptyState description="No deviations recorded" />)
    const text = container.textContent ?? ''

    expect(text.toLowerCase()).not.toContain('no issue found')
    expect(text.toLowerCase()).toContain('no deviations recorded')
  })

  it('FreshnessBadge handles missing fetchedAt safely', () => {
    const { container } = render(<FreshnessBadge fetchedAt={null} />)
    const text = container.textContent ?? ''

    expect(text).toContain('Never refreshed')
  })

  it('EvidenceCaveatList renders caveats visibly', () => {
    const caveats = ['Caveat one', 'Caveat two']
    const { container } = render(<EvidenceCaveatList caveats={caveats} />)
    const text = container.textContent ?? ''

    expect(text).toContain('Caveat one')
    expect(text).toContain('Caveat two')
  })
})
