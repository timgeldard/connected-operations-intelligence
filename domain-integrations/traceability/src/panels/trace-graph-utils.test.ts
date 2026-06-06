import { describe, it, expect } from 'vitest'
import {
  bfsLayout,
  mapToFlowNodes,
  mapToFlowEdges,
  filterGraphByDirection,
  H_SPACING,
  NODE_WIDTH,
  LINK_TYPE_COLORS,
  DEFAULT_EDGE_COLOR,
} from './trace-graph-utils.js'
import type { TraceGraph } from '@connectio/data-contracts'

// ---------------------------------------------------------------------------
// Fixture — minimal graph identical in structure to the mock data
// ---------------------------------------------------------------------------

const graph: TraceGraph = {
  direction: 'both',
  depth: 3,
  rootBatch: 'BATCH-ROOT',
  upstreamCount: 2,
  downstreamCount: 2,
  unresolvedNodeCount: 1,
  nodes: [
    { id: 'root', type: 'finished-good', materialId: 'MAT-001', batchId: 'BATCH-ROOT', materialDescription: 'Root material', quantity: 100, uom: 'KG', status: 'resolved', riskLevel: 'high' },
    { id: 'up1', type: 'raw-material', materialId: 'MAT-002', batchId: 'BATCH-UP1', materialDescription: 'Upstream 1', quantity: 50, uom: 'KG', status: 'resolved', riskLevel: 'low' },
    { id: 'up2', type: 'supplier-lot', materialId: 'MAT-002', batchId: 'BATCH-UP2', materialDescription: 'Upstream 2 (supplier)', quantity: 50, uom: 'KG', status: 'unresolved', riskLevel: 'high' },
    { id: 'dn1', type: 'customer-delivery', materialId: 'MAT-001', batchId: 'BATCH-DN1', materialDescription: 'Delivery 1', quantity: 30, uom: 'KG', status: 'resolved', riskLevel: 'medium' },
    { id: 'dn2', type: 'customer-delivery', materialId: 'MAT-001', batchId: 'BATCH-DN2', materialDescription: 'Delivery 2', quantity: 70, uom: 'KG', status: 'unresolved', riskLevel: 'critical' },
  ],
  edges: [
    { id: 'e1', source: 'up1', target: 'root', relationshipType: 'component-of', quantity: 50, uom: 'KG' },
    { id: 'e2', source: 'up2', target: 'up1', relationshipType: 'produced-from', quantity: 50, uom: 'KG' },
    { id: 'e3', source: 'root', target: 'dn1', relationshipType: 'delivered-to', quantity: 30, uom: 'KG' },
    { id: 'e4', source: 'root', target: 'dn2', relationshipType: 'delivered-to', quantity: 70, uom: 'KG' },
  ],
}

// ---------------------------------------------------------------------------
// bfsLayout
// ---------------------------------------------------------------------------

describe('bfsLayout', () => {
  it('assigns root node to y=0', () => {
    const positions = bfsLayout(graph)
    const root = positions.get('root')
    expect(root).toBeDefined()
    expect(root!.y).toBe(0)
  })

  it('assigns upstream nodes to negative y levels', () => {
    const positions = bfsLayout(graph)
    // up1 is one hop upstream of root → level -1
    expect(positions.get('up1')!.y).toBeLessThan(0)
    // up2 is two hops upstream → level -2
    expect(positions.get('up2')!.y).toBeLessThan(positions.get('up1')!.y)
  })

  it('assigns downstream nodes to positive y levels', () => {
    const positions = bfsLayout(graph)
    expect(positions.get('dn1')!.y).toBeGreaterThan(0)
    expect(positions.get('dn2')!.y).toBeGreaterThan(0)
  })

  it('places all nodes at distinct positions (no exact collisions)', () => {
    const positions = bfsLayout(graph)
    const coords = [...positions.values()].map(p => `${p.x},${p.y}`)
    const unique = new Set(coords)
    expect(unique.size).toBe(coords.length)
  })

  it('returns an empty map for an empty node list', () => {
    const emptyGraph: TraceGraph = { ...graph, nodes: [], edges: [] }
    expect(bfsLayout(emptyGraph).size).toBe(0)
  })

  it('positions peer downstream nodes side by side (same y, different x)', () => {
    const positions = bfsLayout(graph)
    const dn1 = positions.get('dn1')!
    const dn2 = positions.get('dn2')!
    expect(dn1.y).toBe(dn2.y)
    expect(Math.abs(dn1.x - dn2.x)).toBeGreaterThanOrEqual(H_SPACING - NODE_WIDTH)
  })
})

