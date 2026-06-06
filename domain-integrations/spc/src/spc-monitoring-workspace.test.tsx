/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SPCMonitoringWorkspace } from './spc-monitoring-workspace.js'
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

const scope: ScopeContext = { 
  plantId: 'IE10',
  workCentreId: 'WC-IE10-PASTEURISATION',
  materialId: 'MAT-12345'
}

describe('SPCMonitoringWorkspace', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders without crashing', () => {
    render(
      <Wrapper>
        <SPCMonitoringWorkspace scope={scope} />
      </Wrapper>
    )
  })

  it('renders chart-overview view panels', async () => {
    render(
      <Wrapper>
        <SPCMonitoringWorkspace scope={scope} viewId="chart-overview" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-spc-summary"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders active-signals view', async () => {
    render(
      <Wrapper>
        <SPCMonitoringWorkspace scope={scope} viewId="active-signals" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-active-spc-signals"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders characteristic-review view', async () => {
    render(
      <Wrapper>
        <SPCMonitoringWorkspace scope={scope} viewId="characteristic-review" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-control-chart"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders alarm-history view', async () => {
    render(
      <Wrapper>
        <SPCMonitoringWorkspace scope={scope} viewId="alarm-history" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-spc-alarm-history"]')
      expect(panel).not.toBeNull()
    })
  })

  it('falls back to chart-overview for unknown viewId', async () => {
    render(
      <Wrapper>
        <SPCMonitoringWorkspace scope={scope} viewId="not-a-view" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-spc-summary"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders UAT candidate not configured when materialId is missing', async () => {
    const incompleteScope: ScopeContext = {
      plantId: 'IE10',
      workCentreId: 'WC-IE10-PASTEURISATION',
    }
    render(
      <Wrapper>
        <SPCMonitoringWorkspace scope={incompleteScope} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(document.body.innerHTML).toContain('UAT Candidate Not Configured')
      const panel = document.querySelector('[data-testid="evidence-panel-spc-summary"]')
      expect(panel).toBeNull()
    })
  })
})
