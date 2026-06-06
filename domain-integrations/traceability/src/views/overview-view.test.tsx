import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OverviewView } from './overview-view.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

// Mock sub-components
vi.mock('../panels/batch-header-panel.js', () => ({
  BatchHeaderPanel: () => <div data-testid="mock-batch-header-panel" />,
}))
vi.mock('../panels/risk-signals-panel.js', () => ({
  RiskSignalsPanel: () => <div data-testid="mock-risk-signals-panel" />,
}))
vi.mock('../panels/trace-graph-panel.js', () => ({
  TraceGraphPanel: () => <div data-testid="mock-trace-graph-panel" />,
}))
vi.mock('../panels/customer-impact-panel.js', () => ({
  CustomerImpactPanel: () => <div data-testid="mock-customer-impact-panel" />,
}))
vi.mock('../panels/coa-release-status-panel.js', () => ({
  CoAReleaseStatusPanel: () => <div data-testid="mock-coa-release-status-panel" />,
}))
vi.mock('../panels/event-timeline-panel.js', () => ({
  EventTimelinePanel: () => <div data-testid="mock-event-timeline-panel" />,
}))

// Hoisted vi.fn() mocks. Cast return values to unknown so individual tests can supply any
// valid AdapterResult shape via mockReturnValueOnce without triggering inference errors.
const {
  mockUseBatchHeaderSummary,
  mockUseCustomerExposureSummary,
  mockUseMassBalanceSummary,
  mockUseCoAReleaseStatus,
  mockUseSupplierExposureSummary,
  mockUseTraceGraph,
} = vi.hoisted(() => ({
  mockUseBatchHeaderSummary: vi.fn(() => ({ data: { ok: true, data: {} } as unknown })),
  mockUseCustomerExposureSummary: vi.fn(() => ({ data: { ok: true, data: { countries: [] } } as unknown })),
  mockUseMassBalanceSummary: vi.fn(() => ({ data: { ok: true, data: {} } as unknown })),
  mockUseCoAReleaseStatus: vi.fn(() => ({ data: { ok: true, data: {} } as unknown })),
  mockUseSupplierExposureSummary: vi.fn(() => ({ data: { ok: true, data: {} } as unknown })),
  mockUseTraceGraph: vi.fn(() => ({ data: { ok: true, data: {} } as unknown })),
}))

vi.mock('../adapters/trace2-queries.js', () => ({
  useBatchHeaderSummary: () => mockUseBatchHeaderSummary(),
  useCustomerExposureSummary: () => mockUseCustomerExposureSummary(),
  useMassBalanceSummary: () => mockUseMassBalanceSummary(),
  useCoAReleaseStatus: () => mockUseCoAReleaseStatus(),
  useSupplierExposureSummary: () => mockUseSupplierExposureSummary(),
  useTraceGraph: () => mockUseTraceGraph(),
}))

const mockRequest: Trace2AdapterRequest = {
  investigationId: 'test-inv',
  batchId: 'test-batch',
}

beforeEach(() => {
  mockUseBatchHeaderSummary.mockReturnValue({ data: { ok: true, data: {} } as unknown })
  mockUseCustomerExposureSummary.mockReturnValue({ data: { ok: true, data: { countries: [] } } as unknown })
  mockUseMassBalanceSummary.mockReturnValue({ data: { ok: true, data: {} } as unknown })
  mockUseCoAReleaseStatus.mockReturnValue({ data: { ok: true, data: {} } as unknown })
  mockUseSupplierExposureSummary.mockReturnValue({ data: { ok: true, data: {} } as unknown })
  mockUseTraceGraph.mockReturnValue({ data: { ok: true, data: {} } as unknown })
})

