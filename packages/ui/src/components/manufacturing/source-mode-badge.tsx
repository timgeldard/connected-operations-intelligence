import { StatusBadge } from './status-badge.js'

export type ExtendedSourceMode = 'mock' | 'legacy-api' | 'databricks-api' | 'mixed' | 'unavailable' | 'unknown'

export interface SourceModeBadgeProps {
  mode: ExtendedSourceMode
  className?: string
}

/**
 * Standard badge for displaying the data source mode.
 * Supports mock, legacy-api, databricks-api, mixed, and unavailable.
 */
export function SourceModeBadge({ mode, className }: SourceModeBadgeProps) {
  const config: Record<ExtendedSourceMode, { label: string; variant: 'neutral' | 'info' | 'good' | 'warn' | 'bad' }> = {
    mock: {
      label: 'Mock/Sandbox',
      variant: 'warn',
    },
    'legacy-api': {
      label: 'Legacy API',
      variant: 'info',
    },
    'databricks-api': {
      label: 'Databricks',
      variant: 'good',
    },
    mixed: {
      label: 'Mixed Sources',
      variant: 'info',
    },
    unavailable: {
      label: 'Source Unavailable',
      variant: 'bad',
    },
    unknown: {
      label: 'Source Unknown',
      variant: 'neutral',
    },
  }

  const { label, variant } = config[mode] || config.unknown

  return (
    <span title={mode === 'mock' ? 'Mock/sandbox evidence — not live source data.' : undefined}>
      <StatusBadge
        label={label}
        variant={variant}
        className={className}
      />
    </span>
  )
}
