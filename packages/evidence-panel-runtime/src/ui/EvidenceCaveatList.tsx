import { CaveatBadge } from '@connectio/design-system'

export interface EvidenceCaveatListProps {
  caveats?: string[]
  className?: string
}

export function EvidenceCaveatList({ caveats, className }: EvidenceCaveatListProps) {
  if (!caveats || caveats.length === 0) return null

  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}
    >
      {caveats.map((caveat, index) => (
        <CaveatBadge key={index} label={caveat} />
      ))}
    </div>
  )
}
