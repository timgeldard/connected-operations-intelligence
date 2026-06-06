import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BatchReleaseWorkspace } from './batch-release-workspace.js'
import type { ScopeContext } from '@connectio/data-contracts'

/**
 * Creates a QueryClient configured for testing (no retries).
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  })
}

/**
 * Minimal scope for test renders.
 */
const testScope: ScopeContext = {
  plantId: 'IE10',
  batchId: 'CH-240308-0047',
}

/**
 * Wraps children in a QueryClientProvider for hook-based components.
 */
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

describe('BatchReleaseWorkspace', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <Wrapper>
        <BatchReleaseWorkspace scope={testScope} />
      </Wrapper>
    )
    expect(container.firstChild).not.toBeNull()
  })

  it('renders the workspace display name', async () => {
    render(
      <Wrapper>
        <BatchReleaseWorkspace scope={testScope} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.queryByText('Quality Batch Release')).not.toBeNull()
    })
  })

  it('renders the release-queue view by default', async () => {
    render(
      <Wrapper>
        <BatchReleaseWorkspace
          scope={testScope}
          releaseCaseId="RC-2024-001847"
        />
      </Wrapper>
    )

    // The release queue view should contain a panel with the queue panelId
    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-release-queue"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders the batch-decision view when viewId is batch-decision', async () => {
    render(
      <Wrapper>
        <BatchReleaseWorkspace
          scope={testScope}
          releaseCaseId="RC-2024-001847"
          viewId="batch-decision"
        />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-batch-release-summary"]')
      expect(panel).not.toBeNull()
    })
  })

  it('falls back to release-queue view for unknown viewId', async () => {
    render(
      <Wrapper>
        <BatchReleaseWorkspace
          scope={testScope}
          releaseCaseId="RC-2024-001847"
          viewId="nonexistent-view"
        />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-release-queue"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders the actions sidebar', async () => {
    render(
      <Wrapper>
        <BatchReleaseWorkspace scope={testScope} />
      </Wrapper>
    )

    await waitFor(() => {
      const sidebar = screen.queryByLabelText('Batch release actions')
      expect(sidebar).not.toBeNull()
    })
  })

  it('uses the default release case ID when none is provided', async () => {
    // Smoke: renders without requiring releaseCaseId prop
    const { container } = render(
      <Wrapper>
        <BatchReleaseWorkspace scope={testScope} />
      </Wrapper>
    )
    expect(container.firstChild).not.toBeNull()
  })
})
