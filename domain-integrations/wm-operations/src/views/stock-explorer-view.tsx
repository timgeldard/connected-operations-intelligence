import { useState } from 'react'
import type {
  WmOperationsAdapterRequest,
  WmStorageZone,
} from '../adapters/wm-operations-adapter.js'
import { useWmBinStock } from '../adapters/wm-operations-queries.js'
import { BatchHistoryOverlay } from '../components/overlays.js'
import {
  ViewHeader,
  EmptyNote,
  LoadingRows,
  formatQty,
  formatDate,
} from '../components/kerry.js'

export interface StockExplorerViewProps {
  readonly request: WmOperationsAdapterRequest
}

const ZONE_OPTIONS: Array<{ value: WmStorageZone | ''; label: string }> = [
  { value: '', label: 'All zones' },
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'DISPENSARY', label: 'Dispensary' },
  { value: 'PRODUCTION_SUPPLY', label: 'Production supply' },
  { value: 'PALLETISING', label: 'Palletising' },
  { value: 'INTERIM', label: 'Interim (9xx)' },
]

export function StockExplorerView({ request }: StockExplorerViewProps) {
  const [zone, setZone] = useState<WmStorageZone | ''>('')
  const [material, setMaterial] = useState('')
  const [bin, setBin] = useState('')
  const [expiringOnly, setExpiringOnly] = useState(false)
  // Applied (committed) text filters — only sent on Enter/blur to avoid a query per keystroke.
  const [applied, setApplied] = useState<{ material?: string; bin?: string }>({})
  const [drill, setDrill] = useState<{ materialId: string; materialName?: string | null; batchId?: string | null } | null>(null)

  const result = useWmBinStock({
    ...request,
    storageZone: zone || undefined,
    materialId: applied.material || undefined,
    binId: applied.bin || undefined,
    expiringWithinDays: expiringOnly ? 90 : undefined,
  })

  const lines = result.data?.ok ? result.data.data : []
  const error = result.data && !result.data.ok ? result.data.error : null

  const applyTextFilters = () => setApplied({ material: material.trim(), bin: bin.trim() })

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Inventory"
        title="Stock & Bins"
        subtitle="Bin-level stock with zone, category, blocks, and shelf life — the answer to “where is it, and can I use it?”"
      />

      <div className="kw-card">
        <div className="kw-card-title">Stock explorer</div>
        <div className="kw-filters">
          <select aria-label="Filter by zone" value={zone} onChange={e => setZone(e.target.value as WmStorageZone | '')}>
            {ZONE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            aria-label="Filter by material"
            placeholder="Material…"
            value={material}
            onChange={e => setMaterial(e.target.value)}
            onBlur={applyTextFilters}
            onKeyDown={e => e.key === 'Enter' && applyTextFilters()}
          />
          <input
            aria-label="Filter by bin"
            placeholder="Bin…"
            value={bin}
            onChange={e => setBin(e.target.value)}
            onBlur={applyTextFilters}
            onKeyDown={e => e.key === 'Enter' && applyTextFilters()}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={expiringOnly}
              onChange={e => setExpiringOnly(e.target.checked)}
            />
            Expiring ≤ 90d
          </label>
          <span className="kw-eyebrow" style={{ marginLeft: 'auto' }}>
            {lines.length} quants
          </span>
          <button
            type="button"
            className="kw-viewnav-tab"
            disabled={lines.length === 0}
            onClick={() => {
              const cols = ['plantId', 'warehouseId', 'storageType', 'storageZone', 'binId', 'quantId', 'materialId', 'materialName', 'batchId', 'stockCategory', 'totalQty', 'availableQty', 'uom', 'goodsReceiptDate', 'expiryDate'] as const
              // RFC-4180 escaping (JSON.stringify would emit JSON \" and \n escapes, not CSV quoting).
              const escapeCsv = (value: unknown): string => {
                const text = value == null ? '' : String(value)
                return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
              }
              const csv = [cols.join(','), ...lines.map(l => cols.map(c => escapeCsv((l as unknown as Record<string, unknown>)[c])).join(','))].join('\r\n')
              const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
              const a = document.createElement('a')
              a.href = url
              a.download = 'wm-bin-stock.csv'
              a.click()
              // Revoke after the download has started — revoking synchronously can cancel it.
              setTimeout(() => URL.revokeObjectURL(url), 10_000)
            }}
          >
            Export CSV
          </button>
        </div>

        {error ? (
          <EmptyNote>Could not load stock — {error.message}</EmptyNote>
        ) : result.isLoading ? (
          <LoadingRows rows={8} />
        ) : lines.length === 0 ? (
          <EmptyNote>No stock matches these filters.</EmptyNote>
        ) : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>ST</th>
                  <th>Bin</th>
                  <th>Material</th>
                  <th>Batch</th>
                  <th>Total</th>
                  <th>Available</th>
                  <th>Category</th>
                  <th>GR date</th>
                  <th>Expiry</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => (
                  <tr key={`${line.warehouseId}-${line.quantId}`}>
                    <td style={{ fontSize: 11, color: 'var(--kw-forest-60)' }}>{line.storageZone ?? '—'}</td>
                    <td className="kw-mono">{line.storageType}</td>
                    <td className="kw-mono">{line.binId}</td>
                    <td title={line.materialId ?? undefined}>
                      {line.materialId ? (
                        <button type="button" className="kw-link" onClick={() => setDrill({ materialId: line.materialId as string, materialName: line.materialName, batchId: line.batchId })}>
                          {line.materialName ?? line.materialId}
                        </button>
                      ) : '—'}
                    </td>
                    <td className="kw-mono">{line.batchId ?? '—'}</td>
                    <td className="kw-num">{formatQty(line.totalQty, line.uom)}</td>
                    <td className="kw-num">{formatQty(line.availableQty, line.uom)}</td>
                    <td>
                      <span className={`kw-chip ${line.stockCategory === 'UNRESTRICTED' ? 'kw-chip--complete' : line.stockCategory === 'QUALITY' ? 'kw-chip--parked' : line.stockCategory ? 'kw-chip--no-stock' : 'kw-chip--neutral'}`}>
                        {line.stockCategory ?? '—'}
                      </span>
                    </td>
                    <td className="kw-num">{formatDate(line.goodsReceiptDate)}</td>
                    <td className="kw-num" style={line.isExpired ? { color: 'var(--kw-sunset)', fontWeight: 600 } : undefined}>
                      {formatDate(line.expiryDate)}
                      {line.daysToExpiry != null && ` (${line.daysToExpiry}d)`}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--kw-forest-60)' }}>
                      {[
                        line.isExpired ? 'Expired' : null,
                        line.isBlockedForStockRemoval ? 'Removal blocked' : null,
                        line.isBlockedForPutaway ? 'Putaway blocked' : null,
                        line.isBinBlocked ? `Bin blocked${line.blockingReasonCode ? ` (${line.blockingReasonCode})` : ''}` : null,
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
      {drill && request.plantId && (
        <BatchHistoryOverlay
          plantId={request.plantId}
          materialId={drill.materialId}
          materialName={drill.materialName}
          batchId={drill.batchId}
          onClose={() => setDrill(null)}
        />
      )}
    </section>
  )
}
