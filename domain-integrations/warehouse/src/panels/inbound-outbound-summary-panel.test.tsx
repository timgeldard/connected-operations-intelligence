import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { InboundOutboundSummaryPanel } from './inbound-outbound-summary-panel.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

vi.mock('../adapters/warehouse-360-queries.js', () => ({
  useGoodsMovements: vi.fn(() => ({
    data: {
      ok: true,
      data: [
        {
          movementId: 'GR-2024-004812',
          timestamp: '2026-05-14T07:00:00.000Z',
          movementType: 'goods-receipt',
          materialId: 'MAT-RM-RAW-MILK',
          materialDescription: 'Raw Milk — Full Tanker',
          quantity: 25000,
          uom: 'L',
          destinationLocation: 'CHILL-A-BULK-01',
          referenceDocument: 'PO-240308-0021',
          postedBy: 'warehouse.ie10@kerry.com',
        },
        {
          movementId: 'GI-2024-003547',
          timestamp: '2026-05-14T08:30:00.000Z',
          movementType: 'goods-issue',
          materialId: 'MAT-START-CULTURE-B10',
          materialDescription: 'Starter Culture B10',
          batchId: 'SC-240308-0003',
          quantity: 2.5,
          uom: 'KG',
          sourceLocation: 'CHILL-A-007-B03',
          referenceDocument: 'PO-240308-3847',
          postedBy: 'warehouse.ie10@kerry.com',
        },
        {
          movementId: 'TO-2024-001923',
          timestamp: '2026-05-14T09:15:00.000Z',
          movementType: 'transfer',
          materialId: 'MAT-RM-RAW-MILK',
          materialDescription: 'Raw Milk',
          quantity: 5000,
          uom: 'L',
          sourceLocation: 'CHILL-A-BULK-01',
          destinationLocation: 'CHILL-A-PROCESS-01',
          referenceDocument: 'TO-240308-0112',
          postedBy: 'warehouse.ie10@kerry.com',
        }
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
    // mocked response has 2 goods-receipt events; 'Inbound' appears in tile + latest row
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
      expect(screen.getByText('Raw Milk — Full Tanker')).toBeInTheDocument()
    })
  })
})
