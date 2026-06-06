import { StatusBadge } from './status-badge.js'

export interface CaveatBadgeProps {
  /** Short description of the caveat, e.g. "Field not in view". Defaults to "Caveat". */
  label?: string
  className?: string
}

/**
 * Warn-coloured pill for known data caveats that a reviewer should be aware of.
 * Used on panels that are UAT-ready but carry documented limitations.
 */
export function CaveatBadge({ label = 'Caveat', className }: CaveatBadgeProps) {
  return <StatusBadge label={label} variant="warn" className={className} />
}
