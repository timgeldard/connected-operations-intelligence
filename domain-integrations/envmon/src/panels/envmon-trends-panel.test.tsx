// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
expect.extend(matchers)
import '@testing-library/jest-dom/vitest'

import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EnvMonTrendsPanel } from './envmon-trends-panel.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
}

const request: EnvMonAdapterRequest = {
  regionId: 'EU-WEST',
  plantId: 'IE10',
}

describe('EnvMonTrendsPanel', () => {
  it('renders without crashing', () => {
    render(<Wrapper><EnvMonTrendsPanel request={request} /></Wrapper>)
  })

  it('renders the panel container with correct data-testid', async () => {
    render(<Wrapper><EnvMonTrendsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="evidence-panel-envmon-trends"]')).not.toBeNull()
    })
  })

  it('renders the panel display name', async () => {
    render(<Wrapper><EnvMonTrendsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Environmental Trends')).toBeInTheDocument()
    })
  })

  it('renders the bar chart SVG after data loads', async () => {
    render(<Wrapper><EnvMonTrendsPanel request={request} /></Wrapper>)
    // TrendBarsChart renders an SVG with height 90
    await waitFor(() => {
      const svg = document.querySelector('svg[height="90"]')
      expect(svg).not.toBeNull()
    })
  })

  it('renders the bar chart section label', async () => {
    render(<Wrapper><EnvMonTrendsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/Positive Rate/i)).toBeInTheDocument()
    })
  })

  it('renders the table column headers', async () => {
    render(<Wrapper><EnvMonTrendsPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Date')).toBeInTheDocument()
      expect(screen.getByText('Samples')).toBeInTheDocument()
      expect(screen.getByText('Positives')).toBeInTheDocument()
    })
  })

  it('renders bar rect elements for each trend row', async () => {
    render(<Wrapper><EnvMonTrendsPanel request={request} /></Wrapper>)
    // Mock data has 7 trend rows
    await waitFor(() => {
      const bars = document.querySelectorAll('svg rect')
      expect(bars.length).toBeGreaterThanOrEqual(7)
    })
  })

  it('renders table rows for each trend entry', async () => {
    render(<Wrapper><EnvMonTrendsPanel request={request} /></Wrapper>)
    // Mock data row 4 has complianceRate: 90 → renders as "90%"
    // Chart y-axis shows 0%, 9%, 18% (based on maxRate) — "90%" only from the table
    await waitFor(() => {
      expect(screen.getByText('90%')).toBeInTheDocument()
    })
  })
})
