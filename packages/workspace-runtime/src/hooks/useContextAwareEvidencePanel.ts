import { useEffect, useMemo, useState } from 'react'
import { useEvidencePanel } from '@connectio/evidence-panel-runtime'
import { featureFlags } from '@connectio/feature-flags'
import { trackEvent } from '@connectio/telemetry'
import type { EvidencePanelDisplayState } from '@connectio/data-contracts'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { UseEvidencePanelOptions, UseEvidencePanelResult } from '@connectio/evidence-panel-runtime'
import type {
  ActiveInvestigationContext,
  InvestigationContextKey,
} from '../context/active-investigation-context.js'
import { INVESTIGATION_CONTEXT_KEYS } from '../context/active-investigation-context.js'
import { useActiveInvestigationContext } from '../context/ActiveInvestigationContextProvider.js'

export interface UseContextAwareEvidencePanelOptions
  extends Omit<UseEvidencePanelOptions, 'panelId'> {
  readonly registration: EvidencePanelRegistration
  readonly debounceMs?: number
}

export interface UseContextAwareEvidencePanelResult extends UseEvidencePanelResult {
  readonly context: ActiveInvestigationContext
  readonly debouncedContext: ActiveInvestigationContext
  readonly requiredContextKeys: readonly InvestigationContextKey[]
  readonly missingContextKeys: readonly InvestigationContextKey[]
  readonly hasRequiredContext: boolean
  readonly queryEnabled: boolean
  readonly displayState: EvidencePanelDisplayState
}

export function useContextAwareEvidencePanel({
  registration,
  staleAfterSeconds,
  lastRefreshedAt,
  debounceMs = 150,
}: UseContextAwareEvidencePanelOptions): UseContextAwareEvidencePanelResult {
  const base = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds,
    lastRefreshedAt,
  })
  const enabled = featureFlags.runtime.enableCrossDomainContext
  const workspaceId = useActiveInvestigationContext((state) => state.workspaceId)
  const context = useActiveInvestigationContext((state) => state.context)
  const debouncedContext = useDebouncedValue(context, debounceMs)
  const requiredContextKeys = useMemo(
    () => registration.requiredContext
      .filter((requirement) => requirement.required)
      .map((requirement) => requirement.contextKey)
      .filter(isInvestigationContextKey),
    [registration.requiredContext],
  )
  const missingContextKeys = useMemo(
    () => requiredContextKeys.filter((key) => !contextHasValue(debouncedContext, key)),
    [debouncedContext, requiredContextKeys],
  )
  const hasRequiredContext = missingContextKeys.length === 0
  const queryEnabled = !enabled || hasRequiredContext
  const displayState: EvidencePanelDisplayState =
    enabled && !hasRequiredContext ? 'waiting-for-context' : base.displayState

  useEffect(() => {
    if (!enabled || hasRequiredContext) return
    trackEvent('panel.context.waiting', {
      workspaceId,
      panelId: registration.panelId,
      properties: {
        missingContextKeys: missingContextKeys.join(','),
      },
    })
  }, [enabled, hasRequiredContext, missingContextKeys, registration.panelId, workspaceId])

  useEffect(() => {
    if (!enabled || !hasRequiredContext) return
    trackEvent('panel.context.query-enabled', {
      workspaceId,
      panelId: registration.panelId,
      properties: {
        requiredContextKeys: requiredContextKeys.join(','),
      },
    })
  }, [enabled, hasRequiredContext, registration.panelId, requiredContextKeys, workspaceId])

  return {
    ...base,
    displayState,
    context,
    debouncedContext,
    requiredContextKeys,
    missingContextKeys,
    hasRequiredContext,
    queryEnabled,
  }
}

function useDebouncedValue<T>(value: T, debounceMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), debounceMs)
    return () => clearTimeout(timer)
  }, [debounceMs, value])

  return debounced
}

function contextHasValue(context: ActiveInvestigationContext, key: InvestigationContextKey): boolean {
  if (key === 'scope') return Boolean(context.scope?.from || context.scope?.to)
  return Boolean(context[key])
}

function isInvestigationContextKey(key: string): key is InvestigationContextKey {
  return INVESTIGATION_CONTEXT_KEYS.includes(key as InvestigationContextKey)
}
