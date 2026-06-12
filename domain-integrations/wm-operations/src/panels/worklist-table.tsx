import { useMemo } from 'react'
import type { WmWorklistItem } from '../adapters/wm-operations-adapter.js'
import { StatusChip, formatQty, formatTs, EmptyNote, LoadingRows } from '../components/kerry.js'

const WORK_AREA_LABEL: Record<string, string> = {
  PRODUCTION_STAGING: 'Staging',
  DISPENSARY_REPLENISHMENT: 'Disp. replen',
  DISPENSARY_PICKING: 'Dispensary pick',
  WAREHOUSE_OTHER: 'Warehouse',
}

function priorityClass(score: number | null): string {
  if (score == null) return 'kw-chip--neutral'
  if (score >= 100) return 'kw-chip--no-stock'
  if (score >= 80) return 'kw-chip--parked'
  if (score >= 60) return 'kw-chip--priority-yellow'
  return 'kw-chip--neutral'
}

function priorityLabel(score: number | null): string {
  return score == null ? 'P —' : `P ${score}`
}

export interface WorklistTableProps {
  readonly items: WmWorklistItem[]
  readonly isLoading: boolean
  /** When set, order-sourced rows (BETYP='P') render the reference as a drill-through. */
  readonly onOrderClick?: (item: WmWorklistItem) => void
  readonly emptyMessage?: string
  /** Hide the work-area column when the table is already scoped to one area. */
  readonly showWorkArea?: boolean
}

export function WorklistTable({
  items,
  isLoading,
  emptyMessage = 'No open jobs for this scope.',
  showWorkArea = true,
  onOrderClick,
}: WorklistTableProps) {
  const sortedItems = useMemo(() => {
    const dueTime = (value: string | null) => {
      if (!value) return Number.POSITIVE_INFINITY
      const parsed = new Date(value).getTime()
      return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
    }
    return [...items].sort((a, b) => {
      const scoreDelta = (b.priorityScore ?? -1) - (a.priorityScore ?? -1)
      if (scoreDelta !== 0) return scoreDelta
      const dueDelta = dueTime(a.demandDueTs) - dueTime(b.demandDueTs)
      if (dueDelta !== 0) return dueDelta
      return dueTime(a.plannedExecutionTs) - dueTime(b.plannedExecutionTs)
    })
  }, [items])

  if (isLoading) return <LoadingRows rows={6} />
  if (items.length === 0) return <EmptyNote>{emptyMessage}</EmptyNote>

  return (
    <div className="kw-table-wrap">
      <table className="kw-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Priority</th>
            <th>TR</th>
            {showWorkArea && <th>Work area</th>}
            <th>Order / Ref</th>
            <th>Material</th>
            <th>Required</th>
            <th>Open</th>
            <th>Progress</th>
            <th>Operator</th>
            <th>Queue</th>
            <th>Campaign</th>
            <th>Planned</th>
            <th>Age</th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map(item => (
            <tr key={`${item.warehouseId}-${item.trId}`}>
              <td>
                <StatusChip status={item.worklistStatus} />
                {item.isOverdue && (
                  <span
                    className="kw-chip kw-chip--no-stock"
                    style={{ marginLeft: 6 }}
                    title="Planned execution time has passed"
                  >
                    Overdue
                  </span>
                )}
              </td>
              <td>
                <span
                  className={`kw-chip ${priorityClass(item.priorityScore)}`}
                  title={item.demandDueTs ? `Demand due ${formatTs(item.demandDueTs)}` : 'No demand due timestamp'}
                >
                  <span className="kw-chip-dot" />
                  {priorityLabel(item.priorityScore)}
                </span>
              </td>
              <td className="kw-mono">{item.trId}</td>
              {showWorkArea && <td>{WORK_AREA_LABEL[item.workArea] ?? item.workArea}</td>}
              <td className="kw-mono">
                {item.referenceId && item.referenceType === 'P' && onOrderClick ? (
                  <button type="button" className="kw-link" onClick={() => onOrderClick(item)}>{item.referenceId}</button>
                ) : (item.referenceId ?? '—')}
              </td>
              <td>
                {item.materialCount != null && item.materialCount > 1 ? (
                  <span style={{ color: 'var(--kw-forest-60)' }}>
                    {item.materialCount} materials
                  </span>
                ) : (
                  <span title={item.materialId ?? undefined}>
                    {item.materialName ?? item.materialId ?? '—'}
                  </span>
                )}
              </td>
              <td className="kw-num">{formatQty(item.requiredQty, item.hasMixedBaseUom ? null : item.uom)}</td>
              <td className="kw-num">{formatQty(item.openQty, item.hasMixedBaseUom ? null : item.uom)}</td>
              <td>
                {item.pickProgressFraction != null ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="kw-progress" style={{ width: 64 }}>
                      <span style={{ width: `${Math.round(item.pickProgressFraction * 100)}%` }} />
                    </div>
                    <span className="kw-num" style={{ fontSize: 10.5 }}>
                      {Math.round(item.pickProgressFraction * 100)}%
                    </span>
                  </div>
                ) : (
                  '—'
                )}
              </td>
              <td>{item.assignedOperator ?? '—'}</td>
              <td className="kw-mono">{item.queue ?? '—'}</td>
              <td className="kw-mono">{item.campaignId ?? '—'}</td>
              <td className="kw-num">{formatTs(item.demandDueTs ?? item.plannedExecutionTs)}</td>
              <td className="kw-num">{item.ageHours != null ? `${item.ageHours.toFixed(0)}h` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
