import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { QualityReadOnlyEvidencePanel } from './quality-readonly-evidence-panel.js'
import { expectNoForbiddenClaims } from '@connectio/test-support'
import {
  pendingSourceVerificationFixture,
  multipleLotsFixture,
} from '../adapters/quality-readonly-evidence-mock-data.js'

describe('Quality usage decision evidence (Offline UAT Smoke Check)', () => {
  it('renders unknown usage decision truthfully and prevents forbidden claims', () => {
    const { container } = render(
      <QualityReadOnlyEvidencePanel result={pendingSourceVerificationFixture} />,
    )

    expectNoForbiddenClaims(container, ['released', 'complete'])
    expect(container.textContent?.toLowerCase()).toContain('source unverified')

    const textContent = container.textContent?.toLowerCase() || ''
    expect(textContent).not.toContain('batch approved')
    expect(textContent).toMatch(/not be interpreted as accepted, released/i)
    expect(textContent).not.toContain('safe')
    expect(textContent).not.toContain('cleared for shipment')
    expect(textContent).not.toContain('signed off')
  })

  it('renders multiple-lot warning when multiple lots are present', () => {
    const { container } = render(<QualityReadOnlyEvidencePanel result={multipleLotsFixture} />)

    expect(container.textContent || '').toMatch(/multiple inspection lots/i)
  })
})
