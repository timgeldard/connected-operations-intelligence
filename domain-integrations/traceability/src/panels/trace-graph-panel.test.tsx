import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { TraceGraphPanel } from './trace-graph-panel.js'
import type { TraceGraph } from '@connectio/data-contracts'

// ---------------------------------------------------------------------------
// Mock @xyflow/react — jsdom lacks ResizeObserver and SVG layout
// ---------------------------------------------------------------------------

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({
    nodes,
    edges,
    onNodeClick,
    onEdgeClick,
  }: {
    nodes: { id: string; data: { node: { materialDescription: string } } }[]
    edges: { id: string; source: string; target: string; label?: string }[]
    onNodeClick?: (evt: unknown, node: unknown) => void
    onEdgeClick?: (evt: unknown, edge: unknown) => void
  }) => (
    <div data-testid="react-flow">
      {nodes.map(n => (
        <button
          key={n.id}
          data-testid={`node-${n.id}`}
          onClick={evt => onNodeClick?.(evt, n)}
        >
          {n.data.node.materialDescription}
        </button>
      ))}
      {edges.map(e => (
        <button
          key={e.id}
          data-testid={`edge-${e.id}`}
          onClick={evt => onEdgeClick?.(evt, e)}
        >
          {e.label ?? e.id}
        </button>
      ))}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  useNodesState: (init: unknown[]) => {
    const [nodes, setNodes] = useState(init)
    return [nodes, setNodes, () => {}]
  },
  useEdgesState: (init: unknown[]) => {
    const [edges, setEdges] = useState(init)
    return [edges, setEdges, () => {}]
  },
}))

// ---------------------------------------------------------------------------
// Mock EvidencePanel runtime
// ---------------------------------------------------------------------------

vi.mock('@connectio/evidence-panel-runtime', () => ({
  EvidencePanel: ({ children }: { children?: React.ReactNode }) => <div data-testid="evidence-panel">{children}</div>,
  useEvidencePanel: () => ({ displayState: 'ready', markReady: vi.fn(), markError: vi.fn() }),
}))

// ---------------------------------------------------------------------------
// Mock useTraceGraph
// ---------------------------------------------------------------------------

vi.mock('../adapters/trace2-queries.js', () => ({
  useTraceGraph: vi.fn(),
}))

import { useTraceGraph } from '../adapters/trace2-queries.js'

const mockGraph: TraceGraph = {
  direction: 'both',
  depth: 2,
  rootBatch: 'BATCH-ROOT',
  upstreamCount: 1,
  downstreamCount: 1,
  unresolvedNodeCount: 0,
  nodes: [
    { id: 'root', type: 'finished-good', materialId: 'MAT-001', batchId: 'BATCH-ROOT', plantId: 'C061', materialDescription: 'Root Cheese Block', quantity: 100, uom: 'KG', status: 'resolved', riskLevel: 'high' },
    { id: 'up1', type: 'raw-material', materialId: 'MAT-002', batchId: 'BATCH-UP1', plantId: 'C015', materialDescription: 'Raw Milk', quantity: 1000, uom: 'L', status: 'resolved', riskLevel: 'low' },
    { id: 'dn1', type: 'customer-delivery', materialId: 'MAT-001', batchId: 'BATCH-DN1', materialDescription: 'Delivery DE', quantity: 60, uom: 'KG', status: 'unresolved', riskLevel: 'critical' },
  ],
  edges: [
    { id: 'e1', source: 'up1', target: 'root', relationshipType: 'component-of', linkType: 'PRODUCTION', quantity: 1000, uom: 'L', documentReference: 'MAT-DOC-001', materialDocumentNumber: 'MAT-DOC-001' },
    { id: 'e2', source: 'root', target: 'dn1', relationshipType: 'delivered-to', linkType: 'DELIVERY', quantity: 60, uom: 'KG', movementType: 'GD-601', documentReference: 'DO-4900089123', materialDocumentNumber: 'DO-4900089123' },
  ],
}

const request = { investigationId: 'INV-001', batchId: 'BATCH-ROOT' }

beforeEach(() => {
  vi.mocked(useTraceGraph).mockReturnValue({
    data: { ok: true, data: mockGraph, fetchedAt: '2024-03-08T15:00:00.000Z', source: 'mock' },
    isLoading: false,
  } as ReturnType<typeof useTraceGraph>)
})

// ---------------------------------------------------------------------------
// Core rendering tests
// ---------------------------------------------------------------------------

