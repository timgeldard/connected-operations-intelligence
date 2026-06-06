import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProductionStagingWorkspace } from './production-staging-workspace.js'
import type { ScopeContext } from '@connectio/data-contracts'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  })
}

const testScope: ScopeContext = {
  plantId: 'IE10',
  warehouseId: 'WH-IE10-01',
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

describe('ProductionStagingWorkspace', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <Wrapper>
        <ProductionStagingWorkspace scope={testScope} />
      </Wrapper>
    )
    expect(container.firstChild).not.toBeNull()
  })

  it('renders the workspace display name', async () => {
    render(
      <Wrapper>
        <ProductionStagingWorkspace scope={testScope} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.queryByText('Production Staging')).not.toBeNull()
    })
  })

  it('renders the staging-overview view by default', async () => {
    render(
      <Wrapper>
        <ProductionStagingWorkspace scope={testScope} planDate="2024-03-08" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-staging-readiness-summary"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders the shortfalls view when viewId is shortfalls', async () => {
    render(
      <Wrapper>
        <ProductionStagingWorkspace scope={testScope} viewId="shortfalls" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-staging-shortfalls"]')
      expect(panel).not.toBeNull()
    })
  })

  it('falls back to staging-overview for unknown viewId', async () => {
    render(
      <Wrapper>
        <ProductionStagingWorkspace scope={testScope} viewId="nonexistent-view" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-staging-readiness-summary"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders the actions sidebar', async () => {
    render(
      <Wrapper>
        <ProductionStagingWorkspace scope={testScope} />
      </Wrapper>
    )

    await waitFor(() => {
      const sidebar = screen.queryByLabelText('Production staging actions')
      expect(sidebar).not.toBeNull()
    })
  })

  it('renders without planDate prop', () => {
    const { container } = render(
      <Wrapper>
        <ProductionStagingWorkspace scope={testScope} />
      </Wrapper>
    )
    expect(container.firstChild).not.toBeNull()
  })
})
