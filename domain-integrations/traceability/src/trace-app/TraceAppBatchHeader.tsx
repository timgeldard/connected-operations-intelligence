import type { BatchHeaderSummary } from '@connectio/data-contracts'
import { TRACE_APP_TABS, type TraceAppTabId } from './plants.js'

export interface TraceAppBatchHeaderProps {
  readonly batch: BatchHeaderSummary | null
  /** Echo of the resolved request (used when batch data is still loading or unavailable). */
  readonly request: { materialId: string; batchId: string; plantId: string }
  readonly activeTab: TraceAppTabId
  readonly onTabChange: (tab: TraceAppTabId) => void
  readonly onBack: () => void
  readonly tabCounts?: Partial<Record<TraceAppTabId, number>>
}

const STATUS_TONE: Record<string, { bg: string; fg: string; border: string }> = {
  released: tone('var(--jade, #44CF93)'),
  accepted: tone('var(--jade, #44CF93)'),
  active: tone('var(--jade, #44CF93)'),
  blocked: tone('var(--sunset, #F24A00)'),
  rejected: tone('var(--sunset, #F24A00)'),
  unrestricted: tone('var(--jade, #44CF93)'),
  'quality-inspection': tone('var(--sage, #289BA2)'),
  pending: tone('var(--sage, #289BA2)'),
  conditional: tone('var(--sage, #289BA2)'),
  restricted: tone('var(--sunrise, #F9C20A)'),
  transit: tone('var(--valentia-slate, #005776)'),
  'not-released': tone('var(--sunrise, #F9C20A)'),
}

function tone(color: string) {
  return { bg: `${color}1A`, fg: color, border: color }
}

export function TraceAppBatchHeader({
  batch,
  request,
  activeTab,
  onTabChange,
  onBack,
  tabCounts,
}: TraceAppBatchHeaderProps) {
  const totalStock = batch
    ? (batch.unrestricted ?? 0) +
      (batch.blocked ?? 0) +
      (batch.qualityInspection ?? 0) +
      (batch.restricted ?? 0) +
      (batch.transit ?? 0)
    : 0

  return (
    <div
      style={{
        background: 'white',
        borderBottom: '1px solid var(--shell-line, #E5E3D7)',
        position: 'sticky',
        top: 56,
        zIndex: 20,
        boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ padding: '16px 20px', display: 'flex', gap: 16, justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--valentia-slate, #005776)',
                fontFamily: 'inherit',
                fontSize: 11,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              ← Trace
            </button>
            <span>/</span>
            <span style={{ fontFamily: 'monospace' }}>{request.materialId}</span>
            <span>/</span>
            <span style={{ fontFamily: 'monospace', color: 'var(--forest, #143700)', fontWeight: 600 }}>
              {request.batchId}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--forest, #143700)' }}>
              {batch?.materialDescription ?? 'Loading…'}
            </h1>
            <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--shell-fg-2)' }}>
              Batch {request.batchId} · {request.materialId}
            </span>
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: 'var(--shell-fg-2)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'baseline',
            }}
          >
            {batch && (
              <>
                <span>
                  Plant{' '}
                  <b style={{ color: 'var(--forest, #143700)' }}>
                    {batch.plantName} · {batch.plantId}
                  </b>
                </span>
                <Sep />
                {batch.manufactureDate && (
                  <>
                    <span>
                      Mfg <b style={{ color: 'var(--forest, #143700)' }}>{new Date(batch.manufactureDate).toLocaleDateString()}</b>
                    </span>
                    <Sep />
                  </>
                )}
                {batch.expiryDate && (
                  <>
                    <span>
                      Expiry <b style={{ color: 'var(--forest, #143700)' }}>{new Date(batch.expiryDate).toLocaleDateString()}</b>
                    </span>
                    <Sep />
                  </>
                )}
                {batch.processOrderId && (
                  <>
                    <span>
                      Process order <b style={{ color: 'var(--forest, #143700)' }}>{batch.processOrderId}</b>
                    </span>
                    <Sep />
                  </>
                )}
                <span>
                  On hand{' '}
                  <b style={{ color: 'var(--forest, #143700)' }}>
                    {totalStock.toLocaleString()} {batch.uom ?? ''}
                  </b>
                </span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {batch && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <StatusPill status={batch.stockStatus} />
              <StatusPill status={batch.qualityStatus} />
              <StatusPill status={batch.releaseStatus} />
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: '0 12px',
          overflowX: 'auto',
          borderTop: '1px solid var(--shell-line, #E5E3D7)',
        }}
      >
        {TRACE_APP_TABS.map((t) => {
          const isActive = activeTab === t.id
          const count = tabCounts?.[t.id]
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive
                  ? '2px solid var(--valentia-slate, #005776)'
                  : '2px solid transparent',
                color: isActive ? 'var(--valentia-slate, #005776)' : 'var(--shell-fg-2)',
                fontWeight: isActive ? 600 : 500,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}
            >
              {t.label}
              {count != null && count > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 999,
                    background: isActive ? 'var(--valentia-slate, #005776)' : 'var(--shell-line, #E5E3D7)',
                    color: isActive ? 'white' : 'var(--shell-fg-2)',
                    fontWeight: 600,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const t = STATUS_TONE[status] ?? { bg: 'var(--shell-line)', fg: 'var(--shell-fg-2)', border: 'var(--shell-line)' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {status.replace(/-/g, ' ')}
    </span>
  )
}

function Sep() {
  return <span style={{ color: 'var(--shell-line, #E5E3D7)' }}>·</span>
}
