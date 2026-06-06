import type {
  BatchHeaderSummary,
  CustomerExposureSummary,
  SupplierExposureSummary,
} from '@connectio/data-contracts'
import {
  StatusBadge,
  Button,
  SourceConfidenceStrip,
  UnknownValue,
  UnavailableValue,
  type EvidenceStatus,
  type ExtendedSourceMode,
} from '@connectio/design-system'
import { EvidenceCaveatList } from '@connectio/evidence-panel-runtime'
import { EvidenceConfidenceBadge, type ConfidenceResult } from './EvidenceConfidence.js'

const mapConfidenceToStatus = (grade: string): EvidenceStatus => {
  switch (grade) {
    case 'COMPLETE':
      return 'loaded'
    case 'PARTIAL':
      return 'partial'
    case 'MISSING':
      return 'unavailable'
    default:
      return 'unavailable'
  }
}

export interface InvestigationSummaryProps {
  readonly batchHeader: BatchHeaderSummary | null
  readonly customerExposure: CustomerExposureSummary | null
  readonly supplierExposure: SupplierExposureSummary | null
  readonly confidence: ConfidenceResult
  readonly sim: boolean
  readonly onSim: (sim: boolean) => void
  readonly adapterMode?: ExtendedSourceMode
  readonly fetchedAt?: string | null
}

