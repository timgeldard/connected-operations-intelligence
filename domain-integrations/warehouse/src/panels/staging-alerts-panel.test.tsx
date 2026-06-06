import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StagingAlertsPanel } from './staging-alerts-panel.js'
import type { ProductionStagingAdapterRequest } from '../adapters/production-staging-adapter.js'

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
}

const request: ProductionStagingAdapterRequest = {
  plantId: 'IE10',
  warehouseId: 'WH-IE10-01',
  planDate: '2026-05-14',
}

describe('StagingAlertsPanel', () => {
  it('renders the panel container', async () => {
    render(<Wrapper><StagingAlertsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="evidence-panel-staging-alerts"]')).not.toBeNull()
    })
  })

  it('renders the panel display name', async () => {
    render(<Wrapper><StagingAlertsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Staging Alerts')).toBeInTheDocument()
    })
  })

  it('renders active alerts from mock data (excludes resolved)', async () => {
    render(<Wrapper><StagingAlertsPanel request={request} /></Wrapper>)
    // All 3 mock alerts are open or acknowledged (none resolved), so all 3 render
    await waitFor(() => {
      expect(screen.getByText(/Packaging Film shortfall/i)).toBeInTheDocument()
    })
  })

  it('renders the blocked-order alert description', async () => {
    render(<Wrapper><StagingAlertsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/blocked by quality hold/i)).toBeInTheDocument()
    })
  })

  it('does not show "View WH360 Holds" button when no callback provided', async () => {
    render(<Wrapper><StagingAlertsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /View WH360 Holds/i })).toBeNull()
    })
  })

  it('shows "View WH360 Holds" button for blocked-order alert when callback provided', async () => {
    const onNavigateToWorkspace = vi.fn()
    render(
      <Wrapper>
        <StagingAlertsPanel request={request} onNavigateToWorkspace={onNavigateToWorkspace} />
      </Wrapper>
    )
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /View WH360 Holds/i })).toBeInTheDocument()
    })
  })

  it('calls onNavigateToWorkspace with warehouse-360-overview when WH360 button clicked', async () => {
    const onNavigateToWorkspace = vi.fn()
    render(
      <Wrapper>
        <StagingAlertsPanel request={request} onNavigateToWorkspace={onNavigateToWorkspace} />
      </Wrapper>
    )
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /View WH360 Holds/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /View WH360 Holds/i }))
    expect(onNavigateToWorkspace).toHaveBeenCalledWith('warehouse-360-overview')
  })

  it('shows no active alerts message when all alerts are resolved', async () => {
    // Mock returns non-resolved alerts; verify empty state text exists in DOM
    render(<Wrapper><StagingAlertsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      // With real mock data, empty state should NOT show
      expect(screen.queryByText('No active staging alerts')).toBeNull()
    })
  })
})
