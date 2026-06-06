import type {
  ActiveInvestigationContext,
  ActiveInvestigationContextPatch,
} from './active-investigation-context.js'
import {
  createEmptyInvestigationContext,
  normalizeInvestigationPatch,
} from './active-investigation-context.js'

const PARAMS = {
  batchId: 'batchId',
  materialId: 'materialId',
  plantId: 'plantId',
  processOrderId: 'processOrderId',
  scopeFrom: 'scopeFrom',
  scopeTo: 'scopeTo',
} as const

export function readInvestigationContextFromUrl(
  search: string,
  now: () => string = () => new Date().toISOString(),
): ActiveInvestigationContext {
  const params = new URLSearchParams(search)
  const patch: ActiveInvestigationContextPatch = {
    batchId: getParam(params, PARAMS.batchId),
    materialId: getParam(params, PARAMS.materialId),
    plantId: getParam(params, PARAMS.plantId),
    processOrderId: getParam(params, PARAMS.processOrderId),
    scope: {
      from: parseDateParam(params.get(PARAMS.scopeFrom)),
      to: parseDateParam(params.get(PARAMS.scopeTo)),
    },
  }
  return normalizeInvestigationPatch(createEmptyInvestigationContext(now), patch, now)
}

export function writeInvestigationContextToUrl(
  search: string,
  context: ActiveInvestigationContext,
): string {
  const params = new URLSearchParams(search)
  setOptionalParam(params, PARAMS.batchId, context.batchId)
  setOptionalParam(params, PARAMS.materialId, context.materialId)
  setOptionalParam(params, PARAMS.plantId, context.plantId)
  setOptionalParam(params, PARAMS.processOrderId, context.processOrderId)
  setOptionalParam(params, PARAMS.scopeFrom, formatDateParam(context.scope?.from))
  setOptionalParam(params, PARAMS.scopeTo, formatDateParam(context.scope?.to))
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function replaceInvestigationContextInBrowserUrl(
  context: ActiveInvestigationContext,
): void {
  if (typeof window === 'undefined') return
  const nextSearch = writeInvestigationContextToUrl(window.location.search, context)
  const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (nextUrl === currentUrl) return
  window.history.replaceState(null, '', nextUrl)
}

function getParam(params: URLSearchParams, key: string): string | undefined {
  return params.get(key) || undefined
}

function setOptionalParam(params: URLSearchParams, key: string, value: string | undefined): void {
  if (value) {
    params.set(key, value)
  } else {
    params.delete(key)
  }
}

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function formatDateParam(value: Date | undefined): string | undefined {
  if (!value) return undefined
  return value.toISOString().slice(0, 10)
}
