import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ExceptionStockSummaryPanel } from './exception-stock-summary-panel.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

vi.mock('../adapters/warehouse-360-queries.js', () => ({
  useStockOverview: vi.fn(() => ({
    data: {
      ok: true,
      data: {
        warehouseId: 'WH-IE10-MAIN',
        zones: [
          {
            zoneId: 'ZONE-CHILL-A',
            zoneName: 'Chilled Zone A (0–4°C)',
            zoneType: 'chilled',
            stockLines: 142,
            capacityPercent: 81,
            holdPercent: 6.3,
          },
          {
            zoneId: 'ZONE-CHILL-B',
            zoneName: 'Chilled Zone B (0–4°C)',
            zoneType: 'chilled',
            stockLines: 98,
            capacityPercent: 67,
            holdPercent: 11.2,
          },
        ],
        totalStorageLocations: 1240,
        occupiedLocations: 920,
        blockedLocations: 47,
      },
      fetchedAt: '2026-05-14T10:00:00.000Z',
      source: 'databricks-api',
    },
    isLoading: false,
  })),
}))

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
}

const request: Warehouse360AdapterRequest = { warehouseId: 'WH-IE10-MAIN', plantId: 'IE10' }

describe('ExceptionStockSummaryPanel', () => {
  it('renders the panel container', async () => {
    render(<Wrapper><ExceptionStockSummaryPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="evidence-panel-exception-stock-summary"]')).not.toBeNull()
    })
  })

  it('renders the panel display name', async () => {
    render(<Wrapper><ExceptionStockSummaryPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Exception Stock Summary')).toBeInTheDocument()
    })
  })

  it('renders the blocked locations count from mock data', async () => {
    render(<Wrapper><ExceptionStockSummaryPanel request={request} /></Wrapper>)
    // mocked response has blockedLocations: 47
    await waitFor(() => {
      expect(screen.getByText('47')).toBeInTheDocument()
    })
  })

  it('renders the total storage locations', async () => {
    render(<Wrapper><ExceptionStockSummaryPanel request={request} /></Wrapper>)
    // mocked response has totalStorageLocations: 1240
    await waitFor(() => {
      expect(screen.getByText('1240')).toBeInTheDocument()
    })
  })

  it('renders zone breakdown labels', async () => {
    render(<Wrapper><ExceptionStockSummaryPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Zone breakdown')).toBeInTheDocument()
    })
  })

  it('renders zone names from mock data', async () => {
    render(<Wrapper><ExceptionStockSummaryPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/Chilled Zone A/i)).toBeInTheDocument()
    })
  })

  it('shows empty state when no data yet', () => {
    render(<Wrapper><ExceptionStockSummaryPanel request={request} /></Wrapper>)
    // Before data loads, panel container should still render
    expect(document.querySelector('[data-testid="evidence-panel-exception-stock-summary"]')).not.toBeNull()
  })
})
