import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { WarehouseReconciliationException } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { WarehouseReconciliationExceptionsPanel } from './warehouse-reconciliation-exceptions-panel.js'

const exceptionsResult: AdapterResult<WarehouseReconciliationException[]> = {
  ok: true,
  data: [
    {
      exceptionId: 'RECON-00047',
      severity: 'critical',
      resolution: 'open',
      exceptionType: 'quantity-mismatch',
      materialDescription: 'Emmental Block 4 kg',
      discrepancyQuantity: 12,
      uom: 'KG',
      batchId: 'BATCH-001',
      storageLocationId: 'SL01',
      ageHours: 6.5,
    },
    {
      exceptionId: 'RECON-00046',
      severity: 'high',
      resolution: 'in-progress',
      exceptionType: 'missing-in-wms',
      materialDescription: 'Cheddar Barrel',
      discrepancyQuantity: -4,
      uom: 'KG',
      batchId: 'BATCH-002',
      storageLocationId: 'SL02',
      ageHours: 12.3,
    },
    {
      exceptionId: 'RECON-00044',
      severity: 'medium',
      resolution: 'open',
      exceptionType: 'location-mismatch',
      materialDescription: 'Gouda Wheel',
      discrepancyQuantity: 0,
      uom: 'KG',
      batchId: 'BATCH-003',
      storageLocationId: 'SL03',
      ageHours: 3.1,
    },
  ] as unknown as WarehouseReconciliationException[],
  fetchedAt: '2026-05-24T12:00:00Z',
  source: 'mock',
}

describe('WarehouseReconciliationExceptionsPanel', () => {
  it('renders the panel container', () => {
    render(<WarehouseReconciliationExceptionsPanel result={exceptionsResult} />)

    expect(
      document.querySelector('[data-testid="evidence-panel-warehouse-reconciliation-exceptions"]'),
    ).not.toBeNull()
  })

  it('renders the panel display name', () => {
    render(<WarehouseReconciliationExceptionsPanel result={exceptionsResult} />)

    expect(screen.getByText('IM/WM Reconciliation Exceptions')).toBeInTheDocument()
  })

  it('renders open exceptions count banner', () => {
    render(<WarehouseReconciliationExceptionsPanel result={exceptionsResult} />)

    expect(screen.getByText(/open exceptions require attention/i)).toBeInTheDocument()
  })

  it('renders quantity mismatch label', () => {
    render(<WarehouseReconciliationExceptionsPanel result={exceptionsResult} />)

    expect(screen.getByText(/Qty mismatch/i)).toBeInTheDocument()
  })

  it('renders missing in WM label', () => {
    render(<WarehouseReconciliationExceptionsPanel result={exceptionsResult} />)

    expect(screen.getByText(/Missing in WM/i)).toBeInTheDocument()
  })

  it('renders material description for emmental', () => {
    render(<WarehouseReconciliationExceptionsPanel result={exceptionsResult} />)

    expect(screen.getByText(/Emmental Block 4 kg/i)).toBeInTheDocument()
  })

  it('renders resolution status labels', () => {
    render(<WarehouseReconciliationExceptionsPanel result={exceptionsResult} />)

    expect(screen.getAllByText(/open|in-progress/i).length).toBeGreaterThan(0)
  })

  it('shows panel container before data loads', () => {
    render(<WarehouseReconciliationExceptionsPanel isLoading={true} />)

    expect(
      document.querySelector('[data-testid="evidence-panel-warehouse-reconciliation-exceptions"]'),
    ).not.toBeNull()
  })
})
