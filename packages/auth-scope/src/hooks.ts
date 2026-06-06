import { useContext } from 'react'
import { AuthScopeContext } from './ScopeProvider.js'
import type { AuthScopeValue } from './types.js'

/** Returns the current auth and scope context. Must be used inside AuthScopeProvider. */
export function useAuthScope(): AuthScopeValue {
  const ctx = useContext(AuthScopeContext)
  if (!ctx) {
    throw new Error('useAuthScope must be used inside <AuthScopeProvider>')
  }
  return ctx
}
