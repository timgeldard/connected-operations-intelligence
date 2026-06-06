import { useQuery } from "@tanstack/react-query"
import type {
  TraceInvestigationContext,
  BatchHeaderSummary,
  TraceGraph,
  MassBalanceSummary,
  CustomerExposureSummary,
  SupplierExposureSummary,
  ProductionHistorySummary,
  TraceEvent,
  CoAReleaseStatus,
  TraceRiskSignal,
  RelatedInvestigation,
  TraceExposureForRelease,
} from "@connectio/data-contracts"
import type { AdapterResult } from "@connectio/source-adapters"
import { toAdapterError } from "./trace2-adapter.js"
import type { Trace2AdapterRequest } from "./trace2-adapter.js"
import { trace2Adapter } from "./trace2-adapter-factory.js"

const TRACE_STALE_TIME_MS = 5 * 60 * 1000

interface QueryHookOptions {
  readonly enabled?: boolean
}

function traceKey(method: string, request: Trace2AdapterRequest) {
  return [
    "trace2", method,
    request.investigationId,
    request.materialId ?? null,
    request.batchId ?? null,
    request.plantId ?? null,
    request.direction ?? null,
    request.maxDepth ?? null,
    request.maxEdges ?? null,
  ] as const
}

export function useTraceInvestigationContext(request: Trace2AdapterRequest, options: QueryHookOptions = {}) {
  return useQuery<AdapterResult<TraceInvestigationContext>>({
    queryKey: traceKey("getInvestigationContext", request),
    queryFn: async () => { try { return await trace2Adapter.getInvestigationContext(request) } catch (e) { return toAdapterError<TraceInvestigationContext>(e) } },
    staleTime: TRACE_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

export function useBatchHeaderSummary(request: Trace2AdapterRequest, options: QueryHookOptions = {}) {
  return useQuery<AdapterResult<BatchHeaderSummary>>({
    queryKey: traceKey("getBatchHeaderSummary", request),
    queryFn: async () => { try { return await trace2Adapter.getBatchHeaderSummary(request) } catch (e) { return toAdapterError<BatchHeaderSummary>(e) } },
    staleTime: TRACE_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

export function useTraceGraph(request: Trace2AdapterRequest, options: QueryHookOptions = {}) {
  return useQuery<AdapterResult<TraceGraph>>({
    queryKey: traceKey("getTraceGraph", request),
    queryFn: async () => { try { return await trace2Adapter.getTraceGraph(request) } catch (e) { return toAdapterError<TraceGraph>(e) } },
    staleTime: TRACE_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

export function useMassBalanceSummary(request: Trace2AdapterRequest, options: QueryHookOptions = {}) {
  return useQuery<AdapterResult<MassBalanceSummary>>({
    queryKey: traceKey("getMassBalanceSummary", request),
    queryFn: async () => { try { return await trace2Adapter.getMassBalanceSummary(request) } catch (e) { return toAdapterError<MassBalanceSummary>(e) } },
    staleTime: TRACE_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

export function useCustomerExposureSummary(request: Trace2AdapterRequest, options: QueryHookOptions = {}) {
  return useQuery<AdapterResult<CustomerExposureSummary>>({
    queryKey: traceKey("getCustomerExposureSummary", request),
    queryFn: async () => { try { return await trace2Adapter.getCustomerExposureSummary(request) } catch (e) { return toAdapterError<CustomerExposureSummary>(e) } },
    staleTime: TRACE_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

export function useSupplierExposureSummary(request: Trace2AdapterRequest, options: QueryHookOptions = {}) {
  return useQuery<AdapterResult<SupplierExposureSummary>>({
    queryKey: traceKey("getSupplierExposureSummary", request),
    queryFn: async () => { try { return await trace2Adapter.getSupplierExposureSummary(request) } catch (e) { return toAdapterError<SupplierExposureSummary>(e) } },
    staleTime: TRACE_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

export function useProductionHistory(request: Trace2AdapterRequest, options: QueryHookOptions = {}) {
  return useQuery<AdapterResult<ProductionHistorySummary>>({
    queryKey: traceKey("getProductionHistory", request),
    queryFn: async () => { try { return await trace2Adapter.getProductionHistory(request) } catch (e) { return toAdapterError<ProductionHistorySummary>(e) } },
    staleTime: TRACE_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

export function useTraceEvents(request: Trace2AdapterRequest, options: QueryHookOptions = {}) {
  return useQuery<AdapterResult<readonly TraceEvent[]>>({
    queryKey: traceKey("getEventTimeline", request),
    queryFn: async () => { try { return await trace2Adapter.getEventTimeline(request) } catch (e) { return toAdapterError<readonly TraceEvent[]>(e) } },
    staleTime: TRACE_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

export function useCoAReleaseStatus(request: Trace2AdapterRequest, options: QueryHookOptions = {}) {
  return useQuery<AdapterResult<CoAReleaseStatus>>({
    queryKey: traceKey("getCoAReleaseStatus", request),
    queryFn: async () => { try { return await trace2Adapter.getCoAReleaseStatus(request) } catch (e) { return toAdapterError<CoAReleaseStatus>(e) } },
    staleTime: TRACE_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

export function useRiskSignals(request: Trace2AdapterRequest, options: QueryHookOptions = {}) {
  return useQuery<AdapterResult<readonly TraceRiskSignal[]>>({
    queryKey: traceKey("getRiskSignals", request),
    queryFn: async () => { try { return await trace2Adapter.getRiskSignals(request) } catch (e) { return toAdapterError<readonly TraceRiskSignal[]>(e) } },
    staleTime: TRACE_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

export function useRelatedInvestigations(request: Trace2AdapterRequest, options: QueryHookOptions = {}) {
  return useQuery<AdapterResult<readonly RelatedInvestigation[]>>({
    queryKey: traceKey("getRelatedInvestigations", request),
    queryFn: async () => { try { return await trace2Adapter.getRelatedInvestigations(request) } catch (e) { return toAdapterError<readonly RelatedInvestigation[]>(e) } },
    staleTime: TRACE_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

export function useTraceExposureForRelease(request: Trace2AdapterRequest, options: QueryHookOptions = {}) {
  return useQuery<AdapterResult<TraceExposureForRelease>>({
    queryKey: traceKey("getTraceExposureForRelease", request),
    queryFn: async () => { try { return await trace2Adapter.getTraceExposureForRelease(request) } catch (e) { return toAdapterError<TraceExposureForRelease>(e) } },
    staleTime: TRACE_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}
