import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
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

// Alerts are synthesized in the adapter from the live governed datasets:
// shortfalls -> 'shortfall' alerts, blocked staging orders -> 'blocked-order' alerts.
beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/api/warehouse360/shortfalls')) {
      return {
        ok: true,
        json: async () => [
          {
            plantId: 'IE10',
            materialId: 'MAT-PACK-FILM-12U',
            shortfallQty: 120,
            openItemsCount: 2,
            oldestTrDate: '2026-05-12T08:00:00.000Z',
          },
        ],
      } as Response
    }
    if (url.includes('/api/warehouse360/staging')) {
      return {
        ok: true,
        json: async () => [
          {
            processOrderId: '000700123456',
            materialId: 'MAT-CHIP-VAR-001',
            requiredQuantity: 10,
            stagedQuantity: 0,
            openQuantity: 10,
            stagingStatus: 'blocked',
            unitOfMeasure: 'KG',
            requirementDate: '2026-05-14',
          },
        ],
      } as Response
    }
    return { ok: true, json: async () => [] } as Response
  }))
})

afterAll(() => {
  vi.unstubAllGlobals()
})

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

  it('renders a shortfall alert synthesized from the governed shortfalls dataset', async () => {
    render(<Wrapper><StagingAlertsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/shortfall of 120 for MAT-PACK-FILM-12U/i)).toBeInTheDocument()
    })
  })

  it('renders the blocked-order alert description', async () => {
    render(<Wrapper><StagingAlertsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/Staging blocked for process order 000700123456/i)).toBeInTheDocument()
    })
  })

  it('does not show "View WH360 Holds" button when no callback provided', async () => {
    render(<Wrapper><StagingAlertsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/Staging blocked for process order/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /View WH360 Holds/i })).toBeNull()
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

  it('does not show the empty state while live alerts exist', async () => {
    render(<Wrapper><StagingAlertsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/shortfall of 120/i)).toBeInTheDocument()
    })
    expect(screen.queryByText('No active staging alerts')).toBeNull()
  })
})
