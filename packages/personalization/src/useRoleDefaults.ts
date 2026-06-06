import { useState, useCallback } from 'react'

const STORAGE_KEY = 'connectio.v2.roleDefaults'

/** Role-specific default view overrides for a workspace. */
export interface RoleDefaultOverrides {
  /** Default view to open when navigating to this workspace. */
  readonly defaultViewId?: string
  /** Default scope level to apply on workspace entry. */
  readonly defaultScopeLevel?: string
  /** Panel IDs to hide by default for this persona. */
  readonly hiddenPanelIds?: readonly string[]
}

function storageKey(workspaceId: string): string {
  return `${STORAGE_KEY}.${workspaceId}`
}

function readOverrides(workspaceId: string): RoleDefaultOverrides | null {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId))
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as RoleDefaultOverrides) : null
  } catch {
    return null
  }
}

function writeOverrides(workspaceId: string, overrides: RoleDefaultOverrides | null): void {
  try {
    const key = storageKey(workspaceId)
    if (overrides === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify(overrides))
    }
  } catch {
    // localStorage unavailable — fail silently
  }
}

/**
 * Manages role-specific default overrides for a workspace.
 *
 * Returns null when no overrides are saved (use registration defaults).
 * Returns an overrides object when the user has configured role-specific defaults.
 *
 * @param workspaceId The workspace to manage overrides for.
 */
export function useRoleDefaults(
  workspaceId: string,
): [RoleDefaultOverrides | null, (overrides: RoleDefaultOverrides | null) => void] {
  const [overrides, setOverrides] = useState<RoleDefaultOverrides | null>(() =>
    readOverrides(workspaceId),
  )

  const updateOverrides = useCallback(
    (next: RoleDefaultOverrides | null) => {
      writeOverrides(workspaceId, next)
      setOverrides(next)
    },
    [workspaceId],
  )

  return [overrides, updateOverrides]
}
