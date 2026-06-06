import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EvidencePackReadiness } from './EvidencePackReadiness.js'
import type { ConfidenceResult } from './EvidenceConfidence.js'

describe('EvidencePackReadiness', () => {
  const mockConfidence: ConfidenceResult = {
    grade: 'PARTIAL',
    score: 80,
    gaps: [],
    details: {
      lineage: 'complete',
      customers: 'complete',
      massBalance: 'complete',
      quality: 'missing',
      coa: 'missing',
      suppliers: 'complete',
    },
  }

  it('renders the checklist and system-verified tags', () => {
    render(<EvidencePackReadiness confidence={mockConfidence} />)

    expect(screen.getByText('Evidence Pack Readiness')).not.toBeNull()
    expect(screen.getByText('Lineage map loaded')).not.toBeNull()
    expect(screen.getAllByText('System Verified')).toHaveLength(4) // lineage, customers, massBalance, suppliers
  })

  it('allows manual toggling of incomplete items', () => {
    render(<EvidencePackReadiness confidence={mockConfidence} />)

    const qualityText = screen.getByText('Quality inspection lots parsed')
    fireEvent.click(qualityText)

    // Should now show 5/6 compiled
    expect(screen.getByText('5 / 6 (83%)')).not.toBeNull()
  })

  it('unlocks compile button only when all items are verified', () => {
    render(<EvidencePackReadiness confidence={mockConfidence} />)

    const compileBtn = screen.getByRole('button')
    expect(compileBtn.hasAttribute('disabled')).toBe(true)

    // Click remaining items
    fireEvent.click(screen.getByText('Quality inspection lots parsed'))
    fireEvent.click(screen.getByText('Certificate of Analysis issued'))

    expect(screen.getByText('6 / 6 (100%)')).not.toBeNull()
    expect(compileBtn.hasAttribute('disabled')).toBe(false)
  })

  it('successfully triggers digital signing upon clicking compile button', () => {
    render(<EvidencePackReadiness confidence={mockConfidence} />)

    fireEvent.click(screen.getByText('Quality inspection lots parsed'))
    fireEvent.click(screen.getByText('Certificate of Analysis issued'))

    const compileBtn = screen.getByRole('button')
    fireEvent.click(compileBtn)

    expect(screen.getByText(/Dossier Compiled & Digitally Signed/)).not.toBeNull()
  })

  it('persists manual checklist toggles across re-renders with identical confidence details', () => {
    const { rerender } = render(<EvidencePackReadiness confidence={mockConfidence} />)

    // Initially 4/6 are checked, so count is 4 / 6 (67%)
    expect(screen.getByText('4 / 6 (67%)')).not.toBeNull()

    // Toggle 'Quality inspection lots parsed' manually
    fireEvent.click(screen.getByText('Quality inspection lots parsed'))
    expect(screen.getByText('5 / 6 (83%)')).not.toBeNull()

    // Rerender with a new confidence object containing identical details
    rerender(<EvidencePackReadiness confidence={{ ...mockConfidence }} />)

    // Verify it is still 5/6 (83%) and didn't reset back to 4/6 (67%)
    expect(screen.getByText('5 / 6 (83%)')).not.toBeNull()
  })
})
