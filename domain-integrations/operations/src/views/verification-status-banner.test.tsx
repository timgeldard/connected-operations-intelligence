// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VerificationStatusBanner } from '@connectio/design-system'
import '@testing-library/jest-dom'

describe('VerificationStatusBanner', () => {
  const defaultProps = {
    title: 'Test Integration Specifications',
    status: 'executable-pending-bv' as const,
    sourceLabel: 'Databricks Test Schema',
    routes: ['POST /api/test/data', 'GET /api/test/items'],
    sourceObjects: ['test_view_v', 'test_items_v'],
    limitations: ['Limitation A', 'Limitation B'],
    lastVerified: 'Pending Test',
  }

  it('renders standard header elements correctly', () => {
    render(<VerificationStatusBanner {...defaultProps} />)

    expect(screen.getByText('Test Integration Specifications')).toBeInTheDocument()
    expect(screen.getByText('EXECUTABLE · PENDING BROWSER VERIFICATION')).toBeInTheDocument()
    expect(screen.getByText('Databricks Test Schema')).toBeInTheDocument()
  })

  it('toggles collapsible drawer on click', () => {
    render(<VerificationStatusBanner {...defaultProps} />)

    // Check that technical fields are NOT in DOM initially (drawer is closed)
    expect(screen.queryByText('POST /api/test/data')).toBeNull()
    expect(screen.queryByText('Limitation A')).toBeNull()
    expect(screen.queryByText('Pending Test')).toBeNull()

    const toggleBtn = screen.getByRole('button', { name: /Show Specs/i })
    
    // Click to open/expand drawer
    fireEvent.click(toggleBtn)

    // Now technical fields should be rendered in DOM
    expect(screen.getByText('POST /api/test/data')).toBeInTheDocument()
    expect(screen.getByText('Limitation A')).toBeInTheDocument()
    expect(screen.getByText('Pending Test')).toBeInTheDocument()

    // Click again to close/collapse drawer
    fireEvent.click(toggleBtn)

    // Technical fields should be unmounted/absent from DOM again
    expect(screen.queryByText('POST /api/test/data')).toBeNull()
  })

  it('renders different statuses with correct labels', () => {
    const statuses = [
      { status: 'native-live' as const, label: 'NATIVE LIVE' },
      { status: 'executable-pending-bv' as const, label: 'EXECUTABLE · PENDING BROWSER VERIFICATION' },
      { status: 'partial-native' as const, label: 'PARTIAL NATIVE' },
      { status: 'mock-demo' as const, label: 'SANDBOX / DEMO ONLY' },
      { status: 'source-blocked' as const, label: 'SOURCE BLOCKED' },
      { status: 'error' as const, label: 'ERROR' },
    ]

    for (const item of statuses) {
      const { unmount } = render(<VerificationStatusBanner {...defaultProps} status={item.status} />)
      expect(screen.getByText(item.label)).toBeInTheDocument()
      unmount()
    }
  })
})
