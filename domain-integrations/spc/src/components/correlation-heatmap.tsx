import { useState } from 'react'
import {
  type CorrelationCell,
  type AlignedBatchPoint,
  computeCorrelationMatrix
} from '../utils/multivariate-analysis.js'
import type { ControlChartSeries } from '@connectio/data-contracts'

export interface CorrelationHeatmapProps {
  readonly allSeries: ControlChartSeries[]
  readonly alignedPoints: AlignedBatchPoint[]
}

export function CorrelationHeatmap({ allSeries, alignedPoints }: CorrelationHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<CorrelationCell | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  // Unique characteristics list
  const charIds = Array.from(new Set(allSeries.map(s => s.characteristicId)))
  const charNames = charIds.map(id => allSeries.find(s => s.characteristicId === id)?.characteristicName || id)

  const cells = computeCorrelationMatrix(allSeries, alignedPoints)

  // Get color for correlation value
  const getCellColor = (r: number | null) => {
    if (r === null) return 'var(--shell-surface-2, #1e1e24)'
    const abs = Math.abs(r)
    // Scale opacity based on correlation strength
    if (r > 0) {
      // Positive correlation -> Forest/Green style
      return `rgba(31, 139, 76, ${abs * 0.95})`
    } else {
      // Negative correlation -> Sunset/Red style
      return `rgba(242, 74, 0, ${abs * 0.95})`
    }
  }

  const getTextColor = (r: number | null) => {
    if (r === null) return 'var(--shell-fg-3, #a0a0a5)'
    const abs = Math.abs(r)
    return abs > 0.4 ? '#ffffff' : 'var(--shell-fg, #ffffff)'
  }

  const getCorrelationLabel = (r: number | null) => {
    if (r === null) return 'No aligned data'
    if (Math.abs(r) >= 0.7) return r > 0 ? 'Strong Positive' : 'Strong Negative'
    if (Math.abs(r) >= 0.3) return r > 0 ? 'Moderate Positive' : 'Moderate Negative'
    return 'Weak or No Correlation'
  }

  return (
    <div style={{ position: 'relative', width: '100%', userSelect: 'none', background: 'var(--shell-surface, #2a2a35)', padding: '24px', borderRadius: 'var(--radius-lg, 12px)', border: '1px solid var(--shell-line, #3a3a45)' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--fs-16, 16px)', fontWeight: 'var(--fw-bold, 700)', color: 'var(--shell-fg, #ffffff)' }}>Pearson Correlation Matrix</h3>
        <p style={{ margin: '4px 0 0 0', fontSize: 'var(--fs-12, 12px)', color: 'var(--shell-fg-3, #a0a0a5)' }}>
          Calculated across {alignedPoints.length} aligned batches. Green represents positive correlation, and red represents negative correlation.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `150px repeat(${charIds.length}, 1fr)`, gap: '4px', overflowX: 'auto' }}>
        {/* Top Left Header Cell */}
        <div></div>

        {/* Top Headers */}
        {charNames.map((name, i) => (
          <div key={`header-top-${i}`} style={{ padding: '8px', fontSize: '11px', fontWeight: '600', color: 'var(--shell-fg-2, #d1d1d6)', textAlign: 'center', wordBreak: 'break-word', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40px' }}>
            {name}
          </div>
        ))}

        {/* Rows */}
        {charIds.map((rowCharId, rowIndex) => {
          const rowName = charNames[rowIndex]

          return (
            <div key={`row-${rowCharId}`} style={{ display: 'contents' }}>
              {/* Row Left Label */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px', fontSize: '11px', fontWeight: '600', color: 'var(--shell-fg-2, #d1d1d6)', minHeight: '60px' }}>
                {rowName}
              </div>

              {/* Grid Cells */}
              {charIds.map((colCharId) => {
                const cell = cells.find(c => c.charIdA === rowCharId && c.charIdB === colCharId)
                const r = cell ? cell.r : null

                return (
                  <div
                    key={`cell-${rowCharId}-${colCharId}`}
                    style={{
                      background: getCellColor(r),
                      color: getTextColor(r),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: '700',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      border: '1px solid rgba(255,255,255,0.05)',
                      transform: hoveredCell?.charIdA === rowCharId && hoveredCell?.charIdB === colCharId ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: hoveredCell?.charIdA === rowCharId && hoveredCell?.charIdB === colCharId ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
                      zIndex: hoveredCell?.charIdA === rowCharId && hoveredCell?.charIdB === colCharId ? 10 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (cell) {
                        setHoveredCell(cell)
                        const rect = e.currentTarget.getBoundingClientRect()
                        const parentRect = e.currentTarget.parentElement?.getBoundingClientRect()
                        if (parentRect) {
                          setTooltipPos({
                            x: rect.left - parentRect.left + rect.width / 2,
                            y: rect.top - parentRect.top - 85,
                          })
                        }
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredCell(null)
                      setTooltipPos(null)
                    }}
                  >
                    {r !== null ? r.toFixed(2) : 'N/A'}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Tooltip */}
      {hoveredCell && tooltipPos && (
        <div
          style={{
            position: 'absolute',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translateX(-50%)',
            background: 'var(--shell-surface-2, #1e1e24)',
            border: '1px solid var(--shell-line, #3a3a45)',
            borderRadius: '6px',
            padding: '10px 14px',
            color: 'var(--shell-fg, #ffffff)',
            fontSize: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 100,
            pointerEvents: 'none',
            maxWidth: '260px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontWeight: '700', marginBottom: '4px', fontSize: '13px' }}>
            {hoveredCell.charNameA} & {hoveredCell.charNameB}
          </div>
          <div style={{ color: hoveredCell.r && hoveredCell.r > 0 ? 'var(--shell-good, #1F8B4C)' : hoveredCell.r && hoveredCell.r < 0 ? 'var(--sunset, #F24A00)' : 'inherit', fontWeight: 'bold' }}>
            r = {hoveredCell.r !== null ? hoveredCell.r.toFixed(3) : 'N/A'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--shell-fg-3, #a0a0a5)', marginTop: '4px' }}>
            {getCorrelationLabel(hoveredCell.r)}
          </div>
        </div>
      )}
    </div>
  )
}
