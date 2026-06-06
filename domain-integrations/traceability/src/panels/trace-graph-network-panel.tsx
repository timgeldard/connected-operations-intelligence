import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { TraceGraph, TraceNode } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'

const registration: EvidencePanelRegistration = {
  panelId: 'trace-graph-network',
  displayName: 'Lineage Network',
  description:
    'Force-directed lineage graph showing upstream and downstream nodes for the investigated batch.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['trace-investigation'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: {
    staleAfterSeconds: 600,
    errorAfterSeconds: 1800,
    refreshOnFocus: false,
    pollIntervalSeconds: null,
  },
  confidencePolicy: { level: 0.9, hidden: false },
  drillThrough: {
    label: 'Open in Trace2',
    targetWorkspaceId: 'traceability-workspace',
    targetViewId: 'trace',
    contextScopes: ['batch'],
  },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

export type RiskFilter = 'all' | 'critical' | 'high' | 'medium' | 'low'

export interface TraceGraphNetworkPanelProps {
  readonly result?: AdapterResult<TraceGraph>
  readonly isLoading?: boolean
  readonly riskFilter?: RiskFilter
  readonly onNodeClick?: (node: TraceNode) => void
}

const RISK_HIERARCHY: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
}

const RISK_COLORS: Record<string, string> = {
  critical: '#F24A00',
  high: '#F9C20A',
  medium: '#44CF93',
  low: '#289BA2',
  none: '#F1F1E5',
}

const WIDTH = 800
const HEIGHT = 560

function getNodeLabel(node: TraceNode): string {
  if (node.batchId) return `${node.materialDescription} (${node.batchId})`
  return node.materialDescription
}

function getNodeColor(riskLevel: string | undefined): string {
  return RISK_COLORS[riskLevel ?? 'none'] ?? RISK_COLORS.none
}

function getNodeRadius(node: TraceNode): number {
  const base = 12
  if (node.type === 'customer-delivery') return base + 4
  if (node.type === 'supplier-lot') return base + 2
  return base
}

interface SimNode extends TraceNode, d3.SimulationNodeDatum {}

interface SimEdge {
  id: string
  source: string | SimNode
  target: string | SimNode
  relationshipType?: string
}

export function TraceGraphNetworkPanel({
  result,
  isLoading = false,
  riskFilter = 'all',
  onNodeClick,
}: TraceGraphNetworkPanelProps) {
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) {
      markReady()
    } else if (result && !result.ok) {
      markError()
    }
  }, [isLoading, result, markReady, markError])

  const graph: TraceGraph | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {graph && (
        <TraceGraphCanvas graph={graph} riskFilter={riskFilter} onNodeClick={onNodeClick} />
      )}
    </EvidencePanel>
  )
}

