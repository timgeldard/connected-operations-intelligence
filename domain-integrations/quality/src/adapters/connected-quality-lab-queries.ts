import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type {
  ConnectedQualityLabFailuresResponse,
  ConnectedQualityLabPlantsResponse,
} from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import {
  connectedQualityLabAdapterInstance,
  toConnectedQualityLabAdapterError,
} from './connected-quality-lab-databricks-adapter.js'
import type { ConnectedQualityLabAdapterRequest } from './connected-quality-lab-databricks-adapter.js'

const LAB_FAILURES_STALE_TIME_MS = 60 * 1000
const LAB_PLANTS_STALE_TIME_MS = 10 * 60 * 1000

/** Shape of a plant row returned by /api/wm-operations/plants. */
interface WmPlantRow {
  readonly plantId: string
  readonly warehouseId: string
}

const FALLBACK_PLANTS: WmPlantRow[] = [
  { plantId: 'C061', warehouseId: '104' },
  { plantId: 'P817', warehouseId: '208' },
  { plantId: 'P806', warehouseId: '190' },
  { plantId: 'C351', warehouseId: '105' },
]

/**
 * Fetch the governed plant list from /api/wm-operations/plants (same endpoint used
 * by the CommandPalette). Falls back to FALLBACK_PLANTS on any fetch error so the
 * picker always has options.
 */
export function useLabBoardPlants(): { plants: WmPlantRow[] } {
  const [plants, setPlants] = useState<WmPlantRow[]>(FALLBACK_PLANTS)

  useEffect(() => {
    let cancelled = false
    fetch('/api/wm-operations/plants?limit=50', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((rows: WmPlantRow[]) => {
        if (!cancelled && Array.isArray(rows) && rows.length > 0) {
          setPlants(rows)
        }
      })
      .catch(() => {
        // Keep FALLBACK_PLANTS on any error.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { plants }
}

export function useConnectedQualityLabFailures(request: ConnectedQualityLabAdapterRequest) {
  return useQuery<AdapterResult<ConnectedQualityLabFailuresResponse>>({
    queryKey: [
      'connected-quality-lab',
      'failures',
      request.plantId ?? null,
      request.lotType ?? null,
      request.days ?? null,
    ] as const,
    queryFn: async () => {
      try {
        return await connectedQualityLabAdapterInstance.getLabFailures(request)
      } catch (e) {
        return toConnectedQualityLabAdapterError<ConnectedQualityLabFailuresResponse>(e)
      }
    },
    staleTime: LAB_FAILURES_STALE_TIME_MS,
  })
}

export function useConnectedQualityLabPlants() {
  return useQuery<AdapterResult<ConnectedQualityLabPlantsResponse>>({
    queryKey: ['connected-quality-lab', 'plants'] as const,
    queryFn: async () => {
      try {
        return await connectedQualityLabAdapterInstance.getLabPlants()
      } catch (e) {
        return toConnectedQualityLabAdapterError<ConnectedQualityLabPlantsResponse>(e)
      }
    },
    staleTime: LAB_PLANTS_STALE_TIME_MS,
  })
}
