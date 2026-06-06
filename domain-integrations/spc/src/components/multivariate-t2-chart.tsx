import { useState, useRef } from 'react'
import type { MultivariateT2Point } from '../utils/multivariate-analysis.js'

export interface MultivariateT2ChartProps {
  readonly points: MultivariateT2Point[]
  readonly onPointClick?: (point: MultivariateT2Point) => void
  readonly width?: number
  readonly height?: number
}

export function MultivariateT2Chart({
  points,
  onPointClick,
  width = 680,
  height = 240,
}: MultivariateT2ChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<MultivariateT2Point | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  if (points.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--shell-fg-3, #a0a0a5)', fontSize: 12 }}>
        No multivariate points calculated. Ensure all 5 characteristics have aligned batch data.
      </div>
    )
  }

  // Find bounds for plotting
  const values = points.map(p => p.t2)
  const ucls = points.map(p => p.ucl)
  const cls = points.map(p => p.cl)
  const maxVal = Math.max(...values, ...ucls, ...cls) * 1.15
  const minVal = 0 // T^2 is always non-negative

  // Padding & plot dimensions
  const paddingLeft = 50
  const paddingRight = 80
  const paddingTop = 20
  const paddingBottom = 40
  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom

  // Mapping coordinate functions
  const toX = (index: number) => {
    if (points.length <= 1) return paddingLeft + plotWidth / 2
    return paddingLeft + (index / (points.length - 1)) * plotWidth
  }

  const toY = (val: number) => {
    const scale = plotHeight / (maxVal - minVal)
    return paddingTop + plotHeight - (val - minVal) * scale
  }

  // Path generator for line connecting points
  const polylinePoints = points
    .map((p, idx) => `${toX(idx)},${toY(p.t2)}`)
    .join(' ')

  const ucl = points[0].ucl
  const cl = points[0].cl

  return (
    <div ref={containerRef} style={{ position: 'relative', width: `${width}px` }}>
      <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
        {/* Grid lines */}
        <line
          x1={paddingLeft}
          y1={toY(minVal)}
          x2={paddingLeft + plotWidth}
          y2={toY(minVal)}
          stroke="var(--shell-line, #3a3a45)"
          strokeWidth={1}
        />

        {/* Center Line (CL) */}
        {cl != null && (
          <g>
            <line
              x1={paddingLeft}
              y1={toY(cl)}
              x2={paddingLeft + plotWidth}
              y2={toY(cl)}
              stroke="var(--shell-fg-3, #a0a0a5)"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <text
              x={paddingLeft + plotWidth + 6}
              y={toY(cl) + 3}
              fontSize={9}
              fill="var(--shell-fg-3, #a0a0a5)"
              fontWeight={600}
            >
              CL: {cl.toFixed(2)}
            </text>
          </g>
        )}

        {/* Upper Control Limit (UCL) */}
        {ucl != null && (
          <g>
            <line
              x1={paddingLeft}
              y1={toY(ucl)}
              x2={paddingLeft + plotWidth}
              y2={toY(ucl)}
              stroke="var(--sunset, #F24A00)"
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
            <text
              x={paddingLeft + plotWidth + 6}
              y={toY(ucl) + 3}
              fontSize={9}
              fill="var(--sunset, #F24A00)"
              fontWeight={600}
            >
              UCL: {ucl.toFixed(2)}
            </text>
          </g>
        )}

        {/* Y Axis Labels */}
        {[0, maxVal / 2, maxVal].map((val, idx) => (
          <text
            key={`y-label-${idx}`}
            x={paddingLeft - 8}
            y={toY(val) + 3}
            fontSize={9}
            fill="var(--shell-fg-3, #a0a0a5)"
            textAnchor="end"
            fontFamily="var(--font-mono)"
          >
            {val.toFixed(1)}
          </text>
        ))}

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
        {points.map((p, idx) => {
          const isOutlier = p.isOutlier
          let fill = 'var(--shell-good, #1F8B4C)'
          let radius = 5
          let stroke = 'transparent'
          let strokeWidth = 0

          if (isOutlier) {
            fill = 'var(--shell-bad, #C73315)'
            radius = 7
            stroke = 'rgba(199, 51, 21, 0.4)'
            strokeWidth = 6
          } else if (hoveredPoint?.batchId === p.batchId) {
            fill = '#ffffff'
            radius = 6
            stroke = 'var(--shell-fg-2, #d1d1d6)'
            strokeWidth = 2
          }

          return (
            <g key={`point-${p.batchId}`}>
              {strokeWidth > 0 && (
                <circle
                  cx={toX(idx)}
                  cy={toY(p.t2)}
                  r={radius + strokeWidth}
                  fill={stroke}
                />
              )}
              <circle
                cx={toX(idx)}
                cy={toY(p.t2)}
                r={radius}
                fill={fill}
                cursor="pointer"
                onClick={() => onPointClick?.(p)}
                onMouseEnter={(e) => {
                  setHoveredPoint(p)
                  const rect = e.currentTarget.getBoundingClientRect()
                  const parentRect = containerRef.current?.getBoundingClientRect()
                  if (parentRect) {
                    setTooltipPos({
                      x: rect.left - parentRect.left + rect.width / 2,
                      y: rect.top - parentRect.top - 55,
                    })
                  }
                }}
                onMouseLeave={() => {
                  setHoveredPoint(null)
                  setTooltipPos(null)
                }}
              />
            </g>
          )
        })}

        {/* X Axis Batch Labels (subset for readability) */}
        {points.map((p, idx) => {
          // Label every Nth point to avoid overlap
          const interval = Math.max(1, Math.floor(points.length / 6))
          if (idx % interval !== 0 && idx !== points.length - 1) return null

          const label = p.batchId.replace('CH-', '')
          return (
            <g key={`x-label-${idx}`}>
              <line
                x1={toX(idx)}
                y1={toY(minVal)}
                x2={toX(idx)}
                y2={toY(minVal) + 4}
                stroke="var(--shell-line, #3a3a45)"
                strokeWidth={1}
              />
              <text
                x={toX(idx)}
                y={toY(minVal) + 16}
                fontSize={9}
                fill="var(--shell-fg-3, #a0a0a5)"
                textAnchor="middle"
                fontFamily="var(--font-mono)"
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && tooltipPos && (
        <div
          style={{
            position: 'absolute',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translateX(-50%)',
            background: 'var(--shell-surface-2, #1e1e24)',
            border: '1px solid var(--shell-line, #3a3a45)',
            borderRadius: '4px',
            padding: '6px 10px',
            color: 'var(--shell-fg, #ffffff)',
            fontSize: '11px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 100,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: '700' }}>Batch: {hoveredPoint.batchId}</div>
          <div>T² score: {hoveredPoint.t2.toFixed(3)}</div>
          {hoveredPoint.isOutlier && (
            <div style={{ color: 'var(--shell-bad, #C73315)', fontWeight: 'bold', marginTop: 2 }}>
              ⚠️ Anomaly Detected
            </div>
          )}
        </div>
      )}
    </div>
  )
}
