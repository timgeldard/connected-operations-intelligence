import { createContext, useCallback, useState, type ReactNode } from 'react'
import type { ScopeContext } from '@connectio/data-contracts'
import type { AuthScopeValue, UserIdentity, ScopeGrant } from './types.js'

export const AuthScopeContext = createContext<AuthScopeValue | null>(null)

const ANONYMOUS_USER: UserIdentity = {
  userId: 'anonymous',
  email: null,
  displayName: null,
  groups: [],
  isAuthenticated: false,
}

interface AuthScopeProviderProps {
  readonly children: ReactNode
  /** Pre-loaded user identity (from /api/auth/session in production). */
  readonly user?: UserIdentity
  /** Pre-loaded authorised scopes. */
  readonly authorisedScopes?: readonly ScopeGrant[]
  /** Default active scope. */
  readonly defaultScope?: ScopeContext
}

/** Provides user identity and multi-dimensional scope context to the tree. */
export function AuthScopeProvider({
  children,
  user = ANONYMOUS_USER,
  authorisedScopes = [],
  defaultScope = {},
}: AuthScopeProviderProps) {
  const [activeScope, setActiveScopeState] = useState<ScopeContext>(defaultScope)

  const setActiveScope = useCallback((patch: Partial<ScopeContext>) => {
    setActiveScopeState((prev) => ({ ...prev, ...patch }))
  }, [])

  const value: AuthScopeValue = {
    user,
    authorisedScopes,
    activeScope,
    setActiveScope,
    isLoading: false,
    error: null,
  }

  return <AuthScopeContext.Provider value={value}>{children}</AuthScopeContext.Provider>
}
