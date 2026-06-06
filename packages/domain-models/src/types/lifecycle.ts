/**
 * Lifecycle state controls how a product item appears in navigation.
 *
 * - live: visible to all authorised users
 * - pilot: visible only to users with pilot permission, shown with a pilot badge
 * - concept-lab: visible only inside the Concept Lab domain
 * - deprecated: hidden from navigation, preserved for existing deep links
 * - hidden: never rendered
 */
export type LifecycleState = 'live' | 'pilot' | 'concept-lab' | 'deprecated' | 'hidden'
