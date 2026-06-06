import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OperationsPlanRiskWorkspace } from './operations-plan-risk-workspace.js'
import type { ScopeContext } from '@connectio/data-contracts'

/**
 * Creates a QueryClient configured for testing (no retries).
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  })
}

/**
 * Minimal scope for test renders.
 */
const testScope: ScopeContext = {
  plantId: 'IE10',
}

/**
 * Wraps children in a QueryClientProvider for hook-based components.
 */
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

describe('OperationsPlanRiskWorkspace', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <Wrapper>
        <OperationsPlanRiskWorkspace scope={testScope} />
      </Wrapper>
    )
    expect(container.firstChild).not.toBeNull()
  })

  it('renders the workspace display name', async () => {
    render(
      <Wrapper>
        <OperationsPlanRiskWorkspace scope={testScope} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.queryByText('Operations Plan Risk')).not.toBeNull()
    })
  })

  it('renders the plan-overview view by default', async () => {
    render(
      <Wrapper>
        <OperationsPlanRiskWorkspace
          scope={testScope}
          planDate="2024-03-08"
        />
      </Wrapper>
    )

    // The plan-overview view should contain a panel with the plan-risk-summary panelId
    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-plan-risk-summary"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders the late-orders panel in the plan-overview view', async () => {
    render(
      <Wrapper>
        <OperationsPlanRiskWorkspace
          scope={testScope}
          planDate="2024-03-08"
        />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-late-orders"]')
      expect(panel).not.toBeNull()
    })
  })

  it('falls back to plan-overview view for unknown viewId', async () => {
    render(
      <Wrapper>
        <OperationsPlanRiskWorkspace
          scope={testScope}
          planDate="2024-03-08"
          viewId="nonexistent-view"
        />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-plan-risk-summary"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders the actions sidebar', async () => {
    render(
      <Wrapper>
        <OperationsPlanRiskWorkspace scope={testScope} />
      </Wrapper>
    )

    await waitFor(() => {
      const sidebar = screen.queryByLabelText('Operations plan risk actions')
      expect(sidebar).not.toBeNull()
    })
  })

  it('uses the default planDate when none is provided', async () => {
    // Smoke: renders without requiring planDate prop
    const { container } = render(
      <Wrapper>
        <OperationsPlanRiskWorkspace scope={testScope} />
      </Wrapper>
    )
    expect(container.firstChild).not.toBeNull()
  })
})
