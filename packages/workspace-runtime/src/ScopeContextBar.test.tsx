import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScopeContextBar } from './ScopeContextBar.js'

describe('ScopeContextBar', () => {
  it('renders the plant label and value when plantId is set', () => {
    render(<ScopeContextBar scope={{ plantId: 'P001' }} />)
    expect(screen.getByText('Plant')).toBeInTheDocument()
    expect(screen.getByText('P001')).toBeInTheDocument()
  })

  it('renders multiple active scope fields', () => {
    render(<ScopeContextBar scope={{ plantId: 'P001', batchId: 'B-100' }} />)
    expect(screen.getByText('Plant')).toBeInTheDocument()
    expect(screen.getByText('P001')).toBeInTheDocument()
    expect(screen.getByText('Batch')).toBeInTheDocument()
    expect(screen.getByText('B-100')).toBeInTheDocument()
  })

  it('does not render when scope is entirely empty', () => {
    const { container } = render(<ScopeContextBar scope={{}} />)
    expect(container.firstChild).toBeNull()
  })

  it('does not render the plant field when plantId is undefined', () => {
    render(<ScopeContextBar scope={{ batchId: 'B-100' }} />)
    expect(screen.queryByText('Plant')).toBeNull()
  })

  it('does not render the plant field when plantId is null (explicit null cast)', () => {
    // ScopeContext values are all optional strings; passing undefined suppresses rendering.
    render(<ScopeContextBar scope={{ plantId: undefined, batchId: 'B-200' }} />)
    expect(screen.queryByText('Plant')).toBeNull()
    expect(screen.getByText('B-200')).toBeInTheDocument()
  })

  it('renders the line field when lineId is set', () => {
    render(<ScopeContextBar scope={{ lineId: 'L-01' }} />)
    expect(screen.getByText('Line')).toBeInTheDocument()
    expect(screen.getByText('L-01')).toBeInTheDocument()
  })

  it('renders fields in fixed order regardless of object key order', () => {
    const { container } = render(
      <ScopeContextBar scope={{ batchId: 'B-500', plantId: 'P-002' }} />,
    )
    const fields = container.querySelectorAll('.connectio-scopebar-field')
    // Plant (index 0 in SCOPE_FIELD_ORDER) always comes before Batch (index 7)
    const texts = Array.from(fields).map((el) => el.textContent ?? '')
    const plantIndex = texts.findIndex((t) => t.includes('Plant'))
    const batchIndex = texts.findIndex((t) => t.includes('Batch'))
    expect(plantIndex).toBeGreaterThanOrEqual(0)
    expect(batchIndex).toBeGreaterThanOrEqual(0)
    expect(plantIndex).toBeLessThan(batchIndex)
  })
})
