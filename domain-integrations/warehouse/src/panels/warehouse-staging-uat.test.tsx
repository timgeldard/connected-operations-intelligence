import { describe, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { StagingReadinessSummaryPanel } from './staging-readiness-summary-panel.js'
import { expectNoForbiddenClaims } from '@connectio/test-support'
import * as queries from '../adapters/production-staging-queries.js'

vi.mock('../adapters/production-staging-queries.js', () => ({
  useStagingReadinessSummary: vi.fn(),
}))

describe('Warehouse staging (Offline UAT Smoke Check)', () => {
  it('renders truthfully and prevents forbidden claims', () => {
    vi.mocked(queries.useStagingReadinessSummary).mockReturnValue({
      data: {
        ok: true,
        data: {
          ordersTotal: 10,
          ordersReady: 5,
          ordersShort: 2,
          ordersCritical: 1,
          ordersBlocked: 2,
          componentsTotal: 100,
          componentsMissing: 5,
        },
        fetchedAt: new Date().toISOString(),
        source: 'mock',
      },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { container } = render(<StagingReadinessSummaryPanel request={{ plantId: 'P001' }} />)

    expectNoForbiddenClaims(container)
  })
})
