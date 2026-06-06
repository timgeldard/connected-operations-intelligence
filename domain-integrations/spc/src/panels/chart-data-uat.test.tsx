import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ControlChartPanel } from './control-chart-panel.js'
import { expectNoForbiddenClaims } from '@connectio/test-support'
import * as queries from '../adapters/spc-monitoring-queries.js'

vi.mock('../adapters/spc-monitoring-queries.js', () => ({
  useControlChartSeries: vi.fn(),
}))

describe('SPC chart data (Offline UAT Smoke Check)', () => {
  it('renders truthfully with not-evaluated points and prevents forbidden claims', () => {
    vi.mocked(queries.useControlChartSeries).mockReturnValue({
      data: {
        ok: true,
        data: {
          chartId: 'SPC-001',
          characteristicId: 'CHAR-1',
          characteristicName: 'Weight',
          chartType: 'individuals',
          unitOfMeasure: 'g',
          confidence: 0.0,
          points: [
            {
              pointId: 'PT-1',
              timestamp: '2026-05-24T10:00:00Z',
              value: 100.5,
              batchId: 'BATCH-001',
              signalIds: [],
              // Critical: status must remain not-evaluated — never collapsed to in-control
              status: 'not-evaluated',
            },
            {
              pointId: 'PT-2',
              timestamp: '2026-05-24T12:00:00Z',
              value: 101.0,
              batchId: 'BATCH-002',
              signalIds: [],
              status: 'not-evaluated',
            },
            {
              pointId: 'PT-3',
              timestamp: '2026-05-24T14:00:00Z',
              value: 99.5,
              batchId: 'BATCH-003',
              signalIds: [],
              status: 'not-evaluated',
            },
          ],
          upperControlLimit: 105,
          lowerControlLimit: 95,
          centerLine: 100,
          // limitProvenance unknown — must not be presented as approved
          limitProvenance: 'unknown',
          // approvalState pending — must not render as "approved"
          approvalState: 'pending-validation',
          lockedLimits: false,
        },
        fetchedAt: new Date().toISOString(),
        source: 'mock',
      },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { container } = render(
      <ControlChartPanel
        request={{ characteristicId: 'CHAR-1', plantId: 'P001', materialId: 'MAT-1' }}
      />,
    )

    // "approved" appears only in the truthful caveat ("approval source not verified") — not as a positive claim
    expectNoForbiddenClaims(container, ['approved'])

    // Component renders all 3 data points (not the "no measurement data" fallback)
    expect(container.textContent).toContain('3 points')

    // pending-validation must surface as a warning caveat, not a positive approval claim
    expect(container.textContent?.toLowerCase()).toContain('approval source not verified')
    // not-evaluated status is preserved and visible in rendered output
    expect(container.textContent?.toLowerCase()).toContain('not evaluated')
    // unknown limitProvenance must not render as "in control"
    expect(container.textContent?.toLowerCase()).not.toContain('in control')
  })

  it('renders loading state distinct from no monitored characteristics', () => {
    vi.mocked(queries.useControlChartSeries).mockReturnValue({
      data: undefined,
      isLoading: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { container } = render(
      <ControlChartPanel
        request={{ characteristicId: 'CHAR-1', plantId: 'P001', materialId: 'MAT-1' }}
      />,
    )

    // Loading state must not render as "no monitored characteristics found"
    expect(container.textContent?.toLowerCase()).not.toContain('no monitored characteristics')
    expectNoForbiddenClaims(container)
  })

  it('renders source error distinct from confirmed empty data', () => {
    vi.mocked(queries.useControlChartSeries).mockReturnValue({
      data: {
        ok: false,
        error: { message: 'Source unavailable', code: 'DATABRICKS_502' },
        source: 'databricks-api',
      },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { container } = render(
      <ControlChartPanel
        request={{ characteristicId: 'CHAR-1', plantId: 'P001', materialId: 'MAT-1' }}
      />,
    )

    // Source error must not render as "no measurement data" (confirmed empty)
    expect(container.textContent?.toLowerCase()).not.toContain('no measurement data found')
    expectNoForbiddenClaims(container)
  })
})
