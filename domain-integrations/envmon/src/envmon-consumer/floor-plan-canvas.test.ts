import { describe, it, expect } from 'vitest'
import { isPointInPolygon } from './floor-plan-canvas.js'

describe('isPointInPolygon', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]

  it('identifies points strictly inside the polygon', () => {
    expect(isPointInPolygon({ x: 50, y: 50 }, square)).toBe(true)
    expect(isPointInPolygon({ x: 10, y: 90 }, square)).toBe(true)
  })

  it('identifies points strictly outside the polygon', () => {
    expect(isPointInPolygon({ x: -10, y: 50 }, square)).toBe(false)
    expect(isPointInPolygon({ x: 50, y: 120 }, square)).toBe(false)
    expect(isPointInPolygon({ x: 150, y: 150 }, square)).toBe(false)
  })

  it('handles non-convex or complex shape boundaries correctly', () => {
    // L-shape polygon
    const lShape = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    expect(isPointInPolygon({ x: 25, y: 25 }, lShape)).toBe(true)
    expect(isPointInPolygon({ x: 75, y: 75 }, lShape)).toBe(true)
    // Inside the missing quadrant
    expect(isPointInPolygon({ x: 75, y: 25 }, lShape)).toBe(false)
  })
})
