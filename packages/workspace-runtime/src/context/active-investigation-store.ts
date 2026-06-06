import { createStore } from 'zustand/vanilla'
import { devtools } from 'zustand/middleware'
import { trackEvent } from '@connectio/telemetry'
import type {
  ActiveInvestigationContext,
  ActiveInvestigationContextPatch,
} from './active-investigation-context.js'
import {
  createEmptyInvestigationContext,
  normalizeInvestigationPatch,
  validateInvestigationContext,
} from './active-investigation-context.js'

export interface ActiveInvestigationStoreState {
  readonly workspaceId: string
  readonly context: ActiveInvestigationContext
  readonly setContext: (patch: ActiveInvestigationContextPatch) => void
  readonly replaceContext: (context: ActiveInvestigationContext) => void
  readonly resetContext: () => void
}

export type ActiveInvestigationStore = ReturnType<typeof createActiveInvestigationStore>

export interface CreateActiveInvestigationStoreOptions {
  readonly workspaceId: string
  readonly initialContext?: ActiveInvestigationContext
  readonly now?: () => string
}

export function createActiveInvestigationStore({
  workspaceId,
  initialContext,
  now = () => new Date().toISOString(),
}: CreateActiveInvestigationStoreOptions) {
  const initial = initialContext
    ? validateInvestigationContext(initialContext)
    : createEmptyInvestigationContext(now)

  return createStore<ActiveInvestigationStoreState>()(
    devtools(
      (set, get) => ({
        workspaceId,
        context: initial,
        setContext: (patch) => {
          const previous = get().context
          const next = normalizeInvestigationPatch(previous, patch, now)
          set({ context: next }, false, 'activeInvestigation/setContext')
          trackContextChange(workspaceId, previous, next)
        },
        replaceContext: (context) => {
          const previous = get().context
          const next = validateInvestigationContext(context)
          set({ context: next }, false, 'activeInvestigation/replaceContext')
          trackContextChange(workspaceId, previous, next)
        },
        resetContext: () => {
          const previous = get().context
          const next = createEmptyInvestigationContext(now)
          set({ context: next }, false, 'activeInvestigation/resetContext')
          trackContextChange(workspaceId, previous, next)
        },
      }),
      { name: `connectio:${workspaceId}:active-investigation-context` },
    ),
  )
}

function trackContextChange(
  workspaceId: string,
  previous: ActiveInvestigationContext,
  next: ActiveInvestigationContext,
): void {
  if (contextsEqual(previous, next)) return
  trackEvent('workspace.context.changed', {
    workspaceId,
    panelId: next.lastChangedByPanel,
    properties: {
      batchIdChanged: previous.batchId !== next.batchId,
      materialIdChanged: previous.materialId !== next.materialId,
      plantIdChanged: previous.plantId !== next.plantId,
      processOrderIdChanged: previous.processOrderId !== next.processOrderId,
      lastChangedByPanel: next.lastChangedByPanel ?? null,
    },
  })
}

function contextsEqual(
  previous: ActiveInvestigationContext,
  next: ActiveInvestigationContext,
): boolean {
  return (
    previous.batchId === next.batchId &&
    previous.materialId === next.materialId &&
    previous.plantId === next.plantId &&
    previous.processOrderId === next.processOrderId &&
    previous.lastChangedByPanel === next.lastChangedByPanel &&
    previous.scope?.from?.getTime() === next.scope?.from?.getTime() &&
    previous.scope?.to?.getTime() === next.scope?.to?.getTime()
  )
}
