import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ProcessOrderConfirmation } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { OrderConfirmationsPanel } from './order-confirmations-panel.js'

const confirmationsResult: AdapterResult<ProcessOrderConfirmation[]> = {
  ok: true,
  data: [
    {
      confirmationId: 'CONF-001',
      operationText: 'Milk Standardisation',
      isFinalConfirmation: true,
      confirmedYield: 1200,
      scrapQuantity: 0,
      variancePercent: 1.2,
      uom: 'KG',
      confirmedAt: '2026-03-08T09:00:00Z',
      confirmedBy: 'EMP-1',
    },
    {
      confirmationId: 'CONF-002',
      operationText: 'Cutting and Drainage',
      isFinalConfirmation: false,
      confirmedYield: 800,
      scrapQuantity: 15,
      variancePercent: -2.5,
      uom: 'KG',
      confirmedAt: '2026-03-08T10:00:00Z',
      confirmedBy: 'EMP-2',
    },
    {
      confirmationId: 'CONF-003',
      operationText: 'Moulding',
      isFinalConfirmation: false,
      confirmedYield: 780,
      scrapQuantity: 0,
      variancePercent: -4.2,
      uom: 'KG',
      confirmedAt: '2026-03-08T11:00:00Z',
      confirmedBy: 'EMP-3',
    },
  ] as unknown as ProcessOrderConfirmation[],
  fetchedAt: '2026-03-08T11:00:00Z',
  source: 'mock',
}

describe('OrderConfirmationsPanel', () => {
  it('renders the panel container', () => {
    render(<OrderConfirmationsPanel result={confirmationsResult} />)

    const panel = document.querySelector('[data-testid="evidence-panel-order-confirmations"]')
    expect(panel).not.toBeNull()
  })

  it('renders the panel title', () => {
    render(<OrderConfirmationsPanel result={confirmationsResult} />)

    expect(screen.getByText('Confirmations')).toBeInTheDocument()
  })

  it('shows open confirmations banner for 2 open confirmations', () => {
    render(<OrderConfirmationsPanel result={confirmationsResult} />)

    expect(screen.getByText(/2 open confirmations/)).toBeInTheDocument()
  })

  it('renders Milk Standardisation confirmation', () => {
    render(<OrderConfirmationsPanel result={confirmationsResult} />)

    expect(screen.getByText(/Milk Standardisation/)).toBeInTheDocument()
  })

  it('shows scrap quantity for the partial confirmation', () => {
    render(<OrderConfirmationsPanel result={confirmationsResult} />)

    expect(screen.getAllByText(/scrap:/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders variance percentage', () => {
    render(<OrderConfirmationsPanel result={confirmationsResult} />)

    expect(screen.getAllByText(/vs plan/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders final badge for the completed confirmation', () => {
    render(<OrderConfirmationsPanel result={confirmationsResult} />)

    expect(screen.getAllByText('final').length).toBeGreaterThanOrEqual(1)
  })

  it('renders partial badge for open confirmations', () => {
    render(<OrderConfirmationsPanel result={confirmationsResult} />)

    expect(screen.getAllByText('partial').length).toBe(2)
  })

  it('renders unavailable wording instead of 0 when confirmed yield is null', () => {
    const nullYieldResult: AdapterResult<ProcessOrderConfirmation[]> = {
      ok: true,
      data: [
        {
          confirmationId: 'CONF-NULL',
          operationText: 'Test Op',
          isFinalConfirmation: false,
          confirmedYield: null,
          scrapQuantity: null,
          variancePercent: null,
          uom: 'KG',
          confirmedAt: '2026-03-08T09:00:00Z',
          confirmedBy: 'EMP-1',
        },
      ] as unknown as ProcessOrderConfirmation[],
      fetchedAt: '2026-03-08T09:00:00Z',
      source: 'mock',
    }

    render(<OrderConfirmationsPanel result={nullYieldResult} />)

    expect(screen.getByText(/partial/i)).toBeInTheDocument()

    const textContent = document.body.textContent || ''
    expect(textContent).not.toContain('yield: 0')
    expect(textContent).not.toContain('0 KG')
    expect(textContent).toContain('—')
  })
})
