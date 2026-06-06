import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NearExpiryStockPanel } from './near-expiry-stock-panel.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

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
