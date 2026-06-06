export type { UserIdentity, ScopeGrant, AuthScopeValue } from './types.js'
export { AuthScopeContext, AuthScopeProvider } from './ScopeProvider.js'
export { useAuthScope } from './hooks.js'
export { hasPermission, isLifecycleVisible } from './permissions.js'
