import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { WmWorklistItem } from '../adapters/wm-operations-adapter.js'
import { WorklistTable } from './worklist-table.js'

function item(overrides: Partial<WmWorklistItem>): WmWorklistItem {
  return {
    plantId: 'C061',
    warehouseId: '104',
    trId: 'TR-BASE',
    workArea: 'PRODUCTION_STAGING',
    worklistStatus: 'OPEN',
    referenceType: 'P',
    referenceId: '900001',
    orderMaterialId: 'FG1',
    orderScheduledStartDate: '2026-06-12',
    sourceStorageType: null,
    sourceZone: null,
    destinationStorageType: '100',
    destinationZone: 'PRODUCTION_SUPPLY',
    destinationBin: null,
    queue: null,
    campaignId: null,
    assignedOperator: null,
    jobSequence: null,
    transferPriority: null,
    createdTs: '2026-06-12T08:00:00Z',
    plannedExecutionTs: '2026-06-12T09:00:00Z',
    demandDueTs: '2026-06-12T09:00:00Z',
    priorityScore: 40,
    itemCount: 1,
    openItemCount: 1,
    materialCount: 1,
    materialId: 'RM1',
    materialName: 'Raw Material',
    requiredQty: 10,
    openQty: 10,
    uom: 'KG',
    hasMixedBaseUom: false,
    toItemCount: 0,
    toItemsConfirmed: 0,
    toConfirmedQty: 0,
    pickProgressFraction: 0,
    latestToConfirmedTs: null,
    cycleHours: null,
    ageHours: 1,
    isOverdue: false,
    shortPickQty: null,
    shortPickItemCount: null,
    orderProductionLine: null,
    ...overrides,
  }
}

describe('WorklistTable', () => {
  it('sorts by priority score descending, then demand due timestamp ascending', () => {
    render(
      <WorklistTable
        isLoading={false}
        items={[
          item({ trId: 'LOW', priorityScore: 40, demandDueTs: '2026-06-12T08:30:00Z' }),
          item({ trId: 'HIGH-LATE', priorityScore: 80, demandDueTs: '2026-06-12T10:00:00Z' }),
          item({ trId: 'HIGH-EARLY', priorityScore: 80, demandDueTs: '2026-06-12T09:00:00Z' }),
        ]}
      />,
    )

    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('HIGH-EARLY')).toBeInTheDocument()
    expect(within(rows[1]).getByText('HIGH-LATE')).toBeInTheDocument()
    expect(within(rows[2]).getByText('LOW')).toBeInTheDocument()
    expect(screen.getAllByText('P 80')).toHaveLength(2)
    expect(screen.getByText('P 40')).toBeInTheDocument()
  })
})
