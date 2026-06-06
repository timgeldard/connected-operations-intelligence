import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EvidenceGrid } from './EvidenceGrid.js'
import type { EvidencePanelReference } from '@connectio/product-model'

const makePanelRef = (panelId: string): EvidencePanelReference => ({
  panelId,
  defaultVisible: true,
  defaultOrder: 0,
})

describe('EvidenceGrid', () => {
  it('renders the grid root with data-testid="evidence-grid"', () => {
    render(
      <EvidenceGrid panels={[makePanelRef('p1')]}>
        <span>content</span>
      </EvidenceGrid>,
    )
    expect(screen.getByTestId('evidence-grid')).toBeInTheDocument()
  })

  it('renders children inside the grid', () => {
    render(
      <EvidenceGrid panels={[makePanelRef('p1'), makePanelRef('p2')]}>
        <span data-testid="child-a">panel A</span>
        <span data-testid="child-b">panel B</span>
      </EvidenceGrid>,
    )
    expect(screen.getByTestId('child-a')).toBeInTheDocument()
    expect(screen.getByTestId('child-b')).toBeInTheDocument()
  })

  it('renders an empty grid when no children are provided', () => {
    render(<EvidenceGrid panels={[]}>{null}</EvidenceGrid>)
    const grid = screen.getByTestId('evidence-grid')
    expect(grid).toBeInTheDocument()
    expect(grid.children).toHaveLength(0)
  })
})
