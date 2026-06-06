import { useState, useCallback } from 'react'
import type { RecentWorkspace } from './types.js'

const STORAGE_KEY = 'connectio.v2.recentWorkspaces'
const MAX_RECENT = 10

function readRecent(): RecentWorkspace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as RecentWorkspace[]) : []
  } catch {
    return []
  }
}

function writeRecent(items: RecentWorkspace[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore
  }
}

/** Manages the user's recently visited workspace list (last 10 visits). */
export function useRecentWorkspaces(): [
  RecentWorkspace[],
  (workspaceId: string, scopeSnapshot?: Record<string, string>) => void,
] {
  const [recent, setRecent] = useState<RecentWorkspace[]>(readRecent)

  const recordVisit = useCallback(
    (workspaceId: string, scopeSnapshot?: Record<string, string>) => {
      setRecent((prev) => {
        const filtered = prev.filter((r) => r.workspaceId !== workspaceId)
        const next: RecentWorkspace[] = [
          { workspaceId, visitedAt: new Date().toISOString(), scopeSnapshot },
          ...filtered,
        ].slice(0, MAX_RECENT)
        writeRecent(next)
        return next
      })
    },
    [],
  )

  return [recent, recordVisit]
}
