import type { WmWorklistSummaryItem, WmWorkArea } from '../adapters/wm-operations-adapter.js'
import { KpiTile } from '../components/kerry.js'

export interface WorklistSummaryStripProps {
  readonly items: WmWorklistSummaryItem[]
  /** When set, KPI counts are limited to these work areas. */
  readonly workAreas?: readonly WmWorkArea[]
}

function countWhere(
  items: WmWorklistSummaryItem[],
  workAreas: readonly WmWorkArea[] | undefined,
  statuses: readonly string[],
): number {
  return items
    .filter(item => !workAreas || workAreas.includes(item.workArea))
    .filter(item => statuses.includes(item.worklistStatus))
    .reduce((sum, item) => sum + (item.trCount ?? 0), 0)
}

/** Manager KPI strip — open / in-progress / parked / no-stock job counts. */
export function WorklistSummaryStrip({ items, workAreas }: WorklistSummaryStripProps) {
  const open = countWhere(items, workAreas, ['OPEN'])
  const inProgress = countWhere(items, workAreas, ['IN_PROGRESS'])
  const parked = countWhere(items, workAreas, ['PARKED'])
  const noStock = countWhere(items, workAreas, ['NO_STOCK'])

  return (
    <div className="kw-kpi-row">
      <KpiTile label="Open jobs" value={open} />
      <KpiTile label="In progress" value={inProgress} tone="ok" />
      <KpiTile label="Parked" value={parked} tone={parked > 0 ? 'warn' : 'none'} />
      <KpiTile label="No stock" value={noStock} tone={noStock > 0 ? 'alert' : 'none'} />
    </div>
  )
}
