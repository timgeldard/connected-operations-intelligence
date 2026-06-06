import type { SPCSummary, ControlChartSeries, CharacteristicCapability, SPCSignal } from '@connectio/data-contracts'
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

export const SPC_GENIE_STARTER_PROMPTS = [
  'Summarize process capability and Cpk values.',
  'What active alarm signals are present?',
  'Explain the control limits and specification limits for this characteristic.',
  'What is the recommended action for active violations?',
  'Show source citations for these SPC calculations.',
] as const

interface ApprovedQuestion {
  readonly kind: 'approved'
  readonly intent: 'summary' | 'capability' | 'charts' | 'alarms' | 'actions' | 'sources'
}

interface BlockedQuestion {
  readonly kind: 'blocked'
  readonly reason: string
}

interface UnsupportedQuestion {
  readonly kind: 'unsupported'
}

type SPCQuestionClassification = ApprovedQuestion | BlockedQuestion | UnsupportedQuestion

export interface SPCGenieSnapshot {
  readonly summary: {
    readonly data: SPCSummary
    readonly source?: AdapterSource
  }
  readonly chart: {
    readonly data: ControlChartSeries
    readonly source?: AdapterSource
  }
  readonly capability: {
    readonly data: CharacteristicCapability
    readonly source?: AdapterSource
  }
  readonly signals: {
    readonly data: SPCSignal[]
    readonly source?: AdapterSource
  }
}

const BLOCKED_KEYWORDS: Array<{ readonly pattern: RegExp; readonly reason: string }> = [
  { pattern: /\brelease batch\b|\breject batch\b|\bgoverned release\b/i, reason: 'batch release decisions are blocked in the SPC pilot' },
  { pattern: /\bregulatory compliance\b|\baudit sign-off\b/i, reason: 'regulatory and compliance sign-offs are blocked in the SPC pilot' },
]

function sharedScopeNote(): string {
  return 'Scope note: this pilot only answers questions using statistical process control (SPC) data. It does not issue final quality release or recall decisions.'
}

function classifySPCQuestion(question: string): SPCQuestionClassification {
  const normalized = question.trim().toLowerCase()
  if (normalized.length === 0) return { kind: 'unsupported' }

  for (const pattern of DECISION_BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) return { kind: 'blocked', reason: 'decision-blocked' }
  }

  for (const blocked of BLOCKED_KEYWORDS) {
    if (blocked.pattern.test(normalized)) return { kind: 'blocked', reason: blocked.reason }
  }

  if (/\bsources?\b|\bcitations?\b|\btables?\b|\bcome from\b|\bdatabases?\b/.test(normalized)) {
    return { kind: 'approved', intent: 'sources' }
  }
  if (/\bactions?\b|\brecommendations?\b|\bcorrectives?\b/.test(normalized)) {
    return { kind: 'approved', intent: 'actions' }
  }
  if (/\bsignals?\b|\brules?\b|\balarms?\b|\bviolations?\b|\bnelson\b|\bwestgard\b/.test(normalized)) {
    return { kind: 'approved', intent: 'alarms' }
  }
  if (/\bucl\b|\blcl\b|\bcl\b|\bspecs?\b|\busl\b|\blsl\b|\blimits?\b/.test(normalized)) {
    return { kind: 'approved', intent: 'charts' }
  }
  if (/\bcpk\b|\bcp\b|\bppk\b|\bpp\b|\bcapability\b/.test(normalized)) {
    return { kind: 'approved', intent: 'capability' }
  }
  if (/\bsummarize\b|\bsummary\b|\boverall\b/.test(normalized)) {
    return { kind: 'approved', intent: 'summary' }
  }

  return { kind: 'unsupported' }
}

function summariseSummary(data: SPCSummary): string {
  return `SPC Summary: Monitored ${data.chartsMonitored} charts with ${data.activeSignals} active signals (${data.outOfControlSignals} out-of-control, ${data.warningSignals} warnings). High-level severity is ${data.highestSeverity}. Recommended action is: "${data.recommendedAction}".`
}

function summariseCapability(data: CharacteristicCapability): string {
  return `Process Capability for ${data.characteristicName}: Cp: ${data.cp?.toFixed(2) ?? 'N/A'}, Cpk: ${data.cpk?.toFixed(2) ?? 'N/A'} (Interpretation: ${data.interpretation}). Sample size: ${data.sampleCount} points. Standard deviation: ${data.standardDeviation?.toFixed(4) ?? 'N/A'}.`
}

