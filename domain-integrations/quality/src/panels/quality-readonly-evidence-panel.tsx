import { useEffect } from 'react'
import {
  EvidencePanel,
  useEvidencePanel,
  EvidenceCaveatList,
} from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type {
  QualityEvidenceResponse,
  QualityInspectionLotEvidence,
  QualityMicResultEvidence,
  QualityCoaResultEvidence,
} from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { buildUsageDecisionDisplay } from '../lib/usage-decision-display.js'
import { UnknownValue } from '@connectio/design-system'

const registration: EvidencePanelRegistration = {
  panelId: 'quality-readonly-evidence',
  displayName: 'Read-Only Quality Evidence',
  description:
    'Inspection lot, MIC result, usage-decision, and CoA-like evidence readiness for future native Quality UAT.',
  ownerDomain: 'quality',
  sourceOwnership: { domainId: 'quality', systemName: 'sap-qm', legacyAppId: 'connectedquality' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['quality-batch-release'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: false }],
  freshnessPolicy: {
    staleAfterSeconds: 180,
    errorAfterSeconds: 600,
    refreshOnFocus: false,
    pollIntervalSeconds: null,
  },
  confidencePolicy: { level: 0.2, hidden: false },
  requiredPermissions: [{ permissionId: 'quality.read', displayName: 'Quality Read' }],
}

export interface QualityReadOnlyEvidencePanelProps {
  readonly result?: AdapterResult<QualityEvidenceResponse>
  readonly isLoading?: boolean
}

function formatStatusLabel(value: string) {
  return value.replace(/-/g, ' ')
}