// ---------------------------------------------------------------------------
// mapToFlowNodes
// ---------------------------------------------------------------------------

describe('mapToFlowNodes', () => {
  it('returns one React Flow node per graph node', () => {
    const nodes = mapToFlowNodes(graph, null)
    expect(nodes).toHaveLength(graph.nodes.length)
  })

  it('sets type to "traceNode" for all nodes', () => {
    const nodes = mapToFlowNodes(graph, null)
    for (const n of nodes) {
      expect(n.type).toBe('traceNode')
    }
  })

  it('marks the root node correctly', () => {
    const nodes = mapToFlowNodes(graph, null)
    const root = nodes.find(n => n.id === 'root')
    expect(root?.data.isRoot).toBe(true)
    const nonRoot = nodes.find(n => n.id === 'up1')
    expect(nonRoot?.data.isRoot).toBe(false)
  })

  it('marks the selected node when selectedId is provided', () => {
    const nodes = mapToFlowNodes(graph, 'dn2')
    expect(nodes.find(n => n.id === 'dn2')?.data.isSelected).toBe(true)
    expect(nodes.find(n => n.id === 'root')?.data.isSelected).toBe(false)
  })

  it('marks no node as selected when selectedId is null', () => {
    const nodes = mapToFlowNodes(graph, null)
    for (const n of nodes) {
      expect(n.data.isSelected).toBe(false)
    }
  })

  it('attaches the original TraceNode as data.node', () => {
    const nodes = mapToFlowNodes(graph, null)
    const rootNode = nodes.find(n => n.id === 'root')
    expect(rootNode?.data.node.materialDescription).toBe('Root material')
    expect(rootNode?.data.node.riskLevel).toBe('high')
  })
})

// ---------------------------------------------------------------------------
// bfsLayout — disconnected nodes
// ---------------------------------------------------------------------------

describe('bfsLayout — disconnected nodes', () => {
  it('places disconnected nodes below the rest of the graph', () => {
    const disconnectedGraph: TraceGraph = {
      ...graph,
      nodes: [
        ...graph.nodes,
        { id: 'orphan', type: 'process-order', materialId: 'MAT-999', materialDescription: 'Orphan node', status: 'unresolved', riskLevel: 'none' },
      ],
    }
    const positions = bfsLayout(disconnectedGraph)
    const orphan = positions.get('orphan')
    const root = positions.get('root')
    expect(orphan).toBeDefined()
    expect(root).toBeDefined()
    // Disconnected nodes go to min_level - 2 which is below all connected upstream nodes
    const minConnectedY = Math.min(...['root', 'up1', 'up2', 'dn1', 'dn2'].map(id => positions.get(id)!.y))
    expect(orphan!.y).toBeLessThan(minConnectedY)
  })
})

// ---------------------------------------------------------------------------
// filterGraphByDirection
// ---------------------------------------------------------------------------

