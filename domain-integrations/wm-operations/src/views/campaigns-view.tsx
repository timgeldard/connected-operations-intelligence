import { useState } from 'react'
import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'
import { useWmList, useWmWorklist } from '../adapters/wm-operations-queries.js'
import { EmptyNote, KpiTile, LoadingRows, ViewHeader, formatQty, formatTs } from '../components/kerry.js'
import { WorklistTable } from '../panels/worklist-table.js'

interface CampaignRow {
  plantId: string; warehouseId: string; campaignId: string
  trCount: number | null; completeTrs: number | null; inProgressTrs: number | null
  parkedTrs: number | null; noStockTrs: number | null; orderCount: number | null
  operatorCount: number | null; workArea: string | null
  requiredQty: number | null; openQty: number | null
  earliestPlannedTs: string | null; earliestCreatedTs: string | null
}

/** Screen: campaign-grouped picking progress (LTBK ZZ_CAMPAIGN, WMA-E-29/50). */
export function CampaignsView({ request }: { readonly request: WmOperationsAdapterRequest }) {
  const [selected, setSelected] = useState<string | null>(null)
  const result = useWmList<CampaignRow>('/api/wm-operations/campaigns', {
    plant_id: request.plantId, warehouse_id: request.warehouseId, limit: 200,
  })
  const drill = useWmWorklist({ ...request, campaign: selected ?? undefined, includeComplete: true })

  const rows = result.data?.ok ? result.data.data : []
  const drillRows = selected && drill.data?.ok ? drill.data.data : []
  const active = rows.filter(r => (r.trCount ?? 0) > (r.completeTrs ?? 0))

  return (
    <section>
      <ViewHeader
        eyebrow="WM Operations · Campaign picking"
        title="Campaigns"
        subtitle="Shared-material campaign picks across orders — progress, who holds them, and what is parked."
      />
      <div className="kw-kpi-row">
        <KpiTile label="Campaigns" value={rows.length} />
        <KpiTile label="Active" value={active.length} />
        <KpiTile label="Parked TRs" value={rows.reduce((s, r) => s + (r.parkedTrs ?? 0), 0)} tone="warn" />
        <KpiTile label="Orders covered" value={rows.reduce((s, r) => s + (r.orderCount ?? 0), 0)} />
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Campaign progress (click a campaign for its TRs)</div>
        {result.isLoading ? <LoadingRows rows={5} /> : rows.length === 0 ? (
          <EmptyNote>No campaign-grouped TRs for this scope.</EmptyNote>
        ) : (
          <div className="kw-table-wrap">
            <table className="kw-table">
              <thead><tr><th>Campaign</th><th>Work area</th><th>TRs</th><th>Done</th><th>Progress</th><th>Parked</th><th>Orders</th><th>Operators</th><th>Open qty</th><th>Earliest planned</th></tr></thead>
              <tbody>
                {rows.map(c => {
                  const pct = c.trCount ? Math.round(((c.completeTrs ?? 0) / c.trCount) * 100) : 0
                  return (
                    <tr key={`${c.warehouseId}-${c.campaignId}`}>
                      <td><button type="button" className="kw-link" onClick={() => setSelected(c.campaignId)}>{c.campaignId}</button></td>
                      <td>{c.workArea ?? '—'}</td>
                      <td className="kw-num">{c.trCount ?? 0}</td>
                      <td className="kw-num">{c.completeTrs ?? 0}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="kw-progress" style={{ width: 64 }}><span style={{ width: `${pct}%` }} /></div>
                          <span className="kw-num" style={{ fontSize: 10.5 }}>{pct}%</span>
                        </div>
                      </td>
                      <td className="kw-num" style={(c.parkedTrs ?? 0) > 0 ? { color: 'var(--kw-sunset)', fontWeight: 600 } : undefined}>{c.parkedTrs ?? 0}</td>
                      <td className="kw-num">{c.orderCount ?? 0}</td>
                      <td className="kw-num">{c.operatorCount ?? 0}</td>
                      <td className="kw-num">{formatQty(c.openQty)}</td>
                      <td className="kw-num">{formatTs(c.earliestPlannedTs)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="kw-card">
          <div className="kw-card-title">
            Campaign {selected} — transfer requirements
            <button type="button" className="kw-viewnav-tab" style={{ marginLeft: 'auto' }} onClick={() => setSelected(null)}>Close</button>
          </div>
          <WorklistTable items={drillRows} isLoading={drill.isLoading} emptyMessage="No TRs found for this campaign." showWorkArea={false} />
        </div>
      )}
    </section>
  )
}