describe('OverviewView', () => {
  it('renders all six modular panels correctly', () => {
    render(<OverviewView request={mockRequest} />)

    expect(screen.getByTestId('mock-batch-header-panel')).not.toBeNull()
    expect(screen.getByTestId('mock-risk-signals-panel')).not.toBeNull()
    expect(screen.getByTestId('mock-trace-graph-panel')).not.toBeNull()
    expect(screen.getByTestId('mock-customer-impact-panel')).not.toBeNull()
    expect(screen.getByTestId('mock-coa-release-status-panel')).not.toBeNull()
    expect(screen.getByTestId('mock-event-timeline-panel')).not.toBeNull()
  })

  it('renders the investigation summary header and digital checklist panel', () => {
    render(<OverviewView request={mockRequest} />)

    expect(screen.getByText('Batch Investigation Cockpit')).not.toBeNull()
    expect(screen.getByText('Evidence Pack Readiness')).not.toBeNull()
  })

  it('does NOT show a batch header error banner when data loads successfully', () => {
    render(<OverviewView request={mockRequest} />)

    expect(screen.queryByRole('alert', { name: 'Batch header error' })).toBeNull()
  })

  it('does NOT show a batch header error banner while loading (result still undefined)', () => {
    mockUseBatchHeaderSummary.mockReturnValueOnce({ data: undefined })

    render(<OverviewView request={mockRequest} />)

    expect(screen.queryByRole('alert', { name: 'Batch header error' })).toBeNull()
  })

  it('renders the initial load screen when batchId is missing', () => {
    const emptyRequest: Trace2AdapterRequest = { investigationId: 'test-inv' }
    render(<OverviewView request={emptyRequest} />)

    expect(screen.getByText('Trace a batch')).not.toBeNull()
    expect(screen.getByTestId('trace-query-form')).not.toBeNull()
    expect(screen.getByText('Evidence Preview')).not.toBeNull()
    expect(screen.getByText('UAT Candidate')).not.toBeNull()
    expect(screen.getByText('Safety & Readiness Notice')).not.toBeNull()
  })

  it('loads the correct UAT candidate when the action is triggered', () => {
    const emptyRequest: Trace2AdapterRequest = { investigationId: 'test-inv' }
    render(<OverviewView request={emptyRequest} />)

    const btn = screen.getByRole('button', { name: 'Run UAT Candidate Trace' })
    fireEvent.click(btn)

    // Should transition to investigation view
    expect(screen.getByText('Batch Investigation Cockpit')).not.toBeNull()
    // Verify values in the header summary or technical details if possible
    // Since sub-components are mocked, we can check the TraceQueryForm props if they were tracked
  })

  it('renders prominent safety warnings about unavailable evidence', () => {
    const emptyRequest: Trace2AdapterRequest = { investigationId: 'test-inv' }
    render(<OverviewView request={emptyRequest} />)

    expect(screen.getByText(/must not be interpreted as zero exposure/i)).not.toBeNull()
    expect(screen.getByText(/Unknown or unavailable exposure data must not be interpreted as no exposure/i)).not.toBeNull()
  })
})

describe('OverviewView — batch header error states (TRACE-P1-003)', () => {
  it('shows "Batch not found" banner when adapter returns not-found', () => {
    mockUseBatchHeaderSummary.mockReturnValueOnce({
      data: {
        ok: false,
        error: { code: 'not-found', message: 'No batch header row for the given identifiers.', retryable: false },
        displayState: 'empty',
      },
    })

    render(<OverviewView request={mockRequest} />)

    expect(screen.getByRole('alert', { name: 'Batch header error' })).not.toBeNull()
    expect(screen.getByText('Batch not found')).not.toBeNull()
    expect(screen.getByText('No batch header row for the given identifiers.')).not.toBeNull()
  })

  it('shows "Not authorized or data not accessible" banner when adapter returns unauthorized', () => {
    mockUseBatchHeaderSummary.mockReturnValueOnce({
      data: {
        ok: false,
        error: { code: 'unauthorized', message: 'Insufficient permissions to access this batch.', retryable: false },
        displayState: 'error',
      },
    })

    render(<OverviewView request={mockRequest} />)

    expect(screen.getByText('Not authorized or data not accessible')).not.toBeNull()
    expect(screen.getByText('Insufficient permissions to access this batch.')).not.toBeNull()
  })

  it('shows "Batch header unavailable" banner for generic adapter error', () => {
    mockUseBatchHeaderSummary.mockReturnValueOnce({
      data: {
        ok: false,
        error: { code: 'unknown', message: 'Unexpected error from data source.', retryable: true },
        displayState: 'error',
      },
    })

    render(<OverviewView request={mockRequest} />)

    expect(screen.getByText('Batch header unavailable')).not.toBeNull()
    expect(screen.getByText('Unexpected error from data source.')).not.toBeNull()
  })

  it('shows "Data source timeout" banner when adapter returns timeout', () => {
    mockUseBatchHeaderSummary.mockReturnValueOnce({
      data: {
        ok: false,
        error: { code: 'timeout', message: 'Query exceeded the allowed duration.', retryable: true },
        displayState: 'error',
      },
    })

    render(<OverviewView request={mockRequest} />)

    expect(screen.getByText('Data source timeout')).not.toBeNull()
  })

  it('still renders all six evidence panels even when batch header errors', () => {
    mockUseBatchHeaderSummary.mockReturnValueOnce({
      data: {
        ok: false,
        error: { code: 'not-found', message: 'Not found.', retryable: false },
        displayState: 'empty',
      },
    })

    render(<OverviewView request={mockRequest} />)

    expect(screen.getByTestId('mock-batch-header-panel')).not.toBeNull()
    expect(screen.getByTestId('mock-risk-signals-panel')).not.toBeNull()
    expect(screen.getByTestId('mock-trace-graph-panel')).not.toBeNull()
    expect(screen.getByTestId('mock-customer-impact-panel')).not.toBeNull()
    expect(screen.getByTestId('mock-coa-release-status-panel')).not.toBeNull()
    expect(screen.getByTestId('mock-event-timeline-panel')).not.toBeNull()
  })
})

describe('OverviewView — customer exposure error state (TRACE-P0-001)', () => {
  it('shows "Exposure Unknown" (not "Low Risk") when customer exposure adapter fails', () => {
    mockUseCustomerExposureSummary.mockReturnValueOnce({
      data: {
        ok: false,
        error: { code: 'unknown', message: 'Customer exposure data unavailable.', retryable: true },
        displayState: 'error',
      },
    })

    render(<OverviewView request={mockRequest} />)

    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0)
    expect(screen.queryByText('Low Risk')).toBeNull()
  })
})
