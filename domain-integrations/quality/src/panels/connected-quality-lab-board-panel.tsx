import { useEffect, useState } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ConnectedQualityLabFailure } from '@connectio/data-contracts'
import { useConnectedQualityLabFailures } from '../adapters/connected-quality-lab-queries.js'
import type { ConnectedQualityLabAdapterRequest } from '../adapters/connected-quality-lab-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'connected-quality-lab-board',
  displayName: 'Lab Board',
  description:
    'SAP QM inspection failures and warnings — 6-card rotating wallboard with spec bar and severity indicators.',
  ownerDomain: 'quality',
  sourceOwnership: {
    domainId: 'quality',
    systemName: 'sap-qm',
    legacyAppId: 'connected-quality',
  },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['quality-batch-release'],
  requiredContext: [],
  freshnessPolicy: {
    staleAfterSeconds: 120,
    errorAfterSeconds: 600,
    refreshOnFocus: true,
    pollIntervalSeconds: 60,
  },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [
    { permissionId: 'quality.release.read', displayName: 'Quality Release Read' },
  ],
}

const CARDS_PER_PAGE = 6
const ROTATION_SECONDS = 30

const SEV_COLOR: Record<string, string> = {
  fail: '#D32F2F',
  warn: '#D97706',
}

interface SpecBarProps {
  res: number
  lo: number
  hi: number
  sev: string
}

function SpecBar({ res, lo, hi, sev }: SpecBarProps) {
  const span = hi - lo
  const pad = Math.max(Math.abs(span) * 0.25, 0.001)
  const rangeLow = Math.min(res, lo) - pad
  const rangeHigh = Math.max(res, hi) + pad
  const total = rangeHigh - rangeLow

  const specLeft = ((lo - rangeLow) / total) * 100
  const specWidth = ((hi - lo) / total) * 100
  const resLeft = Math.max(0, Math.min(100, ((res - rangeLow) / total) * 100))
  const outOfSpec = res < lo || res > hi

  return (
    <div
      aria-label={`Spec bar: result ${res}, range ${lo} to ${hi}`}
      style={{
        position: 'relative',
        height: 8,
        background: '#e5e7eb',
        borderRadius: 4,
        margin: '6px 0',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${specLeft}%`,
          width: `${Math.max(0, specWidth)}%`,
          height: '100%',
          background: '#16a34a',
          borderRadius: 2,
          opacity: 0.4,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${resLeft}%`,
          width: 3,
          height: '100%',
          background: outOfSpec ? (SEV_COLOR[sev] ?? '#9E9E9E') : '#16a34a',
          borderRadius: 1,
          transform: 'translateX(-50%)',
        }}
      />
    </div>
  )
}

interface FailCardProps {
  failure: ConnectedQualityLabFailure
}

function FailCard({ failure }: FailCardProps) {
  const outOfSpec =
    failure.lo !== undefined && failure.hi !== undefined
      ? failure.res < failure.lo || failure.res > failure.hi
      : true
  const severityColor = SEV_COLOR[failure.sev] ?? '#9E9E9E'
  const tsLabel = failure.ts
    ? new Date(failure.ts).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div
      style={{
        border: `2px solid ${severityColor}`,
        borderRadius: 6,
        padding: '10px 12px',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minHeight: 148,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--shell-fg)',
            lineHeight: 1.3,
          }}
        >
          {failure.mat}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 3,
            background: severityColor,
            color: '#fff',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {failure.sev.toUpperCase()}
        </span>
      </div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--shell-fg-2)',
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        <span>{failure.lot}</span>
        {failure.line && (
          <>
            <span>·</span>
            <span>{failure.line}</span>
          </>
        )}
        <span>·</span>
        <span>Type {failure.lotType}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--shell-fg)', marginTop: 2 }}>{failure.text}</div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'baseline',
          marginTop: 2,
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: outOfSpec ? severityColor : 'var(--shell-fg)',
          }}
        >
          {failure.res} {failure.units}
        </span>
        {failure.lo !== undefined && failure.hi !== undefined && (
          <span style={{ fontSize: 11, color: 'var(--shell-fg-2)' }}>
            [{failure.lo}–{failure.hi}]
          </span>
        )}
      </div>
      {failure.lo !== undefined && failure.hi !== undefined && (
        <SpecBar res={failure.res} lo={failure.lo} hi={failure.hi} sev={failure.sev} />
      )}
      <div
        style={{ fontSize: 10, color: 'var(--shell-fg-3)', marginTop: 'auto' }}
      >
        {failure.char} · {tsLabel}
      </div>
    </div>
  )
}

export interface ConnectedQualityLabBoardPanelProps {
  readonly request: ConnectedQualityLabAdapterRequest
}

