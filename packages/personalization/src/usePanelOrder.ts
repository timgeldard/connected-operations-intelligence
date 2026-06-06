import { useState, useCallback } from 'react'

const STORAGE_KEY = 'connectio.v2.panelOrder'

function storageKey(workspaceId: string, viewId: string): string {
  return `${STORAGE_KEY}.${workspaceId}.${viewId}`
}

function readOrder(workspaceId: string, viewId: string): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId, viewId))
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : null
  } catch {
    return null
  }
}

function writeOrder(workspaceId: string, viewId: string, order: string[] | null): void {
  try {
    const key = storageKey(workspaceId, viewId)
    if (order === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify(order))
    }
  } catch {
    // localStorage unavailable — fail silently
  }
}

/**
 * Manages user-customised panel ordering for a workspace view.
 *
 * Returns null when no override is saved (use registration defaultPanels order).
 * Returns string[] of panelIds in the user's preferred order when customised.
 */
export function usePanelOrder(
  workspaceId: string,
  viewId: string,
): [string[] | null, (order: string[] | null) => void] {
  const [order, setOrder] = useState<string[] | null>(() => readOrder(workspaceId, viewId))

  const updateOrder = useCallback(
    (next: string[] | null) => {
      writeOrder(workspaceId, viewId, next)
      setOrder(next)
    },
    [workspaceId, viewId],
  )

  return [order, updateOrder]
}
