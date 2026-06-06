import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ProcessOrderHeaderPanel } from './process-order-header-panel.js'
import { expectNoForbiddenClaims } from '@connectio/test-support'
import * as queries from '../adapters/process-order-review-queries.js'

vi.mock('../adapters/process-order-review-queries.js', () => ({
  useProcessOrderHeader: vi.fn(),
}))

describe('POH process-order header (Offline UAT Smoke Check)', () => {
  it('renders truthfully with unknown status and prevents forbidden claims', () => {
    vi.mocked(queries.useProcessOrderHeader).mockReturnValue({
      data: {
        ok: true,
        data: {
          processOrderId: 'PO-10001',
          plantId: 'P001',
          materialId: 'MAT-123',
          materialDescription: 'Test Material',
          // Critical: test unknown status
          status: 'unknown',
          targetQuantity: 1000,
          deliveredQuantity: 500,
          uom: 'KG',
        },
        fetchedAt: new Date().toISOString(),
        source: 'mock',
      },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { container } = render(
      <ProcessOrderHeaderPanel request={{ processOrderId: 'PO-10001', plantId: 'P001' }} />,
    )

    // Verify it doesn't leak forbidden claims like "safe" or "complete"
    expectNoForbiddenClaims(container)

    // Check that 'unknown' is rendered
    expect(container.textContent?.toLowerCase()).toContain('unknown')
  })

  it('renders unavailable for missing planned and confirmed quantities', () => {
    vi.mocked(queries.useProcessOrderHeader).mockReturnValue({
      data: {
        ok: true,
        data: {
          processOrderId: 'PO-10002',
          plantId: 'P001',
          materialId: 'MAT-123',
          materialDescription: 'Test Material',
          status: 'in-process',
          targetQuantity: null,
          deliveredQuantity: null,
          plannedQuantity: null,
          confirmedQuantity: null,
          uom: 'KG',
        },
        fetchedAt: new Date().toISOString(),
        source: 'mock',
      },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { container } = render(
      <ProcessOrderHeaderPanel request={{ processOrderId: 'PO-10002', plantId: 'P001' }} />,
    )

    const textContent = container.textContent || ''
    // Neither should display "0 KG"
    expect(textContent).not.toContain('0 KG')
    // They should render "—"
    expect(textContent).toContain('—')
  })

  it('renders explicitly provided zero quantity as zero', () => {
    vi.mocked(queries.useProcessOrderHeader).mockReturnValue({
      data: {
        ok: true,
        data: {
          processOrderId: 'PO-10003',
          plantId: 'P001',
          materialId: 'MAT-123',
          materialDescription: 'Test Material',
          status: 'in-process',
          targetQuantity: 0,
          deliveredQuantity: 0,
          plannedQuantity: 0,
          confirmedQuantity: 0,
          uom: 'KG',
        },
        fetchedAt: new Date().toISOString(),
        source: 'mock',
      },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { container } = render(
      <ProcessOrderHeaderPanel request={{ processOrderId: 'PO-10003', plantId: 'P001' }} />,
    )

    const textContent = container.textContent || ''
    expect(textContent).toContain('0 KG')
    expect(textContent).not.toContain('—')
  })
})
