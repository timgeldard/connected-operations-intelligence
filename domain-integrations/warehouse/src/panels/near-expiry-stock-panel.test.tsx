import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NearExpiryStockPanel } from './near-expiry-stock-panel.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

vi.mock('../adapters/warehouse-360-queries.js', () => ({
  useNearExpiryStock: vi.fn(() => ({
    data: {
      ok: true,
      data: [
        {
          batchId: 'SC-240308-0003',
          materialId: 'MAT-START-CULTURE-B10',
          materialDescription: 'Starter Culture B10',
          storageLocationId: 'CHILL-A-007-B03',
          expiryDate: '2026-05-17T00:00:00.000Z',
          daysUntilExpiry: 1,
          quantity: 3.5,
          uom: 'KG',
          urgency: 'critical',
          holdStatus: 'unrestricted',
        },
        {
          batchId: 'RM-240301-0021',
          materialId: 'MAT-RM-RENNET',
          materialDescription: 'Liquid Rennet 25 L',
          storageLocationId: 'CHILL-A-007-C01',
          expiryDate: '2026-05-14T00:00:00.000Z',
          daysUntilExpiry: -2,
          quantity: 75,
          uom: 'L',
          urgency: 'expired',
          holdStatus: 'quality-hold',
        },
        {
          batchId: 'CH-240225-0018',
          materialId: 'MAT-CH-CHEDDAR-BLOCK',
          materialDescription: 'Cheddar Block 20 kg',
          storageLocationId: 'CHILL-B-011-A02',
          expiryDate: '2026-05-21T00:00:00.000Z',
          daysUntilExpiry: 5,
          quantity: 400,
          uom: 'KG',
          urgency: 'warning',
          holdStatus: 'unrestricted',
        },
        {
          batchId: 'CH-240228-0033',
          materialId: 'MAT-CH-EMMENTAL-BLOCK',
          materialDescription: 'Emmental Block 4 kg',
          storageLocationId: 'CHILL-A-023-B04',
          expiryDate: '2026-05-26T00:00:00.000Z',
          daysUntilExpiry: 10,
          quantity: 120,
          uom: 'KG',
          urgency: 'caution',
          holdStatus: 'unrestricted',
        },
      ],
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

describe('NearExpiryStockPanel', () => {
  it('renders the panel container', async () => {
    render(<Wrapper><NearExpiryStockPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="evidence-panel-near-expiry-stock"]')).not.toBeNull()
    })
  })

  it('renders the panel display name', async () => {
    render(<Wrapper><NearExpiryStockPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Near-Expiry Stock')).toBeInTheDocument()
    })
  })

  it('renders an expired batch label', async () => {
    render(<Wrapper><NearExpiryStockPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('EXPIRED')).toBeInTheDocument()
    })
  })

  it('renders a critical batch label', async () => {
    render(<Wrapper><NearExpiryStockPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('CRITICAL')).toBeInTheDocument()
    })
  })

  it('renders a warning batch label', async () => {
    render(<Wrapper><NearExpiryStockPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('WARNING')).toBeInTheDocument()
    })
  })

  it('renders a caution batch label', async () => {
    render(<Wrapper><NearExpiryStockPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('CAUTION')).toBeInTheDocument()
    })
  })

  it('renders material description for starter culture', async () => {
    render(<Wrapper><NearExpiryStockPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/Starter Culture B10/i)).toBeInTheDocument()
    })
  })

  it('renders days overdue text for expired batch', async () => {
    render(<Wrapper><NearExpiryStockPanel request={request} /></Wrapper>)
    await waitFor(() => {
      // Expired batch has daysUntilExpiry: -2 → "2d overdue"
      expect(screen.getByText(/overdue/i)).toBeInTheDocument()
    })
  })

  it('shows panel container before data loads', () => {
    render(<Wrapper><NearExpiryStockPanel request={request} /></Wrapper>)
    expect(document.querySelector('[data-testid="evidence-panel-near-expiry-stock"]')).not.toBeNull()
  })
})
