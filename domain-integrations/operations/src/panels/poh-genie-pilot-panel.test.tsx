import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PohGeniePilotPanel } from './poh-genie-pilot-panel.js'
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

describe('PohGeniePilotPanel', () => {
  it('shows waiting-for-context when process order is missing', async () => {
    const request: ProcessOrderReviewAdapterRequest = { plantId: 'IE10' }

    render(
      <Wrapper>
        <PohGeniePilotPanel request={request} />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Waiting for investigation context/i)).toBeInTheDocument()
    })
  })

  it('renders an approved answer from a starter prompt', async () => {
    const request: ProcessOrderReviewAdapterRequest = {
      processOrderId: 'PO-240308-3847',
      plantId: 'IE10',
    }

    render(
      <Wrapper>
        <PohGeniePilotPanel request={request} />
      </Wrapper>,
    )

    const starter = await screen.findByRole('button', {
      name: /Show the operations currently returned for this process order/i,
    })
    fireEvent.click(starter)

    await waitFor(() => {
      expect(screen.getByText(/Based on OrderOperationsPanel/i)).toBeInTheDocument()
      expect(screen.getByText(/Scope note:/i)).toBeInTheDocument()
    })
  })

  it('refuses blocked questions entered manually', async () => {
    const request: ProcessOrderReviewAdapterRequest = {
      processOrderId: 'PO-240308-3847',
      plantId: 'IE10',
    }

    render(
      <Wrapper>
        <PohGeniePilotPanel request={request} />
      </Wrapper>,
    )

    const input = await screen.findByLabelText(/Ask within approved POH scope/i)
    fireEvent.change(input, { target: { value: 'Why is this order late?' } })

    fireEvent.click(screen.getByRole('button', { name: /Ask pilot/i }))

    await waitFor(() => {
      expect(screen.getByText(/can't answer that in the current pilot/i)).toBeInTheDocument()
    })
  })
})