export function ConnectedQualityLabBoardPanel({ request }: ConnectedQualityLabBoardPanelProps) {
  const [selectedLotType, setSelectedLotType] = useState<string | undefined>(request.lotType)
  const [page, setPage] = useState(0)
  const [countdown, setCountdown] = useState(ROTATION_SECONDS)

  const effectiveRequest: ConnectedQualityLabAdapterRequest = {
    plantId: request.plantId,
    lotType: selectedLotType,
  }

  const { data: result, isLoading } = useConnectedQualityLabFailures(effectiveRequest)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null

  const sourceLabel =
    result?.source === 'mock'
      ? 'Mock SAP QM lab failures'
      : result?.source === 'legacy-api'
        ? 'SAP QM via legacy API'
        : null

  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) markReady()
    else if (result && !result.ok) markError()
  }, [isLoading, result, markReady, markError])

  const fails: ConnectedQualityLabFailure[] = result?.ok ? result.data.fails : []
  const dataAvailable = result?.ok ? result.data.dataAvailable : true
  const noDataReason = result?.ok && !result.data.dataAvailable ? result.data.reason : undefined

  const totalPages = Math.max(1, Math.ceil(fails.length / CARDS_PER_PAGE))

  useEffect(() => {
    setPage(0)
    setCountdown(ROTATION_SECONDS)
  }, [effectiveRequest.plantId, effectiveRequest.lotType])

  useEffect(() => {
    if (fails.length <= CARDS_PER_PAGE) return
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          setPage((p) => (p + 1) % totalPages)
          return ROTATION_SECONDS
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [fails.length, totalPages])

  const currentFails = fails.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE)

  function goToPage(next: number) {
    setPage(((next % totalPages) + totalPages) % totalPages)
    setCountdown(ROTATION_SECONDS)
  }

  const LOT_TYPE_OPTIONS: Array<{ value: string | undefined; label: string }> = [
    { value: undefined, label: 'All' },
    { value: '89', label: 'FP (89)' },
    { value: '04', label: 'RM (04)' },
  ]

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {/* board header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 6,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--shell-fg-3)',
            textTransform: 'uppercase',
          }}
        >
          ConnectedQuality · Lab Board
        </span>
        {request.plantId && (
          <span style={{ fontSize: 10, color: 'var(--shell-fg-2)' }}>
            Plant: {request.plantId}
          </span>
        )}
        {sourceLabel && (
          <span style={{ fontSize: 10, color: 'var(--shell-fg-3)', marginLeft: 'auto' }}>
            {sourceLabel}
          </span>
        )}
      </div>
      {/* legend */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 3,
            background: '#D32F2F',
            color: '#fff',
          }}
        >
          FAIL
        </span>
        <span style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>Outside spec</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 3,
            background: '#D97706',
            color: '#fff',
            marginLeft: 8,
          }}
        >
          WARN
        </span>
        <span style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>Warning threshold</span>
      </div>
      {/* context strip */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        {LOT_TYPE_OPTIONS.map((opt) => {
          const active = selectedLotType === opt.value
          return (
            <button
              key={opt.label}
              onClick={() => {
                setSelectedLotType(opt.value)
                setPage(0)
                setCountdown(ROTATION_SECONDS)
              }}
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid var(--ocean, #005776)',
                background: active ? 'var(--ocean, #005776)' : 'transparent',
                color: active ? '#fff' : 'var(--ocean, #005776)',
              }}
            >
              {opt.label}
            </button>
          )
        })}
        <span
          style={{
            fontSize: 11,
            color: 'var(--shell-fg-2)',
            marginLeft: 'auto',
          }}
        >
          {fails.length} {fails.length === 1 ? 'failure' : 'failures'}
        </span>
        {totalPages > 1 && (
          <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
            Page {page + 1}/{totalPages} · Auto-rotates · Next in {countdown}s
          </span>
        )}
      </div>

      {/* no-data state */}
      {!isLoading && !dataAvailable && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--shell-fg-3)' }}>
          {noDataReason ?? 'No SAP QM data published for this plant.'}
        </p>
      )}

      {/* empty state */}
      {!isLoading && dataAvailable && fails.length === 0 && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--shell-fg-3)' }}>
          No failures or warnings.
        </p>
      )}

      {/* card grid */}
      {currentFails.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}
        >
          {currentFails.map((f, i) => (
            <FailCard key={`${f.lot}-${f.char}-${i}`} failure={f} />
          ))}
        </div>
      )}

      {/* pagination controls */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'center',
            marginTop: 12,
          }}
        >
          <button
            onClick={() => goToPage(page - 1)}
            style={{
              padding: '4px 14px',
              fontSize: 12,
              border: '1px solid var(--shell-border)',
              borderRadius: 4,
              cursor: 'pointer',
              background: 'transparent',
            }}
          >
            ← Prev
          </button>
          <button
            onClick={() => goToPage(page + 1)}
            style={{
              padding: '4px 14px',
              fontSize: 12,
              border: '1px solid var(--shell-border)',
              borderRadius: 4,
              cursor: 'pointer',
              background: 'transparent',
            }}
          >
            Next →
          </button>
        </div>
      )}
    </EvidencePanel>
  )
}
