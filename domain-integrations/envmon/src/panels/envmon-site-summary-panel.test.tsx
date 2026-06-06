// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
expect.extend(matchers)
import '@testing-library/jest-dom/vitest'

import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EnvMonSiteSummaryPanel } from './envmon-site-summary-panel.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

const request: EnvMonAdapterRequest = {
  regionId: 'EU-WEST',
  plantId: 'IE10',
}

describe('EnvMonSiteSummaryPanel', () => {
  it('renders the panel container with correct data-testid', async () => {
    render(
      <Wrapper>
        <EnvMonSiteSummaryPanel request={request} />
      </Wrapper>
    )

    await waitFor(() => {
      const panel = document.querySelector('[data-testid="evidence-panel-envmon-site-summary"]')
      expect(panel).not.toBeNull()
    })
  })

  it('renders the panel display name', async () => {
    render(
      <Wrapper>
        <EnvMonSiteSummaryPanel request={request} />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Site Environmental Summary')).toBeInTheDocument()
    })
  })

  it('renders the risk status after data loads', async () => {
    render(
      <Wrapper>
        <EnvMonSiteSummaryPanel request={request} />
      </Wrapper>
    )

    // Mock data has riskStatus: 'elevated'
    await waitFor(() => {
      const status = screen.queryByText(/elevated/i)
      expect(status).not.toBeNull()
    })
  })

  it('renders the compliance rate after data loads', async () => {
    render(
      <Wrapper>
        <EnvMonSiteSummaryPanel request={request} />
      </Wrapper>
    )

    // Mock data has complianceRate: 97.5, rendered as Math.round(97.5) = 98
    await waitFor(() => {
      const rate = screen.queryByText(/98/)
      expect(rate).not.toBeNull()
    })
  })
})
