/**
 * Panel tests for ConnectedQualityLabBoardPanel — governed Databricks API path.
 *
 * The panel uses the ConnectedQualityLabDatabricksAdapter singleton; tests mock
 * globalThis.fetch to simulate the /api/cq/lab/fails endpoint response.
 * No mock-data or legacy-api adapter remains — only the governed path exists.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectedQualityLabBoardPanel } from './connected-quality-lab-board-panel.js'
import type { ConnectedQualityLabAdapterRequest } from '../adapters/connected-quality-lab-databricks-adapter.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
}

const request: ConnectedQualityLabAdapterRequest = { plantId: 'C061' }

/** Minimal FailSpec record for test payloads. */
const makeFailure = (overrides: Record<string, unknown> = {}) => ({
  mat: 'Whey Protein Concentrate',
  matNo: '100001',
  lot: '1000000001',
  batch: 'B20260601',
  line: 'LINE-01',
  char: 'MOISTURE',
  text: 'Moisture Content',
  res: 6.5,
  lo: 3.0,
  hi: 5.0,
  units: '%',
  sev: 'fail',
  ts: '2026-06-12',
  lotType: '89',
  ...overrides,
})

/** Stub fetch to return a successful /api/cq/lab/fails response with given failures. */
function stubFetchFails(fails: ReturnType<typeof makeFailure>[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        fails,
        dataAvailable: true,
      }),
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── Rendering and UX ──────────────────────────────────────────────────────────

describe('ConnectedQualityLabBoardPanel', () => {
  it('renders the panel container', async () => {
    stubFetchFails([])
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="evidence-panel-connected-quality-lab-board"]'),
      ).not.toBeNull()
    })
  })

  it('renders the panel display name', async () => {
    stubFetchFails([])
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Lab Board')).toBeInTheDocument()
    })
  })

  it('renders lot type filter buttons', async () => {
    stubFetchFails([])
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('FP (89)')).toBeInTheDocument()
      expect(screen.getByText('RM (04)')).toBeInTheDocument()
    })
  })

  it('renders ConnectedQuality Lab Board header', async () => {
    stubFetchFails([])
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/ConnectedQuality · Lab Board/i)).toBeInTheDocument()
    })
  })

  it('shows plant context in board header when plantId is provided', async () => {
    stubFetchFails([])
    render(<Wrapper><ConnectedQualityLabBoardPanel request={{ plantId: 'C061' }} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Plant: C061')).toBeInTheDocument()
    })
  })

  it('renders legend with Outside spec and Warning threshold labels', async () => {
    stubFetchFails([])
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Outside spec')).toBeInTheDocument()
      expect(screen.getByText('Warning threshold')).toBeInTheDocument()
    })
  })

  it('renders failure count from API response', async () => {
    const failures = Array.from({ length: 3 }, (_, i) =>
      makeFailure({ lot: `100000000${i}`, char: `CHAR_${i}` }),
    )
    stubFetchFails(failures)
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/3 failures/i)).toBeInTheDocument()
    })
  })

  it('renders a material name from API response', async () => {
    stubFetchFails([makeFailure({ mat: 'Kerry Whey Protein', matNo: '200001' })])
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Kerry Whey Protein')).toBeInTheDocument()
    })
  })

  it('renders pagination controls when more than 6 failures', async () => {
    const failures = Array.from({ length: 8 }, (_, i) =>
      makeFailure({ lot: `100000000${i}`, char: `CHAR_${i}` }),
    )
    stubFetchFails(failures)
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/← Prev/)).toBeInTheDocument()
      expect(screen.getByText(/Next →/)).toBeInTheDocument()
    })
  })

  it('shows page indicator for multi-page results', async () => {
    const failures = Array.from({ length: 8 }, (_, i) =>
      makeFailure({ lot: `100000000${i}`, char: `CHAR_${i}` }),
    )
    stubFetchFails(failures)
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/Page 1\/2/)).toBeInTheDocument()
    })
  })

  it('shows Auto-rotates in page indicator when multiple pages', async () => {
    const failures = Array.from({ length: 8 }, (_, i) =>
      makeFailure({ lot: `100000000${i}`, char: `CHAR_${i}` }),
    )
    stubFetchFails(failures)
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/Auto-rotates/)).toBeInTheDocument()
    })
  })

  it('shows empty state when no failures', async () => {
    stubFetchFails([])
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('No failures or warnings.')).toBeInTheDocument()
    })
  })

  it('renders FAIL badge for fail severity records', async () => {
    stubFetchFails([makeFailure({ sev: 'fail' })])
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      const badges = screen.getAllByText('FAIL')
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  it('renders WARN badge for warn severity records', async () => {
    stubFetchFails([makeFailure({ sev: 'warn', res: 4.8, lo: 3.0, hi: 5.0 })])
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      const badges = screen.getAllByText('WARN')
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  it('does not render "Live" text in any form', async () => {
    stubFetchFails([])
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.queryByText(/live/i)).toBeNull()
    })
  })

  it('shows "SAP QM via governed gold" source label when databricks-api response received', async () => {
    stubFetchFails([makeFailure()])
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('SAP QM via governed gold')).toBeInTheDocument()
    })
  })

  it('filters failures by lot type on button click', async () => {
    const failures = [
      makeFailure({ lotType: '89', lot: '1001', char: 'CHAR_FP' }),
      makeFailure({ lotType: '04', lot: '1002', char: 'CHAR_RM' }),
    ]
    // Stub to return FP-only on the filtered request
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ fails: failures, dataAvailable: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            fails: failures.filter((f) => f.lotType === '89'),
            dataAvailable: true,
          }),
        }),
    )
    const user = userEvent.setup()
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => expect(screen.getByText('FP (89)')).toBeInTheDocument())
    await user.click(screen.getByText('FP (89)'))
    await waitFor(() => {
      // After FP filter: only 1 failure returned
      expect(screen.getByText(/1 failure/i)).toBeInTheDocument()
    })
  })

  it('renders error state when API returns non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }),
    )
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    // Panel should eventually show error state (not crash); EvidencePanel handles display.
    await waitFor(() => {
      // Error state: panel container still renders
      expect(
        document.querySelector('[data-testid="evidence-panel-connected-quality-lab-board"]'),
      ).not.toBeNull()
    })
  })
})