describe('filterGraphByDirection', () => {
  it('returns the full graph unchanged for "both"', () => {
    const result = filterGraphByDirection(graph, 'both')
    expect(result.nodes).toHaveLength(graph.nodes.length)
    expect(result.edges).toHaveLength(graph.edges.length)
  })

  it('"forward" returns root and all downstream nodes only', () => {
    const result = filterGraphByDirection(graph, 'forward')
    const ids = result.nodes.map(n => n.id)
    expect(ids).toContain('root')
    expect(ids).toContain('dn1')
    expect(ids).toContain('dn2')
    expect(ids).not.toContain('up1')
    expect(ids).not.toContain('up2')
  })

  it('"reverse" returns root and all upstream nodes only', () => {
    const result = filterGraphByDirection(graph, 'reverse')
    const ids = result.nodes.map(n => n.id)
    expect(ids).toContain('root')
    expect(ids).toContain('up1')
    expect(ids).toContain('up2')
    expect(ids).not.toContain('dn1')
    expect(ids).not.toContain('dn2')
  })

  it('"forward" only includes edges between reachable nodes', () => {
    const result = filterGraphByDirection(graph, 'forward')
    for (const e of result.edges) {
      const sourceReachable = result.nodes.some(n => n.id === e.source)
      const targetReachable = result.nodes.some(n => n.id === e.target)
      expect(sourceReachable).toBe(true)
      expect(targetReachable).toBe(true)
    }
  })

  it('"forward" sets upstreamCount to 0', () => {
    const result = filterGraphByDirection(graph, 'forward')
    expect(result.upstreamCount).toBe(0)
    expect(result.direction).toBe('downstream')
  })

  it('"reverse" sets downstreamCount to 0', () => {
    const result = filterGraphByDirection(graph, 'reverse')
    expect(result.downstreamCount).toBe(0)
    expect(result.direction).toBe('upstream')
  })

  it('returns empty nodes/edges for an empty graph', () => {
    const emptyGraph: TraceGraph = { ...graph, nodes: [], edges: [] }
    const result = filterGraphByDirection(emptyGraph, 'forward')
    expect(result.nodes).toHaveLength(0)
    expect(result.edges).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// mapToFlowEdges
// ---------------------------------------------------------------------------

describe('mapToFlowEdges', () => {
  it('returns one React Flow edge per graph edge', () => {
    const edges = mapToFlowEdges(graph)
    expect(edges).toHaveLength(graph.edges.length)
  })

  it('preserves source and target identifiers', () => {
    const edges = mapToFlowEdges(graph)
    const e1 = edges.find(e => e.id === 'e1')
    expect(e1?.source).toBe('up1')
    expect(e1?.target).toBe('root')
  })

  it('converts relationship type hyphens to spaces in the label', () => {
    const edges = mapToFlowEdges(graph)
    const e1 = edges.find(e => e.id === 'e1')
    expect(e1?.label).toBe('component of')
  })

  it('strokes per relationshipType from LINK_TYPE_COLORS', () => {
    const edges = mapToFlowEdges(graph)
    const componentOfEdge = edges.find(e => e.id === 'e1')!
    const producedFromEdge = edges.find(e => e.id === 'e2')!
    const deliveredToEdge = edges.find(e => e.id === 'e3')!
    expect((componentOfEdge.style as Record<string, unknown>).stroke).toBe(LINK_TYPE_COLORS['component-of'])
    expect((producedFromEdge.style as Record<string, unknown>).stroke).toBe(LINK_TYPE_COLORS['produced-from'])
    expect((deliveredToEdge.style as Record<string, unknown>).stroke).toBe(LINK_TYPE_COLORS['delivered-to'])
  })

  it('falls back to the default colour when relationshipType is unknown or absent', () => {
    const graphWithUnknown: TraceGraph = {
      ...graph,
      edges: [
        // No relationshipType
        { id: 'e-unknown', source: 'up1', target: 'root', quantity: 1, uom: 'KG' },
        // Off-enum value cast to any to verify the fallback (defensive — should
        // never happen via the Zod-parsed schema but the mapper is conservative).
        { id: 'e-offmap', source: 'up1', target: 'root', relationshipType: 'totally-made-up' as unknown as TraceGraph['edges'][number]['relationshipType'], quantity: 1, uom: 'KG' },
      ],
    }
    const edges = mapToFlowEdges(graphWithUnknown)
    expect((edges[0].style as Record<string, unknown>).stroke).toBe(DEFAULT_EDGE_COLOR)
    expect((edges[1].style as Record<string, unknown>).stroke).toBe(DEFAULT_EDGE_COLOR)
  })

  it('covers vendor-receipt and consumed-by in LINK_TYPE_COLORS (TRACE-P0-002 enum)', () => {
    expect(LINK_TYPE_COLORS['vendor-receipt']).toBeDefined()
    expect(LINK_TYPE_COLORS['consumed-by']).toBeDefined()
  })
})
