import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StagingReadinessSummaryPanel } from './staging-readiness-summary-panel.js'
import type { ProductionStagingAdapterRequest } from '../adapters/production-staging-adapter.js'

vi.mock('../adapters/production-staging-queries.js', () => ({
  useStagingReadinessSummary: vi.fn(() => ({
    data: {
      ok: true,
      data: {
        planDate: '2024-03-08',
        warehouseId: 'WH-IE10-01',
        totalOrders: 18,
        fullyStaged: 12,
        partiallyStaged: 3,
        notStaged: 2,
        blocked: 1,
        percentReady: 66.7,
        openShortfalls: 2,
        pendingPickTasks: 8,
        openMoveRequests: 4,
        riskStatus: 'at-risk',
        confidence: 0.88,
      },
      fetchedAt: '2024-03-08T15:00:00.000Z',
      source: 'databricks-api',
    },
    isLoading: false,
  })),
}))

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

const request: ProductionStagingAdapterRequest = {
  plantId: 'IE10',
  warehouseId: 'WH-IE10-01',
  planDate: '2024-03-08',
}


describe('StagingReadinessSummaryPanel', () => {
  it('renders the panel container with correct data-testid', async () => {
    render(
      <Wrapper>
        <StagingReadinessSummaryPanel request={request} />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-staging-readiness-summary"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders the panel display name', async () => {
    render(
      <Wrapper>
        <StagingReadinessSummaryPanel request={request} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Staging Readiness')).toBeInTheDocument()
    })
  })

  it('renders the risk status after data loads', async () => {
    render(
      <Wrapper>
        <StagingReadinessSummaryPanel request={request} />
      </Wrapper>
    )

    // Mock data has riskStatus: 'at-risk'
    await waitFor(() => {
      const status = screen.queryByText(/at.risk/i)
      expect(status).not.toBeNull()
    })
  })

  it('renders the percent ready after data loads', async () => {
    render(
      <Wrapper>
        <StagingReadinessSummaryPanel request={request} />
      </Wrapper>
    )

    // Mock data has percentReady: 66.7, rendered as Math.round(66.7) = 67
    await waitFor(() => {
      const pct = screen.queryByText(/67/)
      expect(pct).not.toBeNull()
    })
  })
})