export function InvestigationSummary({
  batchHeader,
  customerExposure,
  supplierExposure,
  confidence,
  sim,
  onSim,
  adapterMode = 'mock',
  fetchedAt,
}: InvestigationSummaryProps) {
  // Navigation helper to update view without router library dependency
  const handleNavigate = (viewId: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set('view', viewId)
    history.replaceState(null, '', `?${params.toString()}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  // Calculate shelf-life metrics
  const hasExpiry = !!batchHeader?.expiryDate
  let daysToExpiry = 0
  let isExpired = false
  let isNearExpiry = false
  let formattedExpiryDate = 'Not available'

  if (batchHeader?.expiryDate) {
    const expiry = new Date(batchHeader.expiryDate)
    formattedExpiryDate = expiry.toLocaleDateString()
    const diffTime = expiry.getTime() - new Date().getTime()
    daysToExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    isExpired = daysToExpiry < 0
    isNearExpiry = daysToExpiry >= 0 && daysToExpiry < 30
  }

  // Determine Severity and alert messaging
  // customerExposure === null means delivery data is unavailable (not the same as no shipments)
  const customerDataUnavailable = customerExposure === null
  const hasShippedExposure =
    !customerDataUnavailable &&
    ((customerExposure.shippedQuantity || 0) > 0 || (customerExposure.affectedCustomers || 0) > 0)
  const hasUnrestrictedStock = batchHeader?.stockStatus === 'unrestricted'
  // maxExposureDepth: minimum hop count to closest affected customer delivery.
  // Populated from live Databricks data (TRACE-P0-003); undefined in mock mode.
  const maxExposureDepth = customerExposure?.maxExposureDepth

  let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' = 'UNKNOWN'
  let severityLabel = ''
  let alertMessage =
    'No exposure signals returned from current source. Containment status is not independently verified — do not assume containment.'
  let actionGuidance =
    'Review batch details and delivery data before concluding on containment status.'
  let bannerBg = 'rgba(31, 139, 76, 0.08)'
  let bannerBorder = '1px solid rgba(31, 139, 76, 0.25)'

  if (sim) {
    severity = 'CRITICAL'
    alertMessage = 'SIMULATION ACTIVE: Simulating product recall and containment protocol.'
    actionGuidance = 'Execute recall training checklist and assess mock containment speed.'
    bannerBg = 'rgba(199, 51, 21, 0.08)'
    bannerBorder = '1px solid rgba(199, 51, 21, 0.25)'
  } else if (customerDataUnavailable) {
    severity = 'UNKNOWN'
    alertMessage =
      'Customer delivery data is unavailable. Downstream exposure cannot be assessed — do not assume containment.'
    actionGuidance =
      'Verify delivery data source connectivity before concluding on containment status.'
    bannerBg = 'rgba(199, 130, 28, 0.08)'
    bannerBorder = '1px solid rgba(199, 130, 28, 0.25)'
  } else if (hasShippedExposure) {
    // Depth-aware tiering (reference engine: depth=1→CRITICAL, depth≥2→HIGH).
    // Falls back to CRITICAL when depth is unavailable (conservative).
    if (maxExposureDepth != null && maxExposureDepth >= 2) {
      severity = 'HIGH'
      severityLabel = 'High Indirect Exposure'
      alertMessage =
        'Warning: Shipped stock has reached customer sites via indirect (multi-hop) lineage. Recall review may be required based on governed process.'
      actionGuidance = 'Assess scope of indirect exposure and initiate recall review.'
      bannerBg = 'rgba(199, 130, 28, 0.08)'
      bannerBorder = '1px solid rgba(199, 130, 28, 0.25)'
    } else {
      severity = 'CRITICAL'
      alertMessage =
        'Critical Alert: Shipped stock has reached customer sites. Immediate review is recommended with the responsible owner.'
      actionGuidance =
        'Review exposure with the responsible quality/recall owner before initiating any governed process.'
      bannerBg = 'rgba(199, 51, 21, 0.08)'
      bannerBorder = '1px solid rgba(199, 51, 21, 0.25)'
    }
  } else if (maxExposureDepth != null && maxExposureDepth >= 2) {
    // Indirect multi-hop lineage with no confirmed shipments — reference engine: MEDIUM.
    severity = 'MEDIUM'
    alertMessage =
      'Warning: Indirect lineage exposure detected at depth 2 or beyond. No direct shipments confirmed.'
    actionGuidance = 'Review multi-hop lineage for downstream risk before concluding containment.'
    bannerBg = 'rgba(199, 130, 28, 0.08)'
    bannerBorder = '1px solid rgba(199, 130, 28, 0.25)'
  } else if (isExpired || isNearExpiry) {
    severity = 'HIGH'
    alertMessage = 'Warning: Suspect batch is approaching shelf-life limit or has expired.'
    actionGuidance = 'Monitor stock position and adjacent production batches.'
    bannerBg = 'rgba(199, 130, 28, 0.08)'
    bannerBorder = '1px solid rgba(199, 130, 28, 0.25)'
  } else if (hasUnrestrictedStock) {
    severity = 'MEDIUM'
    alertMessage =
      'Review recommended: Significant stock remains unrestricted. Restrict batch status to prevent further issues.'
    actionGuidance = 'Monitor stock position and adjacent production batches.'
    bannerBg = 'rgba(199, 130, 28, 0.08)'
  } else if (!customerDataUnavailable && !hasShippedExposure) {
    severity = 'LOW'
    alertMessage = 'No downstream customer shipments detected in available data.'
    actionGuidance = 'Maintain containment protocol and monitor stock position.'
    bannerBg = 'rgba(31, 139, 76, 0.08)'
    bannerBorder = '1px solid rgba(31, 139, 76, 0.25)'
  }

  const severityLabels: Record<typeof severity, string> = {
    CRITICAL: 'Critical Exposure',
    HIGH: 'Near Expiry',
    MEDIUM: 'Medium Risk',
    LOW: 'Low Risk',
    UNKNOWN: 'Exposure Unknown',
  }
  // Use reason-specific label if set (e.g. depth-based HIGH), otherwise fall back to severity map.
  if (!severityLabel) severityLabel = severityLabels[severity]

  return (
    <div
      style={{
        background: 'var(--shell-surface, #FFFFFF)',
        border: '1px solid var(--shell-line, #DAD9C9)',
        borderRadius: 8,
        padding: '24px 28px',
        boxShadow: '0 2px 6px rgba(14, 31, 10, 0.04)',
        fontFamily: 'var(--font-sans, sans-serif)',
      }}
    >
      {/* Top row: Case Details & Confidence Badge */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '1px solid var(--shell-line, #DAD9C9)',
          paddingBottom: 16,
          marginBottom: 18,
          gap: 20,
        }}
      >
        <div>
          <SourceConfidenceStrip
            mode={adapterMode}
            status={mapConfidenceToStatus(confidence.grade)}
            fetchedAt={fetchedAt ?? undefined}
            className=""
            style={{ marginBottom: '12px' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 10,
                color: 'var(--shell-fg-3, #7A8A75)',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              Batch Investigation Cockpit
            </span>
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                background: 'var(--shell-line, #DAD9C9)',
              }}
            />
            <EvidenceConfidenceBadge result={confidence} />
          </div>

          <h2
            style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--shell-fg, #0E1F0A)' }}
          >
            {batchHeader?.materialDescription || 'Loading material...'}
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 13,
                color: 'var(--shell-fg-2, #4A5C45)',
                fontWeight: 400,
                marginLeft: 12,
              }}
            >
              (Mat: {batchHeader?.materialId || '—'} · Batch: {batchHeader?.batchId || '—'})
            </span>
          </h2>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Button
            variant={sim ? 'default' : 'destructive'}
            onClick={() => onSim(!sim)}
            style={{
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {sim ? 'Cancel Simulation' : 'Simulate Recall'}
          </Button>
        </div>
      </div>

      {/* Case Severity & Action Alert Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 18px',
          background: bannerBg,
          border: bannerBorder,
          borderRadius: 6,
          marginBottom: 20,
          fontSize: 12.5,
          color: 'var(--shell-fg, #0E1F0A)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 10,
            letterSpacing: '0.12em',
            fontWeight: 700,
            textTransform: 'uppercase',
            color:
              severity === 'CRITICAL' ? 'var(--shell-bad, #C73315)' : 'var(--shell-warn, #C7821C)',
            background: 'rgba(255, 255, 255, 0.5)',
            padding: '2px 6px',
            borderRadius: 3,
            border: '1px solid rgba(0, 0, 0, 0.05)',
          }}
        >
          {severity === 'UNKNOWN' ? <UnknownValue /> : severityLabel}
        </span>
        <div style={{ flex: 1 }}>
          <EvidenceCaveatList caveats={[`Action Recommended: ${alertMessage}`, actionGuidance]} />
        </div>
      </div>

      {/* Grid of Key Analytical Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 16,
          background: 'var(--shell-surface-2, #FAFAF3)',
          border: '1px solid var(--shell-line, #DAD9C9)',
          borderRadius: 6,
          padding: '16px 20px',
          marginBottom: 20,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 9,
              color: 'var(--shell-fg-3, #7A8A75)',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono, monospace)',
              marginBottom: 4,
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            Stock Position
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--shell-fg, #0E1F0A)' }}>
            {batchHeader?.quantity !== undefined ? (
              batchHeader.quantity.toLocaleString()
            ) : (
              <UnavailableValue />
            )}
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: 'var(--shell-fg-2, #4A5C45)',
                marginLeft: 4,
              }}
            >
              {batchHeader?.uom || ''}
            </span>
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--shell-fg-2, #4A5C45)',
              marginTop: 2,
              textTransform: 'capitalize',
            }}
          >
            {batchHeader?.stockStatus || <UnknownValue />}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 9,
              color: 'var(--shell-fg-3, #7A8A75)',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono, monospace)',
              marginBottom: 4,
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            Total Shipped
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: customerDataUnavailable
                ? 'var(--shell-warn, #C7821C)'
                : hasShippedExposure
                  ? 'var(--shell-bad, #C73315)'
                  : 'var(--shell-fg, #0E1F0A)',
            }}
          >
            {customerDataUnavailable ? (
              <UnknownValue />
            ) : customerExposure.shippedQuantity !== undefined ? (
              customerExposure.shippedQuantity.toLocaleString()
            ) : (
              <UnavailableValue />
            )}
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: 'var(--shell-fg-2, #4A5C45)',
                marginLeft: 4,
              }}
            >
              {batchHeader?.uom || ''}
            </span>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--shell-fg-2, #4A5C45)', marginTop: 2 }}>
            {customerDataUnavailable ? (
              'data unavailable'
            ) : customerExposure.affectedDeliveries !== undefined ? (
              `${customerExposure.affectedDeliveries} deliveries`
            ) : (
              <UnavailableValue />
            )}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 9,
              color: 'var(--shell-fg-3, #7A8A75)',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono, monospace)',
              marginBottom: 4,
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            Downstream Exposure
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: customerDataUnavailable
                ? 'var(--shell-warn, #C7821C)'
                : hasShippedExposure
                  ? 'var(--shell-bad, #C73315)'
                  : 'var(--shell-fg, #0E1F0A)',
            }}
          >
            {customerDataUnavailable ? (
              <UnknownValue />
            ) : customerExposure.affectedCustomers !== undefined ? (
              customerExposure.affectedCustomers
            ) : (
              <UnavailableValue />
            )}
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: 'var(--shell-fg-2, #4A5C45)',
                marginLeft: 4,
              }}
            >
              customers
            </span>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--shell-fg-2, #4A5C45)', marginTop: 2 }}>
            {customerDataUnavailable
              ? 'data unavailable'
              : `across ${customerExposure.countries?.length || 0} countries`}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 9,
              color: 'var(--shell-fg-3, #7A8A75)',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono, monospace)',
              marginBottom: 4,
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            Upstream Lineage
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--shell-fg, #0E1F0A)' }}>
            {supplierExposure?.supplierCount !== undefined ? (
              supplierExposure.supplierCount
            ) : (
              <UnavailableValue />
            )}
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: 'var(--shell-fg-2, #4A5C45)',
                marginLeft: 4,
              }}
            >
              suppliers
            </span>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--shell-fg-2, #4A5C45)', marginTop: 2 }}>
            {supplierExposure?.supplierLots !== undefined ? (
              `${supplierExposure.supplierLots} lots`
            ) : (
              <UnavailableValue />
            )}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 9,
              color: 'var(--shell-fg-3, #7A8A75)',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono, monospace)',
              marginBottom: 4,
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            Shelf Life
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: !hasExpiry
                ? 'var(--shell-fg-3, #7A8A75)'
                : isExpired
                  ? 'var(--shell-bad, #C73315)'
                  : isNearExpiry
                    ? 'var(--shell-warn, #C7821C)'
                    : 'var(--shell-good, #1F8B4C)',
            }}
          >
            {!hasExpiry ? <UnavailableValue /> : isExpired ? 'Expired' : `${daysToExpiry} days`}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--shell-fg-2, #4A5C45)', marginTop: 2 }}>
            {!hasExpiry ? 'No expiry date' : `expires ${formattedExpiryDate}`}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 9,
              color: 'var(--shell-fg-3, #7A8A75)',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono, monospace)',
              marginBottom: 4,
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            Quality Status
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--shell-fg, #0E1F0A)',
              display: 'flex',
              alignItems: 'center',
              minHeight: 22,
            }}
          >
            {batchHeader?.qualityStatus ? (
              <StatusBadge
                label={batchHeader.qualityStatus}
                variant={
                  batchHeader.qualityStatus === 'accepted'
                    ? 'good'
                    : batchHeader.qualityStatus === 'rejected'
                      ? 'bad'
                      : batchHeader.qualityStatus === 'pending'
                        ? 'warn'
                        : 'neutral'
                }
              />
            ) : (
              <UnavailableValue />
            )}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--shell-fg-2, #4A5C45)', marginTop: 2 }}>
            source release status:{' '}
            {batchHeader?.releaseStatus ? batchHeader.releaseStatus : <UnknownValue />}
          </div>
        </div>
      </div>

      {/* Bottom Pointers & Quick Links */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: 'var(--shell-fg-2, #4A5C45)',
          borderTop: '1px solid var(--shell-line, #DAD9C9)',
          paddingTop: 14,
        }}
      >
        <span>
          💡 <strong>Auditing checklist:</strong> ensure all data sectors match the physical SAP
          delivery notes before completing governed release processes outside this app.
        </span>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span>Explore views:</span>
          {[
            { label: 'Mass Balance', target: 'mass-balance' },
            { label: 'Lineage Graph', target: 'trace-tree' },
            { label: 'Deliveries', target: 'customer-exposure' },
            { label: 'Suppliers', target: 'supplier-exposure' },
          ].map((l) => (
            <button
              key={l.target}
              onClick={() => handleNavigate(l.target)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--shell-accent, #005776)',
                cursor: 'pointer',
                fontWeight: 600,
                textDecoration: 'underline',
              }}
            >
              {l.label} →
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
