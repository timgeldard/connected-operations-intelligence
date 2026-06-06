// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
expect.extend(matchers)
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QualityResultsPanel } from './quality-results-panel.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'
import { useQualityResults } from '../adapters/quality-release-queries.js'

// Mock runtime dependencies
vi.mock('@connectio/evidence-panel-runtime', () => ({
  EvidencePanel: ({ children }: { children?: React.ReactNode }) => <div data-testid="evidence-panel">{children}</div>,
  useEvidencePanel: () => ({ displayState: 'ready', markReady: vi.fn(), markError: vi.fn() }),
}))

vi.mock('@xyflow/react', () => ({}))

vi.mock('../adapters/quality-release-queries.js', () => ({
  useQualityResults: vi.fn(),
}))

const request: QualityReleaseAdapterRequest = {
  releaseCaseId: 'RC-2024-001847',
  batchId: 'CH-240308-0047',
  plantId: 'IE10',
}

describe('QualityResultsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "Inspection lot not found" when inspectionLotId is missing', () => {
    vi.mocked(useQualityResults).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          overallStatus: 'unknown',
          inspectionLotId: null, // missing lot ID
          inspectionCompletedAt: null,
          inspectionCompletedBy: null,
          micStatus: 'not-applicable',
          chemicalStatus: 'not-applicable',
          physicalStatus: 'not-applicable',
          sensoryStatus: 'not-applicable',
          micFailures: [],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useQualityResults>)

    render(<QualityResultsPanel request={request} />)

    expect(screen.getByText('Inspection lot not found. No quality results available in SAP QM.')).toBeDefined()
  })

  it('renders "MIC Status is FAIL but no failure details were returned" on inconsistent state', () => {
    vi.mocked(useQualityResults).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          overallStatus: 'fail',
          inspectionLotId: 'LOT-12345',
          inspectionCompletedAt: null,
          inspectionCompletedBy: null,
          micStatus: 'fail', // FAIL status
          chemicalStatus: 'pass',
          physicalStatus: 'pass',
          sensoryStatus: 'pass',
          micFailures: [], // but empty failure details!
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useQualityResults>)

    render(<QualityResultsPanel request={request} />)

    expect(screen.getByText('MIC Status is FAIL but no failure details were returned. Verify lot records in SAP QM.')).toBeDefined()
  })

  it('renders results lists and simulated mock disclaimer footnote', () => {
    vi.mocked(useQualityResults).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          overallStatus: 'pass',
          inspectionLotId: 'LOT-12345',
          inspectionCompletedAt: '2026-05-19T08:00:00Z',
          inspectionCompletedBy: 'Lab Analyst',
          micStatus: 'pass',
          chemicalStatus: 'pass',
          physicalStatus: 'pass',
          sensoryStatus: 'pass',
          micFailures: [],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useQualityResults>)

    render(<QualityResultsPanel request={request} />)

    expect(screen.getAllByText(/Inspection Lot:/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText('LOT-12345')[0]).toBeInTheDocument()
    expect(screen.getAllByText(/This panel uses simulated mock data/i)[0]).toBeInTheDocument()
  })

  it('toggles MIC failures list visibility when Hide/Show button is clicked', () => {
    vi.mocked(useQualityResults).mockReturnValue({
      data: {
        ok: true,
        fetchedAt: new Date().toISOString(),
        source: 'mock',
        data: {
          overallStatus: 'fail',
          inspectionLotId: 'LOT-12345',
          inspectionCompletedAt: '2026-05-19T08:00:00Z',
          inspectionCompletedBy: 'Lab Analyst',
          micStatus: 'fail',
          chemicalStatus: 'pass',
          physicalStatus: 'pass',
          sensoryStatus: 'pass',
          micFailures: [
            { organism: 'Coliforms', result: '15', unit: 'CFU/g', limit: '10', exceededBy: '5', testMethod: 'ISO-4832', testedAt: '2026-05-19T09:00:00Z', testedBy: 'Lab Tech' }
          ],
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useQualityResults>)

    render(<QualityResultsPanel request={request} />)

    // Initially Coliforms is visible
    expect(screen.queryByText('Coliforms')).not.toBeNull()
    const toggleBtn = screen.getByRole('button', { name: 'Hide' })

    // Click Hide to collapse failures list
    fireEvent.click(toggleBtn)
    expect(screen.queryByText('Coliforms')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show' })).toBeDefined()

    // Click Show to expand failures list
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.queryByText('Coliforms')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Hide' })).toBeDefined()
  })
})
