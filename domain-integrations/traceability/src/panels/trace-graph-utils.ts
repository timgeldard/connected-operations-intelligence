import type { Node, Edge } from '@xyflow/react'
import type { TraceGraph, TraceNode, TraceEdge } from '@connectio/data-contracts'

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

export const NODE_WIDTH = 200
export const NODE_HEIGHT = 72
export const LEVEL_HEIGHT = 110
export const H_SPACING = 220

// ---------------------------------------------------------------------------
// Visual mappings
// ---------------------------------------------------------------------------

export const RISK_BORDER: Record<string, string> = {
  critical: '#F24A00',
  high: '#D97706',
  medium: '#D4A017',
  low: '#289BA2',
  none: '#6B7280',
}

export const RISK_BG: Record<string, string> = {
  critical: '#FFF1EC',
  high: '#FFFBEB',
  medium: '#FEFCE8',
  low: '#F0FDFC',
  none: '#F9FAFB',
}

export const RISK_TEXT: Record<string, string> = {
  critical: '#7C1900',
  high: '#78350F',
  medium: '#713F12',
  low: '#134E4A',
  none: '#374151',
}

export const NODE_TYPE_LABEL: Record<string, string> = {
  'finished-good': 'Finished Good',
  'raw-material': 'Raw Material',
  'supplier-lot': 'Supplier Lot',
  'process-order': 'Process Order',
  'customer-delivery': 'Delivery',
  'semi-finished': 'Semi-Finished',
}

// ---------------------------------------------------------------------------
// BFS layout
// ---------------------------------------------------------------------------

/**
 * Assigns {x, y} positions to each node via BFS from the root batch node.
 *
 * Levels: root = 0, upstream nodes get negative levels, downstream get positive.
 * Within each level nodes are spread horizontally by H_SPACING.
 * Nodes unreachable from the root are placed in a disconnected row at the bottom.
 */
export function bfsLayout(graph: TraceGraph): Map<string, { x: number; y: number }> {
  if (graph.nodes.length === 0) return new Map()

  const rootNode = graph.nodes.find(n => n.batchId === graph.rootBatch) ?? graph.nodes[0]
  if (!rootNode) return new Map()

  const levelOf = new Map<string, number>()
  const queue: string[] = [rootNode.id]
  levelOf.set(rootNode.id, 0)

  while (queue.length > 0) {
    const cur = queue.shift()!
    const curLevel = levelOf.get(cur)!

    for (const edge of graph.edges) {
      if (edge.target === cur && !levelOf.has(edge.source)) {
        levelOf.set(edge.source, curLevel - 1)
        queue.push(edge.source)
      }
      if (edge.source === cur && !levelOf.has(edge.target)) {
        levelOf.set(edge.target, curLevel + 1)
        queue.push(edge.target)
      }
    }
  }

  // Place disconnected nodes (unreachable from root) in a separate row below the graph
  const disconnectedLevel =
    levelOf.size > 0
      ? Math.min(...Array.from(levelOf.values())) - 2
      : 0
  for (const node of graph.nodes) {
    if (!levelOf.has(node.id)) {
      levelOf.set(node.id, disconnectedLevel)
    }
  }

  // Group nodes by level so we can centre each row
  const byLevel = new Map<number, string[]>()
  for (const [id, level] of levelOf) {
    const group = byLevel.get(level) ?? []
    group.push(id)
    byLevel.set(level, group)
  }

  const positions = new Map<string, { x: number; y: number }>()
  for (const [level, ids] of byLevel) {
    const rowWidth = ids.length * H_SPACING
    const startX = -rowWidth / 2 + H_SPACING / 2
    ids.forEach((id, i) => {
      positions.set(id, { x: startX + i * H_SPACING, y: level * LEVEL_HEIGHT })
    })
  }

  return positions
}

/**
 * Returns a filtered view of the graph containing only nodes and edges
 * reachable from the root in the specified direction.
 *
 * `'both'` returns the graph unchanged.
 * `'forward'` follows edges from root → downstream.
 * `'reverse'` follows edges from root ← upstream.
 */
