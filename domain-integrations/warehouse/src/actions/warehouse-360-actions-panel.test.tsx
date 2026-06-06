import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { setFeatureFlags } from '@connectio/feature-flags'
import { Warehouse360ActionsPanel } from './warehouse-360-actions-panel.js'
import type { Warehouse360OverviewContext } from '@connectio/data-contracts'

const mockContext: Warehouse360OverviewContext = {
  warehouseId: 'WH123',
  warehouseName: 'Dublin Logistics',
  plantId: 'IE10',
  totalStockLines: 100,
  holdPercent: 5.0,
  openTransfers: 2,
  capacityUtilizationPercent: 78.5,
  lastUpdatedAt: '2026-05-20T00:00:00.000Z',
}

describe('Warehouse360ActionsPanel Posting Actions Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setFeatureFlags({})
  })

  it('renders disabled buttons and warning message when postingActions feature flag is false', () => {
    setFeatureFlags({
      'warehouse.postingActions': false,
    })

    render(<Warehouse360ActionsPanel context={mockContext} />)

    // Check warning message
    expect(screen.getByText('Posting actions disabled by configuration.')).toBeDefined()

    // Verify posting buttons are disabled
    const holdBtn = screen.getByText('Raise Hold Inquiry') as HTMLButtonElement
    const replenishmentBtn = screen.getByText('Request Replenishment') as HTMLButtonElement
    
    // Non-posting buttons should still be enabled
    const releaseBtn = screen.getByText('Open Batch Release') as HTMLButtonElement
    const stagingBtn = screen.getByText('Open Production Staging') as HTMLButtonElement
    const traceBtn = screen.getByText('Open Trace Investigation') as HTMLButtonElement

    expect(holdBtn.disabled).toBe(true)
    expect(replenishmentBtn.disabled).toBe(true)
    expect(releaseBtn.disabled).toBe(false)
    expect(stagingBtn.disabled).toBe(false)
    expect(traceBtn.disabled).toBe(false)
  })

  it('renders enabled buttons and no warning when postingActions feature flag is true', () => {
    setFeatureFlags({
      'warehouse.postingActions': true,
    })

    render(<Warehouse360ActionsPanel context={mockContext} />)

    // Check no warning message is present
    expect(screen.queryByText('Posting actions disabled by configuration.')).toBeNull()

    // Verify all buttons are enabled
    const holdBtn = screen.getByText('Raise Hold Inquiry') as HTMLButtonElement
    const replenishmentBtn = screen.getByText('Request Replenishment') as HTMLButtonElement
    const releaseBtn = screen.getByText('Open Batch Release') as HTMLButtonElement
    const stagingBtn = screen.getByText('Open Production Staging') as HTMLButtonElement
    const traceBtn = screen.getByText('Open Trace Investigation') as HTMLButtonElement

    expect(holdBtn.disabled).toBe(false)
    expect(replenishmentBtn.disabled).toBe(false)
    expect(releaseBtn.disabled).toBe(false)
    expect(stagingBtn.disabled).toBe(false)
    expect(traceBtn.disabled).toBe(false)
  })
})
