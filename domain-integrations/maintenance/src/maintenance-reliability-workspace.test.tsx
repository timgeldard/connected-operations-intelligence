import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MaintenanceReliabilityWorkspace } from './maintenance-reliability-workspace.js'
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

const scope: ScopeContext = { plantId: 'IE10' }

describe('MaintenanceReliabilityWorkspace', () => {
  it('renders without crashing', () => {
    render(
      <Wrapper>
        <MaintenanceReliabilityWorkspace scope={scope} />
      </Wrapper>
    )
  })

  it('renders overview view panels', async () => {
    render(
      <Wrapper>
        <MaintenanceReliabilityWorkspace scope={scope} viewId="overview" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-maintenance-kpi-summary"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders work-orders view', async () => {
    render(
      <Wrapper>
        <MaintenanceReliabilityWorkspace scope={scope} viewId="work-orders" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-open-work-orders"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders preventive-maintenance view', async () => {
    render(
      <Wrapper>
        <MaintenanceReliabilityWorkspace scope={scope} viewId="preventive-maintenance" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-preventive-maintenance-schedule"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders equipment-availability view', async () => {
    render(
      <Wrapper>
        <MaintenanceReliabilityWorkspace scope={scope} viewId="equipment-availability" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-equipment-availability"]')
      expect(panel).not.toBeNull()
    })
  })

  it('falls back to overview for unknown viewId', async () => {
    render(
      <Wrapper>
        <MaintenanceReliabilityWorkspace scope={scope} viewId="not-a-view" />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-maintenance-kpi-summary"]')
      expect(panel).not.toBeNull()
    })
  })
})
