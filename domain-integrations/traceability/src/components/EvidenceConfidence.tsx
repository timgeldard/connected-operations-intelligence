import React from 'react'
import type {
  BatchHeaderSummary,
  CustomerExposureSummary,
  MassBalanceSummary,
  CoAReleaseStatus,
  SupplierExposureSummary,
  TraceGraph,
} from '@connectio/data-contracts'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@connectio/design-system'

export interface ConfidenceResult {
  grade: 'COMPLETE' | 'PARTIAL' | 'MISSING' | 'UNKNOWN'
  score: number
  gaps: string[]
  details: {
    lineage: 'complete' | 'partial' | 'missing' | 'unknown'
    customers: 'complete' | 'partial' | 'missing' | 'unknown'
    massBalance: 'complete' | 'partial' | 'missing' | 'unknown'
    quality: 'complete' | 'partial' | 'missing' | 'unknown'
    coa: 'complete' | 'partial' | 'missing' | 'unknown'
    suppliers: 'complete' | 'partial' | 'missing' | 'unknown'
  }
}

/**
  * Core utility function to evaluate the completeness of batch evidence for V2.
  */
export function calculateConfidence({
  batchHeader,
  customerExposure,
  massBalance,
  coaRelease,
  supplierExposure,
  traceGraph,
}: {
  batchHeader: BatchHeaderSummary | null
  customerExposure: CustomerExposureSummary | null
  massBalance: MassBalanceSummary | null
  coaRelease: CoAReleaseStatus | null
  supplierExposure: SupplierExposureSummary | null
  traceGraph: TraceGraph | null
}): ConfidenceResult {
  let score = 0
  const gaps: string[] = []
  const details: ConfidenceResult['details'] = {
    lineage: 'unknown',
    customers: 'unknown',
    massBalance: 'unknown',
    quality: 'unknown',
    coa: 'unknown',
    suppliers: 'unknown',
  }

  // 1. Lineage Verification (Max: 15 pts)
  if (batchHeader?.processOrderId || (traceGraph && traceGraph.upstreamCount > 0)) {
    details.lineage = 'complete'
    score += 15
  } else {
    details.lineage = 'missing'
    gaps.push('Missing upstream process order lineage trace.')
  }

  // 2. Customers & Deliveries Verification (Max: 20 pts)
  if (customerExposure) {
    if (customerExposure.shippedQuantity > 0) {
      if (customerExposure.affectedDeliveries > 0) {
        details.customers = 'complete'
        score += 20
      } else {
        details.customers = 'missing'
        gaps.push('Suspect batch has shipped stock, but customer delivery records are empty.')
      }
    } else {
      // If no stock was shipped, the customer record is complete by default (contained)
      details.customers = 'complete'
      score += 20
    }
  } else {
    details.customers = 'unknown'
  }

  // 3. Mass Balance Verification (Max: 20 pts)
  if (massBalance) {
    if (Math.abs(massBalance.varianceQuantity) < 0.01) {
      details.massBalance = 'complete'
      score += 20
    } else {
      details.massBalance = 'partial'
      score += 10
      gaps.push(`Mass balance variance of ${massBalance.varianceQuantity} ${massBalance.uom || ''} remains unresolved.`)
    }
  } else {
    details.massBalance = 'missing'
    gaps.push('Mass balance ledger timeline is empty.')
  }

  // 4. Quality Inspection Verification (Max: 15 pts)
  // 'unknown' means QM decision data is unavailable — not a positive quality signal.
  // 'not-applicable' means inspection is structurally not applicable to this batch.
  // Neither counts as quality evidence.
  const hasQualityDecision =
    batchHeader?.qualityStatus &&
    batchHeader.qualityStatus !== 'not-applicable' &&
    batchHeader.qualityStatus !== 'unknown'
  if (hasQualityDecision) {
    details.quality = 'complete'
    score += 15
  } else {
    details.quality = 'missing'
    gaps.push('Suspect batch lacks a registered quality batch status.')
  }

  // 5. CoA Availability (Max: 15 pts)
  if (coaRelease) {
    if (coaRelease.coaAvailable) {
      details.coa = 'complete'
      score += 15
    } else if (coaRelease.releaseStatus === 'not-released' || coaRelease.releaseStatus === 'conditional') {
      details.coa = 'partial'
      score += 8
      gaps.push('Certificate of Analysis is pending inspection release.')
    } else {
      details.coa = 'missing'
      gaps.push('Certificate of Analysis is withheld or unavailable.')
    }
  } else {
    details.coa = 'unknown'
  }

  // 6. Upstream Supplier Validation (Max: 15 pts)
  if (supplierExposure && supplierExposure.supplierCount > 0) {
    details.suppliers = 'complete'
    score += 15
  } else if (batchHeader?.plantId) {
    details.suppliers = 'complete'
    score += 15
  } else {
    details.suppliers = 'missing'
    gaps.push('Manufacturing plant or supplier exposure validation is missing.')
  }

  // Deduce overall Grade
  let grade: ConfidenceResult['grade'] = 'UNKNOWN'
  if (score === 100 && gaps.length === 0) {
    grade = 'COMPLETE'
  } else if (score >= 50) {
    grade = 'PARTIAL'
  } else if (score > 0) {
    grade = 'MISSING'
  } else {
    grade = 'UNKNOWN'
  }

  return { grade, score, gaps, details }
}

