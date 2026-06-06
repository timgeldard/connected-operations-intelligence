import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueriedAtLabel } from './QueriedAtLabel.js'

describe('QueriedAtLabel', () => {
  it('renders nothing when fetchedAt is null', () => {
    const { container } = render(<QueriedAtLabel fetchedAt={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fetchedAt is undefined', () => {
    const { container } = render(<QueriedAtLabel fetchedAt={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders HH:MM:SS time + "source refresh time unavailable" notice for a valid ISO string', () => {
    // 09:15:42 in some timezone — assertion is regex-based to avoid local-time flakiness
    render(<QueriedAtLabel fetchedAt={'2026-05-21T09:15:42.000Z'} />)
    const label = screen.getByLabelText('Data fetch time and source freshness notice')
    expect(label.textContent).toMatch(/^Queried at \d{2}:\d{2}:\d{2} — source refresh time unavailable$/)
  })

  it('falls back to the raw value when fetchedAt is malformed', () => {
    render(<QueriedAtLabel fetchedAt={'not-an-iso-date'} />)
    const label = screen.getByLabelText('Data fetch time and source freshness notice')
    expect(label.textContent).toContain('not-an-iso-date')
  })

  it('applies custom inline style', () => {
    render(<QueriedAtLabel fetchedAt={'2026-05-21T09:15:42.000Z'} style={{ marginTop: 4 }} />)
    const label = screen.getByLabelText('Data fetch time and source freshness notice')
    expect(label).toHaveStyle('margin-top: 4px')
  })

  it('never claims to know the underlying source refresh time', () => {
    render(<QueriedAtLabel fetchedAt={'2026-05-21T09:15:42.000Z'} />)
    const label = screen.getByLabelText('Data fetch time and source freshness notice')
    // Must contain the explicit unavailable language — never let this drift silently.
    expect(label.textContent).toContain('source refresh time unavailable')
  })
})
