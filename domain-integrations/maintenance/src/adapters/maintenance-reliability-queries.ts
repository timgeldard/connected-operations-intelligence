import { useQuery } from '@tanstack/react-query'
import { maintenanceReliabilityAdapter } from './maintenance-reliability-adapter.js'
import type { MaintenanceReliabilityAdapterRequest } from './maintenance-reliability-adapter.js'

const STALE = 5 * 60 * 1000

export function useMaintenanceReliabilityContext(request: MaintenanceReliabilityAdapterRequest) {
  return useQuery({
    queryKey: ['maintenance-reliability-context', request.plantId ?? null, request.lineId ?? null],
    queryFn: () => maintenanceReliabilityAdapter.getMaintenanceReliabilityContext(request),
    staleTime: STALE,
  })
}

export function useMaintenanceKpiSummary(request: MaintenanceReliabilityAdapterRequest) {
  return useQuery({
    queryKey: ['maintenance-kpi-summary', request.plantId ?? null, request.lineId ?? null],
    queryFn: () => maintenanceReliabilityAdapter.getMaintenanceKpiSummary(request),
    staleTime: STALE,
  })
}

export function useWorkOrders(request: MaintenanceReliabilityAdapterRequest) {
  return useQuery({
    queryKey: ['work-orders', request.plantId ?? null, request.lineId ?? null, request.equipmentId ?? null],
    queryFn: () => maintenanceReliabilityAdapter.getWorkOrders(request),
    staleTime: STALE,
  })
}

export function usePreventiveMaintenanceTasks(request: MaintenanceReliabilityAdapterRequest) {
  return useQuery({
    queryKey: ['pm-tasks', request.plantId ?? null, request.lineId ?? null],
    queryFn: () => maintenanceReliabilityAdapter.getPreventiveMaintenanceTasks(request),
    staleTime: STALE,
  })
}

export function useEquipmentAvailability(request: MaintenanceReliabilityAdapterRequest) {
  return useQuery({
    queryKey: ['equipment-availability', request.plantId ?? null, request.lineId ?? null],
    queryFn: () => maintenanceReliabilityAdapter.getEquipmentAvailability(request),
    staleTime: STALE,
  })
}

export function useReliabilityMetrics(request: MaintenanceReliabilityAdapterRequest) {
  return useQuery({
    queryKey: ['reliability-metrics', request.plantId ?? null, request.lineId ?? null, request.equipmentId ?? null],
    queryFn: () => maintenanceReliabilityAdapter.getReliabilityMetrics(request),
    staleTime: STALE,
  })
}

export function useMaintenanceBacklog(request: MaintenanceReliabilityAdapterRequest) {
  return useQuery({
    queryKey: ['maintenance-backlog', request.plantId ?? null],
    queryFn: () => maintenanceReliabilityAdapter.getMaintenanceBacklog(request),
    staleTime: STALE,
  })
}
