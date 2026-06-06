import type {
  ProcessOrderConfirmation,
  ProcessOrderGoodsMovement,
  ProcessOrderHeader,
  ProcessOrderOperation,
} from '@connectio/data-contracts'
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

export const POH_GENIE_STARTER_PROMPTS = [
  'Summarize the currently loaded operations, confirmations, and goods movements for this process order.',
  'Show the operations currently returned for this process order.',
  'Show the confirmations currently returned for this process order.',
  'Show the goods movements currently returned for this process order.',
  'What is the current status, material, and quantity for this process order?',
] as const

export type PohGenieIntent =
  | 'operations'
  | 'confirmations'
  | 'goods-movements'
  | 'combined'
  | 'header'

export interface PohGenieSnapshot {
  readonly processOrderId: string
  readonly header?: {
    readonly data: ProcessOrderHeader
    readonly source?: AdapterSource
  }
  readonly operations: {
    readonly data: readonly ProcessOrderOperation[]
    readonly source?: AdapterSource
  }
  readonly confirmations: {
    readonly data: readonly ProcessOrderConfirmation[]
    readonly source?: AdapterSource
  }
  readonly goodsMovements: {
    readonly data: readonly ProcessOrderGoodsMovement[]
    readonly source?: AdapterSource
  }
}

interface ApprovedQuestion {
  readonly kind: 'approved'
  readonly intent: PohGenieIntent
}

interface BlockedQuestion {
  readonly kind: 'blocked'
  readonly reason: string
}

interface UnsupportedQuestion {
  readonly kind: 'unsupported'
}

type QuestionClassification = ApprovedQuestion | BlockedQuestion | UnsupportedQuestion

const BLOCKED_KEYWORDS: Array<{ readonly pattern: RegExp; readonly reason: string }> = [
  {
    pattern: /\bwhy\b.*\blate\b|\blate\b|\bdelay\b|\broot cause\b/i,
    reason: 'lateness and root-cause analysis are blocked in the current POH pilot',
  },
  {
    pattern: /\boee\b|\bschedule adherence\b|\bcapability\b|\bbenchmark/i,
    reason: 'OEE and broader analytics are not part of the approved POH pilot scope',
  },
  {
    pattern: /\bplanning\b|\bday view\b|\blineside\b|\bline side\b/i,
    reason: 'planning, day-view, and lineside workflows are outside the approved POH pilot scope',
  },
  {
    pattern: /\bdowntime\b|\bnote\b|\bnotes\b|\bcomment\b|\bcomments\b/i,
    reason: 'downtime and operator notes are not currently approved POH Genie topics',
  },
  {
    pattern: /\bgenealog/i,
    reason: 'genealogy and related-batch inference are blocked from the current POH pilot',
  },
  {
    pattern: /\brelease\b|\bquality release\b|\brelease readiness\b/i,
    reason: 'release reasoning and decision support are blocked from the current POH pilot',
  },
  {
    pattern: /\bstaff\b|\bescalat/i,
    reason: 'staffing and escalation recommendations are blocked from the current POH pilot',
  },
  {
    pattern: /\bvessel\b/i,
    reason: 'vessel-planning questions are outside the approved POH pilot scope',
  },
]

