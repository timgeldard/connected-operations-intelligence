import { afterEach, describe, expect, it, vi } from 'vitest'
import { WmOperationsAdapter } from './wm-operations-adapter.js'

const NOW = () => '2026-06-10T12:00:00.000Z'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('WmOperationsAdapter', () => {
  it('fetches the worklist with scope and filter params', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse([
        {
          plantId: 'C061',
          warehouseId: '104',
          trId: '0000123456',
          workArea: 'PRODUCTION_STAGING',
          worklistStatus: 'IN_PROGRESS',
        },
      ]),
    )

    const adapter = new WmOperationsAdapter({ baseUrl: 'http://api.test', now: NOW })
    const result = await adapter.getWorklist({
      plantId: 'C061',
      warehouseId: '104',
      workArea: 'PRODUCTION_STAGING',
      status: 'IN_PROGRESS',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0].trId).toBe('0000123456')
      expect(result.fetchedAt).toBe(NOW())
      expect(result.source).toBe('databricks-api')
    }

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('http://api.test/api/wm-operations/worklist?')
    expect(url).toContain('plant_id=C061')
    expect(url).toContain('warehouse_id=104')
    expect(url).toContain('work_area=PRODUCTION_STAGING')
    expect(url).toContain('status=IN_PROGRESS')
  })

  it('maps a 401 to an unauthorized, non-retryable error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ detail: 'nope' }, 401))

    const adapter = new WmOperationsAdapter({ baseUrl: '', now: NOW })
    const result = await adapter.getWorklistSummary({ plantId: 'C061' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized')
      expect(result.error.retryable).toBe(false)
      expect(result.displayState).toBe('error')
    }
  })

  it('maps a network failure to a retryable network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))

    const adapter = new WmOperationsAdapter({ baseUrl: '', now: NOW })
    const result = await adapter.getOrderReadiness({ plantId: 'P817' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('network')
      expect(result.error.retryable).toBe(true)
    }
  })

  it('passes bin-stock filters through as query params', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]))

    const adapter = new WmOperationsAdapter({ baseUrl: '', now: NOW })
    const result = await adapter.getBinStock({
      plantId: 'P817',
      warehouseId: '208',
      storageZone: 'DISPENSARY',
      materialId: '1000123',
      expiringWithinDays: 30,
    })

    expect(result.ok).toBe(true)
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('/api/wm-operations/bin-stock?')
    expect(url).toContain('storage_zone=DISPENSARY')
    expect(url).toContain('material_id=1000123')
    expect(url).toContain('expiring_within_days=30')
  })
})
