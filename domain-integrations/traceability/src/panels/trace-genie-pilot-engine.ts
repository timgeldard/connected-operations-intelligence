import type { BatchHeaderSummary, TraceGraph } from '@connectio/data-contracts'
import type { AdapterSource } from '@connectio/source-adapters'
import {
  DECISION_BLOCKED_PATTERNS,
  buildAssistantCitation,
  buildAssistantReply,
  buildBlockedAssistantReply,
  buildDecisionBlockedAssistantReply,
  buildMockWarning,
  buildUnsupportedAssistantReply,
  type AssistantReply,
} from '@connectio/product-model'

export const TRACE_GENIE_STARTER_PROMPTS = [
  'Summarize the focal batch currently loaded in the batch header.',
  'Summarize the lineage currently visible in the trace graph for this batch.',
  'Which upstream and downstream nodes are currently visible in the graph?',
  'Is the current graph truncated, and are there any graph warnings visible?',
  'Identify which parts of the answer come from batch-header evidence and which come from trace-graph evidence.',
] as const

interface ApprovedQuestion {
  readonly kind: 'approved'
  readonly intent: 'header' | 'graph-summary' | 'graph-counts' | 'graph-warnings' | 'sources'
}

interface BlockedQuestion {
  readonly kind: 'blocked'
  readonly reason: string
}

interface UnsupportedQuestion {
  readonly kind: 'unsupported'
}

type TraceQuestionClassification = ApprovedQuestion | BlockedQuestion | UnsupportedQuestion

export interface TraceGenieSnapshot {
  readonly batchHeader: {
    readonly data: BatchHeaderSummary
    readonly source?: AdapterSource
  }
  readonly traceGraph: {
    readonly data: TraceGraph
    readonly source?: AdapterSource
  }
}

const BLOCKED_KEYWORDS: Array<{ readonly pattern: RegExp; readonly reason: string }> = [
  { pattern: /\bcustomer\b|\bcustomers\b|\bdownstream exposure\b|\baffected\b/i, reason: 'customer exposure claims are blocked in the current Traceability pilot' },
  { pattern: /\bsupplier\b|\bsuppliers\b|\bimplicated\b/i, reason: 'supplier exposure claims are blocked in the current Traceability pilot' },
  { pattern: /\bmass balance\b|\bvariance root cause\b/i, reason: 'mass-balance interpretation is blocked in the current Traceability pilot' },
  { pattern: /\bquality\b|\bcoa\b|\brelease\b|\brecall\b|\bsafe\b|\bregulatory\b|\bqa\b|\bsap\b/i, reason: 'quality, release, recall, and regulatory decisions are blocked in the current Traceability pilot' },
  { pattern: /\btimeline\b|\bevent\b|\bevents\b/i, reason: 'timeline and event-history claims are blocked in the current Traceability pilot' },
]

function sharedScopeNote(): string {
  return 'Scope note: this pilot only answers from the currently visible batch-header and trace-graph evidence. It does not infer customer exposure, supplier impact, mass balance, quality/release decisions, or recall actions.'
}

function classifyTraceQuestion(question: string): TraceQuestionClassification {
  const normalized = question.trim().toLowerCase()
  if (normalized.length === 0) return { kind: 'unsupported' }

  // Decision-blocked patterns are checked first — these map to governed QA/SAP/recall
  // decisions that must never be answered by the evidence assistant.
  for (const pattern of DECISION_BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) return { kind: 'blocked', reason: 'decision-blocked' }
  }

  for (const blocked of BLOCKED_KEYWORDS) {
    if (blocked.pattern.test(normalized)) return { kind: 'blocked', reason: blocked.reason }
  }

  if (/\bsource\b|\bcitation\b|\bwhich parts\b/.test(normalized)) {
    return { kind: 'approved', intent: 'sources' }
  }
  if (/\btruncated\b|\bwarning\b|\bwarnings\b/.test(normalized)) {
    return { kind: 'approved', intent: 'graph-warnings' }
  }
  if (/\bupstream\b|\bdownstream\b|\bhow many nodes\b|\bwhich nodes\b/.test(normalized)) {
    return { kind: 'approved', intent: 'graph-counts' }
  }
  if (/\blineage\b|\bgraph\b|\bvisible\b|\bedge\b|\btransfer\b/.test(normalized)) {
    return { kind: 'approved', intent: 'graph-summary' }
  }
  if (/\bfocal batch\b|\bbatch header\b|\bstatus\b|\bmaterial\b|\bquantity\b/.test(normalized)) {
    return { kind: 'approved', intent: 'header' }
  }

  return { kind: 'unsupported' }
}