function classifyQuestion(question: string): QuestionClassification {
  const normalized = question.trim().toLowerCase()
  if (normalized.length === 0) return { kind: 'unsupported' }

  // Decision-blocked patterns are checked first — these map to governed QA/SAP/recall
  // decisions that must never be answered by the evidence assistant.
  for (const pattern of DECISION_BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      return { kind: 'blocked', reason: 'decision-blocked' }
    }
  }

  for (const blocked of BLOCKED_KEYWORDS) {
    if (blocked.pattern.test(normalized)) {
      return { kind: 'blocked', reason: blocked.reason }
    }
  }

  const mentionsOperations = /\boperation\b|\boperations\b|\bphase\b|\bphases\b/.test(normalized)
  const mentionsConfirmations = /\bconfirmation\b|\bconfirmations\b|\byield\b/.test(normalized)
  const mentionsGoodsMovements =
    /\bgoods movement\b|\bgoods movements\b|\bmovement\b|\bmovements\b|\bissue\b|\bissues\b|\breceipt\b|\breceipts\b/.test(
      normalized,
    )
  const mentionsHeader = /\bstatus\b|\bmaterial\b|\bquantity\b|\bheader\b/.test(normalized)

  const approvedCount = [mentionsOperations, mentionsConfirmations, mentionsGoodsMovements].filter(
    Boolean,
  ).length

  if (
    approvedCount > 1 ||
    /\bsummarize\b|\bsummary\b|\bcurrently loaded\b|\bshow all\b/.test(normalized)
  ) {
    return { kind: 'approved', intent: 'combined' }
  }
  if (mentionsOperations) return { kind: 'approved', intent: 'operations' }
  if (mentionsConfirmations) return { kind: 'approved', intent: 'confirmations' }
  if (mentionsGoodsMovements) return { kind: 'approved', intent: 'goods-movements' }
  if (mentionsHeader) return { kind: 'approved', intent: 'header' }

  return { kind: 'unsupported' }
}

function formatOrderStatus(status: string): string {
  return status.replace(/-/g, ' ')
}

function summariseOperations(operations: readonly ProcessOrderOperation[]): string {
  const confirmed = operations.filter((operation) => operation.confirmed).length
  const exceptions = operations.filter((operation) => operation.hasException).length
  const inProgress = operations.filter((operation) => operation.status === 'in-progress').length
  return `${operations.length} operations returned; ${confirmed} confirmed, ${inProgress} in progress, ${exceptions} with exception flags.`
}

function summariseConfirmations(confirmations: readonly ProcessOrderConfirmation[]): string {
  const finalCount = confirmations.filter((confirmation) => confirmation.isFinalConfirmation).length
  const partialCount = confirmations.length - finalCount
  const totalYield = confirmations.reduce(
    (sum, confirmation) =>
      confirmation.confirmedYield != null ? sum + confirmation.confirmedYield : sum,
    0,
  )
  const uoms = Array.from(
    new Set(confirmations.map((confirmation) => confirmation.uom).filter(Boolean)),
  )
  const yieldSummary =
    uoms.length === 1
      ? `${totalYield.toLocaleString()} ${uoms[0]} total confirmed yield`
      : `${totalYield.toLocaleString()} total confirmed yield across mixed units`

  return `${confirmations.length} confirmations returned; ${finalCount} final, ${partialCount} partial/open, ${yieldSummary}.`
}

function summariseGoodsMovements(movements: readonly ProcessOrderGoodsMovement[]): string {
  const inputs = movements.filter((movement) => movement.direction === 'input').length
  const outputs = movements.filter((movement) => movement.direction === 'output').length
  const unknown = movements.filter((movement) => movement.direction === 'unknown').length
  const distinctMaterials = new Set(movements.map((movement) => movement.materialId)).size

  return `${movements.length} goods movements returned; ${inputs} input issues, ${outputs} output receipts, ${unknown} unclassified, ${distinctMaterials} distinct materials.`
}

function sharedScopeNote(): string {
  return 'Scope note: this pilot only answers from currently loaded POH evidence. It does not infer lateness root cause, OEE, planning, downtime, genealogy, or release decisions.'
}

