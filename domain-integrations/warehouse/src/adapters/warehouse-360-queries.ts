import { useQuery } from '@tanstack/react-query'
import { warehouse360AdapterInstance as warehouse360Adapter } from './warehouse-360-adapter-factory.js'
import type { Warehouse360AdapterRequest } from './warehouse-360-adapter.js'

const STALE = 5 * 60 * 1000

export function useWarehouse360Context(request: Warehouse360AdapterRequest) {
  return useQuery({
    queryKey: ['warehouse-360-context', request.warehouseId ?? null, request.plantId ?? null],
    queryFn: () => warehouse360Adapter.getWarehouse360Context(request),
    staleTime: STALE,
  })
}

export function useWarehouse360Summary(request: Warehouse360AdapterRequest) {
  return useQuery({
    queryKey: ['warehouse-360-summary', request.warehouseId ?? null, request.plantId ?? null],
    queryFn: () => warehouse360Adapter.getWarehouse360Summary(request),
    staleTime: STALE,
  })
}

export function useStockOverview(request: Warehouse360AdapterRequest) {
  return useQuery({
    queryKey: ['stock-overview', request.warehouseId ?? null, request.plantId ?? null],
    queryFn: () => warehouse360Adapter.getStockOverview(request),
    staleTime: STALE,
  })
}

export function useOpenHolds(request: Warehouse360AdapterRequest) {
  return useQuery({
    queryKey: ['open-holds', request.warehouseId ?? null, request.plantId ?? null],
    queryFn: () => warehouse360Adapter.getOpenHolds(request),
    staleTime: STALE,
  })
}

export function useGoodsMovements(request: Warehouse360AdapterRequest) {
  return useQuery({
    queryKey: ['goods-movements', request.warehouseId ?? null, request.plantId ?? null],
    queryFn: () => warehouse360Adapter.getGoodsMovements(request),
    staleTime: STALE,
  })
}

export function useReplenishmentNeeds(request: Warehouse360AdapterRequest) {
  return useQuery({
    queryKey: ['replenishment-needs', request.warehouseId ?? null, request.plantId ?? null],
    queryFn: () => warehouse360Adapter.getReplenishmentNeeds(request),
    staleTime: STALE,
  })
}

export function useLocationCapacities(request: Warehouse360AdapterRequest) {
  return useQuery({
    queryKey: ['location-capacities', request.warehouseId ?? null, request.plantId ?? null],
    queryFn: () => warehouse360Adapter.getLocationCapacities(request),
    staleTime: STALE,
  })
}

export function useNearExpiryStock(request: Warehouse360AdapterRequest) {
  return useQuery({
    queryKey: ['near-expiry-stock', request.warehouseId ?? null, request.plantId ?? null],
    queryFn: () => warehouse360Adapter.getNearExpiryStock(request),
    staleTime: STALE,
  })
}

export function useWarehouseExceptions(request: Warehouse360AdapterRequest) {
  return useQuery({
    queryKey: ['warehouse-exceptions', request.warehouseId ?? null, request.plantId ?? null],
    queryFn: () => warehouse360Adapter.getWarehouseExceptions(request),
    staleTime: STALE,
  })
}

export function useWarehouseOverview(request: Warehouse360AdapterRequest) {
  return useQuery({
    queryKey: ['warehouse-overview-native', request.warehouseId ?? null, request.plantId ?? null, request.dateFrom ?? null, request.dateTo ?? null, request.limit ?? null],
    queryFn: () => warehouse360Adapter.getWarehouseOverview(request),
    staleTime: STALE,
  })
}

export function useWarehouseInbound(request: Warehouse360AdapterRequest) {
  return useQuery({
    queryKey: ['warehouse-inbound-native', request.warehouseId ?? null, request.plantId ?? null, request.dateFrom ?? null, request.dateTo ?? null, request.limit ?? null],
    queryFn: () => warehouse360Adapter.getWarehouseInbound(request),
    staleTime: STALE,
  })
}

export function useWarehouseOutbound(request: Warehouse360AdapterRequest) {
  return useQuery({
    queryKey: ['warehouse-outbound-native', request.warehouseId ?? null, request.plantId ?? null, request.dateFrom ?? null, request.dateTo ?? null, request.limit ?? null],
    queryFn: () => warehouse360Adapter.getWarehouseOutbound(request),
    staleTime: STALE,
  })
}

export function useWarehouseStaging(request: Warehouse360AdapterRequest) {
  return useQuery({
    queryKey: ['warehouse-staging-native', request.warehouseId ?? null, request.plantId ?? null, request.dateFrom ?? null, request.dateTo ?? null, request.limit ?? null],
    queryFn: () => warehouse360Adapter.getWarehouseStaging(request),
    staleTime: STALE,
  })
}

export function useWarehouseExceptionItems(request: Warehouse360AdapterRequest) {
  return useQuery({
    queryKey: ['warehouse-exceptions-native', request.warehouseId ?? null, request.plantId ?? null, request.dateFrom ?? null, request.dateTo ?? null, request.limit ?? null],
    queryFn: () => warehouse360Adapter.getWarehouseExceptionItems(request),
    staleTime: STALE,
  })
}
