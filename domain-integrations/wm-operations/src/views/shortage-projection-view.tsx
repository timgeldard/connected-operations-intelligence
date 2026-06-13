import { useMemo, useState } from 'react'
import type { WmOperationsAdapterRequest, WmShortageProjectionItem, WmSupplyDemandLedgerItem } from '../adapters/wm-operations-adapter.js'
import { useWmShortageProjection, useWmSupplyDemandLedger } from '../adapters/wm-operations-queries.js'
import { setOrderJourneyDeepLink } from '../state/deep-link.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate, formatQty } from '../components/kerry.js'

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
}

function ShortageKpiStrip({ atRisk }: { readonly atRisk: WmShortageProjectionItem[] }) {
  const orders7d = new Set(
    atRisk.filter(r => {
      const d = daysUntil(r.requirementDate)
      return d != null && d <= 7
    }).map(r => r.orderId),
  ).size
  const orders14d = new Set(
    atRisk.filter(r => {
      const d = daysUntil(r.requirementDate)
      return d != null && d <= 14
    }).map(r => r.orderId),
  ).size
  const materialsShort = new Set(atRisk.map(r => r.materialId)).size

  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
      <KpiTile label="Orders at risk ≤7d" value={orders7d} tone={orders7d > 0 ? 'warn' : 'ok'} />
      <KpiTile label="Orders at risk ≤14d" value={orders14d} tone={orders14d > 0 ? 'warn' : 'none'} />
      <KpiTile label="Materials short" value={materialsShort} tone={materialsShort > 0 ? 'alert' : 'ok'} />
    </div>
  )
}

