export type AssistantReplyKind = 'approved' | 'blocked' | 'unsupported'

export interface AssistantReply {
  readonly kind: AssistantReplyKind
  readonly text: string
}

export interface AssistantReplyOptions {
  readonly intro: string
  readonly details?: readonly string[]
  readonly citations: readonly string[]
  readonly scopeNote: string
  readonly warning?: string | null
}

/**
 * The standard decision-blocked response text, per the safety specification.
 * All governed decision questions (release, rejection, recall closure, exposure status,
 * SAP posting, regulatory compliance) must return this exact body.
 */
export const DECISION_BLOCKED_TEMPLATE =
  "V2 is an evidence assistant, not a decision authority. This question requires a governed QA, recall, SAP, or process-control decision that must be made through your organisation's qualified procedures. The app can show source evidence and gaps, but cannot confirm release, rejection, recall closure, exposure status, or regulatory compliance decisions."

/**
 * No-record caveat appended to every approved answer. Prevents users from
 * treating absence of returned records as confirmed absence of exposure or defect.
 */
export const EVIDENCE_ASSISTANT_CAVEAT =
  'Evidence caveat: No records returned from a source must not be interpreted as absence of exposure. Source evidence shown here may be partial, unavailable, mock, or live — check the citations above.'

/**
 * Patterns that classify a question as a governed decision question regardless
 * of which domain the assistant is operating in. These are checked BEFORE
 * domain-specific keyword lists.
 */
export const DECISION_BLOCKED_PATTERNS: ReadonlyArray<RegExp> = [
  /\bcan\s+i\s+release\b|\brelease\s+this\s+batch\b|\bis\s+this\s+batch\s+accepted\b|\bis\s+this\s+batch\s+rejected\b/i,
  /\bcan\s+i\s+reject\b|\breject\s+this\s+batch\b/i,
  /\bcan\s+i\s+close\b|\bclose\s+this\s+recall\b|\bclose\s+the\s+recall\b|\brecall\s+contained\b|\brecall\s+closed\b/i,
  /\bis\s+exposure\s+zero\b|\bexposure\s+zero\b/i,
  /\ball\s+customers\s+identified\b|\bcustomers\s+identified\b/i,
  /\bsupplier\s+at\s+fault\b|\bis\s+this\s+supplier\b/i,
  /\bis\s+this\s+process\s+in\s+control\b|\bprocess\s+in\s+control\b/i,
  /\bwarehouse\s+clear\b|\bis\s+the\s+warehouse\s+clear\b/i,
  /\bno\s+deviations\b|\bare\s+there\s+no\s+deviations\b/i,
  /\bcoa\s+approved\b|\bis\s+coa\b|\bis\s+the\s+coa\b/i,
  /\bpost\s+(this\s+)?in\s+sap\b|\bpost\s+this\s+in\s+sap\b|\bsap\s+posting\b/i,
]

export function buildAssistantCitation(label: string, source?: string): string {
  return `${label} (${source ?? 'unknown-source'})`
}

export function buildAssistantReply({
  intro,
  details = [],
  citations,
  scopeNote,
  warning,
}: AssistantReplyOptions): string {
  const lines: string[] = [intro]

  if (details.length > 0) {
    lines.push(...details)
  }

  lines.push('')
  lines.push(`Citations: ${citations.join('; ')}.`)
  lines.push(scopeNote)
  lines.push(EVIDENCE_ASSISTANT_CAVEAT)

  if (warning) {
    lines.push('')
    lines.push(warning)
  }

  return lines.join('\n')
}

export function buildBlockedAssistantReply(reason: string, approvedHelp: string, scopeNote: string): AssistantReply {
  return {
    kind: 'blocked',
    text: [
      `I can't answer that in the current pilot because ${reason}.`,
      approvedHelp,
      scopeNote,
    ].join('\n'),
  }
}

/**
 * Builds a blocked reply for governed decision questions (release, recall, SAP, etc.).
 * Uses the standard DECISION_BLOCKED_TEMPLATE — no additional text is appended.
 */
export function buildDecisionBlockedAssistantReply(): AssistantReply {
  return {
    kind: 'blocked',
    text: DECISION_BLOCKED_TEMPLATE,
  }
}

export function buildUnsupportedAssistantReply(message: string, hint: string, scopeNote: string): AssistantReply {
  return {
    kind: 'unsupported',
    text: [
      message,
      hint,
      scopeNote,
    ].join('\n'),
  }
}

export function buildMockWarning(sources: readonly (string | undefined)[]): string | null {
  return sources.includes('mock')
    ? 'Source warning: one or more cited panels are running in mock mode, so this answer is demo-only.'
    : null
}