describe('TraceGraphPanel', () => {
  it('renders the React Flow component when data is available', () => {
    render(<TraceGraphPanel request={request} />)
    expect(screen.getByTestId('react-flow')).toBeDefined()
  })

  it('renders a node button for each graph node', () => {
    render(<TraceGraphPanel request={request} />)
    expect(screen.getByTestId('node-root')).toBeDefined()
    expect(screen.getByTestId('node-up1')).toBeDefined()
    expect(screen.getByTestId('node-dn1')).toBeDefined()
  })

  it('shows summary stats', () => {
    render(<TraceGraphPanel request={request} />)
    const header = screen.getByLabelText('Investigation context')
    expect(within(header).getByText('Nodes')).toBeDefined()
    expect(within(header).getByText('Edges')).toBeDefined()
    expect(within(header).getByText('Depth reached')).toBeDefined()
  })

  it('shows the root batch identifier', () => {
    render(<TraceGraphPanel request={request} />)
    // BATCH-ROOT appears in both investigation header (batchId chip) and root batch line
    expect(screen.getAllByText('BATCH-ROOT').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the hint text when no node or edge is selected', () => {
    render(<TraceGraphPanel request={request} />)
    expect(screen.getByText(/click any node or connection line/i)).toBeDefined()
  })

  it('wraps content in the EvidencePanel', () => {
    render(<TraceGraphPanel request={request} />)
    expect(screen.getByTestId('evidence-panel')).toBeDefined()
  })

  it('renders nothing inside EvidencePanel when data is unavailable', () => {
    vi.mocked(useTraceGraph).mockReturnValue({
      data: { ok: false, error: { code: 'unknown', message: 'No data', retryable: true }, displayState: 'error', source: 'mock' },
      isLoading: false,
    } as ReturnType<typeof useTraceGraph>)

    render(<TraceGraphPanel request={request} />)
    expect(screen.queryByTestId('react-flow')).toBeNull()
  })

  it('renders nothing inside EvidencePanel while loading', () => {
    vi.mocked(useTraceGraph).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useTraceGraph>)

    render(<TraceGraphPanel request={request} />)
    expect(screen.queryByTestId('react-flow')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Node selection tests
// ---------------------------------------------------------------------------

describe('TraceGraphPanel — node selection', () => {
  it('shows selected node details when a node is clicked', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('node-dn1'))
    expect(screen.getByText('Selected node')).toBeDefined()
    expect(screen.getAllByText('Delivery DE').length).toBeGreaterThanOrEqual(1)
  })

  it('deselects a node when clicked again', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('node-dn1'))
    expect(screen.getByText('Selected node')).toBeDefined()
    fireEvent.click(screen.getByTestId('node-dn1'))
    expect(screen.queryByText('Selected node')).toBeNull()
  })

  it('switches selection between two nodes', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('node-root'))
    expect(screen.getAllByText('Root Cheese Block').length).toBeGreaterThanOrEqual(1)
    fireEvent.click(screen.getByTestId('node-up1'))
    expect(screen.getAllByText('Raw Milk').length).toBeGreaterThanOrEqual(1)
  })

  it('shows inbound and outbound edge counts in selected node detail', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('node-root'))
    // root has e1 (incoming) and e2 (outgoing) — shown as inbound/outbound counts
    const detail = screen.getByLabelText('Selected node details')
    expect(within(detail).getByText('Inbound edges')).toBeDefined()
    expect(within(detail).getByText('Outbound edges')).toBeDefined()
  })

  it('preserves node.plantId through to the React Flow node data (consumed by TraceNodeCard for at-a-glance display)', () => {
    // The TraceNodeCard renders plantId as a chip beneath batchId, but this
    // test file mocks @xyflow/react with a stub button per node, so the card's
    // chip is not visible here. Verify the data path: plantId must reach the
    // React Flow node data layer for the live card to show it.
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('node-root'))
    const detail = screen.getByLabelText('Selected node details')
    // Selected-node detail (real production code, not behind the ReactFlow mock)
    // reads node.plantId directly.
    expect(within(detail).getByText('C061')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Edge selection tests
// ---------------------------------------------------------------------------

describe('TraceGraphPanel — edge selection', () => {
  it('shows edge detail panel when an edge is clicked', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('edge-e1'))
    expect(screen.getByText('Selected relationship')).toBeDefined()
  })

  it('shows mapped relationship type for the selected edge', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('edge-e1'))
    const detail = screen.getByLabelText('Selected relationship details')
    expect(within(detail).getByText('Link type (mapped)')).toBeDefined()
    expect(within(detail).getByText('component of')).toBeDefined()
  })

  it('shows raw linkType alongside the mapped relationshipType', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('edge-e1'))
    const detail = screen.getByLabelText('Selected relationship details')
    expect(within(detail).getByText('Link type (raw)')).toBeDefined()
    expect(within(detail).getByText('PRODUCTION')).toBeDefined()
  })

  it('shows movement type when present', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('edge-e2'))
    expect(screen.getByText('GD-601')).toBeDefined()
  })

  it('shows document reference when present', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('edge-e1'))
    expect(screen.getByText('MAT-DOC-001')).toBeDefined()
  })

  it('shows source and target batch IDs in edge detail', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('edge-e1'))
    const detail = screen.getByLabelText('Selected relationship details')
    expect(within(detail).getByText('BATCH-UP1')).toBeDefined()
    expect(within(detail).getByText('BATCH-ROOT')).toBeDefined()
  })

  it('clears edge detail when edge clicked again', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('edge-e1'))
    expect(screen.getByText('Selected relationship')).toBeDefined()
    fireEvent.click(screen.getByTestId('edge-e1'))
    expect(screen.queryByText('Selected relationship')).toBeNull()
  })

  it('clears node selection when an edge is clicked', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('node-root'))
    expect(screen.getByText('Selected node')).toBeDefined()
    fireEvent.click(screen.getByTestId('edge-e1'))
    expect(screen.queryByText('Selected node')).toBeNull()
    expect(screen.getByText('Selected relationship')).toBeDefined()
  })

  it('clears edge selection when a node is clicked', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('edge-e1'))
    expect(screen.getByText('Selected relationship')).toBeDefined()
    fireEvent.click(screen.getByTestId('node-root'))
    expect(screen.queryByText('Selected relationship')).toBeNull()
    expect(screen.getByText('Selected node')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Direction toggle tests
// ---------------------------------------------------------------------------

describe('TraceGraphPanel — direction toggle', () => {
  it('renders the three direction toggle buttons', () => {
    render(<TraceGraphPanel request={request} />)
    expect(screen.getByText('Both')).toBeDefined()
    expect(screen.getByText('Downstream ↓')).toBeDefined()
    expect(screen.getByText('Upstream ↑')).toBeDefined()
  })

  it('"Downstream ↓" hides upstream nodes', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByText('Downstream ↓'))
    expect(screen.queryByTestId('node-up1')).toBeNull()
    expect(screen.getByTestId('node-root')).toBeDefined()
    expect(screen.getByTestId('node-dn1')).toBeDefined()
  })

  it('"Upstream ↑" hides downstream nodes', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByText('Upstream ↑'))
    expect(screen.queryByTestId('node-dn1')).toBeNull()
    expect(screen.getByTestId('node-root')).toBeDefined()
    expect(screen.getByTestId('node-up1')).toBeDefined()
  })

  it('"Both" restores all nodes', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByText('Downstream ↓'))
    expect(screen.queryByTestId('node-up1')).toBeNull()
    fireEvent.click(screen.getByText('Both'))
    expect(screen.getByTestId('node-up1')).toBeDefined()
  })

  it('clears selection when direction changes', () => {
    render(<TraceGraphPanel request={request} />)
    fireEvent.click(screen.getByTestId('node-root'))
    expect(screen.getByText('Selected node')).toBeDefined()
    fireEvent.click(screen.getByText('Downstream ↓'))
    expect(screen.queryByText('Selected node')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Empty state and warnings banner tests
// ---------------------------------------------------------------------------

describe('TraceGraphPanel — empty state', () => {
  it('shows empty-state message when graph has no nodes', () => {
    const emptyGraph: TraceGraph = {
      ...mockGraph,
      nodes: [],
      edges: [],
      upstreamCount: 0,
      downstreamCount: 0,
    }
    vi.mocked(useTraceGraph).mockReturnValue({
      data: { ok: true, data: emptyGraph, fetchedAt: '2024-03-08T15:00:00.000Z', source: 'databricks-api' },
      isLoading: false,
    } as ReturnType<typeof useTraceGraph>)
    render(<TraceGraphPanel request={request} />)
    expect(screen.getByText(/No lineage edges found for this material\/batch\/plant/i)).toBeDefined()
  })
})

describe('TraceGraphPanel — warnings and truncation chips', () => {
  it('shows truncation chip status when graph is truncated', () => {
    const truncatedGraph: TraceGraph = {
      ...mockGraph,
      truncated: true,
      warnings: ['max_edges_reached'],
    }
    vi.mocked(useTraceGraph).mockReturnValue({
      data: { ok: true, data: truncatedGraph, fetchedAt: '2024-03-08T15:00:00.000Z', source: 'databricks-api' },
      isLoading: false,
    } as ReturnType<typeof useTraceGraph>)
    render(<TraceGraphPanel request={request} />)
    const header = screen.getByLabelText('Investigation context')
    expect(within(header).getByText('Yes')).toBeDefined()
    expect(within(header).getByText('Warnings')).toBeDefined()
  })

  it('shows warning chip when max_depth_reached in warnings', () => {
    const depthWarningGraph: TraceGraph = {
      ...mockGraph,
      warnings: ['max_depth_reached'],
    }
    vi.mocked(useTraceGraph).mockReturnValue({
      data: { ok: true, data: depthWarningGraph, fetchedAt: '2024-03-08T15:00:00.000Z', source: 'databricks-api' },
      isLoading: false,
    } as ReturnType<typeof useTraceGraph>)
    render(<TraceGraphPanel request={request} />)
    const header = screen.getByLabelText('Investigation context')
    expect(within(header).getByText('Warnings')).toBeDefined()
  })

  it('shows warning chip when max_edges_reached in warnings', () => {
    const edgeLimitGraph: TraceGraph = {
      ...mockGraph,
      truncated: false,
      warnings: ['max_edges_reached'],
    }
    vi.mocked(useTraceGraph).mockReturnValue({
      data: { ok: true, data: edgeLimitGraph, fetchedAt: '2024-03-08T15:00:00.000Z', source: 'databricks-api' },
      isLoading: false,
    } as ReturnType<typeof useTraceGraph>)
    render(<TraceGraphPanel request={request} />)
    const header = screen.getByLabelText('Investigation context')
    expect(within(header).getByText('Warnings')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Investigation header tests (c.txt §3)
// ---------------------------------------------------------------------------

describe('TraceGraphPanel — investigation header', () => {
  it('shows material, batch, plant from request in investigation header', () => {
    render(<TraceGraphPanel request={{ investigationId: '', materialId: 'MAT-X', batchId: 'BATCH-X', plantId: 'P001' }} />)
    const header = screen.getByLabelText('Investigation context')
    expect(within(header).getByText('MAT-X')).toBeDefined()
    expect(within(header).getByText('BATCH-X')).toBeDefined()
    expect(within(header).getByText('P001')).toBeDefined()
  })

  it('shows node and edge counts', () => {
    render(<TraceGraphPanel request={request} />)
    const header = screen.getByLabelText('Investigation context')
    // mockGraph has 3 nodes — '3' is unique in header
    expect(within(header).getByText('3')).toBeDefined()
    // edge count '2' and depth '2' both appear — assert both labels exist
    expect(within(header).getByText('Nodes')).toBeDefined()
    expect(within(header).getByText('Edges')).toBeDefined()
  })

  it('shows source in investigation header', () => {
    render(<TraceGraphPanel request={request} />)
    const header = screen.getByLabelText('Investigation context')
    expect(within(header).getByText('databricks-api')).toBeDefined()
  })

  it('shows Truncated: No when graph is not truncated', () => {
    render(<TraceGraphPanel request={request} />)
    const header = screen.getByLabelText('Investigation context')
    expect(within(header).getByText('No')).toBeDefined()
  })


  it('shows Truncated: Yes when graph is truncated', () => {
    vi.mocked(useTraceGraph).mockReturnValue({
      data: { ok: true, data: { ...mockGraph, truncated: true }, fetchedAt: '', source: 'databricks-api' },
      isLoading: false,
    } as ReturnType<typeof useTraceGraph>)
    render(<TraceGraphPanel request={request} />)
    const header = screen.getByLabelText('Investigation context')
    expect(within(header).getByText('Yes')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Adapter param pass-through architecture test (c.txt §10)
// ---------------------------------------------------------------------------

describe('TraceGraphPanel — architecture', () => {
  it('renders no mock graph data on fetch failure', () => {
    vi.mocked(useTraceGraph).mockReturnValue({
      data: { ok: false, error: { code: 'network', message: 'Failed', retryable: true }, displayState: 'error', source: 'databricks-api' },
      isLoading: false,
    } as ReturnType<typeof useTraceGraph>)
    render(<TraceGraphPanel request={request} />)
    expect(screen.queryByTestId('react-flow')).toBeNull()
    expect(screen.queryByLabelText('Investigation context')).toBeNull()
  })
})