function buildApprovedReply(intent: PohGenieIntent, snapshot: PohGenieSnapshot): AssistantReply {
  const operationsCitation = buildAssistantCitation(
    'OrderOperationsPanel',
    snapshot.operations.source,
  )
  const confirmationsCitation = buildAssistantCitation(
    'OrderConfirmationsPanel',
    snapshot.confirmations.source,
  )
  const movementsCitation = buildAssistantCitation(
    'ProcessOrderGoodsMovementsPanel',
    snapshot.goodsMovements.source,
  )
  const headerCitation = buildAssistantCitation('ProcessOrderHeaderPanel', snapshot.header?.source)
  const warning = buildMockWarning([
    snapshot.header?.source,
    snapshot.operations.source,
    snapshot.confirmations.source,
    snapshot.goodsMovements.source,
  ])

  switch (intent) {
    case 'operations':
      return {
        kind: 'approved',
        text: buildAssistantReply({
          intro: `Based on ${operationsCitation} for process order ${snapshot.processOrderId}:`,
          details: [summariseOperations(snapshot.operations.data)],
          citations: [operationsCitation],
          scopeNote: sharedScopeNote(),
          warning,
        }),
      }

    case 'confirmations':
      return {
        kind: 'approved',
        text: buildAssistantReply({
          intro: `Based on ${confirmationsCitation} for process order ${snapshot.processOrderId}:`,
          details: [summariseConfirmations(snapshot.confirmations.data)],
          citations: [confirmationsCitation],
          scopeNote: sharedScopeNote(),
          warning,
        }),
      }

    case 'goods-movements':
      return {
        kind: 'approved',
        text: buildAssistantReply({
          intro: `Based on ${movementsCitation} for process order ${snapshot.processOrderId}:`,
          details: [summariseGoodsMovements(snapshot.goodsMovements.data)],
          citations: [movementsCitation],
          scopeNote: sharedScopeNote(),
          warning,
        }),
      }

    case 'header':
      if (!snapshot.header) {
        return buildUnsupportedAssistantReply(
          'The conditional header slice is not currently available for this pilot answer.',
          'Approved alternatives: ask about operations, confirmations, goods movements, or the combined currently loaded evidence.',
          sharedScopeNote(),
        )
      }

      return {
        kind: 'approved',
        text: buildAssistantReply({
          intro: `Based on ${headerCitation} for process order ${snapshot.processOrderId}:`,
          details: [
            `${snapshot.header.data.materialDescription} (${snapshot.header.data.materialId}) is currently ${formatOrderStatus(snapshot.header.data.orderStatus)} with ${(snapshot.header.data.confirmedQuantity ?? 0).toLocaleString()} ${snapshot.header.data.uom} confirmed against ${(snapshot.header.data.plannedQuantity ?? 0).toLocaleString()} ${snapshot.header.data.uom} planned.`,
          ],
          citations: [headerCitation],
          scopeNote:
            'Scope note: the header slice is conditional in the current POH pilot and should not be used to infer blocked topics outside the approved pack.',
          warning,
        }),
      }

    case 'combined':
    default: {
      const details = [
        `- ${summariseOperations(snapshot.operations.data)}`,
        `- ${summariseConfirmations(snapshot.confirmations.data)}`,
        `- ${summariseGoodsMovements(snapshot.goodsMovements.data)}`,
      ]

      if (snapshot.header) {
        details.push(
          `- Conditional header slice from ${headerCitation}: ${snapshot.header.data.materialDescription} is currently ${formatOrderStatus(snapshot.header.data.orderStatus)}.`,
        )
      } else {
        details.push('- Conditional header slice is not currently included in this answer.')
      }

      return {
        kind: 'approved',
        text: buildAssistantReply({
          intro: `Based on ${operationsCitation}, ${confirmationsCitation}, and ${movementsCitation} for process order ${snapshot.processOrderId}:`,
          details,
          citations: snapshot.header
            ? [operationsCitation, confirmationsCitation, movementsCitation, headerCitation]
            : [operationsCitation, confirmationsCitation, movementsCitation],
          scopeNote: sharedScopeNote(),
          warning,
        }),
      }
    }
  }
}

export function buildPohGenieReply(question: string, snapshot: PohGenieSnapshot): AssistantReply {
  const classified = classifyQuestion(question)

  if (classified.kind === 'blocked') {
    if (classified.reason === 'decision-blocked') {
      return buildDecisionBlockedAssistantReply()
    }
    return buildBlockedAssistantReply(
      classified.reason,
      'Approved topics right now: operations, confirmations, goods movements, or a combined summary of the currently loaded POH evidence.',
      sharedScopeNote(),
    )
  }

  if (classified.kind === 'unsupported') {
    return buildUnsupportedAssistantReply(
      'I could not match that to the approved POH pilot scope.',
      'Try one of the starter prompts, or ask about operations, confirmations, goods movements, or the combined currently loaded evidence for this process order.',
      sharedScopeNote(),
    )
  }

  return buildApprovedReply(classified.intent, snapshot)
}
