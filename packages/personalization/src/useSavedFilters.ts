import { useState, useCallback } from 'react'

const STORAGE_KEY = 'connectio.v2.savedFilters'

/** A saved filter preset for a workspace. */
export interface SavedFilter {
  readonly filterId: string
  readonly label: string
  readonly filters: Record<string, string | string[] | boolean>
  readonly savedAt: string
}

function storageKey(workspaceId: string): string {
  return `${STORAGE_KEY}.${workspaceId}`
}

function readFilters(workspaceId: string): SavedFilter[] {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId))
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedFilter[]) : []
  } catch {
    return []
  }
}

function writeFilters(workspaceId: string, filters: SavedFilter[]): void {
  try {
    localStorage.setItem(storageKey(workspaceId), JSON.stringify(filters))
  } catch {
    // localStorage unavailable — fail silently
  }
}

/**
 * Manages saved filter presets for a workspace.
 *
 * @returns Tuple of [savedFilters, saveFilter, deleteFilter] where:
 * - `savedFilters` is the current list of saved presets
 * - `saveFilter` adds or replaces a preset by filterId
 * - `deleteFilter` removes a preset by filterId
 */
export function useSavedFilters(workspaceId: string): [
  SavedFilter[],
  (filter: Omit<SavedFilter, 'savedAt'>) => void,
  (filterId: string) => void,
] {
  const [filters, setFilters] = useState<SavedFilter[]>(() => readFilters(workspaceId))

  const saveFilter = useCallback(
    (filter: Omit<SavedFilter, 'savedAt'>) => {
      setFilters(prev => {
        const next = [
          ...prev.filter(f => f.filterId !== filter.filterId),
          { ...filter, savedAt: new Date().toISOString() },
        ]
        writeFilters(workspaceId, next)
        return next
      })
    },
    [workspaceId],
  )

  const deleteFilter = useCallback(
    (filterId: string) => {
      setFilters(prev => {
        const next = prev.filter(f => f.filterId !== filterId)
        writeFilters(workspaceId, next)
        return next
      })
    },
    [workspaceId],
  )

  return [filters, saveFilter, deleteFilter]
}