function summariseChart(data: ControlChartSeries): string {
  return `Control Chart for ${data.characteristicName}: Centerline (CL) is ${data.centerLine?.toFixed(2) ?? 'N/A'}. Control limits: UCL: ${data.upperControlLimit?.toFixed(2) ?? 'N/A'}, LCL: ${data.lowerControlLimit?.toFixed(2) ?? 'N/A'}. Spec limits: USL: ${data.upperSpecLimit?.toFixed(2) ?? 'N/A'}, LSL: ${data.lowerSpecLimit?.toFixed(2) ?? 'N/A'}. Point count is ${data.points?.length ?? 0}.`
}

function summariseSignals(data: SPCSignal[]): string {
  if (data.length === 0) return 'No active SPC signal violations detected.'
  return `Active Signals (${data.length}): ` + data.map(s => `Batch ${s.batchId} violates ${s.rule} (Severity: ${s.severity})`).join('; ')
}

export function buildSPCGenieReply(question: string, snapshot: SPCGenieSnapshot): AssistantReply {
  const classified = classifySPCQuestion(question)

  if (classified.kind === 'blocked') {
    if (classified.reason === 'decision-blocked') {
      return buildDecisionBlockedAssistantReply()
    }
    return buildBlockedAssistantReply(
      classified.reason,
      'Approved topics: overall summary, process capability, control chart limits, signals/alarms, corrective actions, and data citations.',
      sharedScopeNote()
    )
  }

  if (classified.kind === 'unsupported') {
    return buildUnsupportedAssistantReply(
      'I could not match that to the approved SPC assistant scope.',
      'Try asking about capability metrics, control limits, active signals, recommendations, or database citations.',
      sharedScopeNote()
    )
  }

  const summaryCitation = buildAssistantCitation('SPCSummaryPanel', snapshot.summary.source)
  const capabilityCitation = buildAssistantCitation('CharacteristicCapabilityPanel', snapshot.capability.source)
  const chartCitation = buildAssistantCitation('ControlChartPanel', snapshot.chart.source)
  const signalsCitation = buildAssistantCitation('ActiveSPCSignalsPanel', snapshot.signals.source)
  const warning = buildMockWarning([snapshot.summary.source, snapshot.capability.source])

  switch (classified.intent) {
    case 'summary':
      return {
        kind: 'approved',
        text: buildAssistantReply({
          intro: `Based on ${summaryCitation}:`,
          details: [summariseSummary(snapshot.summary.data)],
          citations: [summaryCitation],
          scopeNote: sharedScopeNote(),
          warning,
        }),
      }

    case 'capability':
      return {
        kind: 'approved',
        text: buildAssistantReply({
          intro: `Based on ${capabilityCitation}:`,
          details: [summariseCapability(snapshot.capability.data)],
          citations: [capabilityCitation],
          scopeNote: sharedScopeNote(),
          warning,
        }),
      }

    case 'charts':
      return {
        kind: 'approved',
        text: buildAssistantReply({
          intro: `Based on ${chartCitation}:`,
          details: [summariseChart(snapshot.chart.data)],
          citations: [chartCitation],
          scopeNote: sharedScopeNote(),
          warning,
        }),
      }

    case 'alarms':
      return {
        kind: 'approved',
        text: buildAssistantReply({
          intro: `Based on ${signalsCitation}:`,
          details: [summariseSignals(snapshot.signals.data)],
          citations: [signalsCitation],
          scopeNote: sharedScopeNote(),
          warning,
        }),
      }

    case 'actions':
      return {
        kind: 'approved',
        text: buildAssistantReply({
          intro: `Based on active SPC alarms:`,
          details: [
            snapshot.summary.data.recommendedAction
              ? `Recommended action: "${snapshot.summary.data.recommendedAction}"`
              : 'No immediate corrective actions recommended. Process parameters are within statistical control.'
          ],
          citations: [summaryCitation],
          scopeNote: sharedScopeNote(),
          warning,
        }),
      }

    case 'sources':
    default:
      return {
        kind: 'approved',
        text: buildAssistantReply({
          intro: 'Data sources referenced for these SPC results (via Databricks API):',
          details: [
            `- Capability indices come from ${capabilityCitation} (table: gold_batch_quality_result_v)`,
            `- Subgroup control data comes from ${chartCitation} (table: spc_quality_metric_subgroup_mv)`,
            `- Signals analysis comes from ${signalsCitation}`,
          ],
          citations: [capabilityCitation, chartCitation, signalsCitation],
          scopeNote: sharedScopeNote(),
          warning,
        }),
      }
  }
}
