import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReleaseSummaryPanel } from './release-summary-panel.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'
import { useReleaseSummary } from '../adapters/quality-release-queries.js'

// Mock runtime dependencies
vi.mock('@connectio/evidence-panel-runtime', () => ({
  EvidencePanel: ({ children, registration }: { children?: React.ReactNode; registration: { panelId: string; displayName: string } }) => (
    <div data-testid={`evidence-panel-${registration.panelId}`}>
      <h3>{registration.displayName}</h3>
      {children}
    </div>
  ),
  useEvidencePanel: () => ({ displayState: 'ready', markReady: vi.fn(), markError: vi.fn() }),
}))

vi.mock('@xyflow/react', () => ({}))

vi.mock('../adapters/quality-release-queries.js', () => ({
  useReleaseSummary: vi.fn(),
}))

const request: QualityReleaseAdapterRequest = {
  releaseCaseId: 'RC-2024-001847',
  batchId: 'CH-240308-0047',
  plantId: 'IE10',
}

describe('ReleaseSummaryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the panel title', () => {
    vi.mocked(useReleaseSummary).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          overallReadiness: 'blocked',
          recommendedAction: 'reject',
          qualityPassed: true,
          spcClean: true,
          coaComplete: true,
          noOpenHolds: false,
          deviationsResolved: true,
          traceClean: true,
          blockers: ['Active quality hold in place.'],
          warnings: [],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useReleaseSummary>)

    render(<ReleaseSummaryPanel request={request} />)

    expect(screen.getByText('Release Summary')).toBeDefined()
  })

  it('renders readiness status after data loads', () => {
    vi.mocked(useReleaseSummary).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          overallReadiness: 'blocked',
          recommendedAction: 'reject',
          qualityPassed: true,
          spcClean: true,
          coaComplete: true,
          noOpenHolds: false,
          deviationsResolved: true,
          traceClean: true,
          blockers: ['Active quality hold in place.'],
          warnings: [],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useReleaseSummary>)

    render(<ReleaseSummaryPanel request={request} />)

    expect(screen.queryByText(/blocked/i)).not.toBeNull()
  })

  it('renders recommended action', () => {
    vi.mocked(useReleaseSummary).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          overallReadiness: 'blocked',
          recommendedAction: 'reject',
          qualityPassed: true,
          spcClean: true,
          coaComplete: true,
          noOpenHolds: false,
          deviationsResolved: true,
          traceClean: true,
          blockers: ['Active quality hold in place.'],
          warnings: [],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useReleaseSummary>)

    render(<ReleaseSummaryPanel request={request} />)

    expect(screen.queryByText(/reject/i)).not.toBeNull()
  })

  it('toggles notes and advisories visibility when Hide/Show button is clicked', () => {
    vi.mocked(useReleaseSummary).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          overallReadiness: 'ready',
          recommendedAction: 'release',
          qualityPassed: true,
          spcClean: true,
          coaComplete: true,
          noOpenHolds: true,
          deviationsResolved: true,
          traceClean: true,
          blockers: [],
          warnings: [],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useReleaseSummary>)

    render(<ReleaseSummaryPanel request={request} />)

    // Initially advisory text is visible and the button shows 'Hide'
    expect(screen.queryByText(/Recommended actions are system-generated/i)).not.toBeNull()
    const toggleBtn = screen.getByRole('button', { name: 'Hide' })

    // Click Hide to collapse advisories
    fireEvent.click(toggleBtn)
    expect(screen.queryByText(/Recommended actions are system-generated/i)).toBeNull()
    expect(screen.getByRole('button', { name: 'Show' })).toBeDefined()

    // Click Show to restore advisories
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.queryByText(/Recommended actions are system-generated/i)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Hide' })).toBeDefined()
  })
})
