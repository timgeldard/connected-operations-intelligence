import { describe, it, expect } from 'vitest'
import { mapBackendTraceGraph } from './trace2-graph-mapper.js'
import type { BackendTraceGraphResponse } from './trace2-graph-mapper.js'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ANCHOR_MAT = '20052009'
const ANCHOR_BATCH = '0008602411'
const ANCHOR_PLANT = 'C061'
const ANCHOR_KEY = `${ANCHOR_MAT}:${ANCHOR_BATCH}:${ANCHOR_PLANT}`

const UPSTREAM_MAT = '000000000099000001'
const UPSTREAM_BATCH = '0001234567'
const UPSTREAM_PLANT = 'C061'
const UPSTREAM_KEY = `${UPSTREAM_MAT}:${UPSTREAM_BATCH}:${UPSTREAM_PLANT}`

function makeResponse(overrides: Partial<BackendTraceGraphResponse> = {}): BackendTraceGraphResponse {
  return {
    rootBatch: `${ANCHOR_MAT}/${ANCHOR_BATCH}`,
    nodes: [
      {
        id: ANCHOR_KEY,
        materialId: ANCHOR_MAT,
        batchId: ANCHOR_BATCH,
        plantId: ANCHOR_PLANT,
        depth: 0,
        directions: ['anchor'],
        isAnchor: true,
      },
      {
        id: UPSTREAM_KEY,
        materialId: UPSTREAM_MAT,
        batchId: UPSTREAM_BATCH,
        plantId: UPSTREAM_PLANT,
        depth: 1,
        directions: ['upstream'],
        isAnchor: false,
      },
    ],
    edges: [
      {
        id: `${UPSTREAM_KEY}|${ANCHOR_KEY}|PRODUCTION|MAT-DOC-001|0`,
        source: UPSTREAM_KEY,
        target: ANCHOR_KEY,
        linkType: 'PRODUCTION',
        processOrderId: 'PO-12345',
        materialDocumentNumber: 'MAT-DOC-001',
        purchaseOrderId: null,
        supplierId: null,
        customerId: null,
        deliveryId: null,
        salesOrderId: null,
        quantity: 500.0,
        uom: 'KG',
        postingDate: '2026-01-15',
        movementType: '101',
      },
    ],
    depth: 1,
    truncated: false,
    warnings: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mapBackendTraceGraph', () => {
  it('maps anchor batchId to rootBatch', () => {
    const graph = mapBackendTraceGraph(makeResponse())
    expect(graph.rootBatch).toBe(ANCHOR_BATCH)
  })

  it('preserves leading zeros in batchId (string, not number)', () => {
    const graph = mapBackendTraceGraph(makeResponse())
    const anchorNode = graph.nodes.find(n => n.id === ANCHOR_KEY)
    expect(anchorNode?.batchId).toBe('0008602411')
  })

  it('preserves leading zeros in materialId', () => {
    const graph = mapBackendTraceGraph(makeResponse())
    const upstreamNode = graph.nodes.find(n => n.id === UPSTREAM_KEY)
    expect(upstreamNode?.materialId).toBe('000000000099000001')
  })

  it('sets node id from id field', () => {
    const graph = mapBackendTraceGraph(makeResponse())
    const ids = graph.nodes.map(n => n.id)
    expect(ids).toContain(ANCHOR_KEY)
    expect(ids).toContain(UPSTREAM_KEY)
  })

  it('sets materialDescription to empty string (not label)', () => {
    const graph = mapBackendTraceGraph(makeResponse())
    for (const node of graph.nodes) {
      expect(node.materialDescription).toBe('')
    }
  })

  it('node.type is undefined (not in gold_batch_lineage)', () => {
    const graph = mapBackendTraceGraph(makeResponse())
    for (const node of graph.nodes) {
      expect(node.type).toBeUndefined()
    }
  })

  it('maps PRODUCTION linkType to produced-from relationshipType', () => {
    const graph = mapBackendTraceGraph(makeResponse())
    expect(graph.edges[0].relationshipType).toBe('produced-from')
  })

  it('maps BATCH_TRANSFER to transferred-to', () => {
    const raw = makeResponse()
    raw.edges[0].linkType = 'BATCH_TRANSFER'
    raw.edges[0].id = `${UPSTREAM_KEY}|${ANCHOR_KEY}|BATCH_TRANSFER||0`
    const graph = mapBackendTraceGraph(raw)
    expect(graph.edges[0].relationshipType).toBe('transferred-to')
  })

  it('maps DELIVERY to delivered-to', () => {
    const raw = makeResponse()
    raw.edges[0].linkType = 'DELIVERY'
    const graph = mapBackendTraceGraph(raw)
    expect(graph.edges[0].relationshipType).toBe('delivered-to')
  })

  it('sets relationshipType to undefined for unknown linkType', () => {
    const raw = makeResponse()
    raw.edges[0].linkType = 'UNKNOWN_TYPE'
    const graph = mapBackendTraceGraph(raw)
    expect(graph.edges[0].relationshipType).toBeUndefined()
  })

  it('sets relationshipType to undefined when linkType is null', () => {
    const raw = makeResponse()
    raw.edges[0].linkType = null
    const graph = mapBackendTraceGraph(raw)
    expect(graph.edges[0].relationshipType).toBeUndefined()
  })

  it('maps VENDOR_RECEIPT to vendor-receipt (not component-of)', () => {
    const raw = makeResponse()
    raw.edges[0].linkType = 'VENDOR_RECEIPT'
    const graph = mapBackendTraceGraph(raw)
    expect(graph.edges[0].relationshipType).toBe('vendor-receipt')
  })

  it('maps CONSUMPTION to consumed-by (not component-of)', () => {
    const raw = makeResponse()
    raw.edges[0].linkType = 'CONSUMPTION'
    const graph = mapBackendTraceGraph(raw)
    expect(graph.edges[0].relationshipType).toBe('consumed-by')
  })

  it('VENDOR_RECEIPT and CONSUMPTION map to different relationshipType values', () => {
    const rawVR = makeResponse()
    rawVR.edges[0].linkType = 'VENDOR_RECEIPT'
    const rawCON = makeResponse()
    rawCON.edges[0].linkType = 'CONSUMPTION'
    const graphVR = mapBackendTraceGraph(rawVR)
    const graphCON = mapBackendTraceGraph(rawCON)
    expect(graphVR.edges[0].relationshipType).not.toBe(graphCON.edges[0].relationshipType)
  })

  it('preserves raw linkType on edge for audit', () => {
    const raw = makeResponse()
    raw.edges[0].linkType = 'VENDOR_RECEIPT'
    const graph = mapBackendTraceGraph(raw)
    expect((graph.edges[0] as Record<string, unknown>)['linkType']).toBe('VENDOR_RECEIPT')
  })

  it('does not set linkType on edge when linkType is null', () => {
    const raw = makeResponse()
    raw.edges[0].linkType = null
    const graph = mapBackendTraceGraph(raw)
    expect((graph.edges[0] as Record<string, unknown>)['linkType']).toBeUndefined()
  })

  it('preserves edge source and target as nodeKey strings', () => {
    const graph = mapBackendTraceGraph(makeResponse())
    expect(graph.edges[0].source).toBe(UPSTREAM_KEY)
    expect(graph.edges[0].target).toBe(ANCHOR_KEY)
  })

  it('sets documentReference from materialDocumentNumber', () => {
    const graph = mapBackendTraceGraph(makeResponse())
    expect(graph.edges[0].documentReference).toBe('MAT-DOC-001')
  })

  it('falls back to processOrderId when materialDocumentNumber is null', () => {
    const raw = makeResponse()
    raw.edges[0].materialDocumentNumber = null
    const graph = mapBackendTraceGraph(raw)
    expect(graph.edges[0].documentReference).toBe('PO-12345')
  })

  it('documentReference is undefined when both materialDocumentNumber and processOrderId are null', () => {
    const raw = makeResponse()
    raw.edges[0].materialDocumentNumber = null
    raw.edges[0].processOrderId = null
    const graph = mapBackendTraceGraph(raw)
    expect(graph.edges[0].documentReference).toBeUndefined()
  })

  it('maps uom field to edge uom', () => {
    const graph = mapBackendTraceGraph(makeResponse())
    expect(graph.edges[0].uom).toBe('KG')
  })

  it('preserves quantity', () => {
    const graph = mapBackendTraceGraph(makeResponse())
    expect(graph.edges[0].quantity).toBe(500.0)
  })

  it('quantity is undefined when null in response', () => {
    const raw = makeResponse()
    raw.edges[0].quantity = null
    const graph = mapBackendTraceGraph(raw)
    expect(graph.edges[0].quantity).toBeUndefined()
  })

  it('preserves movementType', () => {
    const graph = mapBackendTraceGraph(makeResponse())
    expect(graph.edges[0].movementType).toBe('101')
  })

  it('counts upstream nodes (non-anchor)', () => {
    const graph = mapBackendTraceGraph(makeResponse())
    expect(graph.upstreamCount).toBe(1)
    expect(graph.downstreamCount).toBe(0)
  })

  it('counts downstream nodes (non-anchor)', () => {
    const raw = makeResponse()
    raw.nodes[1].directions = ['downstream']
    const graph = mapBackendTraceGraph(raw)
    expect(graph.upstreamCount).toBe(0)
    expect(graph.downstreamCount).toBe(1)
  })

  it('sets depth as graph.depth', () => {
    const graph = mapBackendTraceGraph(makeResponse())
    expect(graph.depth).toBe(1)
  })

  it('sets unresolvedNodeCount to 0', () => {
    const graph = mapBackendTraceGraph(makeResponse())
    expect(graph.unresolvedNodeCount).toBe(0)
  })

  it('sets direction to both when backend omits direction field', () => {
    const graph = mapBackendTraceGraph(makeResponse())
    expect(graph.direction).toBe('both')
  })

  it('preserves direction=upstream from backend', () => {
    const raw = makeResponse({ direction: 'upstream' })
    const graph = mapBackendTraceGraph(raw)
    expect(graph.direction).toBe('upstream')
  })

  it('preserves direction=downstream from backend', () => {
    const raw = makeResponse({ direction: 'downstream' })
    const graph = mapBackendTraceGraph(raw)
    expect(graph.direction).toBe('downstream')
  })

  it('preserves direction=both from backend explicitly', () => {
    const raw = makeResponse({ direction: 'both' })
    const graph = mapBackendTraceGraph(raw)
    expect(graph.direction).toBe('both')
  })

  it('uses backend upstreamCount when provided', () => {
    const raw = makeResponse({ upstreamCount: 5 })
    const graph = mapBackendTraceGraph(raw)
    expect(graph.upstreamCount).toBe(5)
  })

  it('uses backend downstreamCount when provided', () => {
    const raw = makeResponse({ downstreamCount: 7 })
    const graph = mapBackendTraceGraph(raw)
    expect(graph.downstreamCount).toBe(7)
  })

  it('uses backend unresolvedNodeCount when provided', () => {
    const raw = makeResponse({ unresolvedNodeCount: 3 })
    const graph = mapBackendTraceGraph(raw)
    expect(graph.unresolvedNodeCount).toBe(3)
  })

  it('falls back to local node count when backend omits upstreamCount', () => {
    const raw = makeResponse()  // fixture has 1 upstream node, no upstreamCount field
    const graph = mapBackendTraceGraph(raw)
    expect(graph.upstreamCount).toBe(1)
  })

  it('falls back to local node count when backend omits downstreamCount', () => {
    const raw = makeResponse()
    raw.nodes[1].directions = ['downstream']
    const graph = mapBackendTraceGraph(raw)
    expect(graph.downstreamCount).toBe(1)
  })

  it('preserves warnings array', () => {
    const raw = makeResponse({ warnings: ['max_depth_reached'] })
    const graph = mapBackendTraceGraph(raw)
    expect(graph.warnings).toEqual(['max_depth_reached'])
  })

  it('preserves truncated flag', () => {
    const raw = makeResponse({ truncated: true, warnings: ['max_edges_reached'] })
    const graph = mapBackendTraceGraph(raw)
    expect(graph.truncated).toBe(true)
  })

  it('maps empty graph (anchor only, no edges)', () => {
    const raw = makeResponse({ nodes: [makeResponse().nodes[0]], edges: [], warnings: ['no_edges_found'] })
    const graph = mapBackendTraceGraph(raw)
    expect(graph.nodes).toHaveLength(1)
    expect(graph.edges).toHaveLength(0)
    expect(graph.upstreamCount).toBe(0)
    expect(graph.downstreamCount).toBe(0)
    expect(graph.warnings).toContain('no_edges_found')
  })

  it('does not drop edges when optional fields are null', () => {
    const raw = makeResponse()
    raw.edges[0].supplierId = null
    raw.edges[0].customerId = null
    raw.edges[0].deliveryId = null
    raw.edges[0].salesOrderId = null
    raw.edges[0].purchaseOrderId = null
    const graph = mapBackendTraceGraph(raw)
    expect(graph.edges).toHaveLength(1)
  })
})
