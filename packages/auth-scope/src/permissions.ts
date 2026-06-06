import type { PermissionDefinition, LifecycleState } from '@connectio/product-model'
import type { UserIdentity } from './types.js'

/** Returns true when the user has the given permission (group-based check). */
export function hasPermission(
  user: UserIdentity,
  permission: PermissionDefinition,
): boolean {
  // In production this checks IdP group membership via the JWT groups claim.
  // The permissionId maps to a group name convention: e.g. 'quality.batch-release.approve'
  return user.groups.includes(permission.permissionId)
}

/** Returns true when the lifecycle state is visible to this user. */
export function isLifecycleVisible(user: UserIdentity, lifecycle: LifecycleState): boolean {
  switch (lifecycle) {
    case 'live':
      return true
    case 'pilot':
      // Pilot access is granted via a dedicated IdP group
      return user.groups.includes('connectio.pilot-access')
    case 'concept-lab':
      return user.groups.includes('connectio.concept-lab-access')
    case 'deprecated':
    case 'hidden':
      return false
  }
}
