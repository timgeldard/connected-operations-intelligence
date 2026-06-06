import { vi } from "vitest"

import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProcessOrderGoodsMovementsPanel } from './process-order-goods-movements-panel.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'
import * as queries from '../adapters/process-order-review-queries.js'

vi.mock('../adapters/process-order-review-queries.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../adapters/process-order-review-queries.js')>()
  return {
    ...actual,
    useOrderGoodsMovements: vi.fn((req) => actual.useOrderGoodsMovements(req)),
  }
})

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
}

const request: ProcessOrderReviewAdapterRequest = {
  processOrderId: 'PO-240308-3847',
  plantId: 'IE10',
}

describe('ProcessOrderGoodsMovementsPanel', () => {
  it('renders the panel container', async () => {
    render(
      <Wrapper>
        <ProcessOrderGoodsMovementsPanel request={request} />
      </Wrapper>,
    )
    await waitFor(() => {
      const panel = document.querySelector(
        '[data-testid="evidence-panel-process-order-goods-movements"]',
      )
      expect(panel).not.toBeNull()
    })
  })

  it('renders the panel title', async () => {
    render(
      <Wrapper>
        <ProcessOrderGoodsMovementsPanel request={request} />
      </Wrapper>,
    )
    await waitFor(() => {
      expect(screen.getByText('Goods Movements')).toBeInTheDocument()
    })
  })

  it('shows input and output summary counts', async () => {
    render(
      <Wrapper>
        <ProcessOrderGoodsMovementsPanel request={request} />
      </Wrapper>,
    )
    await waitFor(() => {
      expect(screen.getByText(/input/)).toBeInTheDocument()
      expect(screen.getByText(/output/)).toBeInTheDocument()
    })
  })

  it('renders Raw Milk goods issue', async () => {
    render(
      <Wrapper>
        <ProcessOrderGoodsMovementsPanel request={request} />
      </Wrapper>,
    )
    await waitFor(() => {
      expect(screen.getByText('Raw Milk')).toBeInTheDocument()
    })
  })

  it('renders Emmental Block goods receipt', async () => {
    render(
      <Wrapper>
        <ProcessOrderGoodsMovementsPanel request={request} />
      </Wrapper>,
    )
    await waitFor(() => {
      expect(screen.getByText('Emmental Block 4 kg')).toBeInTheDocument()
    })
  })

  it('shows GI badge for input movements', async () => {
    render(
      <Wrapper>
        <ProcessOrderGoodsMovementsPanel request={request} />
      </Wrapper>,
    )
    await waitFor(() => {
      const giBadges = screen.getAllByText('GI')
      expect(giBadges.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows GR badge for output movement', async () => {
    render(
      <Wrapper>
        <ProcessOrderGoodsMovementsPanel request={request} />
      </Wrapper>,
    )
    await waitFor(() => {
      expect(screen.getByText('GR')).toBeInTheDocument()
    })
  })

  it('renders unavailable wording instead of 0 when quantity is null', async () => {
    vi.mocked(queries.useOrderGoodsMovements).mockReturnValue({
      data: {
        ok: true,
        data: [
          {
            movementId: 'GM-NULL',
            movementType: '261',
            direction: 'input',
            materialId: 'MAT-123',
            materialDescription: 'Test Material',
            batchId: 'BATCH-1',
            // Critical: quantity is null
            quantity: null,
            uom: 'KG',
            postedAt: '2026-03-08T08:00:00Z',
            storageLocation: 'SL-1',
          },
        ],
        fetchedAt: new Date().toISOString(),
        source: 'mock',
      },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(
      <Wrapper>
        <ProcessOrderGoodsMovementsPanel request={request} />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getByText('Test Material')).toBeInTheDocument()
    })

    const textContent = document.body.textContent || ''
    expect(textContent).not.toContain('0 KG')
    expect(textContent).toContain('—') // Or however unavailable is rendered
  })
})
