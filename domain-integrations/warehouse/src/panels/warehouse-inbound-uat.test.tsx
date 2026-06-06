import { describe, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { InboundOutboundSummaryPanel } from './inbound-outbound-summary-panel.js'
import { expectNoForbiddenClaims } from '@connectio/test-support'
import * as queries from '../adapters/warehouse-360-queries.js'

vi.mock('../adapters/warehouse-360-queries.js', () => ({
  useGoodsMovements: vi.fn(),
}))

describe('Warehouse inbound (Offline UAT Smoke Check)', () => {
  it('renders truthfully and prevents forbidden claims', () => {
    vi.mocked(queries.useGoodsMovements).mockReturnValue({
      data: {
        ok: true,
        data: [], // Empty for now, just checking baseline
        fetchedAt: new Date().toISOString(),
        source: 'mock',
      },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { container } = render(
      <InboundOutboundSummaryPanel request={{ warehouseId: 'WH01', plantId: 'P001' }} />,
    )

    expectNoForbiddenClaims(container)
  })
})