export function filterGraphByDirection(
  graph: TraceGraph,
  activeDirection: 'forward' | 'reverse' | 'both',
): TraceGraph {
  if (activeDirection === 'both') return graph

  const rootNode = graph.nodes.find(n => n.batchId === graph.rootBatch) ?? graph.nodes[0]
  if (!rootNode) return { ...graph, nodes: [], edges: [] }

  const reachable = new Set<string>([rootNode.id])
  const queue = [rootNode.id]

  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const edge of graph.edges) {
      if (activeDirection === 'forward' && edge.source === cur && !reachable.has(edge.target)) {
        reachable.add(edge.target)
        queue.push(edge.target)
      }
      if (activeDirection === 'reverse' && edge.target === cur && !reachable.has(edge.source)) {
        reachable.add(edge.source)
        queue.push(edge.source)
      }
    }
  }

  const filteredNodes = graph.nodes.filter(n => reachable.has(n.id))
  const filteredEdges = graph.edges.filter(e => reachable.has(e.source) && reachable.has(e.target))

  return {
    ...graph,
    direction: activeDirection === 'forward' ? 'downstream' : 'upstream',
    nodes: filteredNodes,
    edges: filteredEdges,
    upstreamCount: activeDirection === 'forward' ? 0 : graph.upstreamCount,
    downstreamCount: activeDirection === 'reverse' ? 0 : graph.downstreamCount,
  }
}

// ---------------------------------------------------------------------------
// React Flow node/edge mapping
// ---------------------------------------------------------------------------

/** Data payload attached to each React Flow node. */
export interface TraceNodeData {
  node: TraceNode
  isRoot: boolean
  isSelected: boolean
  [key: string]: unknown
}

export function mapToFlowNodes(
  graph: TraceGraph,
  selectedId: string | null | undefined,
): Node<TraceNodeData>[] {
  const positions = bfsLayout(graph)

  return graph.nodes.map(node => {
    const pos = positions.get(node.id) ?? { x: 0, y: 0 }
    return {
      id: node.id,
      type: 'traceNode',
      position: pos,
      data: {
        node,
        isRoot: node.batchId === graph.rootBatch,
        isSelected: node.id === selectedId,
      },
    }
  })
}

/**
 * Per-relationshipType edge colour map.
 *
 * Keys correspond to the `TraceEdge.relationshipType` enum (component-of /
 * produced-from / split-from / merged-into / transferred-to / delivered-to /
 * vendor-receipt / consumed-by). The legend in `trace-graph-panel.tsx` uses
 * the same map for the colour swatch, so legend and edge stroke stay in sync.
 *
 * Default fallback (anything outside the map) is the legacy neutral grey.
 */
export const LINK_TYPE_COLORS: Record<string, string> = {
  'produced-from': '#7C3AED',     // purple — production lineage
  'consumed-by': '#7C3AED',       // purple — consumption (opposite side of production)
  'transferred-to': '#0891B2',    // cyan — internal/STO movement
  'vendor-receipt': '#D97706',    // orange — inbound from external supplier
  'delivered-to': '#059669',      // green — outbound to customer
  'split-from': '#6366F1',        // indigo — batch split
  'merged-into': '#6366F1',       // indigo — batch merge
  'component-of': '#6B7280',      // grey — legacy/generic
}

export const DEFAULT_EDGE_COLOR = '#9CA3AF'

export function mapToFlowEdges(graph: TraceGraph): Edge[] {
  return graph.edges.map((edge: TraceEdge) => {
    const stroke = LINK_TYPE_COLORS[edge.relationshipType ?? ''] ?? DEFAULT_EDGE_COLOR
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.relationshipType?.replace(/-/g, ' ') ?? '',
      style: { stroke, strokeWidth: 1.5 },
      labelStyle: { fontSize: 10, fill: '#6B7280' },
      labelBgStyle: { fill: 'var(--shell-bg, #ffffff)', fillOpacity: 0.85 },
    }
  })
}
