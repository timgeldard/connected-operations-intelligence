// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProcessOrderReviewWorkspace } from './process-order-review-workspace.js'
import type { ScopeContext } from '@connectio/data-contracts'
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

const scope: ScopeContext = { plantId: 'IE10', processOrderId: 'PO-240308-3847' }

describe('ProcessOrderReviewWorkspace', () => {
  it('renders without crashing', () => {
    render(
      <Wrapper>
        <ProcessOrderReviewWorkspace scope={scope} />
      </Wrapper>
    )
  })

  it('renders order-history view', async () => {
    render(
      <Wrapper>
        <ProcessOrderReviewWorkspace scope={scope} viewId="order-history" />
      </Wrapper>
    )

    await waitFor(() => {
      const form = document.querySelector('[data-testid="poh-query-form"]')
      expect(form).not.toBeNull()
    })
  })

  it('renders order-overview view panels', async () => {
    render(
      <Wrapper>
        <ProcessOrderReviewWorkspace scope={scope} viewId="order-overview" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-process-order-header"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders execution-timeline view', async () => {
    render(
      <Wrapper>
        <ProcessOrderReviewWorkspace scope={scope} viewId="execution-timeline" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-execution-timeline"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders the POH assistant pilot view', async () => {
    render(
      <Wrapper>
        <ProcessOrderReviewWorkspace scope={scope} viewId="poh-genie-pilot" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-poh-genie-pilot"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders quality-context view', async () => {
    render(
      <Wrapper>
        <ProcessOrderReviewWorkspace scope={scope} viewId="quality-context" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-order-quality-context"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders staging-context view', async () => {
    render(
      <Wrapper>
        <ProcessOrderReviewWorkspace scope={scope} viewId="staging-context" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-order-staging-context"]')
      expect(panel).not.toBeNull()
    })
  })

  it('falls back to order-history for unknown viewId', async () => {
    render(
      <Wrapper>
        <ProcessOrderReviewWorkspace scope={scope} viewId="not-a-view" />
      </Wrapper>
    )

    await waitFor(() => {
      const form = document.querySelector('[data-testid="poh-query-form"]')
      expect(form).not.toBeNull()
    })
  })
})
