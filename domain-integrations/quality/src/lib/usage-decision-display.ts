/**
 * Usage-decision display helpers for the Quality read-only evidence panel.
 *
 * These helpers produce UI display models from raw source usage-decision data.
 * They intentionally avoid release semantics: "Released", "Approved", "Cleared",
 * and "Can release" are never returned as displayLabel values.
 *
 * Governed labels are sourced from qm-usage-decision-code-semantics.md §2, as
 * confirmed by the Kerry QM process owner (2026-05-21). Labels carry the suffix
 * "— source UD label only" to distinguish source evidence from release authority.
 *
 * CRITICAL: This module is read-only evidence display. It does not authorise
 * release, rejection, or any SAP QM posting.
 */

export type UsageDecisionDisplayTone = 'neutral' | 'warning' | 'info'

export type UsageDecisionEvidenceState =
  | 'loaded'
  | 'no-records'
  | 'pending-source-verification'
  | 'source-verified-not-wired'
  | 'unavailable'
  | 'error'
  | 'mock'
  | 'multiple-lots'
  | 'partial-evidence'

export interface UsageDecisionDisplayInput {
  readonly inspectionLotId?: string | null
  readonly usageDecisionCode?: string | null
  readonly usageDecisionText?: string | null
  readonly createdAt?: string | null
  readonly source?: string
  readonly mappingStatus?: 'governed-label' | 'raw-only' | 'governance-pending' | 'unknown-code'
}

export interface UsageDecisionDisplay {
  /** The raw source code, always preserved verbatim. Null if no lot/row found. */
  readonly rawCode: string | null
  /**
   * The governed display label or a safe fallback.
   * NEVER "Released", "Can release", "Approved", or "Cleared".
   */
  readonly displayLabel: string
  /** The source long text, or a safe fallback if not available. */
  readonly detailText: string
  /** Evidence state from the state model. */
  readonly evidenceState: UsageDecisionEvidenceState
  /** Display tone for UI colour coding. */
  readonly tone: UsageDecisionDisplayTone
  /** Source limitation warnings that must always be shown. */
  readonly warnings: readonly string[]
  /** Mapping status label for display. */
  readonly mappingStatus: string
}

/**
 * Map of confirmed governed codes to display labels.
 * Source: qm-usage-decision-code-semantics.md §2 (confirmed 2026-05-21).
 * The suffix "— source UD label only" is intentional: these are source evidence
 * labels, not release decisions.
 */
const GOVERNED_LABELS: Readonly<Record<string, string>> = {
  A: 'Accepted — source UD label only',
  AE: 'Accepted (variant/EM) — source UD label only',
  AC: 'Accepted with concession — source UD label only',
  ACE: 'Accepted with concession (variant/EM) — source UD label only',
  A9: 'Accepted — batch restricted — source UD label only',
  R: 'Rejected — source UD label only',
  RE: 'Rejected (variant/EM) — source UD label only',
  RR: 'Rejected — batch restricted globally — source UD label only',
}

const SOURCE_GAP_WARNING =
  'No inspection lot found. This is a source gap, not confirmation of no issue.'

const NO_RECORDS_WARNING =
  'No records returned from a source must not be interpreted as absence of exposure.'

const READ_ONLY_WARNING =
  'Usage decision codes are displayed as source evidence only. A single batch-level release decision is not derived.'

/**
 * Build a display model for a single usage-decision evidence record.
 *
 * Rules:
 * - null/undefined inspectionLotId → evidenceState = no-records (source gap)
 * - null/undefined usageDecisionCode (but lot present) → evidenceState = no-records
 * - empty string code → Pending / lot open display
 * - governed code → label from GOVERNED_LABELS
 * - unknown code → governance-required fallback
 */
export function buildUsageDecisionDisplay(
  input: UsageDecisionDisplayInput
): UsageDecisionDisplay {
  const warnings: string[] = [NO_RECORDS_WARNING, READ_ONLY_WARNING]

  // No inspection lot — source gap
  if (input.inspectionLotId === null || input.inspectionLotId === undefined) {
    warnings.unshift(SOURCE_GAP_WARNING)
    return {
      rawCode: null,
      displayLabel: 'No inspection lot / source gap',
      detailText:
        'No inspection lot was found for this batch in the queried source. This is a source gap, not confirmation that no inspection occurred.',
      evidenceState: 'no-records',
      tone: 'warning',
      warnings,
      mappingStatus: resolvedMappingStatus(input.mappingStatus),
    }
  }

  const code = input.usageDecisionCode

  // Lot present but no usage-decision code (null/undefined)
  if (code === null || code === undefined) {
    return {
      rawCode: null,
      displayLabel: 'No usage decision recorded — source gap',
      detailText:
        'An inspection lot was found but no usage-decision record was returned. This is a source gap, not confirmation that the lot was accepted or passed.',
      evidenceState: 'no-records',
      tone: 'warning',
      warnings,
      mappingStatus: resolvedMappingStatus(input.mappingStatus),
    }
  }

  // Empty string — lot open, no decision taken yet
  if (code === '') {
    return {
      rawCode: '',
      displayLabel: 'Pending — lot open / no decision taken',
      detailText:
        input.usageDecisionText?.trim() ||
        'Inspection lot is still open; stock may be in Quality Inspection (QI) hold. No usage decision has been recorded yet.',
      evidenceState: 'loaded',
      tone: 'info',
      warnings,
      mappingStatus: 'governed-label',
    }
  }

  // Governed code
  const governedLabel = GOVERNED_LABELS[code]
  if (governedLabel !== undefined) {
    return {
      rawCode: code,
      displayLabel: governedLabel,
      detailText:
        input.usageDecisionText?.trim() ||
        `Source usage-decision code: ${code}. Governed label applied from Kerry QM process owner confirmation (2026-05-21).`,
      evidenceState: 'loaded',
      tone: 'neutral',
      warnings,
      mappingStatus: 'governed-label',
    }
  }

  // Unknown code — governance required
  return {
    rawCode: code,
    displayLabel: 'Unknown source code — governance required',
    detailText:
      input.usageDecisionText?.trim() ||
      `Source usage-decision code "${code}" is not in the governed mapping. Governance confirmation is required before this code can be displayed with a release-status label.`,
    evidenceState: 'loaded',
    tone: 'warning',
    warnings,
    mappingStatus: 'unknown-code',
  }
}

function resolvedMappingStatus(
  inputStatus?: 'governed-label' | 'raw-only' | 'governance-pending' | 'unknown-code'
): string {
  return inputStatus ?? 'unknown-code'
}
