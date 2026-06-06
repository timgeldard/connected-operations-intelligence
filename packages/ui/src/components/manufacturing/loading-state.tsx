import { Skeleton } from '../ui/skeleton'

export interface LoadingStateProps {
  /** Number of skeleton lines to render; defaults to 3. */
  lines?: number
  className?: string
}

/**
 * LoadingState renders a column of pulsing Skeleton lines while data is loading.
 * The number of lines is configurable to match the expected content density.
 */
export function LoadingState({ lines = 3, className }: LoadingStateProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-6)',
      }}
    >
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          style={{ height: '1rem', width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}
