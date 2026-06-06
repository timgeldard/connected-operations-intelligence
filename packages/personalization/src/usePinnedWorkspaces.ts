import { useState, useCallback } from 'react'

const STORAGE_KEY = 'connectio.v2.pinnedWorkspaces'

function readPinned(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : null
  } catch {
    return null
  }
}

function writePinned(pins: string[] | null): void {
  try {
    if (pins === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pins))
    }
  } catch {
    // localStorage unavailable (private browsing) — fail silently
  }
}

/**
 * Manages the user's pinned workspace list from localStorage.
 *
 * Returns null when no preferences are saved (show all enabled workspaces).
 * Returns string[] once the user has customised the rail.
 *
 * @param selectableWorkspaceIds All user-selectable workspace IDs currently enabled.
 *   Used to seed the initial set when the user unpins for the first time.
 */
export function usePinnedWorkspaces(
  selectableWorkspaceIds: string[],
): [string[] | null, (workspaceId: string, pin: boolean) => void] {
  const [pinned, setPinned] = useState<string[] | null>(readPinned)

  const onPinToggle = useCallback(
    (workspaceId: string, pin: boolean) => {
      setPinned((prev) => {
        const current = prev ?? selectableWorkspaceIds
        const next = pin
          ? current.includes(workspaceId)
            ? current
            : [...current, workspaceId]
          : current.filter((id) => id !== workspaceId)
        writePinned(next.length > 0 ? next : null)
        return next.length > 0 ? next : null
      })
    },
    [selectableWorkspaceIds],
  )

  return [pinned, onPinToggle]
}
