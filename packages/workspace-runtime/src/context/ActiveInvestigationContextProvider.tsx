import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { useStore } from 'zustand'
import { featureFlags } from '@connectio/feature-flags'
import type { ScopeContext } from '@connectio/data-contracts'
import type {
  ActiveInvestigationContext,
  ActiveInvestigationContextPatch,
} from './active-investigation-context.js'
import { normalizeInvestigationPatch } from './active-investigation-context.js'
import type {
  ActiveInvestigationStore,
  ActiveInvestigationStoreState,
} from './active-investigation-store.js'
import { createActiveInvestigationStore } from './active-investigation-store.js'
import {
  readInvestigationContextFromUrl,
  replaceInvestigationContextInBrowserUrl,
} from './url-sync.js'

const ActiveInvestigationStoreContext = createContext<ActiveInvestigationStore | null>(null)

export interface ActiveInvestigationContextProviderProps {
  readonly workspaceId: string
  readonly scope: ScopeContext
  readonly children: ReactNode
  readonly syncUrl?: boolean
  readonly urlDebounceMs?: number
}

export function ActiveInvestigationContextProvider({
  workspaceId,
  scope,
  children,
  syncUrl = true,
  urlDebounceMs = 150,
}: ActiveInvestigationContextProviderProps) {
  const enabled = featureFlags.runtime.enableCrossDomainContext
  const initialContext = useMemo(
    () => buildInitialContext(scope, enabled),
    // The provider is intentionally remounted per workspace in practice; this
    // memo only avoids recalculating URL parsing during normal child renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const storeRef = useRef<ActiveInvestigationStore>()

  if (!storeRef.current) {
    storeRef.current = createActiveInvestigationStore({ workspaceId, initialContext })
  }

  useEffect(() => {
    if (!enabled) return
    storeRef.current?.getState().setContext(scopeToPatch(scope))
  }, [enabled, scope])

  useEffect(() => {
    if (!enabled || !syncUrl || typeof window === 'undefined') return
    const store = storeRef.current
    if (!store) return
    const activeStore = store

    let timer: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = activeStore.subscribe((state) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        replaceInvestigationContextInBrowserUrl(state.context)
      }, urlDebounceMs)
    })

    function onPopState() {
      const fromUrl = readInvestigationContextFromUrl(window.location.search)
      activeStore.getState().replaceContext(fromUrl)
    }

    window.addEventListener('popstate', onPopState)

    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('popstate', onPopState)
      unsubscribe()
    }
  }, [enabled, syncUrl, urlDebounceMs])

  return (
    <ActiveInvestigationStoreContext.Provider value={storeRef.current}>
      {children}
    </ActiveInvestigationStoreContext.Provider>
  )
}

export function useActiveInvestigationContext<T>(
  selector: (state: ActiveInvestigationStoreState) => T,
): T {
  const store = useContext(ActiveInvestigationStoreContext)
  if (!store) {
    throw new Error('useActiveInvestigationContext must be used inside ActiveInvestigationContextProvider')
  }
  return useStore(store, selector)
}

export function useOptionalActiveInvestigationContext<T>(
  selector: (state: ActiveInvestigationStoreState) => T,
  fallback: T,
): T {
  const store = useContext(ActiveInvestigationStoreContext)
  const subscribe = useMemo(
    () => store
      ? (listener: () => void) => store.subscribe(listener)
      : () => () => undefined,
    [store],
  )
  const getSnapshot = useMemo(
    () => store
      ? () => selector(store.getState())
      : () => fallback,
    [fallback, selector, store],
  )
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useActiveInvestigationStore(): ActiveInvestigationStore {
  const store = useContext(ActiveInvestigationStoreContext)
  if (!store) {
    throw new Error('useActiveInvestigationStore must be used inside ActiveInvestigationContextProvider')
  }
  return store
}

function buildInitialContext(scope: ScopeContext, includeUrl: boolean): ActiveInvestigationContext {
  const base = normalizeInvestigationPatch({ timestamp: new Date().toISOString() }, scopeToPatch(scope))
  if (!includeUrl || typeof window === 'undefined') return base
  return normalizeInvestigationPatch(base, readInvestigationContextFromUrl(window.location.search))
}

function scopeToPatch(scope: ScopeContext): ActiveInvestigationContextPatch {
  return {
    batchId: scope.batchId,
    materialId: scope.materialId,
    plantId: scope.plantId,
    processOrderId: scope.processOrderId,
  }
}
