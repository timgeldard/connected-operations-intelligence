import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { setFeatureFlags } from '@connectio/feature-flags'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import {
  ActiveInvestigationContextProvider,
  useActiveInvestigationContext,
  useOptionalActiveInvestigationContext,
} from '../context/ActiveInvestigationContextProvider.js'
import { useContextAwareEvidencePanel } from './useContextAwareEvidencePanel.js'

vi.mock('@connectio/telemetry', () => ({
  trackEvent: vi.fn(),
}))

const registration: EvidencePanelRegistration = {
  panelId: 'batch-release-summary',
  displayName: 'Release Summary',
  description: 'Summary',
  ownerDomain: 'quality',
  sourceOwnership: { domainId: 'quality', systemName: 'sap-qm' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: [],
  requiredContext: [
    { contextKey: 'batchId', scopeLevel: 'batch', required: true },
    { contextKey: 'plantId', scopeLevel: 'plant', required: true },
  ],
  freshnessPolicy: { staleAfterSeconds: 60, errorAfterSeconds: 120, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [],
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ActiveInvestigationContextProvider
      workspaceId="quality-batch-release"
      scope={{ plantId: 'IE10' }}
      syncUrl={false}
    >
      {children}
    </ActiveInvestigationContextProvider>
  )
}

describe('useContextAwareEvidencePanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setFeatureFlags({ 'runtime.enableCrossDomainContext': true })
  })

  afterEach(() => {
    setFeatureFlags({})
    vi.useRealTimers()
  })

  it('returns waiting-for-context when a required context key is missing', () => {
    const { result } = renderHook(
      () => useContextAwareEvidencePanel({
        registration,
        staleAfterSeconds: 60,
        lastRefreshedAt: null,
      }),
      { wrapper },
    )

    expect(result.current.displayState).toBe('waiting-for-context')
    expect(result.current.queryEnabled).toBe(false)
    expect(result.current.missingContextKeys).toEqual(['batchId'])
  })

  it('enables queries after required context appears and debounce elapses', () => {
    const { result } = renderHook(
      () => {
        const panel = useContextAwareEvidencePanel({
          registration,
          staleAfterSeconds: 60,
          lastRefreshedAt: null,
          debounceMs: 25,
        })
        const setContext = useActiveInvestigationContext((state) => state.setContext)
        return { panel, setContext }
      },
      { wrapper },
    )

    act(() => {
      result.current.setContext({ batchId: 'B-001', lastChangedByPanel: 'trace-query-form' })
    })

    expect(result.current.panel.queryEnabled).toBe(false)

    act(() => {
      vi.advanceTimersByTime(25)
    })

    expect(result.current.panel.queryEnabled).toBe(true)
    expect(result.current.panel.debouncedContext.batchId).toBe('B-001')
  })

  it('keeps backward-compatible query behavior when the flag is disabled', () => {
    setFeatureFlags({ 'runtime.enableCrossDomainContext': false })

    const { result } = renderHook(
      () => useContextAwareEvidencePanel({
        registration,
        staleAfterSeconds: 60,
        lastRefreshedAt: null,
      }),
      { wrapper },
    )

    expect(result.current.displayState).toBe('loading')
    expect(result.current.queryEnabled).toBe(true)
  })

  it('allows optional context consumers to render outside a provider', () => {
    const fallback = vi.fn()
    const { result } = renderHook(
      () => useOptionalActiveInvestigationContext((state) => state.setContext, fallback),
    )

    expect(result.current).toBe(fallback)
  })
})
