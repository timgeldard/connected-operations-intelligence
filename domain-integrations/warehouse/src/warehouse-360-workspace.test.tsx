// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import { Warehouse360Workspace } from './warehouse-360-workspace.js'
import type { ScopeContext } from '@connectio/data-contracts'

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

const scope: ScopeContext = { plantId: 'IE10', warehouseId: 'WH-IE10-MAIN' }

describe('Warehouse360Workspace', () => {
  it('renders without crashing', () => {
    render(
      <Wrapper>
        <Warehouse360Workspace scope={scope} />
      </Wrapper>
    )
  })

  it('renders warehouse-overview view panels', async () => {
    render(
      <Wrapper>
        <Warehouse360Workspace scope={scope} viewId="warehouse-overview" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-warehouse-360-summary"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders stock-status view', async () => {
    render(
      <Wrapper>
        <Warehouse360Workspace scope={scope} viewId="stock-status" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-stock-overview"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders holds-management view', async () => {
    render(
      <Wrapper>
        <Warehouse360Workspace scope={scope} viewId="holds-management" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-open-holds"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders replenishment view', async () => {
    render(
      <Wrapper>
        <Warehouse360Workspace scope={scope} viewId="replenishment" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-replenishment-needs"]')
      expect(panel).not.toBeNull()
    })
  })

  it('falls back to warehouse-cockpit for unknown viewId', async () => {
    render(
      <Wrapper>
        <Warehouse360Workspace scope={scope} viewId="not-a-view" />
      </Wrapper>
    )

    await waitFor(() => {
      expect(document.body.innerHTML).toContain('Warehouse360 Cockpit (Native)')
    })
  })
})
