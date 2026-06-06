import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { AdapterResult } from '@connectio/source-adapters'
import type { WarehouseReconciliationException } from '@connectio/data-contracts'
import { WarehouseReconciliationExceptionsPanel } from './warehouse-reconciliation-exceptions-panel.js'
import { expectNoForbiddenClaims } from '@connectio/test-support'

describe('Warehouse exceptions (Offline UAT Smoke Check)', () => {
  it('renders truthfully with null severity and prevents forbidden claims', () => {
    const result: AdapterResult<WarehouseReconciliationException[]> = {
      ok: true,
      data: [
        {
          exceptionId: 'EXC-1',
          exceptionType: 'reconciliation',
          severity: null,
          status: 'open',
          resolution: 'pending',
          ageHours: 12.5,
          createdAt: '2026-05-24T12:00:00Z',
        },
      ] as unknown as WarehouseReconciliationException[],
      fetchedAt: new Date().toISOString(),
      source: 'mock',
    }

    const { container } = render(<WarehouseReconciliationExceptionsPanel result={result} />)

    expectNoForbiddenClaims(container)
    expect(container.textContent?.toLowerCase()).not.toContain('low')
    expect(container.textContent?.toLowerCase()).not.toContain('low')
  })
})
