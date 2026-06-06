import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderOperationsPanel } from './order-operations-panel.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

const request: ProcessOrderReviewAdapterRequest = {
  processOrderId: 'PO-240308-3847',
  plantId: 'IE10',
}

describe('OrderOperationsPanel', () => {
  it('renders the panel container', async () => {
    render(
      <Wrapper>
        <OrderOperationsPanel request={request} />
      </Wrapper>
    )
    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-order-operations"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders the panel title', async () => {
    render(
      <Wrapper>
        <OrderOperationsPanel request={request} />
      </Wrapper>
    )
    await waitFor(() => {
      expect(screen.getByText('Operations')).toBeInTheDocument()
    })
  })

  it('renders operation OP-010 Milk Standardisation', async () => {
    render(
      <Wrapper>
        <OrderOperationsPanel request={request} />
      </Wrapper>
    )
    await waitFor(() => {
      expect(screen.getByText(/Milk Standardisation/)).toBeInTheDocument()
    })
  })

  it('renders the current in-progress operation OP-070', async () => {
    render(
      <Wrapper>
        <OrderOperationsPanel request={request} />
      </Wrapper>
    )
    await waitFor(() => {
      expect(screen.getByText(/Pressing & Moulding/)).toBeInTheDocument()
    })
  })

  it('shows exception flag for OP-020 Pasteurisation', async () => {
    render(
      <Wrapper>
        <OrderOperationsPanel request={request} />
      </Wrapper>
    )
    await waitFor(() => {
      expect(screen.getByText(/exception/)).toBeInTheDocument()
    })
  })

  it('renders confirmed count summary', async () => {
    render(
      <Wrapper>
        <OrderOperationsPanel request={request} />
      </Wrapper>
    )
    await waitFor(() => {
      expect(screen.getByText(/6 of 8 confirmed/)).toBeInTheDocument()
    })
  })

  it('renders the final pending operation OP-080 Brining', async () => {
    render(
      <Wrapper>
        <OrderOperationsPanel request={request} />
      </Wrapper>
    )
    await waitFor(() => {
      expect(screen.getByText(/Brining/)).toBeInTheDocument()
    })
  })
})
