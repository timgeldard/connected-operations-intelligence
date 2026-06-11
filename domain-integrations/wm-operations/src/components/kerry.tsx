import type { ReactNode } from 'react'
import type { WmWorklistStatus } from '../adapters/wm-operations-adapter.js'

/** Hexagon keyline accent — Kerry micro-shape vocabulary ('molecules / building blocks'). */
export function HexAccent({ size = 44, color = 'var(--kw-valentia-slate)' }: { size?: number; color?: string }) {
  const h = (size * Math.sqrt(3)) / 2
  const points = [
    [size * 0.25, 0],
    [size * 0.75, 0],
    [size, h / 2],
    [size * 0.75, h],
    [size * 0.25, h],
    [0, h / 2],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(' ')
  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} aria-hidden="true">
      <polygon points={points} fill="none" stroke={color} strokeWidth={2} opacity={0.35} />
    </svg>
  )
}

/** Horizon keyline — 'Beyond the Horizon' micro-shape, used under view headers. */
export function HorizonKeyline({ width = 280 }: { width?: number }) {
  return (
    <div className="kw-horizon" style={{ width }}>
      <svg width={width} height={14} viewBox={`0 0 ${width} 14`} aria-hidden="true">
        <path
          d={`M0 13 Q ${width / 2} -10 ${width} 13`}
          fill="none"
          stroke="var(--kw-valentia-slate)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export interface ViewHeaderProps {
  readonly eyebrow: string
  readonly title: string
  readonly subtitle?: string
}

/** Kerry view header: mono eyebrow, condensed ALL-CAPS impact headline, serif subline. */
export function ViewHeader({ eyebrow, title, subtitle }: ViewHeaderProps) {
  return (
    <header className="kw-view-header">
      <div className="kw-eyebrow">{eyebrow}</div>
      <h1 className="kw-impact">{title}</h1>
      {subtitle && <p className="kw-sub">{subtitle}</p>}
      <HorizonKeyline />
    </header>
  )
}

const STATUS_CHIP_CLASS: Record<WmWorklistStatus, string> = {
  OPEN: 'kw-chip--open',
  IN_PROGRESS: 'kw-chip--in-progress',
  PARKED: 'kw-chip--parked',
  NO_STOCK: 'kw-chip--no-stock',
  COMPLETE: 'kw-chip--complete',
}

const STATUS_LABEL: Record<WmWorklistStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  PARKED: 'Parked',
  NO_STOCK: 'No stock',
  COMPLETE: 'Complete',
}

export function StatusChip({ status }: { status: WmWorklistStatus | string }) {
  const cls = STATUS_CHIP_CLASS[status as WmWorklistStatus] ?? 'kw-chip--neutral'
  const label = STATUS_LABEL[status as WmWorklistStatus] ?? status
  return (
    <span className={`kw-chip ${cls}`}>
      <span className="kw-chip-dot" />
      {label}
    </span>
  )
}

export function BandDot({ band }: { band: 'red' | 'amber' | 'green' | 'grey' | null | undefined }) {
  return <span className={`kw-band kw-band--${band ?? 'grey'}`} title={band ?? 'unknown'} />
}

export interface KpiTileProps {
  readonly label: string
  readonly value: ReactNode
  readonly tone?: 'alert' | 'warn' | 'ok' | 'none'
}

export function KpiTile({ label, value, tone = 'none' }: KpiTileProps) {
  const toneClass = tone === 'none' ? '' : ` kw-kpi--${tone}`
  return (
    <div className={`kw-kpi${toneClass}`}>
      <div className="kw-kpi-hex">
        <HexAccent />
      </div>
      <div className="kw-kpi-value">{value}</div>
      <div className="kw-kpi-label">{label}</div>
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="kw-empty">{children}</div>
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="kw-skeleton" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  )
}

export function formatQty(value: number | null | undefined, uom?: string | null): string {
  if (value == null) return '—'
  const formatted = value.toLocaleString(undefined, { maximumFractionDigits: 1 })
  return uom ? `${formatted} ${uom}` : formatted
}

export function formatTs(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}
