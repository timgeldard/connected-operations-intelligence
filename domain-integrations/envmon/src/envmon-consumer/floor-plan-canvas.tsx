import { useState, useRef, useEffect, MouseEvent } from 'react'
import type { EnvMonL4Zone, EnvMonL5Coordinate } from '@connectio/data-contracts'
import type { EnvMonFloor } from './mock-data.js'

export function isPointInPolygon(point: { x: number; y: number }, vs: { x: number; y: number }[]) {
  const x = point.x, y = point.y
  let inside = false
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x, yi = vs[i].y
    const xj = vs[j].x, yj = vs[j].y
    
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

interface FloorPlanCanvasProps {
  readonly floor: EnvMonFloor
  readonly zones: EnvMonL4Zone[]
  readonly coordinates: EnvMonL5Coordinate[]
  readonly onSaveZones: (zones: EnvMonL4Zone[]) => void
  readonly onSaveCoordinates: (coords: EnvMonL5Coordinate[]) => void
}

export function FloorPlanCanvas({
  floor,
  zones,
  coordinates,
  onSaveZones,
  onSaveCoordinates,
}: FloorPlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  
  // Modes: 'view' | 'draw-l4' | 'place-l5'
  const [editorMode, setEditorMode] = useState<'view' | 'draw-l4' | 'place-l5'>('view')
  
  // Drawing states
  const [currentL4Points, setCurrentL4Points] = useState<{ x: number; y: number }[]>([])
  const [newZoneLabel, setNewZoneLabel] = useState('')
  const [newLocationLabel, setNewLocationLabel] = useState('')
  const [selectedL4ForL5, setSelectedL4ForL5] = useState<string>('')
  
  // Error / Toast state
  const [validationError, setValidationError] = useState<string | null>(null)

  // Selection
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null)
  const [selectedMarker, setSelectedMarker] = useState<EnvMonL5Coordinate | null>(null)

  // Reset editor state when switching floors
  useEffect(() => {
    setEditorMode('view')
    setCurrentL4Points([])
    setNewZoneLabel('')
    setNewLocationLabel('')
    setSelectedL4ForL5('')
    setValidationError(null)
    setHoveredZoneId(null)
    setSelectedMarker(null)
  }, [floor.floorId])

  // Translate click to SVG coordinate system
  const getSvgCoordinates = (e: MouseEvent<SVGSVGElement>): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 }
    // Relative coordinates scaled to viewbox
    const x = Math.round(((e.clientX - rect.left) / rect.width) * floor.width)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * floor.height)
    return { x, y }
  }

  const handleCanvasClick = (e: MouseEvent<SVGSVGElement>) => {
    const coords = getSvgCoordinates(e)

    if (editorMode === 'draw-l4') {
      setCurrentL4Points((prev) => [...prev, coords])
      setValidationError(null)
    } else if (editorMode === 'place-l5') {
      if (!selectedL4ForL5) {
        setValidationError('Please select a target L4 Zone first.')
        return
      }

      const parentZone = zones.find((z) => z.zoneId === selectedL4ForL5)
      if (!parentZone) return

      // Validate L5 point is inside L4 zone bounds
      const isInside = isPointInPolygon(coords, parentZone.points)
      if (!isInside) {
        setValidationError(
          `Constraint Violation: Swab point must reside inside the boundary of "${parentZone.label}".`
        )
        return
      }

      setValidationError(null)
      const newMarkerId = `LOC-${Date.now()}`
      const newMarker: EnvMonL5Coordinate = {
        locationId: newMarkerId,
        label: newLocationLabel.trim() || `Swab point ${coordinates.length + 1}`,
        parentZoneId: selectedL4ForL5,
        x: coords.x,
        y: coords.y,
      }

      onSaveCoordinates([...coordinates, newMarker])
      setNewLocationLabel('')
      setEditorMode('view')
    }
  }

  const finalizeL4Zone = () => {
    if (currentL4Points.length < 3) {
      setValidationError('An L4 Zone must contain at least 3 points (polygon).')
      return
    }

    const newZoneId = `Z-${Date.now()}`
    const newZone: EnvMonL4Zone = {
      zoneId: newZoneId,
      label: newZoneLabel.trim() || `Floor Section ${zones.length + 1}`,
      points: currentL4Points,
    }

    onSaveZones([...zones, newZone])
    setCurrentL4Points([])
    setNewZoneLabel('')
    setEditorMode('view')
  }

  const clearDrawing = () => {
    setCurrentL4Points([])
    setValidationError(null)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, background: '#0a0f1d', padding: 20, borderRadius: 8 }}>
      <div style={{ position: 'relative' }}>
        {validationError && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              backgroundColor: '#7f1d1d',
              border: '1px solid #f87171',
              color: '#fca5a5',
              padding: '10px 16px',
              borderRadius: 6,
              fontSize: 13,
              zIndex: 10,
              display: 'flex',
              justifyContent: 'between',
            }}
          >
            <span>{validationError}</span>
            <button
              onClick={() => setValidationError(null)}
              style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontWeight: 'bold', marginLeft: 'auto' }}
            >
              ✕
            </button>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${floor.width} ${floor.height}`}
          onClick={handleCanvasClick}
          style={{
            width: '100%',
            height: 'auto',
            border: '2px solid #1e293b',
            borderRadius: 6,
            background: '#020617',
            cursor: editorMode !== 'view' ? 'crosshair' : 'default',
          }}
        >
          {/* Grid lines to make it feel like blueprint */}
          <defs>
            <pattern id="blueprint-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0f172a" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#blueprint-grid)" />

          {/* Plant Floor SVG Layout/Mock Blueprint Walls */}
          <g stroke="#1e293b" strokeWidth="2" fill="none">
            {/* Outer border & inner room divisions */}
            <rect x="20" y="20" width={floor.width - 40} height={floor.height - 40} rx="8" />
            <line x1="380" y1="20" x2="380" y2="580" strokeDasharray="5,5" />
            <line x1="20" y1="280" x2="780" y2="280" />
            {/* Structural pillars */}
            <rect x="200" y="140" width="20" height="20" fill="#1e293b" />
            <rect x="600" y="140" width="20" height="20" fill="#1e293b" />
            <rect x="200" y="440" width="20" height="20" fill="#1e293b" />
            <rect x="600" y="440" width="20" height="20" fill="#1e293b" />
          </g>

          {/* Draw configured L4 zones */}
          {zones.map((zone) => {
            const isHovered = hoveredZoneId === zone.zoneId
            const pointsString = zone.points.map((p) => `${p.x},${p.y}`).join(' ')
            return (
              <g
                key={zone.zoneId}
                onMouseEnter={() => setHoveredZoneId(zone.zoneId)}
                onMouseLeave={() => setHoveredZoneId(null)}
              >
                <polygon
                  points={pointsString}
                  fill={isHovered ? 'rgba(4, 120, 87, 0.15)' : 'rgba(4, 120, 87, 0.05)'}
                  stroke={isHovered ? '#059669' : '#047857'}
                  strokeWidth="2"
                  strokeDasharray={isHovered ? 'none' : '4,4'}
                  style={{ transition: 'all 0.2s' }}
                />
                {/* Text label at the centroid */}
                {zone.points.length > 0 && (
                  <text
                    x={zone.points[0].x + 15}
                    y={zone.points[0].y + 25}
                    fill="#10b981"
                    fontSize="11"
                    fontWeight="600"
                    style={{ pointerEvents: 'none' }}
                  >
                    {zone.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* Draw active zone path currently being drawn */}
          {currentL4Points.length > 0 && (
            <g>
              <polyline
                points={currentL4Points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2"
              />
              {currentL4Points.map((p, idx) => (
                <circle key={idx} cx={p.x} cy={p.y} r="5" fill="#818cf8" />
              ))}
            </g>
          )}

          {/* Draw L5 coordinates */}
          {coordinates.map((coord) => {
            const isSelected = selectedMarker?.locationId === coord.locationId
            return (
              <g
                key={coord.locationId}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedMarker(coord)
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* Glowing ring if selected */}
                {isSelected && (
                  <circle cx={coord.x} cy={coord.y} r="12" fill="none" stroke="#059669" strokeWidth="2" />
                )}
                {/* Swab point circle */}
                <circle
                  cx={coord.x}
                  cy={coord.y}
                  r="6"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              </g>
            )
          })}
        </svg>
      </div>

      {/* Editor Controls & Inspection details panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderLeft: '1px solid #1e293b', paddingLeft: 20 }}>
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mode</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            <button
              onClick={() => { setEditorMode('view'); clearDrawing(); }}
              style={{
                padding: '8px 12px',
                borderRadius: 4,
                border: '1px solid #1e293b',
                background: editorMode === 'view' ? '#0f172a' : 'transparent',
                color: editorMode === 'view' ? '#10b981' : '#94a3b8',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              🔍 Live Floor View
            </button>
            <button
              onClick={() => { setEditorMode('draw-l4'); clearDrawing(); }}
              style={{
                padding: '8px 12px',
                borderRadius: 4,
                border: '1px solid #1e293b',
                background: editorMode === 'draw-l4' ? '#0f172a' : 'transparent',
                color: editorMode === 'draw-l4' ? '#6366f1' : '#94a3b8',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              📐 Draw L4 Zone
            </button>
            <button
              onClick={() => { setEditorMode('place-l5'); clearDrawing(); }}
              style={{
                padding: '8px 12px',
                borderRadius: 4,
                border: '1px solid #1e293b',
                background: editorMode === 'place-l5' ? '#0f172a' : 'transparent',
                color: editorMode === 'place-l5' ? '#10b981' : '#94a3b8',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              📍 Drop L5 Swab Point
            </button>
          </div>
        </div>

        {/* Draw L4 Form */}
        {editorMode === 'draw-l4' && (
          <div style={{ background: '#0f172a', padding: 12, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h4 style={{ margin: 0, fontSize: 13, color: '#f8fafc' }}>Define L4 Area</h4>
            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Click on the blueprint canvas to define the vertices of the zone.</p>
            <input
              type="text"
              placeholder="Zone Name (e.g. Mixing Room)"
              value={newZoneLabel}
              onChange={(e) => setNewZoneLabel(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #334155', background: '#020617', color: '#f8fafc', fontSize: 12 }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                onClick={finalizeL4Zone}
                disabled={currentL4Points.length < 3}
                style={{
                  padding: '6px 10px',
                  borderRadius: 4,
                  border: 'none',
                  background: currentL4Points.length >= 3 ? '#6366f1' : '#1e1b4b',
                  color: currentL4Points.length >= 3 ? '#ffffff' : '#6366f1',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: currentL4Points.length >= 3 ? 'pointer' : 'default',
                }}
              >
                Save Zone
              </button>
              <button
                onClick={clearDrawing}
                style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Place L5 Form */}
        {editorMode === 'place-l5' && (
          <div style={{ background: '#0f172a', padding: 12, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h4 style={{ margin: 0, fontSize: 13, color: '#f8fafc' }}>Place Swab Point</h4>
            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Choose the parent L4 Zone and drop a marker on the canvas inside that zone.</p>
            <select
              value={selectedL4ForL5}
              onChange={(e) => setSelectedL4ForL5(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #334155', background: '#020617', color: '#f8fafc', fontSize: 12 }}
            >
              <option value="">-- Select L4 Zone --</option>
              {zones.map((z) => (
                <option key={z.zoneId} value={z.zoneId}>{z.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Swab Location Description"
              value={newLocationLabel}
              onChange={(e) => setNewLocationLabel(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #334155', background: '#020617', color: '#f8fafc', fontSize: 12 }}
            />
          </div>
        )}

        {/* Marker inspection details */}
        {selectedMarker && (
          <div style={{ border: '1px solid #1e293b', background: '#0f172a', padding: 12, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h4 style={{ margin: 0, fontSize: 13, color: '#f8fafc' }}>Inspection Swab Details</h4>
            <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div><strong>ID:</strong> {selectedMarker.locationId}</div>
              <div><strong>Name:</strong> {selectedMarker.label}</div>
              <div><strong>Zone:</strong> {zones.find((z) => z.zoneId === selectedMarker.parentZoneId)?.label || 'Unknown'}</div>
              <div><strong>Coordinates:</strong> X:{selectedMarker.x}, Y:{selectedMarker.y}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <strong>Microbial Status:</strong>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>Pass</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedMarker(null)}
              style={{ marginTop: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #334155', background: 'transparent', color: '#f8fafc', fontSize: 11, cursor: 'pointer' }}
            >
              Close Details
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
