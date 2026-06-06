import { useMemo, useState } from 'react'
import { computeHistogram } from '../utils/calculations.js'

interface CapabilityHistogramProps {
  readonly values: number[]
  readonly xBar: number | null | undefined
  readonly sigmaOverall: number | null | undefined
  readonly usl: number | null | undefined
  readonly lsl: number | null | undefined
}

export function CapabilityHistogram({
  values,
  xBar,
  sigmaOverall,
  usl,
  lsl,
}: CapabilityHistogramProps) {
  const [hoveredBin, setHoveredBin] = useState<{ x0: number; x1: number; count: number } | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  const chartData = useMemo(() => {
    if (xBar == null || !sigmaOverall || sigmaOverall <= 0 || !values.length) return null

    const { bins, binWidth } = computeHistogram(values)
    if (!bins.length) return null

    const curveMin = Math.min(lsl ?? xBar - 4 * sigmaOverall, xBar - 4 * sigmaOverall)
    const curveMax = Math.max(usl ?? xBar + 4 * sigmaOverall, xBar + 4 * sigmaOverall)

    // Sample normal curve for drawing overlay
    const CURVE_STEPS = 80
    const step = (curveMax - curveMin) / CURVE_STEPS
    const curvePoints = Array.from({ length: CURVE_STEPS + 1 }, (_, i) => {
      const x = curveMin + i * step
      const y =
        (1 / (sigmaOverall * Math.sqrt(2 * Math.PI))) *
        Math.exp(-0.5 * ((x - xBar) / sigmaOverall) ** 2) *
        values.length *
        binWidth
      return { x, y }
    })

    return { bins, curveMin, curveMax, curvePoints }
  }, [values, xBar, sigmaOverall, usl, lsl])

  if (!chartData) return null

  const { bins, curveMin, curveMax, curvePoints } = chartData

  const width = 500
  const height = 180
  const paddingLeft = 40
  const paddingRight = 60
  const paddingTop = 15
  const paddingBottom = 30

  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom

  const maxCount = Math.max(...bins.map((b) => b.count), 1)
  const maxCurveY = Math.max(...curvePoints.map((p) => p.y), 1)
  const maxY = Math.max(maxCount, maxCurveY)

  function toX(val: number) {
    const range = curveMax - curveMin
    if (range <= 0) return paddingLeft + plotWidth / 2
    return paddingLeft + ((val - curveMin) / range) * plotWidth
  }

  function toY(val: number) {
    if (maxY <= 0) return paddingTop + plotHeight
    return paddingTop + (1 - val / maxY) * plotHeight
  }

  const handleMouseMove = (e: React.MouseEvent, bin: typeof bins[0]) => {
    const containerRect = e.currentTarget.parentElement?.getBoundingClientRect()
    if (!containerRect) return
    setHoveredBin({ x0: bin.x0, x1: bin.x1, count: bin.count })
    setTooltipPos({
      x: e.clientX - containerRect.left + 10,
      y: e.clientY - containerRect.top - 50,
    })
  }

  // Draw smooth path for normal curve
  const curvePath = curvePoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x)} ${toY(p.y)}`)
    .join(' ')

  return (
    <div style={{ position: 'relative', marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3, #a0a0a5)', marginBottom: 8 }}>
        Capability Histogram & Normal Distribution
      </div>

      <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
        {/* Draw specification and target limits */}
        {lsl != null && (
          <g>
            <line
              x1={toX(lsl)}
              y1={paddingTop}
              x2={toX(lsl)}
              y2={paddingTop + plotHeight}
              stroke="#D32F2F"
              strokeWidth={1.5}
              strokeDasharray="2 3"
            />
            <text x={toX(lsl) - 4} y={paddingTop + 10} textAnchor="end" fontSize={8} fill="#D32F2F" fontWeight={700}>
              LSL
            </text>
          </g>
        )}

        {usl != null && (
          <g>
            <line
              x1={toX(usl)}
              y1={paddingTop}
              x2={toX(usl)}
              y2={paddingTop + plotHeight}
              stroke="#D32F2F"
              strokeWidth={1.5}
              strokeDasharray="2 3"
            />
            <text x={toX(usl) + 4} y={paddingTop + 10} textAnchor="start" fontSize={8} fill="#D32F2F" fontWeight={700}>
              USL
            </text>
          </g>
        )}

        {xBar != null && (
          <g>
            <line
              x1={toX(xBar)}
              y1={paddingTop}
              x2={toX(xBar)}
              y2={paddingTop + plotHeight}
              stroke="var(--shell-fg-3, #a0a0a5)"
              strokeWidth={1.5}
            />
            <text x={toX(xBar)} y={paddingTop - 4} textAnchor="middle" fontSize={8} fill="var(--shell-fg-3, #a0a0a5)" fontWeight={700}>
              X̄: {xBar.toFixed(3)}
            </text>
          </g>
        )}

        {/* Draw histogram bars */}
        {bins.map((bin, i) => {
          const x0 = toX(bin.x0)
          const x1 = toX(bin.x1)
          const barWidth = Math.max(1, x1 - x0 - 1)
          const barHeight = plotHeight - (toY(bin.count) - paddingTop)
          const y = toY(bin.count)

          const inSpec = (lsl == null || bin.x0 >= lsl) && (usl == null || bin.x1 <= usl)
          const fill = inSpec ? 'rgba(31, 139, 76, 0.45)' : 'rgba(199, 51, 21, 0.45)'
          const stroke = inSpec ? 'var(--shell-good, #1F8B4C)' : 'var(--shell-bad, #C73315)'

          return (
            <rect
              key={i}
              x={x0}
              y={y}
              width={barWidth}
              height={Math.max(1, barHeight)}
              fill={fill}
              stroke={stroke}
              strokeWidth={0.5}
              onMouseMove={(e) => handleMouseMove(e, bin)}
              onMouseLeave={() => setHoveredBin(null)}
              style={{ cursor: 'pointer', transition: 'fill 0.15s ease' }}
            />
          )
        })}

        {/* Draw normal distribution curve */}
        <path d={curvePath} fill="none" stroke="#10b981" strokeWidth={2} style={{ pointerEvents: 'none' }} />

        {/* Y Axis ticks (frequency count) */}
        {Array.from({ length: 4 }).map((_, idx) => {
          const val = (maxY * idx) / 3
          return (
            <text
              key={idx}
              x={paddingLeft - 6}
              y={toY(val) + 3}
              textAnchor="end"
              fontSize={8}
              fill="var(--shell-fg-3, #a0a0a5)"
            >
              {Math.round(val)}
            </text>
          )
        })}

        {/* X Axis ticks */}
        <line
          x1={paddingLeft}
          y1={paddingTop + plotHeight}
          x2={paddingLeft + plotWidth}
          y2={paddingTop + plotHeight}
          stroke="var(--shell-line, #2d2d34)"
        />
      </svg>

      <div style={{ marginTop: 6, display: 'flex', gap: 12, justifyContent: 'center', fontSize: 9, color: 'var(--shell-fg-3)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: 'rgba(31, 139, 76, 0.45)', border: '1px solid var(--shell-good)' }} />
          In Specs
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: 'rgba(199, 51, 21, 0.45)', border: '1px solid var(--shell-bad)' }} />
          Out of Specs
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 12, height: 2, backgroundColor: '#10b981' }} />
          Normal curve
        </span>
      </div>

      {/* Tooltip */}
      {hoveredBin && tooltipPos && (
        <div
          style={{
            position: 'absolute',
            left: tooltipPos.x,
            top: tooltipPos.y,
            background: 'var(--shell-surface, #2a2a35)',
            border: '1px solid var(--shell-line, #3a3a45)',
            color: 'var(--shell-fg, #ffffff)',
            padding: '6px 10px',
            borderRadius: 4,
            fontSize: 10,
            pointerEvents: 'none',
            zIndex: 100,
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
          }}
        >
          <div>Range: {hoveredBin.x0.toFixed(3)} - {hoveredBin.x1.toFixed(3)}</div>
          <div style={{ fontWeight: 600 }}>Count: {hoveredBin.count}</div>
        </div>
      )}
    </div>
  )
}
