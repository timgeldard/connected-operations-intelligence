import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlanRiskSummaryPanel } from './plan-risk-summary-panel.js'
import type { OperationsPlanRiskAdapterRequest } from '../adapters/operations-plan-risk-adapter.js'

/**
 * Creates a QueryClient configured for testing (no retries, instant stale time).
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  })
}

/**
 * Wraps children in QueryClientProvider for hook-based components.
 */
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

const request: OperationsPlanRiskAdapterRequest = {
  plantId: 'IE10',
  planDate: '2024-03-08',
}

describe('PlanRiskSummaryPanel', () => {
  it('renders the panel container with correct data-testid', async () => {
    render(
      <Wrapper>
        <PlanRiskSummaryPanel request={request} />
      </Wrapper>
    )

    // The EvidencePanel wrapper renders data-testid="evidence-panel-plan-risk-summary"
    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-plan-risk-summary"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders the panel title', async () => {
    render(
      <Wrapper>
        <PlanRiskSummaryPanel request={request} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Plan Risk Summary')).toBeInTheDocument()
    })
  })

  it('renders the highest severity after data loads', async () => {
    render(
      <Wrapper>
        <PlanRiskSummaryPanel request={request} />
      </Wrapper>
    )

    // Mock data has highestSeverity: 'high'
    await waitFor(() => {
      const severity = screen.queryByText(/high/i)
      expect(severity).not.toBeNull()
    })
  })

  it('renders the recommended action after data loads', async () => {
    render(
      <Wrapper>
        <PlanRiskSummaryPanel request={request} />
      </Wrapper>
    )

    // Mock data has recommendedAction containing 'Escalate'
    await waitFor(() => {
      const action = screen.queryByText(/Escalate/i)
      expect(action).not.toBeNull()
    })
  })
})
