import { useMemo, useState } from 'react'
import type { WmOperationsAdapterRequest, WmOrderYieldItem, WmRecipeBenchmarkItem } from '../adapters/wm-operations-adapter.js'
import { useWmList, useWmOrderYield, useWmRecipeBenchmark, useWmWorklist } from '../adapters/wm-operations-queries.js'
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

function formatPct(value: number | null | undefined): string {
  return value == null ? '—' : `${(value * 100).toFixed(1)}%`
}

function formatHours(value: number | null | undefined): string {
  return value == null ? '—' : `${value.toFixed(1)} h`
}

function dateDurationHours(first: string | null, last: string | null): number | null {
  if (!first || !last) return null
  const hours = (new Date(last).getTime() - new Date(first).getTime()) / 3_600_000
  return Number.isFinite(hours) && hours > 0 ? hours : null
}

function median(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b)
  if (nums.length === 0) return null
  const mid = Math.floor(nums.length / 2)
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2
}

function lineKey(value: string | null | undefined): string {
  return value ?? 'UNASSIGNED'
}

function modeRecipe(rows: Array<{ readonly orderMaterialId: string | null; readonly orderProductionLine: string | null }>) {
  const counts = new Map<string, { materialId: string; productionLine: string; count: number }>()
  for (const row of rows) {
    if (!row.orderMaterialId) continue
    const productionLine = lineKey(row.orderProductionLine)
    const key = `${row.orderMaterialId}||${productionLine}`
    const current = counts.get(key)
    counts.set(key, { materialId: row.orderMaterialId, productionLine, count: (current?.count ?? 0) + 1 })
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count)[0] ?? null
}

function RecipeBenchmarkBand({
  label,
  low,
  medianValue,
  high,
  selectedValue,
  formatter,
}: {
  readonly label: string
  readonly low: number | null
  readonly medianValue: number | null
  readonly high: number | null
  readonly selectedValue: number | null
  readonly formatter: (value: number | null | undefined) => string
}) {
  const canRender = low != null && high != null && high > low
  const selectedPct = canRender && selectedValue != null
    ? Math.min(100, Math.max(0, ((selectedValue - low) / (high - low)) * 100))
    : null
  const medianPct = canRender && medianValue != null
    ? Math.min(100, Math.max(0, ((medianValue - low) / (high - low)) * 100))
    : null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: 'var(--kw-muted)' }}>
        <span>{label}</span>
        <span>{formatter(low)} - {formatter(high)}</span>
      </div>
      <div style={{ position: 'relative', height: 12, marginTop: 8, borderRadius: 3, background: 'var(--kw-border)', overflow: 'hidden' }}>
        {canRender ? <span style={{ position: 'absolute', inset: 0, background: 'color-mix(in srgb, var(--kw-sage) 42%, white)' }} /> : null}
        {medianPct != null ? <span style={{ position: 'absolute', left: `${medianPct}%`, top: 0, width: 2, height: '100%', background: 'var(--kw-valentia-slate)' }} /> : null}
        {selectedPct != null ? <span title="Selected campaign" style={{ position: 'absolute', left: `${selectedPct}%`, top: -2, width: 6, height: 16, borderRadius: 3, background: 'var(--kw-sunset)' }} /> : null}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6, fontSize: 11 }}>
        <span>Median {formatter(medianValue)}</span>
        <span>Campaign {formatter(selectedValue)}</span>
      </div>
    </div>
  )
}

