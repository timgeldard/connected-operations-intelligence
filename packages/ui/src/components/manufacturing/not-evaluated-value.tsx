export interface NotEvaluatedValueProps {
  className?: string
}

/**
 * Renders "Not Evaluated" for fields that require an evaluation step which has not yet run.
 * Use for application-heuristic fields where the heuristic has not been applied to this record.
 */
export function NotEvaluatedValue({ className }: NotEvaluatedValueProps) {
  return (
    <span
      className={className}
      style={{
        color: 'var(--fg-muted)',
        fontStyle: 'italic',
        fontSize: 'inherit',
      }}
    >
      Not evaluated
    </span>
  )
}
