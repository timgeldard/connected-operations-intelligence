import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { InboundOutboundSummaryPanel } from './inbound-outbound-summary-panel.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
}

const request: Warehouse360AdapterRequest = { warehouseId: 'WH-IE10-MAIN', plantId: 'IE10' }

describe('InboundOutboundSummaryPanel', () => {
  it('renders the panel container', async () => {
    render(<Wrapper><InboundOutboundSummaryPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="evidence-panel-inbound-outbound-summary"]')).not.toBeNull()
    })
  })

  it('renders the panel display name', async () => {
    render(<Wrapper><InboundOutboundSummaryPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Inbound / Outbound Summary')).toBeInTheDocument()
    })
  })

  it('renders inbound count tile from mock data', async () => {
    render(<Wrapper><InboundOutboundSummaryPanel request={request} /></Wrapper>)
    // mockGoodsMovements has 2 goods-receipt events; 'Inbound' appears in tile + latest row
    await waitFor(() => {
      expect(screen.getAllByText('Inbound').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders outbound tile', async () => {
    render(<Wrapper><InboundOutboundSummaryPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getAllByText('Outbound').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders transfer tile', async () => {
    render(<Wrapper><InboundOutboundSummaryPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getAllByText('Transfer').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders latest movements section', async () => {
    render(<Wrapper><InboundOutboundSummaryPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Latest movements')).toBeInTheDocument()
    })
  })

  it('renders material descriptions from mock movements', async () => {
    render(<Wrapper><InboundOutboundSummaryPanel request={request} /></Wrapper>)
    await waitFor(() => {
      // mockGoodsMovements latest goods-receipt is Raw Milk — Full Tanker
      expect(screen.getByText(/Raw Milk/i)).toBeInTheDocument()
    })
  })
})
