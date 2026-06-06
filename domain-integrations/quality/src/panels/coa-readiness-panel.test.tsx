import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CoAReadinessPanel } from './coa-readiness-panel.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'
import { useCoAReadiness } from '../adapters/quality-release-queries.js'

// Mock runtime dependencies
vi.mock('@connectio/evidence-panel-runtime', () => ({
  EvidencePanel: ({ children }: { children?: React.ReactNode }) => <div data-testid="evidence-panel">{children}</div>,
  useEvidencePanel: () => ({ displayState: 'ready', markReady: vi.fn(), markError: vi.fn() }),
}))

vi.mock('@xyflow/react', () => ({}))

vi.mock('../adapters/quality-release-queries.js', () => ({
  useCoAReadiness: vi.fn(),
}))

const request: QualityReleaseAdapterRequest = {
  releaseCaseId: 'RC-2024-001847',
  batchId: 'CH-240308-0047',
  plantId: 'IE10',
}

describe('CoAReadinessPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "CoA document unavailable" when coaDocumentId is missing', () => {
    vi.mocked(useCoAReadiness).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          readinessStatus: 'incomplete',
          coaDocumentId: null, // missing ID
          signedOffBy: null,
          signedOffAt: null,
          missingFields: ['pH result'],
          customerSpecificCoas: [],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useCoAReadiness>)

    render(<CoAReadinessPanel request={request} />)

    expect(screen.queryByText('CoA document unavailable')).not.toBeNull()
    expect(screen.queryByText(/^incomplete$/i)).not.toBeNull()
  })

  it('renders document ID and signed-off details when present', () => {
    vi.mocked(useCoAReadiness).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          readinessStatus: 'complete',
          coaDocumentId: 'COA-998877',
          signedOffBy: 'Jane Manager',
          signedOffAt: '2026-05-19T10:00:00Z',
          missingFields: [],
          customerSpecificCoas: [],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useCoAReadiness>)

    render(<CoAReadinessPanel request={request} />)

    expect(screen.queryByText(/COA-998877/)).not.toBeNull()
    expect(screen.queryByText(/Jane Manager/)).not.toBeNull()
    expect(screen.queryByText(/^complete$/i)).not.toBeNull()
  })

  it('renders simulated mock disclaimer footnote', () => {
    vi.mocked(useCoAReadiness).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          readinessStatus: 'not-applicable',
          coaDocumentId: null,
          signedOffBy: null,
          signedOffAt: null,
          missingFields: [],
          customerSpecificCoas: [],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useCoAReadiness>)

    render(<CoAReadinessPanel request={request} />)

    expect(screen.queryByText(/This panel uses simulated mock data/i)).not.toBeNull()
  })

  it('toggles customer CoAs details visibility when Hide/Show button is clicked', () => {
    vi.mocked(useCoAReadiness).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          readinessStatus: 'complete',
          coaDocumentId: 'COA-998877',
          signedOffBy: 'Jane Manager',
          signedOffAt: '2026-05-19T10:00:00Z',
          missingFields: [],
          customerSpecificCoas: [
            { customerId: 'CUST-001', customerName: 'Acme Corp', status: 'complete' }
          ],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useCoAReadiness>)

    render(<CoAReadinessPanel request={request} />)

    // Initially, Acme Corp is visible and the button shows 'Hide'
    expect(screen.queryByText('Acme Corp')).not.toBeNull()
    const toggleBtn = screen.getByRole('button', { name: 'Hide' })

    // Click Hide to collapse details
    fireEvent.click(toggleBtn)
    expect(screen.queryByText('Acme Corp')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show' })).toBeDefined()

    // Click Show to restore details
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.queryByText('Acme Corp')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Hide' })).toBeDefined()
  })
})
