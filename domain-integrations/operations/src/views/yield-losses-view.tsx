import type { CSSProperties } from 'react'
import type { ProcessOrderHeader } from '@connectio/data-contracts'
import { OrderProgressPanel } from '../panels/order-progress-panel.js'
import { OrderStagingContextPanel } from '../panels/order-staging-context-panel.js'
import { useProcessOrderHeader } from '../adapters/process-order-review-queries.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface YieldLossesViewProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

export function YieldLossesView({ request }: YieldLossesViewProps) {
  const { data: headerResult } = useProcessOrderHeader(request)
  const header = headerResult?.ok ? headerResult.data : null

  return (
    <div style={GRID}>
      {header && <YieldSummaryCard header={header} />}
      <OrderProgressPanel request={request} />
      <OrderStagingContextPanel request={request} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Yield summary card — derived from ProcessOrderHeader; no new adapter method
// ---------------------------------------------------------------------------

const YIELD_COLOR = {
  good: '#388E3C',
  warn: '#D97706',
  poor: '#D32F2F',
}

function yieldColor(pct: number): string {
  if (pct >= 95) return YIELD_COLOR.good
  if (pct >= 85) return YIELD_COLOR.warn
  return YIELD_COLOR.poor
}

function YieldSummaryCard({ header }: { header: ProcessOrderHeader }) {
  const confirmed = header.confirmedQuantity
  const planned = header.plannedQuantity
  const hasYieldInputs = confirmed != null && planned != null && planned > 0

  const yieldPct = hasYieldInputs ? (confirmed / planned) * 100 : null
  const variance = confirmed != null && planned != null ? planned - confirmed : null
  const color = yieldPct != null ? yieldColor(yieldPct) : 'var(--shell-fg-3)'

  return (
    <div
      style={{
        background: 'var(--shell-surface)',
        border: '1px solid var(--shell-line)',
        borderRadius: 6,
        padding: '12px 16px',
      }}
      aria-label="Yield summary"
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--shell-fg-3)',
          marginBottom: 10,
        }}
      >
        Yield Summary
      </div>

      {/* Yield % hero */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 28, fontWeight: 700, color }}>
          {yieldPct != null ? `${Math.round(yieldPct)}%` : '—'}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color,
            border: `1px solid ${color}`,
            padding: '2px 8px',
            borderRadius: 3,
          }}
        >
          {yieldPct != null
            ? yieldPct >= 95
              ? 'On Target'
              : yieldPct >= 85
                ? 'Below Target'
                : 'Yield Risk'
            : 'Unavailable'}
        </span>
      </div>

      {/* Yield bar */}
      <div
        style={{
          height: 6,
          background: 'var(--shell-surface-2, #e5e7eb)',
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${yieldPct != null ? Math.min(100, yieldPct) : 0}%`,
            background: color,
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <YieldStat
          label="Confirmed"
          value={
            confirmed != null ? `${confirmed.toLocaleString()} ${header.uom ?? ''}`.trim() : '—'
          }
        />
        <YieldStat
          label="Planned"
          value={planned != null ? `${planned.toLocaleString()} ${header.uom ?? ''}`.trim() : '—'}
        />
        <YieldStat
          label="Variance"
          value={
            variance != null
              ? variance !== 0
                ? `${variance > 0 ? '-' : '+'}${Math.abs(variance).toLocaleString()} ${header.uom ?? ''}`.trim()
                : '—'
              : '—'
          }
          highlight={variance != null && variance > 0}
        />
      </div>
    </div>
  )
}

function YieldStat({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--shell-fg-3)',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: highlight ? 'var(--sunset, #F24A00)' : 'var(--shell-fg)',
        }}
      >
        {value}
      </div>
    </div>
  )
}
