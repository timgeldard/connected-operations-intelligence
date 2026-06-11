import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import {
  useWmBinStock,
  useWmWorklist,
  useWmWorklistSummary,
} from '../adapters/wm-operations-queries.js'
import {
  ViewHeader,
  EmptyNote,
  LoadingRows,
  formatQty,
  formatDate,
} from '../components/kerry.js'
import { WorklistTable } from '../panels/worklist-table.js'
import { WorklistSummaryStrip } from '../panels/worklist-summary-strip.js'

export interface DispensaryViewProps {
  readonly request: WmOperationsAdapterRequest
}

/** Dispensary stock lines expiring within this window are highlighted. */
const EXPIRY_ATTENTION_DAYS = 30

export function DispensaryView({ request }: DispensaryViewProps) {
  const summaryResult = useWmWorklistSummary(request)
  const pickingResult = useWmWorklist({ ...request, workArea: 'DISPENSARY_PICKING' })
  const replenResult = useWmWorklist({ ...request, workArea: 'DISPENSARY_REPLENISHMENT' })
  const stockResult = useWmBinStock({ ...request, storageZone: 'DISPENSARY' })

  const summary = summaryResult.data?.ok ? summaryResult.data.data : []
  const picking = pickingResult.data?.ok ? pickingResult.data.data : []
  const replen = replenResult.data?.ok ? replenResult.data.data : []
  const stock = stockResult.data?.ok ? stockResult.data.data : []
  const stockError = stockResult.data && !stockResult.data.ok ? stockResult.data.error : null

  // FEFO risk: an older-expiry quant of the same material also has available stock.
  const oldestExpiry = new Map<string, string>()
  for (const line of stock) {
    if (line.materialId && line.expiryDate && (line.availableQty ?? 0) > 0) {
      const cur = oldestExpiry.get(line.materialId)
      if (!cur || line.expiryDate < cur) oldestExpiry.set(line.materialId, line.expiryDate)
    }
  }
  const isFefoRisk = (line: typeof stock[number]) =>
    Boolean(line.materialId && line.expiryDate && (line.availableQty ?? 0) > 0
      && oldestExpiry.get(line.materialId) !== line.expiryDate)

  const attentionStock = stock.filter(
    line =>
      line.isExpired
      || (line.daysToExpiry != null && line.daysToExpiry <= EXPIRY_ATTENTION_DAYS)
      || line.isBlockedForStockRemoval
      || line.stockCategory === 'QUALITY'
      || line.stockCategory === 'BLOCKED'
      || isFefoRisk(line),
  )

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Dispensary"
        title="Dispensary Operations"
        subtitle="Open dispensing work, replenishment into the dispensary, and dispensary stock that needs attention."
      />

      <WorklistSummaryStrip
        items={summary}
        workAreas={['DISPENSARY_PICKING', 'DISPENSARY_REPLENISHMENT']}
      />

      <div className="kw-card">
        <div className="kw-card-title">Open dispensing work (dispensary → production)</div>
        <WorklistTable
          items={picking}
          isLoading={pickingResult.isLoading}
          emptyMessage="No open dispensary picking jobs."
          showWorkArea={false}
        />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Replenishment backlog (warehouse → dispensary)</div>
        <WorklistTable
          items={replen}
          isLoading={replenResult.isLoading}
          emptyMessage="No open dispensary replenishment."
          showWorkArea={false}
        />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">
          Dispensary stock needing attention
          <span className="kw-eyebrow" style={{ marginLeft: 'auto' }}>
            expiry ≤ {EXPIRY_ATTENTION_DAYS}d · blocked · QI
          </span>
        </div>
        {stockError ? (
          <EmptyNote>Could not load dispensary stock — {stockError.message}</EmptyNote>
        ) : stockResult.isLoading ? (
          <LoadingRows rows={4} />
        ) : attentionStock.length === 0 ? (
          <EmptyNote>
            Dispensary stock is healthy — nothing expired, blocked, or in quality inspection.
          </EmptyNote>
        ) : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead>
                <tr>
                  <th>Storage type</th>
                  <th>Bin</th>
                  <th>Material</th>
                  <th>Batch</th>
                  <th>Available</th>
                  <th>Category</th>
                  <th>Expiry</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {attentionStock.map(line => (
                  <tr key={`${line.warehouseId}-${line.quantId}`}>
                    <td className="kw-mono">{line.storageType}</td>
                    <td className="kw-mono">{line.binId}</td>
                    <td title={line.materialId ?? undefined}>
                      {line.materialName ?? line.materialId ?? '—'}
                    </td>
                    <td className="kw-mono">{line.batchId ?? '—'}</td>
                    <td className="kw-num">{formatQty(line.availableQty, line.uom)}</td>
                    <td>
                      <span className={`kw-chip ${line.stockCategory === 'UNRESTRICTED' ? 'kw-chip--complete' : line.stockCategory === 'QUALITY' ? 'kw-chip--parked' : 'kw-chip--no-stock'}`}>
                        {line.stockCategory ?? '—'}
                      </span>
                    </td>
                    <td className="kw-num" style={line.isExpired ? { color: 'var(--kw-sunset)', fontWeight: 600 } : undefined}>
                      {formatDate(line.expiryDate)}
                      {line.daysToExpiry != null && ` (${line.daysToExpiry}d)`}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--kw-forest-60)' }}>
                      {[
                        line.isExpired ? 'Expired' : null,
                        line.isBlockedForStockRemoval ? 'Removal blocked' : null,
                        line.isBinBlocked ? 'Bin blocked' : null,
                        isFefoRisk(line) ? 'FEFO risk (older batch available)' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
