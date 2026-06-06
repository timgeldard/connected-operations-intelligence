import { useCallback, useEffect, useState } from 'react'

/** Immutable snapshot of URL-derived shell state. */
interface ShellState {
  /** The currently active workspace id, or null when on the home screen. */
  readonly workspaceId: string | null
  /**
   * The currently active tab id within the workspace, or null when unset.
   * @deprecated Use `viewId` for Phase 1+ workspaces. `tabId` is kept for
   * backwards compatibility with Phase 0 URL links.
   */
  readonly tabId: string | null
  /**
   * The active view within a workspace (e.g. 'overview', 'trace-tree').
   * Takes precedence over `tabId` when both are present.
   */
  readonly viewId: string | null
  /**
   * The active investigation ID for investigation-type workspaces.
   * Encoded as `?investigationId=X` in the URL.
   */
  readonly investigationId: string | null
  /**
   * The active release case ID for the Quality Batch Release workspace.
   * Encoded as `?releaseCaseId=X` in the URL.
   */
  readonly releaseCaseId: string | null
  /**
   * The active plan date for the Operations Plan Risk workspace.
   * Encoded as `?planDate=X` in the URL (ISO 8601 date: YYYY-MM-DD).
   */
  readonly planDate: string | null
  /** True when a workspace is selected and the scopebar should be shown. */
  readonly hasScope: boolean
}

/** Imperative actions that mutate the URL and trigger a re-render. */
interface ShellStateActions {
  /** Navigate to a workspace, clearing any previously active tab/view. */
  readonly setWorkspace: (workspaceId: string) => void
  /**
   * Activate a tab within the current workspace.
   * @deprecated Prefer `setView` for Phase 1+ workspaces.
   */
  readonly setTab: (tabId: string) => void
  /** Activate a view within the current workspace. */
  readonly setView: (viewId: string) => void
  /** Set the active investigation ID (for investigation-type workspaces). */
  readonly setInvestigationId: (investigationId: string) => void
  /** Navigate directly to a trace investigation with optional view selection. */
  readonly navigateToTraceInvestigation: (investigationId: string, viewId?: string) => void
  /** Set the active release case ID (for the Quality Batch Release workspace). */
  readonly setReleaseCaseId: (releaseCaseId: string) => void
  /** Navigate directly to the Quality Batch Release workspace with optional view selection. */
  readonly navigateToBatchRelease: (releaseCaseId: string, viewId?: string) => void
  /** Navigate directly to the Operations Plan Risk workspace with optional plan date and view. */
  readonly navigateToOperationsPlanRisk: (planDate?: string, viewId?: string) => void
  /** Navigate directly to the Environmental Monitoring workspace with optional view. */
  readonly navigateToEnvMon: (viewId?: string) => void
  /** Navigate directly to the Production Staging workspace with optional plan date and view. */
  readonly navigateToProductionStaging: (planDate?: string, viewId?: string) => void
  /** Navigate directly to the SPC Monitoring workspace with optional view. */
  readonly navigateToSPCMonitoring: (viewId?: string) => void
  /** Navigate directly to the Warehouse 360 workspace with optional view. */
  readonly navigateToWarehouse360: (viewId?: string) => void
  /** Navigate directly to the Maintenance & Reliability workspace with optional view. */
  readonly navigateToMaintenanceReliability: (viewId?: string) => void
}

/**
 * Updates the URL and notifies all `useWorkspaceShellState` hook instances.
 * `history.replaceState` does not fire `popstate`, so we dispatch it manually.
 */
