import { useState, useEffect, useCallback } from 'react'
import type { EvidencePanelDisplayState } from '@connectio/data-contracts'

/** Input parameters for the useEvidencePanel hook. */
export interface UseEvidencePanelOptions {
  /**
   * Identifier of the panel.
   * Currently unused at runtime but accepted for future telemetry correlation
   * and to enforce call-site traceability. Pass `registration.panelId`.
   */
  panelId: string
  /**
   * Number of seconds after `lastRefreshedAt` before the panel transitions
   * to the `stale` state. Taken from the panel's `FreshnessPolicy`.
   */
  staleAfterSeconds: number
  /**
   * ISO 8601 timestamp of the last successful data refresh, or null when
   * the panel has never been refreshed.
   */
  lastRefreshedAt: string | null
}

/** Values returned by the useEvidencePanel hook. */
export interface UseEvidencePanelResult {
  /** Current display state managed by the hook. */
  displayState: EvidencePanelDisplayState
  /** Transition the panel to the `stale` state immediately. */
  markStale: () => void
  /** Transition the panel to the `ready` state and reset staleness timer. */
  markReady: () => void
  /** Transition the panel to the `error` state. */
  markError: () => void
}

/**
 * Manages display-state transitions for a single evidence panel.
 *
 * @remarks
 * Initial state is `loading`. Callers drive transitions to `ready` or `error`
 * via `markReady` / `markError`. The hook automatically transitions to `stale`
 * once `staleAfterSeconds` have elapsed since `lastRefreshedAt`. The staleness
 * timer uses a single `setTimeout` (not a polling interval) and resets whenever
 * `lastRefreshedAt` changes.
 */
export function useEvidencePanel({
  panelId: _panelId,
  staleAfterSeconds,
  lastRefreshedAt,
}: UseEvidencePanelOptions): UseEvidencePanelResult {
  const [displayState, setDisplayState] = useState<EvidencePanelDisplayState>('loading')

  const markReady = useCallback(() => {
    setDisplayState('ready')
  }, [])

  const markStale = useCallback(() => {
    setDisplayState('stale')
  }, [])

  const markError = useCallback(() => {
    setDisplayState('error')
  }, [])

  useEffect(() => {
    if (lastRefreshedAt === null) return

    const refreshedAt = new Date(lastRefreshedAt).getTime()
    if (isNaN(refreshedAt)) return

    const remainingMs = refreshedAt + staleAfterSeconds * 1000 - Date.now()

    if (remainingMs <= 0) {
      // Already past the stale threshold at mount time.
      setDisplayState('stale')
      return
    }

    const timerId = setTimeout(() => {
      setDisplayState('stale')
    }, remainingMs)

    return () => clearTimeout(timerId)
    // Only re-run when the refresh timestamp or policy changes.
    // displayState is intentionally excluded to avoid re-scheduling the timer
    // on state transitions unrelated to freshness.
     
  }, [lastRefreshedAt, staleAfterSeconds])

  return { displayState, markStale, markReady, markError }
}
