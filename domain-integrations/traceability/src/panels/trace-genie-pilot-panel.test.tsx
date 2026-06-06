import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TraceGeniePilotPanel } from './trace-genie-pilot-panel.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

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

describe('TraceGeniePilotPanel', () => {
  it('shows waiting-for-context when batch/material are missing', async () => {
    render(
      <Wrapper>
        <TraceGeniePilotPanel request={{ investigationId: '' }} />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Waiting for investigation context/i)).toBeInTheDocument()
    })
  })

  it('renders an approved answer from a starter prompt', async () => {
    const request: Trace2AdapterRequest = {
      investigationId: '',
      materialId: '100023847',
      batchId: 'CH-240308-0047',
      plantId: 'IE10',
    }

    render(
      <Wrapper>
        <TraceGeniePilotPanel request={request} />
      </Wrapper>,
    )

    const starter = await screen.findByRole('button', {
      name: /Summarize the focal batch currently loaded in the batch header/i,
    })
    fireEvent.click(starter)

    await waitFor(() => {
      expect(screen.getByText(/Based on BatchHeaderPanel/i)).toBeInTheDocument()
    })
  })

  it('refuses blocked questions entered manually', async () => {
    const request: Trace2AdapterRequest = {
      investigationId: '',
      materialId: '100023847',
      batchId: 'CH-240308-0047',
      plantId: 'IE10',
    }

    render(
      <Wrapper>
        <TraceGeniePilotPanel request={request} />
      </Wrapper>,
    )

    const input = await screen.findByLabelText(/Ask within approved Traceability scope/i)
    fireEvent.change(input, { target: { value: 'Which customers are definitely affected?' } })
    fireEvent.click(screen.getByRole('button', { name: /Ask pilot/i }))

    await waitFor(() => {
      expect(screen.getByText(/can't answer that in the current pilot/i)).toBeInTheDocument()
    })
  })
})
