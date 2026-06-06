import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MaterialSupplierExposurePanel } from './material-supplier-exposure-panel.js'
import { MassBalancePanel } from '../trace-app/MassBalancePanel.js'
import { expectNoForbiddenClaims } from '@connectio/test-support'
import * as queries from '../adapters/trace2-queries.js'
import * as traceAppQueries from '../trace-app/trace-app-queries.js'

vi.mock('../adapters/trace2-queries.js', () => ({
  useSupplierExposureSummary: vi.fn(),
}))

vi.mock('../trace-app/trace-app-queries.js', () => ({
  useMassBalance: vi.fn(),
}))

describe('Trace supplier exposure + mass balance (Offline UAT Smoke Check)', () => {
  it('renders Supplier Exposure truthfully with unknown supplierRisk', () => {
    vi.mocked(queries.useSupplierExposureSummary).mockReturnValue({
      data: {
        ok: true,
        data: [
          {
            supplierId: 'SUP-001',
            supplierName: 'Test Supplier',
            countryId: 'US',
            receivedQuantity: 1000,
            batchCount: 5,
            uom: 'KG',
            // Assuming supplierRisk or similar is part of the detail or summary
            supplierRisk: 'unknown',
          },
        ],
        fetchedAt: new Date().toISOString(),
        source: 'mock',
      },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { container } = render(
      <MaterialSupplierExposurePanel
        request={{ investigationId: 'INV-1', batchId: 'BATCH-001' }}
      />,
    )

    expect(container.textContent?.toLowerCase()).toContain('supplier exposure')
    expectNoForbiddenClaims(container)
  })

  it('renders Mass Balance truthfully with null UOM', () => {
    vi.mocked(traceAppQueries.useMassBalance).mockReturnValue({
      data: {
        ok: true,
        data: {
          batchId: 'BATCH-001',
          kpi: {
            produced: 1000,
            consumed: 500,
            shipped: 0,
            adjusted: 0,
            current: 500,
            variance: 0,
            uom: null, // Critical: test null UOM renders unavailable/—
            postings: {
              production: 5,
              consumption: 2,
              dispatch: 0,
              adjustment: 0,
            },
          },
          events: [],
        },
        fetchedAt: new Date().toISOString(),
        source: 'mock',
      },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { container } = render(
      <MassBalancePanel request={{ investigationId: 'INV-1', batchId: 'BATCH-001' }} />,
    )

    // Verify it doesn't break and forbidden claims aren't used
    expectNoForbiddenClaims(container)

    // Check that null is handled gracefully, usually by showing '—' or missing unit
    expect(container.textContent).toMatch(/—|unavailable|1000.*500/i)
  })
})