function AtRiskTable({
  items,
  isLoading,
  error,
  onOpenJourney,
  onSelectMaterial,
}: {
  readonly items: WmShortageProjectionItem[]
  readonly isLoading: boolean
  readonly error: string | null
  readonly onOpenJourney?: (orderId: string) => void
  readonly onSelectMaterial?: (materialId: string) => void
}) {
  if (isLoading) return <LoadingRows rows={6} />
  if (error) return <EmptyNote>Could not load shortage projection: {error}</EmptyNote>
  if (items.length === 0) return <EmptyNote>No projected shortages for open orders.</EmptyNote>

  return (
    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
      {items.map(r => (
        <div
          key={`${r.orderId}-${r.materialId}-${r.reservationRef}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px',
            fontSize: 12, borderBottom: '1px solid var(--kw-border, #e8e8e8)',
          }}
        >
          <span className="kw-mono" style={{ fontWeight: 700, minWidth: 90 }}>{r.orderId}</span>
          <button
            type="button"
            className="kw-viewnav-tab"
            style={{ fontSize: 11, padding: '2px 6px' }}
            onClick={() => onSelectMaterial?.(r.materialId)}
          >
            {r.materialId}
          </button>
          <span style={{ flex: 1, color: 'var(--kw-text-secondary, #444)' }}>
            {r.materialName ?? '—'}
          </span>
          <span style={{ minWidth: 72, color: 'var(--kw-text-muted, #888)' }}>
            {formatDate(r.requirementDate)}
          </span>
          <span style={{ minWidth: 70, color: 'var(--kw-text-muted, #888)' }}>
            {formatQty(r.projectedBalanceAtDemand, r.uom)}
          </span>
          <span style={{ minWidth: 72, color: 'var(--kw-warning, #e07b00)' }}>
            {formatDate(r.firstShortDate)}
          </span>
          {onOpenJourney && (
            <button
              type="button"
              className="kw-viewnav-tab"
              style={{ fontSize: 11, padding: '2px 6px' }}
              onClick={() => onOpenJourney(r.orderId)}
            >
              Journey
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function LedgerDrill({
  materialId,
  items,
  isLoading,
  error,
}: {
  readonly materialId: string | null
  readonly items: WmSupplyDemandLedgerItem[]
  readonly isLoading: boolean
  readonly error: string | null
}) {
  const rows = useMemo(() => {
    if (!materialId) return []
    return items
      .filter(r => r.materialId === materialId)
      .sort((a, b) => {
        const ad = a.eventDate ?? ''
        const bd = b.eventDate ?? ''
        if (ad !== bd) return ad.localeCompare(bd)
        return a.sortSeq - b.sortSeq
      })
  }, [items, materialId])

  if (!materialId) return <EmptyNote>Select a material from the at-risk table to view its ledger.</EmptyNote>
  if (isLoading) return <LoadingRows rows={4} />
  if (error) return <EmptyNote>Could not load ledger: {error}</EmptyNote>
  if (rows.length === 0) return <EmptyNote>No ledger events for {materialId}.</EmptyNote>

  return (
    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
      <div style={{ fontSize: 11, color: 'var(--kw-text-muted, #888)', marginBottom: 8 }}>
        Ledger for <strong>{materialId}</strong> — running balance by event date
      </div>
      {rows.map(r => (
        <div
          key={`${r.sourceDocumentId}-${r.eventDate ?? 'on-hand'}-${r.sortSeq}`}
          style={{
            display: 'grid', gridTemplateColumns: '90px 100px 1fr 80px 80px', gap: 8,
            padding: '5px 4px', fontSize: 12, borderBottom: '1px solid var(--kw-border, #e8e8e8)',
          }}
        >
          <span>{formatDate(r.eventDate) ?? 'On hand'}</span>
          <span>{r.eventSubtype}</span>
          <span className="kw-mono" style={{ color: 'var(--kw-text-muted, #888)' }}>{r.sourceDocumentId}</span>
          <span>{formatQty(r.signedQty, r.uom)}</span>
          <span style={{ fontWeight: 700 }}>{formatQty(r.runningBalance, r.uom)}</span>
        </div>
      ))}
    </div>
  )
}

export interface ShortageProjectionViewProps {
  readonly request: WmOperationsAdapterRequest
  readonly onNavigateToView?: (viewId: string) => void
}

export function ShortageProjectionView({ request, onNavigateToView }: ShortageProjectionViewProps) {
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null)
  const projectionResult = useWmShortageProjection(request.plantId, 500, Boolean(request.plantId))
  const ledgerResult = useWmSupplyDemandLedger(request.plantId, 1000, Boolean(request.plantId))

  const allRows: WmShortageProjectionItem[] = projectionResult.data?.ok ? projectionResult.data.data : []
  const atRisk = useMemo(() => allRows.filter(r => r.isProjectedShort), [allRows])
  const ledgerItems: WmSupplyDemandLedgerItem[] = ledgerResult.data?.ok ? ledgerResult.data.data : []

  const projectionError = projectionResult.data && !projectionResult.data.ok ? projectionResult.data.error.message : null
  const ledgerError = ledgerResult.data && !ledgerResult.data.ok ? ledgerResult.data.error.message : null

  function handleOpenJourney(orderId: string) {
    if (!onNavigateToView) return
    setOrderJourneyDeepLink({ plantId: request.plantId ?? undefined, orderId })
    onNavigateToView('order-journey')
  }

  if (!request.plantId) {
    return (
      <section>
        <ViewHeader eyebrow="Plan" title="Shortage Projection" subtitle="Select a plant to project component shortages." />
        <EmptyNote>No plant selected.</EmptyNote>
      </section>
    )
  }

  return (
    <section>
      <ViewHeader
        eyebrow="Plan"
        title="Shortage Projection"
        subtitle="Project available supply against open component demand — when orders go short, not just whether they are short now."
      />

      <ShortageKpiStrip atRisk={atRisk} />

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="kw-card" style={{ flex: '1 1 420px', minWidth: 300 }}>
          <div className="kw-card-title" style={{ marginBottom: 12 }}>At-risk orders</div>
          <AtRiskTable
            items={atRisk}
            isLoading={projectionResult.isLoading}
            error={projectionError}
            onOpenJourney={onNavigateToView ? handleOpenJourney : undefined}
            onSelectMaterial={setSelectedMaterial}
          />
        </div>

        <div className="kw-card" style={{ flex: '1 1 360px', minWidth: 280 }}>
          <div className="kw-card-title" style={{ marginBottom: 12 }}>Material ledger</div>
          <LedgerDrill
            materialId={selectedMaterial}
            items={ledgerItems}
            isLoading={ledgerResult.isLoading}
            error={ledgerError}
          />
        </div>
      </div>
    </section>
  )
}