function TraceGraphCanvas({
  graph,
  riskFilter,
  onNodeClick,
}: {
  graph: TraceGraph
  riskFilter: RiskFilter
  onNodeClick?: (node: TraceNode) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedNode, setSelectedNode] = useState<TraceNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<TraceNode | null>(null)

  const filtered = useMemo(() => {
    if (riskFilter === 'all') {
      return { nodes: graph.nodes, edges: graph.edges }
    }
    const minRisk = RISK_HIERARCHY[riskFilter] ?? 0
    const filteredNodes = graph.nodes.filter((n) => (RISK_HIERARCHY[n.riskLevel ?? 'none'] ?? 0) >= minRisk)
    const nodeIds = new Set(filteredNodes.map((n) => n.id))
    const filteredEdges = graph.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    return { nodes: filteredNodes, edges: filteredEdges }
  }, [graph, riskFilter])

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const container = svg.append('g')

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        container.attr('transform', event.transform.toString())
      })
    svg.call(zoom)

    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead-network')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#14370050')

    const simNodes: SimNode[] = filtered.nodes.map((n) => ({ ...n }))
    const simEdges: SimEdge[] = filtered.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      relationshipType: e.relationshipType,
    }))

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimEdge>(simEdges)
          .id((d) => d.id)
          .distance(100),
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(WIDTH / 2, HEIGHT / 2))
      .force(
        'collision',
        d3.forceCollide<SimNode>().radius((d) => getNodeRadius(d) + 5),
      )

    const linkSelection = container
      .append('g')
      .attr('data-testid', 'trace-graph-links')
      .selectAll<SVGLineElement, SimEdge>('line')
      .data(simEdges)
      .enter()
      .append('line')
      .attr('stroke', '#14370030')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead-network)')

    const nodeSelection = container
      .append('g')
      .attr('data-testid', 'trace-graph-nodes')
      .selectAll<SVGCircleElement, SimNode>('circle')
      .data(simNodes)
      .enter()
      .append('circle')
      .attr('r', getNodeRadius)
      .attr('fill', (d) => getNodeColor(d.riskLevel))
      .attr('stroke', '#143700')
      .attr('stroke-width', (d) => (d.isAnchor ? 3 : 1.5))
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation()
        setSelectedNode(d)
        if (onNodeClick) onNodeClick(d)
      })
      .on('mouseenter', (_event: MouseEvent, d) => setHoveredNode(d))
      .on('mouseleave', () => setHoveredNode(null))
      .call(
        d3
          .drag<SVGCircleElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          }),
      )

    const labelSelection = container
      .append('g')
      .attr('data-testid', 'trace-graph-labels')
      .selectAll<SVGTextElement, SimNode>('text')
      .data(simNodes)
      .enter()
      .append('text')
      .text((d) => getNodeLabel(d))
      .attr('font-size', 10)
      .attr('font-family', 'monospace')
      .attr('fill', '#143700')
      .attr('text-anchor', 'middle')
      .attr('dy', -16)
      .style('pointer-events', 'none')
      .style('user-select', 'none')

    simulation.on('tick', () => {
      linkSelection
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0)
      nodeSelection.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0)
      labelSelection.attr('x', (d) => d.x ?? 0).attr('y', (d) => d.y ?? 0)
    })

    return () => {
      simulation.stop()
    }
  }, [filtered, onNodeClick])

  const focusedNode = selectedNode ?? hoveredNode

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--forest)' }}>
          Lineage Network
        </h3>
        <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
          <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--shell-line)', color: 'var(--shell-fg-2)' }}>
            {filtered.nodes.length} nodes · {filtered.edges.length} edges
          </span>
          <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--valentia-slate)', color: 'white' }}>
            {graph.direction}
          </span>
        </div>
      </div>

      <div
        style={{
          background: 'var(--shell-surface-2, #F1F1E5)',
          border: '1px solid var(--shell-line)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <svg
          ref={svgRef}
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', minHeight: 560, display: 'block' }}
          data-testid="trace-graph-network-svg"
        />
      </div>

      {focusedNode && (
        <div
          style={{
            padding: 12,
            background: 'var(--shell-surface-2, #F1F1E5)',
            border: '1px solid var(--shell-line)',
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--shell-fg-2)' }}>Selected Node</p>
              <p style={{ margin: '2px 0 0', fontWeight: 500, color: 'var(--forest)' }}>
                {getNodeLabel(focusedNode)}
              </p>
            </div>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                background: getNodeColor(focusedNode.riskLevel),
                color: '#143700',
              }}
            >
              {focusedNode.riskLevel ?? 'none'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
            <DetailRow label="Type" value={focusedNode.type ?? 'unknown'} />
            <DetailRow label="Depth" value={String(focusedNode.depth ?? 0)} />
            <DetailRow label="Material" value={focusedNode.materialId} />
            <DetailRow label="Status" value={focusedNode.status ?? 'unknown'} />
          </div>
        </div>
      )}

      <Legend />
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--shell-fg-2)' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontFamily: 'monospace', color: 'var(--forest)' }}>{value}</p>
    </div>
  )
}

function Legend() {
  return (
    <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: 'var(--shell-fg-2)', marginBottom: 6 }}>
        Risk Levels
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {(['critical', 'high', 'medium', 'low', 'none'] as const).map((risk) => (
          <div key={risk} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                border: '1px solid #143700',
                background: RISK_COLORS[risk],
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--shell-fg-2)', textTransform: 'capitalize' }}>
              {risk}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
