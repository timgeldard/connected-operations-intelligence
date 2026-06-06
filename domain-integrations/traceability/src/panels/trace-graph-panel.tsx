import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type NodeProps,
  type Node,
  type Edge,
} from '@xyflow/react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { TraceNode, TraceEdge } from '@connectio/data-contracts'
import { useTraceGraph, useBatchHeaderSummary } from '../adapters/trace2-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'
import {
  NODE_TYPE_LABEL,
  NODE_WIDTH,
  NODE_HEIGHT,
  LINK_TYPE_COLORS,
  DEFAULT_EDGE_COLOR,
  mapToFlowNodes,
  mapToFlowEdges,
  filterGraphByDirection,
  type TraceNodeData,
} from './trace-graph-utils.js'
import { QueriedAtLabel } from '../components/QueriedAtLabel.js'
import { Card, CardContent } from '@connectio/design-system'


const registration: EvidencePanelRegistration = {
  panelId: 'trace-graph',
  displayName: 'Trace Graph',
  description: 'Upstream and downstream batch traceability network showing nodes, edges, and risk levels.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['trace-investigation', 'traceability-workspace'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.95, hidden: false },
  drillThrough: { label: 'Open full trace tree', targetWorkspaceId: 'trace-investigation', targetViewId: 'trace-tree', contextScopes: ['batch'] },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

// ---------------------------------------------------------------------------
// Custom node renderer
// ---------------------------------------------------------------------------

function TraceNodeCard({ data }: NodeProps<Node<TraceNodeData>>) {
  const { node, isRoot, isSelected } = data
  const border = isSelected ? 'var(--brand)' : 'var(--stroke)'
  const bg = isSelected ? 'color-mix(in srgb, var(--brand) 6%, white)' : 'var(--white)'

  return (
    <div
      style={{
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        background: bg,
        border: `2px solid ${border}`,
        borderRadius: 'var(--radius-md)',
        padding: '8px 10px',
        boxSizing: 'border-box',
        boxShadow: isRoot ? `0 0 0 3px ${border}30` : 'var(--shadow-sm)',
        cursor: 'pointer',
        position: 'relative',
        fontFamily: 'var(--font-sans)',
        transition: 'all 0.2s',
      }}
      aria-label={`${node.materialDescription}${node.type ? ` — ${node.type}` : ''}`}
    >
      <Handle type="target" position={Position.Top} style={{ background: border, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: border, width: 8, height: 8 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 'var(--fw-bold)', color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: 'var(--ls-upper)', flexShrink: 0 }}>
          {node.type ? (NODE_TYPE_LABEL[node.type] ?? node.type) : undefined}
        </span>
        {isRoot && (
          <span style={{ fontSize: 8, background: 'var(--brand)', color: 'var(--white)', borderRadius: 'var(--radius-sm)', padding: '1px 4px', flexShrink: 0, fontWeight: 'var(--fw-bold)' }}>
            ROOT
          </span>
        )}
      </div>
      <div style={{ fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semibold)', color: 'var(--forest)', marginTop: 4, lineHeight: 'var(--lh-head)', wordBreak: 'break-word' }}>
        {node.materialDescription}
      </div>
      {node.batchId && (
        <div style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
          {node.batchId}
        </div>
      )}
      {node.plantId && (
        <div
          style={{ fontSize: 9, color: 'var(--fg-muted)', marginTop: 1, fontFamily: 'var(--font-mono)' }}
          aria-label={`Plant ${node.plantId}`}
        >
          {node.plantId}
        </div>
      )}
      {node.quantity != null && (
        <div style={{ fontSize: 9, color: 'var(--fg-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
          {node.quantity.toLocaleString()} {node.uom ?? ''}
        </div>
      )}
      {node.status === 'unresolved' && (
        <div style={{ display: 'flex', marginTop: 4 }}>
          <span style={{ fontSize: 9, color: 'var(--status-bad)', fontWeight: 'var(--fw-semibold)' }}>Unresolved</span>
        </div>
      )}
    </div>
  )
}

const nodeTypes = { traceNode: TraceNodeCard }

// ---------------------------------------------------------------------------
// Selected node detail panel
// ---------------------------------------------------------------------------

function SelectedNodeDetail({ node, graphEdges, baseRequest, onClose }: { node: TraceNode; graphEdges: TraceEdge[]; baseRequest: Trace2AdapterRequest; onClose: () => void }) {
  const inboundEdges = graphEdges.filter(e => e.target === node.id)
  const outboundEdges = graphEdges.filter(e => e.source === node.id)

  const nodeRequest: Trace2AdapterRequest = {
    ...baseRequest,
    materialId: node.materialId,
    batchId: node.batchId ?? undefined,
    plantId: node.plantId ?? undefined,
  }
  const { data: batchHeader } = useBatchHeaderSummary(nodeRequest, { enabled: !!node.batchId })
  const manufactureDate = batchHeader?.ok ? batchHeader.data.manufactureDate : undefined
  const expiryDate = batchHeader?.ok ? batchHeader.data.expiryDate : undefined
  const vendorBatch = batchHeader?.ok ? batchHeader.data.vendorBatchId : undefined

  return (
    <div aria-label="Selected node details" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--stroke)', paddingBottom: 10 }}>
        <h4 className="t-eyebrow" style={{ margin: 0 }}>Selected node</h4>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 18, fontWeight: 'bold', padding: 0 }} aria-label="Close details">×</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Detail label="Material ID" value={node.materialId} mono />
        <Detail label="Description" value={node.materialDescription} />
        {node.batchId && <Detail label="Batch ID" value={node.batchId} mono />}
        {node.plantId && <Detail label="Plant" value={node.plantId} mono />}
        {manufactureDate && <Detail label="Date of Manufacture" value={manufactureDate.slice(0, 10)} mono />}
        {expiryDate && <Detail label="Expiry Date" value={expiryDate.slice(0, 10)} mono />}
        {vendorBatch && <Detail label="Vendor Batch Number" value={vendorBatch} mono />}
        {node.depth != null && <Detail label="Lineage Depth" value={String(node.depth)} />}
        <Detail label="Focal Anchor" value={node.isAnchor ? 'Yes' : 'No'} />
        <Detail label="Inbound edges" value={String(inboundEdges.length)} />
        <Detail label="Outbound edges" value={String(outboundEdges.length)} />
        {node.quantity != null && <Detail label="Quantity" value={`${node.quantity.toLocaleString()} ${node.uom ?? ''}`} mono />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Selected edge detail panel
// ---------------------------------------------------------------------------

function SelectedEdgeDetail({ edge, nodes, onClose }: { edge: TraceEdge; nodes: TraceNode[]; onClose: () => void }) {
  const sourceNode = nodes.find(n => n.id === edge.source)
  const targetNode = nodes.find(n => n.id === edge.target)

  return (
    <div aria-label="Selected relationship details" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--stroke)', paddingBottom: 10 }}>
        <h4 className="t-eyebrow" style={{ margin: 0 }}>Selected relationship</h4>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 18, fontWeight: 'bold', padding: 0 }} aria-label="Close details">×</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Detail label="Link type (mapped)" value={edge.relationshipType?.replace(/-/g, ' ') ?? '—'} />
        {edge.linkType && <Detail label="Link type (raw)" value={edge.linkType} />}
        {edge.movementType && <Detail label="Movement Type" value={edge.movementType} mono />}
        {edge.postingDate && <Detail label="Posting Date" value={edge.postingDate} mono />}
        {edge.quantity != null && (
          <Detail label="Quantity" value={`${edge.quantity.toLocaleString()} ${edge.uom ?? ''}`} mono />
        )}
        {sourceNode && <Detail label="Source Batch" value={sourceNode.batchId ?? edge.source} mono />}
        {targetNode && <Detail label="Target Batch" value={targetNode.batchId ?? edge.target} mono />}
        {edge.processOrderId && <Detail label="Process Order" value={edge.processOrderId} mono />}
        {edge.materialDocumentNumber && <Detail label="Material Document" value={edge.materialDocumentNumber} mono />}
        {edge.deliveryId && <Detail label="Delivery ID" value={edge.deliveryId} mono />}
        {edge.supplierId && <Detail label="Supplier ID" value={edge.supplierId} mono />}
        {edge.customerId && <Detail label="Customer ID" value={edge.customerId} mono />}
      </div>
    </div>
  )
}

function Detail({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 9, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-upper)', fontFamily: 'var(--font-mono)' }}>{label}</span>
      <span style={{ fontSize: 'var(--fs-13)', color: 'var(--forest)', fontWeight: 'var(--fw-medium)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}

function HeaderChip({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 9, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-upper)', fontFamily: 'var(--font-mono)' }}>{label}</span>
      <span style={{ fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semibold)', color: alert ? 'var(--status-bad)' : 'var(--forest)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Unused timeline, exposure, and banner components removed.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Direction toggle
// ---------------------------------------------------------------------------

type DirectionOption = 'both' | 'forward' | 'reverse'

const DIRECTION_LABELS: Record<DirectionOption, string> = {
  both: 'Both',
  forward: 'Downstream ↓',
  reverse: 'Upstream ↑',
}

function DirectionToggle({
  active,
  onChange,
}: {
  active: DirectionOption
  onChange: (d: DirectionOption) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }} role="group" aria-label="Trace direction">
      {(['reverse', 'both', 'forward'] as DirectionOption[]).map(dir => (
        <button
          key={dir}
          onClick={() => onChange(dir)}
          style={{
            padding: '3px 10px',
            fontSize: 11,
            borderRadius: 4,
            border: '1px solid var(--shell-line)',
            background: active === dir ? '#2563EB' : 'var(--shell-surface)',
            color: active === dir ? '#fff' : 'var(--shell-fg)',
            cursor: 'pointer',
            fontWeight: active === dir ? 600 : 400,
          }}
          aria-pressed={active === dir}
        >
          {DIRECTION_LABELS[dir]}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Link type legend
//
// The colour map is shared with `mapToFlowEdges` (see trace-graph-utils.ts) so
// the legend swatch and the actual edge stroke stay in sync — fixing a prior
// drift where the legend used keys (goods-movement, production-order, …) that
// did not match the schema's relationshipType enum.
// ---------------------------------------------------------------------------

function LinkTypeLegend({ edges }: { edges: TraceEdge[] }) {
  const types = [...new Set(edges.flatMap(e => e.relationshipType != null ? [e.relationshipType] : []))]
  if (types.length === 0) return null
  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 8 }}
      aria-label="Link type legend"
      data-testid="link-type-legend"
    >
      {types.map(lt => (
        <span key={lt} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#374151' }}>
          <span
            style={{
              display: 'inline-block',
              width: 16,
              height: 2,
              background: LINK_TYPE_COLORS[lt] ?? DEFAULT_EDGE_COLOR,
              borderRadius: 1,
              flexShrink: 0,
            }}
          />
          {lt.replace(/-/g, ' ')}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export interface TraceGraphPanelProps {
  readonly request: Trace2AdapterRequest
}

export function TraceGraphPanel({ request }: TraceGraphPanelProps) {
  const { data: result, isLoading } = useTraceGraph(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) markReady()
    else if (result && !result.ok) markError()
  }, [isLoading, result, markReady, markError])

  const graph = result?.ok ? result.data : null

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [activeDirection, setActiveDirection] = useState<DirectionOption>('both')

  const directedGraph = useMemo(
    () => (graph ? filterGraphByDirection(graph, activeDirection) : null),
    [graph, activeDirection],
  )

  const initialNodes = useMemo(
    () => (directedGraph ? mapToFlowNodes(directedGraph, selectedId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [directedGraph],
  )
  const initialEdges = useMemo(() => (directedGraph ? mapToFlowEdges(directedGraph) : []), [directedGraph])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Sync when graph data or direction changes
  useEffect(() => {
    if (!directedGraph) return
    setNodes(mapToFlowNodes(directedGraph, selectedId))
    setEdges(mapToFlowEdges(directedGraph))
  // Deliberately omit selectedId to avoid clearing selection on data refresh
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directedGraph, setNodes, setEdges])

  // Update node selected state without triggering a full graph re-layout
  useEffect(() => {
    setNodes(prev =>
      prev.map(n => ({
        ...n,
        data: { ...n.data, isSelected: n.id === selectedId },
      })),
    )
  }, [selectedId, setNodes])

  // Clear selections when direction changes
  useEffect(() => {
    setSelectedId(null)
    setSelectedEdgeId(null)
  }, [activeDirection])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedId(prev => (prev === node.id ? null : node.id))
    setSelectedEdgeId(null)
  }, [])

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(prev => (prev === edge.id ? null : edge.id))
    setSelectedId(null)
  }, [])

  const selectedNode = selectedId
    ? directedGraph?.nodes.find(n => n.id === selectedId) ?? null
    : null

  const selectedEdge = selectedEdgeId
    ? directedGraph?.edges.find(e => e.id === selectedEdgeId) ?? null
    : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {graph && (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Investigation header info */}
          <div
            style={{
              background: 'var(--stone)',
              border: '1px solid var(--stroke)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 18px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px 24px',
              alignItems: 'center',
            }}
            aria-label="Investigation context"
          >
            <HeaderChip label="Material" value={request.materialId ?? '—'} />
            <HeaderChip label="Batch" value={request.batchId ?? '—'} />
            <HeaderChip label="Plant" value={request.plantId ?? '—'} />
            <HeaderChip label="Nodes" value={String(graph.nodes.length)} />
            <HeaderChip label="Edges" value={String(graph.edges.length)} />
            <HeaderChip label="Depth reached" value={String(graph.depth)} />
            <HeaderChip label="Truncated" value={graph.truncated ? 'Yes' : 'No'} alert={!!graph.truncated} />
            {graph.warnings && graph.warnings.length > 0 && (
              <HeaderChip label="Warnings" value={String(graph.warnings.length)} alert />
            )}
            <HeaderChip label="Source" value="databricks-api" />
          </div>

          {/* Direction toggle + root metadata */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <DirectionToggle active={activeDirection} onChange={setActiveDirection} />
            <span style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
              Root: {graph.rootBatch}
            </span>
          </div>

          {/* Link type legend — derived from current directed graph */}
          {directedGraph && <LinkTypeLegend edges={directedGraph.edges} />}

          {/* Side-by-Side Flex Layout: Graph + Slide-out details drawer */}
          <div style={{ display: 'flex', gap: 20, position: 'relative', minHeight: 520 }}>
            {/* React Flow graph or empty state */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 520 }}>
              {directedGraph && directedGraph.nodes.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px dashed var(--stroke)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--fg-muted)',
                    fontSize: 'var(--fs-13)',
                  }}
                >
                  No lineage edges found for this material/batch/plant.
                </div>
              ) : (
                <div
                  style={{ flex: 1, borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)', overflow: 'hidden', minHeight: 520, background: 'var(--white)' }}
                  aria-label="Trace graph visualisation"
                >
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={onNodeClick}
                    onEdgeClick={onEdgeClick}
                    fitView
                    fitViewOptions={{ padding: 0.3 }}
                    minZoom={0.3}
                    maxZoom={2}
                    attributionPosition="bottom-right"
                  >
                    <Background gap={16} size={1} color="var(--stroke-soft)" />
                    <Controls showInteractive={false} />
                  </ReactFlow>
                </div>
              )}
            </div>

            {/* Slide-out details sidebar card */}
            {(selectedNode || selectedEdge) ? (
              <Card style={{ width: 340, padding: 20, borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)', boxShadow: 'var(--shadow-md)', background: 'var(--white)', overflowY: 'auto', maxHeight: 520 }}>
                <CardContent style={{ padding: 0 }}>
                  {selectedNode && (
                    <SelectedNodeDetail
                      node={selectedNode}
                      graphEdges={directedGraph?.edges ?? []}
                      baseRequest={request}
                      onClose={() => setSelectedId(null)}
                    />
                  )}
                  {selectedEdge && directedGraph && (
                    <SelectedEdgeDetail
                      edge={selectedEdge}
                      nodes={directedGraph.nodes}
                      onClose={() => setSelectedEdgeId(null)}
                    />
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card style={{ width: 340, padding: 20, borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke-soft)', background: 'var(--stone)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <CardContent style={{ padding: 0, color: 'var(--fg-muted)', fontSize: 'var(--fs-13)' }}>
                  Click any node or connection line to view detailed specifications and source context.
                </CardContent>
              </Card>
            )}
          </div>

          <QueriedAtLabel fetchedAt={lastRefreshedAt} style={{ marginTop: 8 }} />
        </div>
      )}
    </EvidencePanel>
  )
}
