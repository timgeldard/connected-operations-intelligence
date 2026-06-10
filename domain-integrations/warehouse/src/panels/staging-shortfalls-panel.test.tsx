import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StagingShortfallsPanel } from './staging-shortfalls-panel.js'
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
          {
            plantId: 'IE10',
            materialId: 'MAT-RM-RENNET',
            shortfallQty: 75,
            openItemsCount: 1,
            oldestTrDate: '2026-05-13T08:00:00.000Z',
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

describe('StagingShortfallsPanel', () => {
  it('renders the panel container', async () => {
    render(<Wrapper><StagingShortfallsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="evidence-panel-staging-shortfalls"]')).not.toBeNull()
    })
  })

  it('renders the panel display name', async () => {
    render(<Wrapper><StagingShortfallsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Material Shortfalls')).toBeInTheDocument()
    })
  })

  it('falls back to the material ID when the description is a data gap', async () => {
    render(<Wrapper><StagingShortfallsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('MAT-PACK-FILM-12U')).toBeInTheDocument()
      expect(screen.getByText('MAT-RM-RENNET')).toBeInTheDocument()
    })
  })

  it('hides order linkage entirely while it is a documented data gap', async () => {
    // affectedOrders is undefined on the governed shortfalls dataset (order linkage deferred):
    // the panel must not render order chips or an "Orders: N" count it cannot back with data.
    const onProcessOrderClick = vi.fn()
    render(
      <Wrapper>
        <StagingShortfallsPanel request={request} onProcessOrderClick={onProcessOrderClick} />
      </Wrapper>
    )
    await waitFor(() => {
      expect(screen.getByText('MAT-PACK-FILM-12U')).toBeInTheDocument()
    })
    expect(screen.queryByText(/^Orders:/)).toBeNull()
    expect(screen.queryByRole('button', { name: /PO-/ })).toBeNull()
  })

  it('does not show the empty state when shortfalls exist', async () => {
    render(<Wrapper><StagingShortfallsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('MAT-PACK-FILM-12U')).toBeInTheDocument()
    })
    expect(screen.queryByText('No material shortfalls')).toBeNull()
  })
})
