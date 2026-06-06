// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ScopeContext } from '@connectio/data-contracts'
import { TraceInvestigationWorkspace } from './trace-investigation-workspace.js'
import '@testing-library/jest-dom'

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

const scope: ScopeContext = {
  plantId: 'IE10',
  materialId: '100023847',
  batchId: 'CH-240308-0047',
}

describe('TraceInvestigationWorkspace', () => {
  it('renders without crashing', () => {
    render(
      <Wrapper>
        <TraceInvestigationWorkspace scope={scope} />
      </Wrapper>,
    )
  })

  it('renders trace-tree view', async () => {
    render(
      <Wrapper>
        <TraceInvestigationWorkspace scope={scope} viewId="trace-tree" />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('trace-query-form')).toBeInTheDocument()
    })
  })

  it('renders the Trace assistant pilot view and its evidence after submit', async () => {
    render(
      <Wrapper>
        <TraceInvestigationWorkspace scope={scope} viewId="trace-genie-pilot" />
      </Wrapper>,
    )

    fireEvent.click(screen.getByTestId('btn-run-trace'))

    await waitFor(() => {
      const assistantPanel = document.querySelector('[data-testid="evidence-panel-trace-genie-pilot"]')
      const graphPanel = document.querySelector('[data-testid="evidence-panel-trace-graph"]')
      const batchHeaderPanel = document.querySelector('[data-testid="evidence-panel-batch-header"]')
      expect(assistantPanel).not.toBeNull()
      expect(graphPanel).not.toBeNull()
      expect(batchHeaderPanel).not.toBeNull()
    })
  })

  it('falls back to overview for unknown viewId', async () => {
    render(
      <Wrapper>
        <TraceInvestigationWorkspace scope={scope} viewId="not-a-view" />
      </Wrapper>,
    )

    await waitFor(() => {
      const batchHeaderPanel = document.querySelector('[data-testid="evidence-panel-batch-header"]')
      expect(batchHeaderPanel).not.toBeNull()
    })
  })
})