function replaceUrl(params: URLSearchParams): void {
  history.replaceState(null, '', `?${params.toString()}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/**
 * Reads `?workspace=X&view=Y&investigationId=Z` from `window.location.search`
 * and returns a parsed {@link ShellState}.
 *
 * @returns Parsed shell state derived from the current URL search params.
 */
function readFromUrl(): ShellState {
  const params = new URLSearchParams(window.location.search)
  const workspaceId = params.get('workspace')
  const tabId = params.get('tab')
  const viewId = params.get('view')
  const investigationId = params.get('investigationId')
  const releaseCaseId = params.get('releaseCaseId')
  const planDate = params.get('planDate')
  return {
    workspaceId,
    tabId,
    viewId,
    investigationId,
    releaseCaseId,
    planDate,
    hasScope: workspaceId !== null,
  }
}

/**
 * URL-backed shell state hook — no router library dependency.
 *
 * @remarks
 * State is derived from `?workspace=X&view=Y&investigationId=Z` query
 * parameters and kept in sync with browser history via `popstate` events.
 * Mutations use `history.replaceState` so navigation does not add entries.
 *
 * Phase 1 additions:
 * - `viewId` — active workspace view (e.g. 'overview', 'trace-tree')
 * - `investigationId` — active investigation for investigation workspaces
 * - `setView` — sets `?view=X`
 * - `setInvestigationId` — sets `?investigationId=X`
 * - `navigateToTraceInvestigation` — sets workspace + investigationId + view atomically
 *
 * Phase 2 additions:
 * - `releaseCaseId` — active release case for the Quality Batch Release workspace
 * - `setReleaseCaseId` — sets `?releaseCaseId=X`
 * - `navigateToBatchRelease` — sets workspace + releaseCaseId + view atomically
 *
 * Phase 3 additions:
 * - `planDate` — active plan date for the Operations Plan Risk workspace
 * - `navigateToOperationsPlanRisk` — sets workspace + planDate + view atomically
 *
 * Phase 4 additions:
 * - `navigateToEnvMon` — sets workspace + view atomically for Environmental Monitoring
 * - `navigateToProductionStaging` — sets workspace + planDate + view atomically for Production Staging
 *
 * Phase 5 additions:
 * - `navigateToSPCMonitoring` — sets workspace + view atomically for SPC Monitoring
 * - `navigateToWarehouse360` — sets workspace + view atomically for Warehouse 360
 * - `navigateToMaintenanceReliability` — sets workspace + view atomically for Maintenance & Reliability
 *
 * @returns Combined shell state snapshot and action callbacks.
 */
export function useWorkspaceShellState(): ShellState & ShellStateActions {
  const [state, setState] = useState<ShellState>(readFromUrl)

  useEffect(() => {
    /** Re-sync state whenever the user navigates back/forward. */
    function onPopState() {
      setState(readFromUrl())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const setWorkspace = useCallback((workspaceId: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set('workspace', workspaceId)
    params.delete('tab')
    params.delete('view')
    params.delete('investigationId')
    replaceUrl(params)
  }, [])

  const setTab = useCallback((tabId: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set('tab', tabId)
    replaceUrl(params)
  }, [])

  const setView = useCallback((viewId: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set('view', viewId)
    replaceUrl(params)
  }, [])

  const setInvestigationId = useCallback((investigationId: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set('investigationId', investigationId)
    replaceUrl(params)
  }, [])

  const navigateToTraceInvestigation = useCallback(
    (investigationId: string, viewId = 'overview') => {
      const params = new URLSearchParams()
      params.set('workspace', 'trace-investigation')
      params.set('investigationId', investigationId)
      params.set('view', viewId)
      replaceUrl(params)
    },
    [],
  )

  const setReleaseCaseId = useCallback((releaseCaseId: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set('releaseCaseId', releaseCaseId)
    replaceUrl(params)
  }, [])

  const navigateToBatchRelease = useCallback(
    (releaseCaseId: string, viewId = 'release-queue') => {
      const params = new URLSearchParams()
      params.set('workspace', 'quality-batch-release')
      params.set('releaseCaseId', releaseCaseId)
      params.set('view', viewId)
      replaceUrl(params)
    },
    [],
  )

  const navigateToOperationsPlanRisk = useCallback(
    (planDate?: string, viewId = 'plan-overview') => {
      const params = new URLSearchParams()
      params.set('workspace', 'operations-plan-risk')
      if (planDate) params.set('planDate', planDate)
      params.set('view', viewId)
      replaceUrl(params)
    },
    [],
  )

  const navigateToEnvMon = useCallback(
    (viewId = 'scope-overview') => {
      const params = new URLSearchParams()
      params.set('workspace', 'envmon-monitoring')
      params.set('view', viewId)
      replaceUrl(params)
    },
    [],
  )

  const navigateToProductionStaging = useCallback(
    (planDate?: string, viewId = 'staging-overview') => {
      const params = new URLSearchParams()
      params.set('workspace', 'production-staging')
      if (planDate) params.set('planDate', planDate)
      params.set('view', viewId)
      replaceUrl(params)
    },
    [],
  )

  const navigateToSPCMonitoring = useCallback(
    (viewId = 'chart-overview') => {
      const params = new URLSearchParams()
      params.set('workspace', 'spc-monitoring')
      params.set('view', viewId)
      replaceUrl(params)
    },
    [],
  )

  const navigateToWarehouse360 = useCallback(
    (viewId = 'warehouse-overview') => {
      const params = new URLSearchParams()
      params.set('workspace', 'warehouse-360-overview')
      params.set('view', viewId)
      replaceUrl(params)
    },
    [],
  )

  const navigateToMaintenanceReliability = useCallback(
    (viewId = 'overview') => {
      const params = new URLSearchParams()
      params.set('workspace', 'maintenance-reliability')
      params.set('view', viewId)
      replaceUrl(params)
    },
    [],
  )

  return {
    ...state,
    setWorkspace,
    setTab,
    setView,
    setInvestigationId,
    navigateToTraceInvestigation,
    setReleaseCaseId,
    navigateToBatchRelease,
    navigateToOperationsPlanRisk,
    navigateToEnvMon,
    navigateToProductionStaging,
    navigateToSPCMonitoring,
    navigateToWarehouse360,
    navigateToMaintenanceReliability,
  }
}
