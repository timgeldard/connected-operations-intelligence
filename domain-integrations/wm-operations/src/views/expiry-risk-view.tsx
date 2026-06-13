import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { useWmList } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatDate, formatQty } from '../components/kerry.js'

interface ExpiryRiskLine {
  plantId: string
  materialId: string
  materialName: string | null
  batchId: string
  uom: string | null
  unrestrictedQty: number | null
  qualityInspectionQty: number | null
  blockedQty: number | null
  restrictedUseQty: number | null
  inTransferQty: number | null
  blockedReturnsQty: number | null
  totalStockQty: number | null
  expiryDate: string | null
  daysToExpiry: number | null
  expiryBand: string
  manufactureDate: string | null
  vendorBatchNumber: string | null
  shelfLifeDays: number | null
  minimumRemainingShelfLifeDays: number | null
  standardPrice: number | null
  priceUnit: number | null
  estStockValue: number | null
  fefoRiskFlag: boolean | null
  earlierExpiringBatch: string | null
  latestIssueDate: string | null
}

const BAND_CHIP: Record<string, string> = {
  EXPIRED: 'kw-chip--no-stock',
  LT_30_DAYS: 'kw-chip--no-stock',
  DAYS_30_90: 'kw-chip--parked',
  DAYS_90_180: 'kw-chip--open',
  GT_180_DAYS: 'kw-chip--complete',
  NO_DATE: 'kw-chip--neutral',
}

const currency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

function formatValue(value: number | null | undefined): string {
  return value == null ? '—' : currency.format(value)
}

export function ExpiryRiskView({
  request,
  onNavigateToView,
}: {
  readonly request: WmOperationsAdapterRequest
  readonly onNavigateToView?: (viewId: string) => void
}) {
  const expiry = useWmList<ExpiryRiskLine>('/api/wm-operations/expiry-risk', {
    plant_id: request.plantId,
    limit: 500,
  })

  const rows = expiry.data?.ok ? expiry.data.data : []
  const error = expiry.data && !expiry.data.ok ? expiry.data.error : null
  const expiredValue = rows
    .filter(r => r.expiryBand === 'EXPIRED')
    .reduce((sum, r) => sum + (r.estStockValue ?? 0), 0)
  const next30Value = rows
    .filter(r => r.expiryBand === 'LT_30_DAYS')
    .reduce((sum, r) => sum + (r.estStockValue ?? 0), 0)
  const atRiskBatches = rows.filter(r => ['EXPIRED', 'LT_30_DAYS', 'DAYS_30_90'].includes(r.expiryBand)).length
  const fefoSignals = rows.filter(r => r.fefoRiskFlag).length

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Shelf-life risk"
        title="Expiry Risk"
        subtitle="Batch stock value at risk by expiry horizon, with FEFO issue signals where movement evidence exists."
      />
      <div className="kw-kpi-row">
        <KpiTile label="Expired value" value={formatValue(expiredValue)} tone={expiredValue > 0 ? 'alert' : 'none'} />
        <KpiTile label="Expiring <30d" value={formatValue(next30Value)} tone={next30Value > 0 ? 'warn' : 'none'} />
        <KpiTile label="Risk batches" value={atRiskBatches} tone={atRiskBatches > 0 ? 'warn' : 'none'} />
        <KpiTile label="FEFO signals" value={fefoSignals} tone={fefoSignals > 0 ? 'alert' : 'none'} />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">
          Batch expiry exposure
          <button
            type="button"
            className="kw-viewnav-tab"
            style={{ marginLeft: 'auto' }}
            onClick={() => onNavigateToView?.('stock-explorer')}
          >
            Open Stock & Bins
          </button>
        </div>
        {error ? <EmptyNote>Could not load expiry risk — {error.message}</EmptyNote>
          : expiry.isLoading ? <LoadingRows rows={7} />
            : rows.length === 0 ? <EmptyNote>No on-hand batch stock matched this scope.</EmptyNote> : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead>
                <tr>
                  <th>Band</th>
                  <th>Material</th>
                  <th>Batch</th>
                  <th>Vendor batch</th>
                  <th>Stock</th>
                  <th>Value</th>
                  <th>Expiry</th>
                  <th>Days</th>
                  <th>FEFO</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 80).map(row => (
                  <tr key={`${row.plantId}-${row.materialId}-${row.batchId}`}>
                    <td>
                      <span className={`kw-chip ${BAND_CHIP[row.expiryBand] ?? 'kw-chip--neutral'}`}>
                        {row.expiryBand}
                      </span>
                    </td>
                    <td title={row.materialId}>{row.materialName ?? row.materialId}</td>
                    <td className="kw-mono">{row.batchId}</td>
                    <td className="kw-mono">{row.vendorBatchNumber ?? '—'}</td>
                    <td className="kw-num">{formatQty(row.totalStockQty, row.uom)}</td>
                    <td className="kw-num">{formatValue(row.estStockValue)}</td>
                    <td className="kw-num">{formatDate(row.expiryDate)}</td>
                    <td className="kw-num">{row.daysToExpiry ?? '—'}</td>
                    <td>
                      {row.fefoRiskFlag ? (
                        <span className="kw-chip kw-chip--no-stock" title={`Earlier batch ${row.earlierExpiringBatch ?? 'available'}`}>
                          FEFO
                        </span>
                      ) : '—'}
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
