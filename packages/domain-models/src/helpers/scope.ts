import type { ScopeLevel, ScopePolicy } from '../types/scope.js'

/** Returns true when the given scope level is supported by this policy. */
export function scopeIncludes(policy: ScopePolicy, level: ScopeLevel): boolean {
  return policy.supportedLevels.includes(level)
}

/** Returns the first supported scope level from the user's available scopes. */
export function resolveDefaultScope(
  policy: ScopePolicy,
  availableScopes: readonly ScopeLevel[],
): ScopeLevel | null {
  if (policy.autoElevate) {
    // Return the broadest supported scope the user has access to
    const ordered: ScopeLevel[] = ['global', 'region', 'plant', 'line', 'work-centre']
    for (const level of ordered) {
      if (availableScopes.includes(level) && scopeIncludes(policy, level)) {
        return level
      }
    }
  }
  if (availableScopes.includes(policy.defaultLevel) && scopeIncludes(policy, policy.defaultLevel)) {
    return policy.defaultLevel
  }
  const match = availableScopes.find((s) => scopeIncludes(policy, s))
  return match ?? null
}
