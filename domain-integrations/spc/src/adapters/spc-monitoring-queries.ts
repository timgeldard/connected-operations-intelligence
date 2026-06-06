import { useQuery } from '@tanstack/react-query'
import { spcMonitoringAdapter } from './spc-monitoring-adapter-factory.js'
import type { SPCMonitoringAdapterRequest } from './spc-monitoring-adapter.js'

const STALE = 5 * 60 * 1000

export function useSPCMonitoringContext(request: SPCMonitoringAdapterRequest) {
  return useQuery({
    queryKey: ['spc-monitoring-context', request.plantId ?? null, request.workCentreId ?? null, request.materialId ?? null, request.batchId ?? null],
    queryFn: () => spcMonitoringAdapter.getSPCMonitoringContext(request),
    staleTime: STALE,
    enabled: !!request.materialId,
  })
}

export function useSPCSummary(request: SPCMonitoringAdapterRequest) {
  return useQuery({
    queryKey: ['spc-summary', request.plantId ?? null, request.workCentreId ?? null, request.materialId ?? null, request.batchId ?? null],
    queryFn: () => spcMonitoringAdapter.getSPCSummary(request),
    staleTime: STALE,
    enabled: !!request.materialId,
  })
}

export function useActiveSPCSignals(request: SPCMonitoringAdapterRequest) {
  return useQuery({
    queryKey: ['spc-active-signals', request.plantId ?? null, request.workCentreId ?? null, request.materialId ?? null, request.batchId ?? null],
    queryFn: () => spcMonitoringAdapter.getActiveSPCSignals(request),
    staleTime: STALE,
    enabled: !!request.materialId,
  })
}

export function useMonitoredCharacteristics(request: SPCMonitoringAdapterRequest) {
  return useQuery({
    queryKey: ['spc-monitored-characteristics', request.plantId ?? null, request.materialId ?? null, request.workCentreId ?? null],
    queryFn: () => spcMonitoringAdapter.getMonitoredCharacteristics(request),
    staleTime: STALE,
    enabled: !!request.materialId,
  })
}

export function useControlChartSeries(request: SPCMonitoringAdapterRequest) {
  return useQuery({
    queryKey: ['spc-control-chart', request.plantId ?? null, request.characteristicId ?? null, request.batchId ?? null],
    queryFn: () => spcMonitoringAdapter.getControlChartSeries(request),
    staleTime: STALE,
    enabled: !!request.materialId,
  })
}

export function useCharacteristicCapability(request: SPCMonitoringAdapterRequest) {
  return useQuery({
    queryKey: ['spc-capability', request.plantId ?? null, request.characteristicId ?? null, request.materialId ?? null],
    queryFn: () => spcMonitoringAdapter.getCharacteristicCapability(request),
    staleTime: STALE,
    enabled: !!request.materialId,
  })
}

export function useSPCAlarmHistory(request: SPCMonitoringAdapterRequest) {
  return useQuery({
    queryKey: ['spc-alarm-history', request.plantId ?? null, request.workCentreId ?? null, request.materialId ?? null],
    queryFn: () => spcMonitoringAdapter.getSPCAlarmHistory(request),
    staleTime: STALE,
    enabled: !!request.materialId,
  })
}

export function useSPCRelatedBatches(request: SPCMonitoringAdapterRequest) {
  return useQuery({
    queryKey: ['spc-related-batches', request.plantId ?? null, request.materialId ?? null, request.batchId ?? null],
    queryFn: () => spcMonitoringAdapter.getSPCRelatedBatches(request),
    staleTime: STALE,
    enabled: !!request.materialId,
  })
}
