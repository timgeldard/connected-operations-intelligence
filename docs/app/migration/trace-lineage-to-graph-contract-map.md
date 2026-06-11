# Trace Lineage → Graph Contract Map

**Status:** Contract mismatch resolved — frontend wired (u.txt, 2026-05-18)  
**Backend:** `POST /api/trace2/trace-graph` — browser-verified (q.txt, 2026-05-18)  
**Frontend:** `Trace2LegacyApiAdapter.getTraceGraph` override wired; `mapBackendTraceGraph` mapper in place; UI BV confirmed 2026-05-18 (`materialId=20052009`, green badge, nodes+edges rendered)

---

## Resolution (u.txt, 2026-05-18)

The mismatch was resolved without redesigning the frontend adapter or Zod schema. Instead:
- `TraceNode.type` and `TraceEdge.relationshipType` made optional in `TraceGraphSchema`
- `warnings` and `truncated` added to `TraceGraphSchema`
- `mapBackendTraceGraph` mapper in `trace2-graph-mapper.ts` bridges the two shapes
- `Trace2LegacyApiAdapter.getTraceGraph` posts to `POST /api/trace2/trace-graph` and maps via the above

See `docs/migration/trace-graph-frontend-contract-resolution.md` for full detail.

---

## Original Mismatch Analysis (q.txt — historical context)

---

## Contract Mismatch Detail

### Response envelope

| Field | Backend (q.txt) | Frontend schema (TraceGraphSchema) |
|---|---|---|
| `anchor` | `{ materialId, batchId, plantId, nodeKey }` | Not present — `rootBatch: string` instead |
| `depthReached` | `number` | `depth: number` (same concept, different name) |
| `truncated` | `boolean` | Not present |
| `warnings` | `string[]` | Not present |
| `upstreamCount` | Not present | `upstreamCount: number` |
| `downstreamCount` | Not present | `downstreamCount: number` |
| `unresolvedNodeCount` | Not present | `unresolvedNodeCount: number` |

### Direction values

| Backend | Frontend schema |
|---|---|
| `"upstream"` | `"reverse"` |
| `"downstream"` | `"forward"` |
| `"both"` | `"both"` |

### Node fields

| Field | Backend node | Frontend TraceNodeSchema |
|---|---|---|
| Key field | `nodeKey: string` | `id: string` |
| `materialId` | ✓ | ✓ |
| `batchId` | ✓ optional | ✓ optional |
| `plantId` | ✓ | ✓ optional |
| `depth` | ✓ | Not present |
| `directions` | `string[]` | Not present |
| `isAnchor` | `boolean` | Not present |
| `label` | `string` | Not present |
| `type` | Not present | Enum (raw-material, intermediate...) |
| `materialDescription` | Not present | `materialDescription: string` |
| `quantity` | Not present | `quantity?: number` |
| `uom` | Not present | `uom?: string` |
| `status` | Not present | Optional enum |
| `riskLevel` | Not present | Optional enum |

### Edge fields

| Field | Backend edge | Frontend TraceEdgeSchema |
|---|---|---|
| `id` | ✓ | ✓ |
| `source` | ✓ | ✓ |
| `target` | ✓ | ✓ |
| `linkType` | `string` (raw LINK_TYPE) | `relationshipType` (mapped enum) |
| `processOrderId` | ✓ | Not present (in `documentReference`) |
| `materialDocumentNumber` | ✓ | Not present (in `documentReference`) |
| `purchaseOrderId` | ✓ | Not present |
| `supplierId` | ✓ | Not present |
| `customerId` | ✓ | Not present |
| `deliveryId` | ✓ | Not present |
| `salesOrderId` | ✓ | Not present |
| `quantity` | ✓ | ✓ optional |
| `baseUnitOfMeasure` | ✓ | `uom` optional |
| `postingDate` | ✓ | Not present |
| `movementType` | ✓ | ✓ optional |
| `depth` | ✓ | Not present |
| `direction` | ✓ | Not present |

---

## What Was Done (u.txt)

1. **`TraceGraphSchema`** — additive/relaxing changes only (no rename, no breaking change):
   - `TraceNode.type`: `.optional()`
   - `TraceEdge.relationshipType`: `.optional()`
   - Added `warnings: z.array(z.string()).optional()`
   - Added `truncated: z.boolean().optional()`

2. **`trace2-graph-mapper.ts`** — new file mapping `BackendTraceGraphResponse` → `TraceGraph`:
   - `id ← nodeKey`; `type ← undefined`; `materialDescription ← ''`
   - `relationshipType ← LINK_TYPE_MAP[linkType]` (8-entry map mirroring Python)
   - `documentReference ← materialDocumentNumber ?? processOrderId`
   - `rootBatch ← anchor.batchId`; `direction ← 'both'`; `depth ← depthReached`

3. **`Trace2LegacyApiAdapter.getTraceGraph`** — new override; no mock/legacy fallback.

4. **`TraceGraphPanel`** — two TS2538 crash sites fixed (`node.type ?` guard at lines 74 and 137).

---

## Status (b.txt, 2026-05-18)

**UI BV PASSED** — C13 confirmed 2026-05-18. `materialId=20052009`, green `source: databricks-api` badge, nodes and edges rendered.

**Material ID format:** `gold_batch_lineage` stores material IDs **without** SAP ALPHA leading zeros. The confirmed working input key is `20052009`, not `000000000020052009`. Batch IDs (`0008602411`) are string-preserved and do include leading zeros. The backend does not apply ALPHA normalization; users must enter the stored format. Future: input normalization to accept either format.

**Remaining:**
- Node/edge click interactions, direction toggle, warnings banner — not separately confirmed
- `?workspace=traceability-workspace` full shell integration — not tested; do not claim Trace parity is complete
