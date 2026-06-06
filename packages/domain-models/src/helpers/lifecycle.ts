import type { LifecycleState } from '../types/lifecycle.js'

/** Returns true when the lifecycle state should be visible in standard navigation. */
export function isVisible(lifecycle: LifecycleState): boolean {
  return lifecycle === 'live' || lifecycle === 'pilot'
}

/** Returns true when the lifecycle state allows normal navigation routing. */
export function isNavigable(lifecycle: LifecycleState): boolean {
  return lifecycle === 'live' || lifecycle === 'pilot' || lifecycle === 'concept-lab'
}

/** Returns true when the lifecycle state should show a badge indicator. */
export function requiresLifecycleBadge(lifecycle: LifecycleState): boolean {
  return lifecycle === 'pilot' || lifecycle === 'concept-lab' || lifecycle === 'deprecated'
}

/** Human-readable label for the lifecycle state badge. */
export function lifecycleBadgeLabel(lifecycle: LifecycleState): string | null {
  switch (lifecycle) {
    case 'pilot':
      return 'Pilot'
    case 'concept-lab':
      return 'Concept'
    case 'deprecated':
      return 'Deprecated'
    default:
      return null
  }
}