export function QualityReadOnlyEvidencePanel({
  result,
  isLoading = false,
}: QualityReadOnlyEvidencePanelProps) {
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

  const data: QualityEvidenceResponse | null = result?.ok ? result.data : null
  const lotCount = data?.summary.lotCount ?? data?.summary.inspectionLotCount ?? 0
  const isLiveWired = result?.source === 'databricks-api' || result?.source === 'legacy-api'
  const evidenceState =
    data?.summary.evidenceState ?? data?.summary.status ?? 'pending-source-verification'

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          {/* Evidence status header */}
          <div
            style={{
              padding: 10,
              border: '1px solid #D97706',
              borderRadius: 6,
              background: 'rgba(217,119,6,0.08)',
              color: 'var(--shell-fg)',
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            <strong>Read-only Quality evidence is not yet source-verified in V2.</strong>
            <div style={{ marginTop: 4 }}>
              Missing usage-decision, CoA, or deviation evidence must not be interpreted as
              accepted, released, or no issue.
            </div>
            <div
              style={{
                marginTop: 6,
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <SourceBadge
                state={evidenceState}
                source={result?.source}
                isLiveWired={isLiveWired}
              />
              {!isLiveWired && (
                <span style={{ fontSize: 11, color: '#D97706' }}>Live source wiring pending</span>
              )}
            </div>
          </div>

          {/* Metrics row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 8,
            }}
          >
            <Metric label="Inspection lots" value={lotCount} />
            <Metric label="MIC results" value={data.summary.micResultCount} />
            <Metric label="CoA-like rows" value={data.summary.coaResultCount} />
            <Metric label="UD status" value={formatStatusLabel(data.summary.usageDecisionStatus)} />
          </div>

          {/* Multiple lots warning — driven by actual lot array length, not summary count which may be null */}
          {data.inspectionLots.length > 1 && (
            <EvidenceCaveatList
              caveats={[
                `Multiple inspection lots found (${data.inspectionLots.length}).`,
                data.summary.multipleLotsWarning ??
                  'Per-lot usage decisions are shown individually. A batch-level release decision is not derived from individual lot decisions.',
              ]}
            />
          )}

          {/* Inspection lot section */}
          <section>
            <div style={eyebrowStyle}>Inspection lot evidence</div>
            {data.inspectionLots.length === 0 ? (
              <div style={noRecordStyle}>
                {data.summary.missingLotWarning ??
                  'No inspection lot found. This is a source gap, not confirmation that no inspection was performed in SAP.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
                {data.inspectionLots.map((lot) => (
                  <InspectionLotRow key={lot.inspectionLotId} lot={lot} />
                ))}
              </div>
            )}
          </section>

          {/* Usage decision section */}
          {data.usageDecision && (
            <section>
              <div style={eyebrowStyle}>Usage decision evidence</div>
              <UsageDecisionSection
                usageDecision={data.usageDecision}
                inspectionLots={data.inspectionLots}
                lotCount={lotCount}
              />
            </section>
          )}

          {/* MIC / characteristic section */}
          <section>
            <div style={eyebrowStyle}>MIC / inspection characteristic evidence</div>
            {data.micResults.length === 0 ? (
              <div style={noRecordStyle}>
                MIC evidence pending source verification. Do not interpret as no MIC results.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                {data.micResults.map((mic, i) => (
                  <MicResultRow key={mic.micId ?? i} mic={mic} />
                ))}
              </div>
            )}
            <div style={noteStyle}>
              MIC result valuation is not a release decision. Specification limits are not SPC
              control limits.
            </div>
          </section>

          {/* CoA-like evidence section */}
          <section>
            <div style={eyebrowStyle}>CoA-like result evidence</div>
            {data.coaResults.length === 0 ? (
              <div style={noRecordStyle}>
                CoA-like result evidence pending source verification. Do not interpret as no CoA
                evidence.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                {data.coaResults.map((coa, i) => (
                  <CoaResultRow key={coa.micCode ?? i} coa={coa} />
                ))}
              </div>
            )}
            <div style={noteStyle}>
              CoA-like result evidence is not official CoA document approval.
            </div>
          </section>

          {/* Deviation / notification section */}
          {data.summary.unavailableEvidence.includes('deviations') && (
            <div style={warningBoxStyle} role="alert">
              <strong>Deviation source unavailable.</strong>
              <div style={{ marginTop: 4 }}>
                Do not interpret this as no deviations. No deviation or nonconformance source has
                been verified for V2.
              </div>
            </div>
          )}

          {/* Unavailable evidence chips */}
          {data.summary.unavailableEvidence.length > 0 && (
            <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 10 }}>
              <div style={eyebrowStyle}>Unavailable evidence</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {data.summary.unavailableEvidence.map((item) => (
                  <span key={item} style={chipStyle}>
                    {formatStatusLabel(item)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Source-truthfulness footer */}
          <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 10 }}>
            <div style={eyebrowStyle}>Source boundaries</div>
            <ul
              style={{
                margin: '6px 0 0 18px',
                padding: 0,
                color: 'var(--shell-fg-2)',
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {data.summary.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
              <li>Specification limits are not SPC control limits.</li>
              <li>MIC result valuation is not a release decision.</li>
              <li>
                Read-only Quality evidence. This panel does not authorise release, rejection, or SAP
                posting.
              </li>
              <li>
                Usage decision codes are displayed as source evidence only. A single batch-level
                release decision is not derived.
              </li>
            </ul>
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SourceBadge({
  state,
  source,
  isLiveWired,
}: {
  state: string
  source?: string
  isLiveWired: boolean
}) {
  const label = isLiveWired
    ? (source ?? 'live')
    : state === 'simulated-release-only'
      ? 'Simulation'
      : 'Route pending'
  return (
    <span
      style={{
        border: '1px solid #D97706',
        borderRadius: 999,
        padding: '2px 8px',
        fontSize: 10,
        fontWeight: 700,
        color: '#D97706',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      {label}
    </span>
  )
}

function InspectionLotRow({ lot }: { lot: QualityInspectionLotEvidence }) {
  const udDisplay = buildUsageDecisionDisplay({
    inspectionLotId: lot.inspectionLotId,
    usageDecisionCode: lot.usageDecisionCode,
    usageDecisionText: lot.usageDecisionText,
    createdAt: lot.usageDecisionCreatedAt,
    source: lot.source,
  })

  return (
    <div
      style={{
        border: '1px solid var(--shell-line)',
        borderRadius: 6,
        padding: 10,
        display: 'grid',
        gap: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--shell-fg)' }}>
            Lot {lot.inspectionLotId}
          </span>
          {lot.inspectionType && (
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--shell-fg-2)' }}>
              Type {lot.inspectionType}
            </span>
          )}
        </div>
        {lot.inspectionLotStatus && <span style={chipStyle}>{lot.inspectionLotStatus}</span>}
      </div>

      {/* Per-lot usage decision */}
      <div style={{ fontSize: 11, color: 'var(--shell-fg-2)' }}>
        <span style={{ fontWeight: 700, color: 'var(--shell-fg)' }}>Usage decision: </span>
        {udDisplay.rawCode !== null ? (
          <>
            <span style={{ fontFamily: 'monospace', marginRight: 6 }}>
              {udDisplay.rawCode === '' ? '(empty)' : udDisplay.rawCode}
            </span>
            <span style={{ color: 'var(--shell-fg-2)' }}>— {udDisplay.displayLabel}</span>
          </>
        ) : (
          <span style={{ color: '#D97706' }}>
            <UnknownValue />
          </span>
        )}
      </div>

      {/* Release-authority block — always shown */}
      <div style={{ fontSize: 10, color: '#D97706', fontStyle: 'italic' }}>
        Read-only source evidence only. This is not a release authority.
      </div>
    </div>
  )
}

function UsageDecisionSection({
  usageDecision,
  inspectionLots,
  lotCount,
}: {
  usageDecision: QualityEvidenceResponse['usageDecision'] | null
  inspectionLots: QualityInspectionLotEvidence[]
  lotCount: number
}) {
  const firstLot = inspectionLots[0]
  const udDisplay = buildUsageDecisionDisplay({
    inspectionLotId: usageDecision ? (firstLot?.inspectionLotId ?? 'lot-present') : null,
    usageDecisionCode: usageDecision?.usageDecisionCode,
    usageDecisionText: usageDecision?.usageDecisionText,
    createdAt: usageDecision?.createdAt,
    source: usageDecision?.source,
    mappingStatus:
      usageDecision?.mappingStatus === 'source-only'
        ? 'raw-only'
        : usageDecision?.mappingStatus === 'verified'
          ? 'governed-label'
          : 'governance-pending',
  })

  return (
    <div style={{ marginTop: 6, display: 'grid', gap: 8 }}>
      {lotCount > 1 && (
        <EvidenceCaveatList
          caveats={[
            'Multiple lots detected. Usage decision shown is for the primary lot only. Per-lot decisions are shown in the inspection lot section above.',
          ]}
        />
      )}

      {usageDecision ? (
        <div
          style={{
            border: '1px solid var(--shell-line)',
            borderRadius: 6,
            padding: 10,
            display: 'grid',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 11 }}>
            <span style={{ fontWeight: 700, color: 'var(--shell-fg)' }}>Raw code: </span>
            <span style={{ fontFamily: 'monospace', color: 'var(--shell-fg)' }}>
              {udDisplay.rawCode === null
                ? 'null'
                : udDisplay.rawCode === ''
                  ? '(empty string)'
                  : udDisplay.rawCode}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--shell-fg-2)' }}>
            <span style={{ fontWeight: 700 }}>Governed label: </span>
            {udDisplay.displayLabel}
          </div>
          {usageDecision.usageDecisionText && (
            <div style={{ fontSize: 11, color: 'var(--shell-fg-2)' }}>
              <span style={{ fontWeight: 700 }}>Source text: </span>
              {usageDecision.usageDecisionText}
            </div>
          )}
        </div>
      ) : (
        <div style={noRecordStyle}>
          <UnknownValue />
        </div>
      )}

      {/* Release authority block — always shown */}
      <div style={{ fontSize: 11, color: '#D97706', fontStyle: 'italic', padding: '6px 0' }}>
        Usage decision codes are source evidence only. Release authority is not derived from this
        panel.
      </div>
    </div>
  )
}

function MicResultRow({ mic }: { mic: QualityMicResultEvidence }) {
  const statusColor =
    mic.resultStatus === 'pass'
      ? 'var(--shell-good)'
      : mic.resultStatus === 'fail'
        ? 'var(--shell-error, #dc2626)'
        : 'var(--shell-warn)'

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 8px',
        border: '1px solid var(--shell-line)',
        borderRadius: 4,
        fontSize: 11,
        gap: 8,
      }}
    >
      <div>
        <span style={{ fontWeight: 700, color: 'var(--shell-fg)' }}>
          {mic.micCode ?? mic.micName ?? mic.micId ?? 'Unknown'}
        </span>
        {mic.micName && mic.micCode && (
          <span style={{ marginLeft: 6, color: 'var(--shell-fg-2)' }}>{mic.micName}</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {mic.resultValue !== null && mic.resultValue !== undefined && (
          <span style={{ color: 'var(--shell-fg)' }}>
            {mic.resultValue} {mic.resultUnit}
          </span>
        )}
        <span style={{ color: statusColor, fontWeight: 700, textTransform: 'uppercase' }}>
          {mic.resultStatus}
        </span>
      </div>
    </div>
  )
}

function CoaResultRow({ coa }: { coa: QualityCoaResultEvidence }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 8px',
        border: '1px solid var(--shell-line)',
        borderRadius: 4,
        fontSize: 11,
        gap: 8,
      }}
    >
      <div>
        <span style={{ fontWeight: 700, color: 'var(--shell-fg)' }}>
          {coa.micCode ?? coa.micName ?? 'Unknown'}
        </span>
        {coa.micName && coa.micCode && (
          <span style={{ marginLeft: 6, color: 'var(--shell-fg-2)' }}>{coa.micName}</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {coa.actualResult !== null && coa.actualResult !== undefined && (
          <span style={{ color: 'var(--shell-fg)' }}>Result: {coa.actualResult}</span>
        )}
        <span
          style={{
            fontSize: 10,
            color: '#D97706',
            border: '1px solid #D97706',
            borderRadius: 999,
            padding: '1px 6px',
          }}
        >
          CoA doc: {coa.documentStatus}
        </span>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{ border: '1px solid var(--shell-line)', borderRadius: 6, padding: 8, minHeight: 52 }}
    >
      <div style={eyebrowStyle}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700, color: 'var(--shell-fg)' }}>
        {value}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

function sectionState(rowCount: number, status: string) {
  if (rowCount > 0) return 'loaded'
  return status
}

// Keep for backwards compat — used in tests that check section state
export { sectionState }

const eyebrowStyle = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--shell-fg-3)',
} as const

const chipStyle = {
  border: '1px solid var(--shell-line)',
  borderRadius: 999,
  padding: '3px 8px',
  fontSize: 11,
  color: 'var(--shell-fg-2)',
  textTransform: 'capitalize',
} as const

const warningBoxStyle = {
  padding: '8px 10px',
  border: '1px solid #D97706',
  borderRadius: 6,
  background: 'rgba(217,119,6,0.06)',
  color: 'var(--shell-fg)',
  fontSize: 12,
  lineHeight: 1.45,
} as const

const noRecordStyle = {
  padding: '6px 8px',
  border: '1px solid var(--shell-line)',
  borderRadius: 4,
  fontSize: 12,
  color: '#D97706',
  lineHeight: 1.45,
  marginTop: 4,
} as const

const noteStyle = {
  fontSize: 11,
  color: 'var(--shell-fg-2)',
  fontStyle: 'italic',
  marginTop: 4,
} as const
