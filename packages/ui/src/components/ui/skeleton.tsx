import * as React from 'react'
import { cn } from '../../lib/utils'

/**
 * Skeleton — animated placeholder shown while content is loading.
 * Renders a pulsing grey rectangle that can be sized via className.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}

export { Skeleton }
