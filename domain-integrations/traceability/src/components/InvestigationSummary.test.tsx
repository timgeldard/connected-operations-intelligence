import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InvestigationSummary } from './InvestigationSummary.js'
import type { ConfidenceResult } from './EvidenceConfidence.js'
import type {
  BatchHeaderSummary,
  CustomerExposureSummary,
  SupplierExposureSummary,
} from '@connectio/data-contracts'

describe('InvestigationSummary', () => {
  const mockConfidence: ConfidenceResult = {
    grade: 'COMPLETE',
    score: 100,
    gaps: [],
    details: {
      lineage: 'complete',
      customers: 'complete',
      massBalance: 'complete',
      quality: 'complete',
      coa: 'complete',
      suppliers: 'complete',
    },
  }

  const mockBatchHeader: BatchHeaderSummary = {
    materialId: 'M1001',
    materialDescription: 'Kerry Cheddar Cheese Powder',
    batchId: 'B2002',
    plantId: 'P3003',
    plantName: 'Kerry Listowel',
    batchStatus: 'active',
    processOrderId: 'PO4004',
    quantity: 5000,
    uom: 'KG',
    stockStatus: 'unrestricted',
    qualityStatus: 'accepted',
    releaseStatus: 'released',
    expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString(), // 60 days in future
  }

  const mockCustomerExposure: CustomerExposureSummary = {
    shippedQuantity: 1500,
    affectedDeliveries: 3,
    countries: ['Ireland', 'Germany'],
    affectedCustomers: 2,
    highestSeverity: 'low',
    blockedDeliveries: 0,
    recallRecommended: false,
  }

  const mockSupplierExposure: SupplierExposureSummary = {
    supplierCount: 2,
    supplierLots: 5,
    highestRiskSupplier: 'Supp A',
    upstreamMaterials: 3,
    openSupplierActions: 0,
  }

  it('renders focal batch details, plant, and custom title', () => {
    render(
      <InvestigationSummary
        batchHeader={mockBatchHeader}
        customerExposure={mockCustomerExposure}
        supplierExposure={mockSupplierExposure}
        confidence={mockConfidence}
        sim={false}
        onSim={() => {}}
      />,
    )

    expect(screen.getByText('Kerry Cheddar Cheese Powder')).not.toBeNull()
    expect(screen.getByText('(Mat: M1001 · Batch: B2002)')).not.toBeNull()
    expect(screen.getByText('Batch Investigation Cockpit')).not.toBeNull()
  })

  it('fires the simulation callback on button click', () => {
    const onSimMock = vi.fn()
    render(
      <InvestigationSummary
        batchHeader={mockBatchHeader}
        customerExposure={mockCustomerExposure}
        supplierExposure={mockSupplierExposure}
        confidence={mockConfidence}
        sim={false}
        onSim={onSimMock}
      />,
    )

    const btn = screen.getByRole('button', { name: 'Simulate Recall' })
    fireEvent.click(btn)
    expect(onSimMock).toHaveBeenCalledWith(true)
  })

  it('renders critical exposure severity when stock has shipped to customers', () => {
    render(
      <InvestigationSummary
        batchHeader={mockBatchHeader}
        customerExposure={mockCustomerExposure}
        supplierExposure={mockSupplierExposure}
        confidence={mockConfidence}
        sim={false}
        onSim={() => {}}
      />,
    )

    expect(screen.getByText('Critical Exposure')).not.toBeNull()
    expect(screen.getByText(/Shipped stock has reached customer sites/)).not.toBeNull()
  })

  it('displays the key metrics inside the grid', () => {
    render(
      <InvestigationSummary
        batchHeader={mockBatchHeader}
        customerExposure={mockCustomerExposure}
        supplierExposure={mockSupplierExposure}
        confidence={mockConfidence}
        sim={false}
        onSim={() => {}}
      />,
    )

    expect(screen.getByText('Stock Position')).not.toBeNull()
    expect(screen.getByText('5,000')).not.toBeNull()
    expect(screen.getByText('Total Shipped')).not.toBeNull()
    expect(screen.getByText('1,500')).not.toBeNull()
    expect(screen.getByText('Downstream Exposure')).not.toBeNull()
    expect(screen.getAllByText('2')).toHaveLength(2)
  })

  it('shows UNKNOWN severity and data-unavailable warnings when customerExposure is null', () => {
    render(
      <InvestigationSummary
        batchHeader={mockBatchHeader}
        customerExposure={null}
        supplierExposure={mockSupplierExposure}
        confidence={mockConfidence}
        sim={false}
        onSim={() => {}}
      />,
    )

    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0)
    expect(screen.getByText(/Customer delivery data is unavailable/)).not.toBeNull()
    expect(screen.getByText(/do not assume containment/)).not.toBeNull()
    // Both shipped and customer metric cells should show data unavailable
    expect(screen.getAllByText('data unavailable')).toHaveLength(2)
  })

  it('does NOT show Critical Exposure when customerExposure is null (no false containment signal)', () => {
    render(
      <InvestigationSummary
        batchHeader={mockBatchHeader}
        customerExposure={null}
        supplierExposure={mockSupplierExposure}
        confidence={mockConfidence}
        sim={false}
        onSim={() => {}}
      />,
    )

    expect(screen.queryByText('Critical Exposure')).toBeNull()
    expect(screen.queryByText('Critical Exposure')).toBeNull()
    expect(screen.queryByText(/Low Risk/i)).toBeNull()
    const textContent = document.body.textContent?.toLowerCase() || ''
    expect(textContent).not.toContain('fully contained')
    expect(textContent).not.toContain('recall not required')
  })

  it('shows Low Risk severity when customer data is present with no shipments', () => {
    const containedExposure: CustomerExposureSummary = {
      shippedQuantity: 0,
      affectedDeliveries: 0,
      countries: [],
      affectedCustomers: 0,
      highestSeverity: 'low',
      blockedDeliveries: 0,
      recallRecommended: false,
    }

    render(
      <InvestigationSummary
        batchHeader={{ ...mockBatchHeader, stockStatus: 'blocked' }}
        customerExposure={containedExposure}
        supplierExposure={mockSupplierExposure}
        confidence={mockConfidence}
        sim={false}
        onSim={() => {}}
      />,
    )

    expect(screen.getByText('Low Risk')).not.toBeNull()
    expect(screen.getByText('across 0 countries')).not.toBeNull()
  })
})

