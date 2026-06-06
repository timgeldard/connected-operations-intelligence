import type { ScopeContext } from '@connectio/data-contracts'

/** Identity resolved from the Databricks Apps proxy headers. */
export interface UserIdentity {
  readonly userId: string
  readonly email: string | null
  readonly displayName: string | null
  /** Identity provider group memberships (from JWT claims). */
  readonly groups: readonly string[]
  readonly isAuthenticated: boolean
  readonly catalogTarget?: 'uat' | 'prod'
}

/** A single scope dimension the user is authorised to access. */
export interface ScopeGrant {
  readonly scopeType: keyof ScopeContext
  readonly scopeId: string
  readonly displayName?: string
}

/** Full runtime auth+scope value provided by AuthScopeProvider. */
export interface AuthScopeValue {
  readonly user: UserIdentity
  readonly authorisedScopes: readonly ScopeGrant[]
  readonly activeScope: ScopeContext
  readonly setActiveScope: (scope: Partial<ScopeContext>) => void
  readonly isLoading: boolean
  readonly error: string | null
}