/**
 * Inline scoring-rule explanation rendered inside the EvidenceConfidenceBadge
 * tooltip. Documents the sector weights and the grade thresholds so a user
 * seeing a partial score can reason about why.
 *
 * Values must stay in sync with calculateConfidence() above.
 *
 * Exported so it can be tested directly without going through the lazy-mounted
 * Radix Tooltip portal.
 */
export function ScoringRules() {
  return (
    <div
      style={{
        marginTop: 4,
        paddingTop: 8,
        borderTop: '1px dashed var(--shell-line, #DAD9C9)',
      }}
      data-testid="evidence-confidence-scoring-rules"
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--shell-fg-2, #4A5C45)',
          marginBottom: 4,
        }}
      >
        How this is scored
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, lineHeight: 1.5 }}>
        <li>Lineage — 15 pts</li>
        <li>Customers & deliveries — 20 pts</li>
        <li>Mass balance — 20 pts</li>
        <li>Quality status — 15 pts</li>
        <li>CoA / release — 15 pts</li>
        <li>Upstream suppliers — 15 pts</li>
      </ul>
      <div style={{ fontSize: 11, marginTop: 6 }}>
        <span style={{ fontWeight: 600 }}>Grades:</span>{' '}
        Complete = 100% with no gaps · Partial ≥ 50% · Missing &lt; 50% with some data · Not Assessed = 0%
      </div>
    </div>
  )
}

export interface EvidenceConfidenceBadgeProps {
  readonly result: ConfidenceResult
  readonly style?: React.CSSProperties
}

export function EvidenceConfidenceBadge({ result, style }: EvidenceConfidenceBadgeProps) {
  const config = {
    COMPLETE: {
      color: 'var(--shell-good, #1F8B4C)',
      bg: 'rgba(31, 139, 76, 0.08)',
      border: '1px solid rgba(31, 139, 76, 0.25)',
      label: 'Complete',
      desc: 'All core systems returned complete and verified datasets for this batch.',
      bullet: '🟢',
    },
    PARTIAL: {
      color: 'var(--shell-warn, #C7821C)',
      bg: 'rgba(199, 130, 28, 0.08)',
      border: '1px solid rgba(199, 130, 28, 0.25)',
      label: 'Partial',
      desc: 'Some non-critical evidence sections are empty or returned partial data.',
      bullet: '🟡',
    },
    MISSING: {
      color: 'var(--shell-bad, #C73315)',
      bg: 'rgba(199, 51, 21, 0.08)',
      border: '1px solid rgba(199, 51, 21, 0.25)',
      label: 'Missing',
      desc: 'Critical evidence paths (e.g. Lineage or CoA) are missing or failed to load.',
      bullet: '🔴',
    },
    UNKNOWN: {
      color: 'var(--shell-fg-3, #7A8A75)',
      bg: 'var(--shell-surface-2, #FAFAF3)',
      border: '1px solid var(--shell-line, #DAD9C9)',
      label: 'Not Assessed',
      desc: 'Evidence has not yet been loaded or assessed for this batch.',
      bullet: '⚪',
    },
  }[result.grade]

  const triggerElement = (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        borderRadius: 4,
        background: config.bg,
        border: config.border,
        color: config.color,
        fontFamily: 'var(--font-sans, sans-serif)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'default',
        userSelect: 'none',
        ...style,
      }}
    >
      <span style={{ fontSize: 10 }}>{config.bullet}</span>
      <span>Evidence Confidence:</span>
      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums' }}>
        {result.score}%
      </span>
      <span style={{ fontWeight: 400, opacity: 0.8 }}>({config.label})</span>
    </div>
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{triggerElement}</TooltipTrigger>
        <TooltipContent
          style={{
            maxWidth: 320,
            padding: '12px 14px',
            background: 'var(--shell-surface, #FFFFFF)',
            border: '1px solid var(--shell-line, #DAD9C9)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            color: 'var(--shell-fg, #0E1F0A)',
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: config.color }}>
            {config.label} ({result.score}%)
          </div>
          <div style={{ marginBottom: 8 }}>{config.desc}</div>
          <ScoringRules />
          {result.gaps.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--shell-fg-2, #4A5C45)', marginBottom: 4 }}>
                Identified Gaps:
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {result.gaps.map((gap, i) => (
                  <li key={i} style={{ color: 'var(--shell-bad, #C73315)' }}>
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
