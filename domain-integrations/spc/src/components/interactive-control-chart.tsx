import { useState, useRef } from 'react'
import type { IndexedChartPoint, SPCSignal } from '../utils/spc-types.js'

export interface InteractiveControlChartProps {
  readonly title: string
  readonly points: IndexedChartPoint[]
  readonly cl: number | null | undefined
  readonly ucl: number | null | undefined
  readonly lcl: number | null | undefined
  readonly usl: number | null | undefined
  readonly lsl: number | null | undefined
  readonly unit: string
  readonly signals?: SPCSignal[]
  readonly onPointClick?: (point: IndexedChartPoint) => void
  readonly width?: number
  readonly height?: number
}

export function InteractiveControlChart({
  title,
  points,
  cl,
  ucl,
  lcl,
  usl,
  lsl,
  unit,
  signals = [],
  onPointClick,
  width = 480,
  height = 180,
}: InteractiveControlChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<IndexedChartPoint | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Map of originalIndex -> array of rule codes/descriptions violating rules
  const pointViolations = new Map<number, string[]>()
  for (const signal of signals) {
    for (const idx of signal.indices) {
      if (!pointViolations.has(idx)) {
        pointViolations.set(idx, [])
      }
      pointViolations.get(idx)?.push(signal.description || `Rule ${signal.rule}`)
    }
  }

  const validValues = points.filter(p => !p.excluded).map(p => p.value)
  const limitValues = [cl, ucl, lcl, usl, lsl].filter((v): v is number => v != null)

  const rawMin = Math.min(...validValues, ...limitValues, 0)
  const rawMax = Math.max(...validValues, ...limitValues, 100)
  const pad = ((rawMax - rawMin) || 1) * 0.15
  const yMin = rawMin - pad
  const yMax = rawMax + pad
  const yRange = yMax - yMin

  const paddingLeft = 50
  const paddingRight = 90
  const paddingTop = 20
  const paddingBottom = 40

  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom
  const n = points.length

  function toX(i: number) {
    if (n <= 1) return paddingLeft + plotWidth / 2
    return paddingLeft + (i / (n - 1)) * plotWidth
  }

  function toY(v: number | null | undefined) {
    if (v == null || isNaN(v)) return 0
    return paddingTop + (1 - (v - yMin) / yRange) * plotHeight
  }

  const yTicks: number[] = Array.from({ length: 5 }, (_, i) => yMin + (yRange * i) / 4)

  const labelStep = Math.max(1, Math.round((n - 1) / 5))
  const xLabelSet = new Set<number>()
  for (let i = 0; i < n; i += labelStep) {
    xLabelSet.add(i)
  }
  if (n > 0) {
    xLabelSet.add(n - 1)
  }

  const handleMouseMove = (e: React.MouseEvent<SVGCircleElement>, p: IndexedChartPoint) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setHoveredPoint(p)
    setTooltipPos({
      x: e.clientX - rect.left + 15,
      y: e.clientY - rect.top - 40,
    })
  }

  const handleMouseLeave = () => {
    setHoveredPoint(null)
    setTooltipPos(null)
  }

  // Generate polyline points connecting only active (non-excluded) points
  const polylinePoints = points
    .map((p, i) => ({ p, i }))
    .filter(item => !item.p.excluded)
    .map(item => `${toX(item.i)},${toY(item.p.value)}`)
    .join(' ')

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        background: 'var(--shell-surface-2, #1e1e24)',
        borderRadius: 8,
        padding: '16px',
        border: '1px solid var(--shell-line, #2d2d34)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--shell-fg, #ffffff)' }}>{title}</h4>
        <span style={{ fontSize: 11, color: 'var(--shell-fg-3, #a0a0a5)' }}>{unit}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
          {/* Y-axis grid lines and labels */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={toY(tick)}
                x2={paddingLeft + plotWidth}
                y2={toY(tick)}
                stroke="var(--shell-line, #2d2d34)"
                strokeWidth={0.5}
              />
              <text
                x={paddingLeft - 8}
                y={toY(tick) + 3}
                textAnchor="end"
                fontSize={9}
                fill="var(--shell-fg-3, #a0a0a5)"
              >
                {tick.toFixed(3)}
              </text>
            </g>
          ))}

          {/* Center line (CL) */}
          {cl != null && (
            <g>
              <line
                x1={paddingLeft}
                y1={toY(cl)}
                x2={paddingLeft + plotWidth}
                y2={toY(cl)}
                stroke="var(--shell-fg-3, #a0a0a5)"
                strokeWidth={1}
              />
              <text
                x={paddingLeft + plotWidth + 6}
                y={toY(cl) + 3}
                fontSize={9}
                fill="var(--shell-fg-3, #a0a0a5)"
                fontWeight={600}
              >
                CL: {cl.toFixed(3)}
              </text>
            </g>
          )}

          {/* UCL */}
          {ucl != null && (
            <g>
              <line
                x1={paddingLeft}
                y1={toY(ucl)}
                x2={paddingLeft + plotWidth}
                y2={toY(ucl)}
                stroke="var(--sunset, #F24A00)"
                strokeWidth={1.2}
                strokeDasharray="4 3"
              />
              <text
                x={paddingLeft + plotWidth + 6}
                y={toY(ucl) + 3}
                fontSize={9}
                fill="var(--sunset, #F24A00)"
                fontWeight={600}
              >
                UCL: {ucl.toFixed(3)}
              </text>
            </g>
          )}

          {/* LCL */}
          {lcl != null && (
            <g>
              <line
                x1={paddingLeft}
                y1={toY(lcl)}
                x2={paddingLeft + plotWidth}
                y2={toY(lcl)}
                stroke="var(--sunset, #F24A00)"
                strokeWidth={1.2}
                strokeDasharray="4 3"
              />
              <text
                x={paddingLeft + plotWidth + 6}
                y={toY(lcl) + 3}
                fontSize={9}
                fill="var(--sunset, #F24A00)"
                fontWeight={600}
              >
                LCL: {lcl.toFixed(3)}
              </text>
            </g>
          )}

          {/* Specification Limits */}
          {usl != null && (
            <g>
              <line
                x1={paddingLeft}
                y1={toY(usl)}
                x2={paddingLeft + plotWidth}
                y2={toY(usl)}
                stroke="#D32F2F"
                strokeWidth={1.2}
                strokeDasharray="2 3"
              />
              <text
                x={paddingLeft + plotWidth + 6}
                y={toY(usl) - 4}
                fontSize={9}
                fill="#D32F2F"
                fontWeight={600}
              >
                USL: {usl.toFixed(3)}
              </text>
            </g>
          )}

          {lsl != null && (
            <g>
              <line
                x1={paddingLeft}
                y1={toY(lsl)}
                x2={paddingLeft + plotWidth}
                y2={toY(lsl)}
                stroke="#D32F2F"
                strokeWidth={1.2}
                strokeDasharray="2 3"
              />
              <text
                x={paddingLeft + plotWidth + 6}
                y={toY(lsl) + 8}
                fontSize={9}
                fill="#D32F2F"
                fontWeight={600}
              >
                LSL: {lsl.toFixed(3)}
              </text>
            </g>
          )}

          {/* Connective Line */}
          {polylinePoints && (
            <polyline
              fill="none"
              stroke="var(--shell-fg-2, #d1d1d6)"
              strokeWidth={1.5}
              points={polylinePoints}
            />
          )}

          {/* Data Circles */}
          {points.map((p, i) => {
            const rules = pointViolations.get(p.originalIndex) || []
            const isOoc = rules.length > 0
            const isOutlier = p.is_outlier && !p.excluded

            // Styling variables
            let fill = 'var(--shell-good, #1F8B4C)'
            let radius = 4.5
            let stroke = 'transparent'
            let strokeWidth = 0

            if (p.excluded) {
              fill = 'var(--shell-fg-3, #a0a0a5)'
              radius = 4
            } else if (isOutlier) {
              fill = '#7c3aed' // purple
              radius = 6
            } else if (isOoc) {
              fill = 'var(--shell-bad, #C73315)'
              radius = 6
              stroke = 'rgba(199, 51, 21, 0.4)'
              strokeWidth = 3
            }

            return (
              <g key={`${p.batch_id}-${p.sample_seq}-${p.originalIndex}`}>
                <circle
                  cx={toX(i)}
                  cy={toY(p.value)}
                  r={radius}
                  fill={fill}
                  stroke={strokeWidth > 0 ? stroke : 'none'}
                  strokeWidth={strokeWidth > 0 ? strokeWidth : 0}
                  style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                  onMouseMove={(e) => handleMouseMove(e, p)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => onPointClick?.(p)}
                />
              </g>
            )
          })}

          {/* X-axis date labels */}
          {points.map((p, i) => {
            if (!xLabelSet.has(i)) return null
            const displayLabel = p.batch_date ? p.batch_date.substring(5, 10) : `#${p.batch_seq}`
            return (
              <text
                key={`${p.batch_id}-${p.sample_seq}-${p.originalIndex}-lbl`}
                x={toX(i)}
                y={height - 10}
                textAnchor="middle"
                fontSize={9}
                fill="var(--shell-fg-3, #a0a0a5)"
              >
                {displayLabel}
              </text>
            )
          })}
        </svg>
      </div>

      {/* Interactive Tooltip Overlay */}
      {hoveredPoint && tooltipPos && (
        <div
          style={{
            position: 'absolute',
            left: tooltipPos.x,
            top: tooltipPos.y,
            background: 'var(--shell-surface, #2a2a35)',
            border: '1px solid var(--shell-line, #3a3a45)',
            color: 'var(--shell-fg, #ffffff)',
            padding: '8px 12px',
            borderRadius: 4,
            fontSize: 11,
            zIndex: 100,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            minWidth: 160,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Batch: {hoveredPoint.batch_id || 'N/A'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
            <span>Value:</span>
            <span style={{ fontWeight: 600 }}>
              {hoveredPoint.value.toFixed(4)} {unit}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>Seq / Date:</span>
            <span>
              {hoveredPoint.sample_seq} ({hoveredPoint.batch_date?.substring(0, 10) || 'N/A'})
            </span>
          </div>

          {hoveredPoint.excluded && (
            <div style={{ marginTop: 6, color: 'var(--shell-fg-3)', fontStyle: 'italic' }}>
              Excluded from calculations
            </div>
          )}

          {pointViolations.has(hoveredPoint.originalIndex) && (
            <div style={{ marginTop: 6, borderTop: '1px solid var(--shell-line)', paddingTop: 4 }}>
              <div style={{ color: 'var(--shell-bad, #C73315)', fontWeight: 600, marginBottom: 2 }}>
                ⚠️ Rule Violations:
              </div>
              {pointViolations.get(hoveredPoint.originalIndex)?.map((rule, idx) => (
                <div key={idx} style={{ color: 'var(--shell-bad, #C73315)', fontSize: 10 }}>
                  • {rule}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
