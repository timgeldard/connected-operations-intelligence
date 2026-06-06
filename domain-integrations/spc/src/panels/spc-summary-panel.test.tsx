/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SPCSummaryPanel } from './spc-summary-panel.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'

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

const request: SPCMonitoringAdapterRequest = {
  materialId: 'MAT-12345',
  plantId: 'IE10',
  workCentreId: 'WC-IE10-PASTEURISATION',
}

describe('SPCSummaryPanel', () => {
  it('renders the panel container with correct data-testid', async () => {
    render(
      <Wrapper>
        <SPCSummaryPanel request={request} />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-spc-summary"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders the panel display name', async () => {
    render(
      <Wrapper>
        <SPCSummaryPanel request={request} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('SPC Summary')).toBeInTheDocument()
    })
  })

  it('renders charts monitored count after data loads', async () => {
    render(
      <Wrapper>
        <SPCSummaryPanel request={request} />
      </Wrapper>
    )

    // Mock data has chartsMonitored: 12
    await waitFor(() => {
      const el = screen.queryByText('12')
      expect(el).not.toBeNull()
    })
  })

  it('renders highest severity after data loads', async () => {
    render(
      <Wrapper>
        <SPCSummaryPanel request={request} />
      </Wrapper>
    )

    // Mock data has highestSeverity: 'high'
    await waitFor(() => {
      const el = screen.queryByText(/high/i)
      expect(el).not.toBeNull()
    })
  })
})
