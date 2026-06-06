import { useEffect } from 'react'
import { fetchJson } from '@connectio/data-contracts'

/**
 * Fetches the server-side workspace manifest on mount and merges any dynamic
 * registrations with the static {@link workspaceRegistry}.
 *
 * Phase 0 behaviour: the API endpoint does not yet exist in development, so
 * all fetch errors are silently swallowed. In Phase 1 this hook will merge
 * the manifest response into a writable registry store.
 *
 * @returns void — side-effect only hook.
 */
export function useManifestHydration(): void {
  useEffect(() => {
    fetchJson('/api/workspaces/manifest').catch(() => {
      // API unavailable in Phase 0 dev — silently ignore
    })
  }, [])
}