function formatStatus(status: string): string {
  return status.replace(/-/g, ' ')
}

function summariseHeader(data: BatchHeaderSummary): string {
  const quantity = data.quantity != null && data.uom
    ? `${data.quantity.toLocaleString()} ${data.uom}`
    : 'no quantity currently shown'

  return `${data.materialDescription} (${data.materialId}) at ${data.plantId} ${data.plantName} is currently batch status ${formatStatus(data.batchStatus)}, stock status ${formatStatus(data.stockStatus)}, release status ${formatStatus(data.releaseStatus)}, with ${quantity}.`
}

function summariseGraph(data: TraceGraph): string {
  return `${data.nodes.length} visible nodes and ${data.edges.length} visible edges are currently loaded. The graph direction is ${data.direction}, depth reached is ${data.depth}, with ${data.upstreamCount} upstream nodes, ${data.downstreamCount} downstream nodes, and ${data.unresolvedNodeCount} unresolved nodes.`
}

function graphWarningsSummary(data: TraceGraph): string {
  const warnings = data.warnings ?? []
  return warnings.length === 0
    ? `The current graph is ${data.truncated ? 'marked truncated' : 'not marked truncated'} and no graph warnings are present.`
    : `The current graph is ${data.truncated ? 'marked truncated' : 'not marked truncated'} with warnings: ${warnings.join(', ')}.`
}

function graphCountsSummary(data: TraceGraph): string {
  return `Visible graph counts: ${data.upstreamCount} upstream nodes, ${data.downstreamCount} downstream nodes, ${data.nodes.length} total nodes, and ${data.edges.length} total edges.`
}

export function buildTraceGenieReply(question: string, snapshot: TraceGenieSnapshot): AssistantReply {
  const classified = classifyTraceQuestion(question)

  if (classified.kind === 'blocked') {
    if (classified.reason === 'decision-blocked') {
      return buildDecisionBlockedAssistantReply()
    }
    return buildBlockedAssistantReply(
      classified.reason,
      'Approved topics right now: focal batch summary, visible lineage summary, visible graph counts, graph warnings/truncation, and source citations.',
      sharedScopeNote(),
    )
  }

  if (classified.kind === 'unsupported') {
    return buildUnsupportedAssistantReply(
      'I could not match that to the approved Traceability pilot scope.',
      'Try one of the starter prompts, or ask about the focal batch, the visible lineage graph, graph counts, graph warnings, or source citations.',
      sharedScopeNote(),
    )
  }

  const headerCitation = buildAssistantCitation('BatchHeaderPanel', snapshot.batchHeader.source)
  const graphCitation = buildAssistantCitation('TraceGraphPanel', snapshot.traceGraph.source)
  const warning = buildMockWarning([snapshot.batchHeader.source, snapshot.traceGraph.source])

  switch (classified.intent) {
    case 'header':
      return {
        kind: 'approved',
        text: buildAssistantReply({
          intro: `Based on ${headerCitation}:`,
          details: [summariseHeader(snapshot.batchHeader.data)],
          citations: [headerCitation],
          scopeNote: sharedScopeNote(),
          warning,
        }),
      }

    case 'graph-counts':
      return {
        kind: 'approved',
        text: buildAssistantReply({
          intro: `Based on ${graphCitation}:`,
          details: [graphCountsSummary(snapshot.traceGraph.data)],
          citations: [graphCitation],
          scopeNote: sharedScopeNote(),
          warning,
        }),
      }

    case 'graph-warnings':
      return {
        kind: 'approved',
        text: buildAssistantReply({
          intro: `Based on ${graphCitation}:`,
          details: [graphWarningsSummary(snapshot.traceGraph.data)],
          citations: [graphCitation],
          scopeNote: sharedScopeNote(),
          warning,
        }),
      }

    case 'sources':
      return {
        kind: 'approved',
        text: buildAssistantReply({
          intro: 'Current source split for this Traceability pilot:',
          details: [
            `- Focal batch summary comes from ${headerCitation}.`,
            `- Visible lineage summary comes from ${graphCitation}.`,
          ],
          citations: [headerCitation, graphCitation],
          scopeNote: sharedScopeNote(),
          warning,
        }),
      }

    case 'graph-summary':
    default:
      return {
        kind: 'approved',
        text: buildAssistantReply({
          intro: `Based on ${headerCitation} and ${graphCitation}:`,
          details: [
            summariseHeader(snapshot.batchHeader.data),
            summariseGraph(snapshot.traceGraph.data),
            graphWarningsSummary(snapshot.traceGraph.data),
          ],
          citations: [headerCitation, graphCitation],
          scopeNote: sharedScopeNote(),
          warning,
        }),
      }
  }
}