describe('InvestigationSummary — depth-aware severity (TRACE-P0-003)', () => {
  const mockConfidence: ConfidenceResult = {
    grade: 'COMPLETE',
    score: 100,
    gaps: [],
    details: {
      lineage: 'complete',
      customers: 'complete',
      massBalance: 'complete',
      quality: 'complete',
      coa: 'complete',
      suppliers: 'complete',
    },
  }

  const mockBatchHeader: BatchHeaderSummary = {
    materialId: 'M1001',
    materialDescription: 'Kerry Cheddar Cheese Powder',
    batchId: 'B2002',
    plantId: 'P3003',
    plantName: 'Kerry Listowel',
    batchStatus: 'active',
    stockStatus: 'blocked',
    qualityStatus: 'unknown',
    releaseStatus: 'blocked',
  }

  const baseExposure: CustomerExposureSummary = {
    shippedQuantity: 0,
    affectedDeliveries: 0,
    countries: [],
    affectedCustomers: 0,
    highestSeverity: 'none',
    blockedDeliveries: 0,
    recallRecommended: false,
  }

  it('shows CRITICAL when maxExposureDepth=1 and stock has shipped', () => {
    render(
      <InvestigationSummary
        batchHeader={mockBatchHeader}
        customerExposure={{
          ...baseExposure,
          shippedQuantity: 500,
          affectedCustomers: 1,
          maxExposureDepth: 1,
        }}
        supplierExposure={null}
        confidence={mockConfidence}
        sim={false}
        onSim={() => {}}
      />,
    )
    expect(screen.getByText('Critical Exposure')).not.toBeNull()
    expect(screen.getByText('Critical Exposure')).not.toBeNull()
    expect(screen.getByText(/Shipped stock has reached customer sites/)).not.toBeNull()
    const textContent = document.body.textContent?.toLowerCase() || ''
    expect(textContent).not.toContain('activate product recall')
    // We expect wording around review/owner/governed-process rather than automated decision
    expect(textContent).toContain('review')
  })

  it('shows "High Indirect Exposure" (not "Near Expiry") when maxExposureDepth=2 and stock has shipped', () => {
    render(
      <InvestigationSummary
        batchHeader={mockBatchHeader}
        customerExposure={{
          ...baseExposure,
          shippedQuantity: 500,
          affectedCustomers: 1,
          maxExposureDepth: 2,
        }}
        supplierExposure={null}
        confidence={mockConfidence}
        sim={false}
        onSim={() => {}}
      />,
    )
    expect(screen.getByText('High Indirect Exposure')).not.toBeNull()
    expect(screen.queryByText('Near Expiry')).toBeNull()
    expect(screen.getByText(/indirect.*lineage/i)).not.toBeNull()
  })

  it('shows MEDIUM when maxExposureDepth=2 and no shipments', () => {
    render(
      <InvestigationSummary
        batchHeader={mockBatchHeader}
        customerExposure={{ ...baseExposure, maxExposureDepth: 2 }}
        supplierExposure={null}
        confidence={mockConfidence}
        sim={false}
        onSim={() => {}}
      />,
    )
    expect(screen.getByText('Medium Risk')).not.toBeNull()
    expect(screen.getByText(/Indirect lineage exposure/)).not.toBeNull()
  })

  it('shows "Near Expiry" (not "High Indirect Exposure") for shelf-life driven HIGH', () => {
    const nearExpiryHeader: BatchHeaderSummary = {
      ...mockBatchHeader,
      // 10 days to expiry — triggers isNearExpiry
      expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
    }
    render(
      <InvestigationSummary
        batchHeader={nearExpiryHeader}
        customerExposure={baseExposure}
        supplierExposure={null}
        confidence={mockConfidence}
        sim={false}
        onSim={() => {}}
      />,
    )
    expect(screen.getByText('Near Expiry')).not.toBeNull()
    expect(screen.queryByText('High Indirect Exposure')).toBeNull()
  })

  it('shows CRITICAL (conservative fallback) when maxExposureDepth is undefined and stock has shipped', () => {
    render(
      <InvestigationSummary
        batchHeader={mockBatchHeader}
        customerExposure={{ ...baseExposure, shippedQuantity: 500, affectedCustomers: 1 }}
        supplierExposure={null}
        confidence={mockConfidence}
        sim={false}
        onSim={() => {}}
      />,
    )
    expect(screen.getByText('Critical Exposure')).not.toBeNull()
    expect(screen.getByText('Critical Exposure')).not.toBeNull()
    const textContent = document.body.textContent?.toLowerCase() || ''
    expect(textContent).toContain('responsible owner')
    expect(textContent).not.toContain('activate product recall')
    expect(textContent).not.toContain('immediate action')
  })
})
