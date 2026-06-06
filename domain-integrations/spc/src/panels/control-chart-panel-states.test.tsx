/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ControlChartPanel } from './control-chart-panel.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'
import type { ControlChartSeries } from '@connectio/data-contracts'

// ---------------------------------------------------------------------------
// Mock the query hook so we can control data returned in each test
// ---------------------------------------------------------------------------

vi.mock('../adapters/spc-monitoring-queries.js', () => ({
  useControlChartSeries: vi.fn(),
}))

import { useControlChartSeries } from '../adapters/spc-monitoring-queries.js'

const request: SPCMonitoringAdapterRequest = { materialId: 'MAT-12345', plantId: 'IE10', characteristicId: 'CHAR-TEST-001' }

const baseSeries: ControlChartSeries = {
  chartId: 'TEST-001',
  chartType: 'individuals',
  characteristicId: 'CHAR-TEST-001',
  characteristicName: 'Test Characteristic',
  centerLine: 5.0,
  upperControlLimit: 6.0,
  lowerControlLimit: 4.0,
  upperSpecLimit: 6.5,
  lowerSpecLimit: 3.5,
  unitOfMeasure: 'units',
  confidence: 0.9,
  points: [],
}

function makeResult(series: ControlChartSeries) {
  return { data: { ok: true as const, data: series, fetchedAt: '2024-03-08T10:00:00.000Z' }, isLoading: false }
}

beforeEach(() => {
  vi.mocked(useControlChartSeries).mockReturnValue(makeResult(baseSeries) as ReturnType<typeof useControlChartSeries>)
})

describe('ControlChartPanel — empty state', () => {
  it('shows "No measurement data" when points array is empty', async () => {
    render(<ControlChartPanel request={request} />)
    await waitFor(() => {
      expect(screen.getByText(/No measurement data found/i)).toBeInTheDocument()
    })
  })

  it('does not render SVG chart when points is empty', async () => {
    render(<ControlChartPanel request={request} />)
    await waitFor(() => {
      expect(document.querySelector('svg')).toBeNull()
    })
  })

  it('does not render UCL/CL/LCL stats when points is empty', async () => {
    render(<ControlChartPanel request={request} />)
    await waitFor(() => {
      expect(screen.queryByText('UCL')).toBeNull()
    })
  })

  it('still shows characteristic name and point count when empty', async () => {
    render(<ControlChartPanel request={request} />)
    await waitFor(() => {
      expect(screen.getByText(/Test Characteristic/)).toBeInTheDocument()
      expect(screen.getByText(/0 points/)).toBeInTheDocument()
    })
  })
})

describe('ControlChartPanel — insufficient data state', () => {
  beforeEach(() => {
    const twoPointSeries: ControlChartSeries = {
      ...baseSeries,
      points: [
        { pointId: 'P1', timestamp: '2026-05-13T06:00:00.000Z', value: 5.1, batchId: 'B1', sampleId: 'S1', signalIds: [], status: 'in-control' },
        { pointId: 'P2', timestamp: '2026-05-13T09:00:00.000Z', value: 4.9, batchId: 'B1', sampleId: 'S2', signalIds: [], status: 'in-control' },
      ],
    }
    vi.mocked(useControlChartSeries).mockReturnValue(makeResult(twoPointSeries) as ReturnType<typeof useControlChartSeries>)
  })

  it('shows insufficient data notice when fewer than 3 samples', async () => {
    render(<ControlChartPanel request={request} />)
    await waitFor(() => {
      expect(screen.getByText(/Fewer than 3 samples/i)).toBeInTheDocument()
    })
  })

  it('still renders the chart SVG with fewer than 3 samples', async () => {
    render(<ControlChartPanel request={request} />)
    await waitFor(() => {
      expect(document.querySelector('svg')).not.toBeNull()
    })
  })

  it('still renders UCL/CL/LCL stats with fewer than 3 samples', async () => {
    render(<ControlChartPanel request={request} />)
    await waitFor(() => {
      expect(screen.getByText('UCL')).toBeInTheDocument()
      expect(screen.getByText('CL')).toBeInTheDocument()
      expect(screen.getByText('LCL')).toBeInTheDocument()
    })
  })
})

describe('ControlChartPanel — normal state (3+ samples)', () => {
  beforeEach(() => {
    const normalSeries: ControlChartSeries = {
      ...baseSeries,
      points: [
        { pointId: 'P1', timestamp: '2026-05-13T06:00:00.000Z', value: 5.1, batchId: 'B1', sampleId: 'S1', signalIds: [], status: 'in-control' },
        { pointId: 'P2', timestamp: '2026-05-13T09:00:00.000Z', value: 4.9, batchId: 'B1', sampleId: 'S2', signalIds: [], status: 'in-control' },
        { pointId: 'P3', timestamp: '2026-05-13T12:00:00.000Z', value: 5.0, batchId: 'B1', sampleId: 'S3', signalIds: [], status: 'in-control' },
      ],
    }
    vi.mocked(useControlChartSeries).mockReturnValue(makeResult(normalSeries) as ReturnType<typeof useControlChartSeries>)
  })

  it('does not show the insufficient data notice with 3+ samples', async () => {
    render(<ControlChartPanel request={request} />)
    await waitFor(() => {
      expect(screen.queryByText(/Fewer than 3 samples/i)).toBeNull()
    })
  })

  it('does not show the empty state message with 3+ samples', async () => {
    render(<ControlChartPanel request={request} />)
    await waitFor(() => {
      expect(screen.queryByText(/No measurement data/i)).toBeNull()
    })
  })
})

describe('ControlChartPanel — missing control limits state', () => {
  beforeEach(() => {
    const missingLimitsSeries: ControlChartSeries = {
      ...baseSeries,
      upperControlLimit: undefined,
      lowerControlLimit: undefined,
      centerLine: undefined,
      points: [
        { pointId: 'P1', timestamp: '2026-05-13T06:00:00.000Z', value: 5.1, batchId: 'B1', sampleId: 'S1', signalIds: [], status: 'in-control' },
        { pointId: 'P2', timestamp: '2026-05-13T09:00:00.000Z', value: 4.9, batchId: 'B1', sampleId: 'S2', signalIds: [], status: 'in-control' },
        { pointId: 'P3', timestamp: '2026-05-13T12:00:00.000Z', value: 5.0, batchId: 'B1', sampleId: 'S3', signalIds: [], status: 'in-control' },
      ],
    }
    vi.mocked(useControlChartSeries).mockReturnValue(makeResult(missingLimitsSeries) as ReturnType<typeof useControlChartSeries>)
  })

  it('shows missing control limits notice', async () => {
    render(<ControlChartPanel request={request} />)
    await waitFor(() => {
      expect(screen.getByText(/Control limits not calculated/i)).toBeInTheDocument()
    })
  })

  it('does not show insufficient data notice even if 3+ samples and limits missing', async () => {
    render(<ControlChartPanel request={request} />)
    await waitFor(() => {
      expect(screen.queryByText(/Fewer than 3 samples/i)).toBeNull()
    })
  })

  it('does not render UCL/CL/LCL stats when limits are null', async () => {
    render(<ControlChartPanel request={request} />)
    await waitFor(() => {
      expect(screen.queryByText('UCL')).toBeNull()
      expect(screen.queryByText('CL')).toBeNull()
      expect(screen.queryByText('LCL')).toBeNull()
    })
  })
})