/** Screen: campaign-grouped picking progress (LTBK ZZ_CAMPAIGN, WMA-E-29/50). */
export function CampaignsView({ request }: { readonly request: WmOperationsAdapterRequest }) {
  const [selected, setSelected] = useState<string | null>(null)
  const result = useWmList<CampaignRow>('/api/wm-operations/campaigns', {
    plant_id: request.plantId, warehouse_id: request.warehouseId, limit: 200,
  })
  const drill = useWmWorklist({ ...request, campaign: selected ?? undefined, includeComplete: true })
  const benchmark = useWmRecipeBenchmark(request.plantId, 500, Boolean(request.plantId))
  const orderYield = useWmOrderYield(request.plantId, 500, Boolean(request.plantId))

  const rows = result.data?.ok ? result.data.data : []
  const drillRows = selected && drill.data?.ok ? drill.data.data : []
  const benchmarkRows = benchmark.data?.ok ? benchmark.data.data : []
  const orderYieldRows = orderYield.data?.ok ? orderYield.data.data : []
  const error = result.data && !result.data.ok ? result.data.error : null
  const drillError = selected && drill.data && !drill.data.ok ? drill.data.error : null
  const benchmarkError = benchmark.data && !benchmark.data.ok ? benchmark.data.error : null
  const orderYieldError = orderYield.data && !orderYield.data.ok ? orderYield.data.error : null
  const active = rows.filter(r => (r.trCount ?? 0) > (r.completeTrs ?? 0))
  const selectedRecipe = useMemo(() => modeRecipe(drillRows), [drillRows])
  const selectedBenchmark = useMemo(
    () => selectedRecipe ? benchmarkRows.find(row =>
      row.materialId === selectedRecipe.materialId
      && lineKey(row.productionLine) === selectedRecipe.productionLine,
    ) ?? null : null,
    [benchmarkRows, selectedRecipe],
  )
  const selectedCampaignStats = useMemo(() => {
    if (!selectedRecipe) return { yieldPct: null, durationHours: null }
    const orderIds = new Set(
      drillRows
        .filter(row => row.referenceType === 'P' && row.referenceId)
        .map(row => row.referenceId as string),
    )
    const campaignRuns = orderYieldRows.filter((row: WmOrderYieldItem) =>
      orderIds.has(row.orderId)
      && row.materialId === selectedRecipe.materialId
      && lineKey(row.productionLine) === selectedRecipe.productionLine,
    )
    return {
      yieldPct: median(campaignRuns.map(row => row.yieldPct)),
      durationHours: median(campaignRuns.map(row => dateDurationHours(row.firstGrDate, row.lastGrDate))),
    }
  }, [drillRows, orderYieldRows, selectedRecipe])

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
        <div className="kw-card-title">Recipe benchmark</div>
        {benchmarkError ? <EmptyNote>Could not load recipe benchmarks — {benchmarkError.message}</EmptyNote>
          : orderYieldError ? <EmptyNote>Could not load campaign yield points — {orderYieldError.message}</EmptyNote>
          : selected && drill.isLoading ? <LoadingRows rows={2} />
          : !selected ? <EmptyNote>Select a campaign to compare its recipe-line performance.</EmptyNote>
          : !selectedRecipe ? <EmptyNote>Selected campaign has no material and production-line evidence yet.</EmptyNote>
          : !selectedBenchmark ? (
            <EmptyNote>No benchmark row for {selectedRecipe.materialId} on {selectedRecipe.productionLine}.</EmptyNote>
          ) : (
            <RecipeBenchmarkPanel
              benchmark={selectedBenchmark}
              campaignYieldPct={selectedCampaignStats.yieldPct}
              campaignDurationHours={selectedCampaignStats.durationHours}
            />
          )}
      </div>

      <div className="kw-card">
        <div className="kw-card-title">Campaign progress (click a campaign for its TRs)</div>
        {error ? <EmptyNote>Could not load campaigns — {error.message}</EmptyNote>
          : result.isLoading ? <LoadingRows rows={5} /> : rows.length === 0 ? (
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
          {drillError ? <EmptyNote>Could not load campaign TRs — {drillError.message}</EmptyNote>
            : <WorklistTable items={drillRows} isLoading={drill.isLoading} emptyMessage="No TRs found for this campaign." showWorkArea={false} />}
        </div>
      )}
    </section>
  )
}

function RecipeBenchmarkPanel({
  benchmark,
  campaignYieldPct,
  campaignDurationHours,
}: {
  readonly benchmark: WmRecipeBenchmarkItem
  readonly campaignYieldPct: number | null
  readonly campaignDurationHours: number | null
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, alignItems: 'center' }}>
      <div>
        <div className="kw-eyebrow">{benchmark.materialId} · {benchmark.productionLine}</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--kw-valentia-slate)', lineHeight: 1.1 }}>{benchmark.runCount ?? 0}</div>
        <div style={{ fontSize: 12, color: 'var(--kw-muted)' }}>complete benchmark runs</div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--kw-muted)' }}>
          Last run {benchmark.lastRunFinishDate ?? '—'}
        </div>
      </div>
      <RecipeBenchmarkBand
        label="Yield"
        low={benchmark.p10YieldPct}
        medianValue={benchmark.medianYieldPct}
        high={benchmark.p90YieldPct}
        selectedValue={campaignYieldPct}
        formatter={formatPct}
      />
      <RecipeBenchmarkBand
        label="Duration"
        low={benchmark.p10DurationHours}
        medianValue={benchmark.medianDurationHours}
        high={benchmark.p90DurationHours}
        selectedValue={campaignDurationHours}
        formatter={formatHours}
      />
    </div>
  )
}
