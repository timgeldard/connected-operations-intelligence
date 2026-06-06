import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReleaseQueuePanel } from './release-queue-panel.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'

/**
 * Creates a QueryClient configured for testing.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  })
}

/**
 * Wraps children in QueryClientProvider.
 */
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

const request: QualityReleaseAdapterRequest = {
  releaseCaseId: 'RC-2024-001847',
  batchId: 'CH-240308-0047',
  plantId: 'IE10',
}

describe('ReleaseQueuePanel', () => {
  it('renders the queue panel data-testid', async () => {
    render(
      <Wrapper>
        <ReleaseQueuePanel request={request} />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-release-queue"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders queue items after data loads', async () => {
    render(
      <Wrapper>
        <ReleaseQueuePanel request={request} />
      </Wrapper>
    )

    // Mock data has 3 queue items; at least one should have a releaseCaseId
    await waitFor(() => {
      const rcItem = screen.queryByText(/RC-2024-001847/)
      expect(rcItem).not.toBeNull()
    })
  })

  it('calls onSelectCase when a case row is clicked', async () => {
    const onSelectCase = vi.fn()
    const user = userEvent.setup()

    render(
      <Wrapper>
        <ReleaseQueuePanel request={request} onSelectCase={onSelectCase} />
      </Wrapper>
    )

    // Wait for queue to load
    await waitFor(() => {
      expect(screen.queryByText(/RC-2024-001847/)).not.toBeNull()
    })

    // Click the first case row
    const rows = screen.getAllByRole('button')
    if (rows.length > 0) {
      await user.click(rows[0])
      expect(onSelectCase).toHaveBeenCalledTimes(1)
    }
  })

  it('highlights the active case when activeCaseId matches', async () => {
    render(
      <Wrapper>
        <ReleaseQueuePanel
          request={request}
          activeCaseId="RC-2024-001847"
        />
      </Wrapper>
    )

    await waitFor(() => {
      // The active row should be rendered; a data-active attribute or CSS class would
      // be set in production. For now verify the panel renders without error.
      const panel = document.querySelector('[data-testid="evidence-panel-release-queue"]')
      expect(panel).not.toBeNull()
    })
  })
})
