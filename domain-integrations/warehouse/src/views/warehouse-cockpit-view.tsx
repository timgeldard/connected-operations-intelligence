import { useState, useTransition } from 'react'
import {
  VerificationStatusBanner,
  GovernancePendingBadge,
  UnavailableValue,
  StatusBadge,
} from '@connectio/design-system'
import { EvidenceCaveatList } from '@connectio/evidence-panel-runtime'
import type { CSSProperties } from 'react'
import {
  useWarehouseOverview,
  useWarehouseInbound,
  useWarehouseOutbound,
  useWarehouseStaging,
  useWarehouseExceptionItems,
} from '../adapters/warehouse-360-queries.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

// Premium Theme Colors
const COLORS = {
  bg: '#f8fafc',
  card: '#ffffff',
  primary: '#4f46e5',
  primaryHover: '#4338ca',
  slate800: '#1e293b',
  slate600: '#475569',
  slate400: '#94a3b8',
  slate100: '#f1f5f9',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  dangerBg: '#fee2e2',
  info: '#3b82f6',
  indigoBg: '#e0e7ff',
  indigoText: '#3730a3',
}

const CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 24,
  fontFamily: 'Inter, system-ui, sans-serif',
  backgroundColor: COLORS.bg,
  minHeight: '100%',
}

const BANNER_STYLE: CSSProperties = {
  background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
  color: '#ffffff',
  borderRadius: 12,
  padding: '24px 32px',
  boxShadow: '0 4px 20px rgba(49, 46, 129, 0.15)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 16,
}

const CARD_STYLE: CSSProperties = {
  backgroundColor: COLORS.card,
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.02)',
  border: `1px solid ${COLORS.slate100}`,
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
}

const ROW_DETAIL_STYLE: CSSProperties = {
  ...CARD_STYLE,
  borderLeft: `4px solid ${COLORS.primary}`,
}

const GRID_STATS_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
}

const INPUT_STYLE: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: `1px solid ${COLORS.slate400}`,
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const BUTTON_STYLE: CSSProperties = {
  padding: '10px 20px',
  borderRadius: 6,
  border: 'none',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  transition: 'background-color 0.2s, transform 0.1s',
}

const TAB_STYLE = (isActive: boolean): CSSProperties => ({
  padding: '12px 20px',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  border: 'none',
  borderBottom: isActive ? `3px solid ${COLORS.primary}` : '3px solid transparent',
  color: isActive ? COLORS.primary : COLORS.slate600,
  backgroundColor: 'transparent',
  transition: 'color 0.2s, border-color 0.2s',
})

interface DetailRowProps {
  readonly label: string
  readonly value: string | number | null | undefined
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: `1px solid ${COLORS.slate100}`,
      }}
    >
      <span style={{ fontWeight: 500, color: COLORS.slate600, fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 600, color: COLORS.slate800, fontSize: 13 }}>
        {value !== null && value !== undefined ? String(value) : '—'}
      </span>
    </div>
  )
}

export interface WarehouseCockpitViewProps {
  readonly request: Warehouse360AdapterRequest
  readonly onHoldNavigate?: (workspaceId: string) => void
}

export function WarehouseCockpitView({ request }: WarehouseCockpitViewProps) {
  // Form input states
  const [warehouseId, setWarehouseId] = useState(request.warehouseId ?? '')
  const [plantId, setPlantId] = useState(request.plantId ?? 'C061')
  const [dateFrom, setDateFrom] = useState(request.dateFrom ?? '2026-01-01')
  const [dateTo, setDateTo] = useState(request.dateTo ?? '2026-05-18')
  const [limit, setLimit] = useState(request.limit ?? 100)

  // Committed query filters
  const [activeFilters, setActiveFilters] = useState<Warehouse360AdapterRequest>({
    warehouseId: request.warehouseId ?? '',
    plantId: 'C061',
    dateFrom: '2026-01-01',
    dateTo: '2026-05-18',
    limit: 100,
  })

  // Selected operational tab
  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound' | 'staging' | 'exceptions'>(
    'inbound',
  )

  // Selected row inspector details
  const [selectedRow, setSelectedRow] = useState<{
    readonly type: 'inbound' | 'outbound' | 'staging' | 'exceptions'
    readonly data: Record<string, unknown>
  } | null>(null)

  // Diagnostics and url copying states
  const [techDetailsExpanded, setTechDetailsExpanded] = useState(false)
  const [copiedUrlType, setCopiedUrlType] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [, startTransition] = useTransition()

  // Concurrently trigger all 5 query hooks
  const isQueryEnabled = Boolean(activeFilters.warehouseId)

  const overviewQuery = useWarehouseOverview({ ...activeFilters })
  const inboundQuery = useWarehouseInbound({ ...activeFilters })
  const outboundQuery = useWarehouseOutbound({ ...activeFilters })
  const stagingQuery = useWarehouseStaging({ ...activeFilters })
  const exceptionsQuery = useWarehouseExceptionItems({ ...activeFilters })

  // Derived counts and statistics
  const inboundData = inboundQuery.data?.ok ? inboundQuery.data.data : []
  const outboundData = outboundQuery.data?.ok ? outboundQuery.data.data : []
  const stagingData = stagingQuery.data?.ok ? stagingQuery.data.data : []
  const exceptionsData = exceptionsQuery.data?.ok ? exceptionsQuery.data.data : []

  const totalInboundCount = inboundData.length
  const totalOutboundCount = outboundData.length
  const totalStagingCount = stagingData.length
  const totalExceptionCount = exceptionsData.length

  const totalWorkloadEstimate = totalInboundCount + totalOutboundCount + totalStagingCount
  const criticalExceptionCount = exceptionsData.filter(
    (e) => e.severity === 'critical' || e.severity === 'high',
  ).length

  // Dynamically compute the active API mode
  const activeSources: string[] = []
  if (isQueryEnabled) {
    if (overviewQuery.data?.source) activeSources.push(overviewQuery.data.source)
    if (inboundQuery.data?.source) activeSources.push(inboundQuery.data.source)
    if (outboundQuery.data?.source) activeSources.push(outboundQuery.data.source)
    if (stagingQuery.data?.source) activeSources.push(stagingQuery.data.source)
    if (exceptionsQuery.data?.source) activeSources.push(exceptionsQuery.data.source)
  }
  const uniqueSources = Array.from(new Set(activeSources))
  const displayedSource =
    uniqueSources.length === 1 ? uniqueSources[0] : uniqueSources.length > 1 ? 'mixed' : 'mock'

  const getSourceBadgeColorAndText = () => {
    switch (displayedSource) {
      case 'databricks-api':
        return {
          text: 'API Mode: databricks-api (Executable)',
          color: '#ffffff',
          bg: COLORS.success,
        }
      case 'legacy-api':
        return { text: 'API Mode: legacy-api (Proxy)', color: '#ffffff', bg: COLORS.info }
      case 'mixed':
        return { text: 'API Mode: mixed (Hybrid)', color: '#ffffff', bg: COLORS.warning }
      case 'mock':
      default:
        return {
          text: 'API Mode: mock (Fixture Data)',
          color: COLORS.indigoText,
          bg: COLORS.indigoBg,
        }
    }
  }
  const sourceBadge = getSourceBadgeColorAndText()

  const handleRun = () => {
    const trimmedWh = warehouseId.trim()
    if (!trimmedWh) {
      setFormError('Warehouse ID is required before running native Databricks queries.')
      return
    }

    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      setFormError('Start date cannot be after end date.')
      return
    }

    const clampedLimit = Math.max(1, Math.min(500, limit))

    setFormError(null)
    setSelectedRow(null)
    startTransition(() => {
      setActiveFilters({
        warehouseId: trimmedWh,
        plantId: plantId.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: clampedLimit,
      })
    })
  }

  const handleReset = () => {
    setWarehouseId('')
    setPlantId('C061')
    setDateFrom('2026-01-01')
    setDateTo('2026-05-18')
    setLimit(100)
    setFormError(null)
    setSelectedRow(null)
  }

  const handleSetDemoValues = () => {
    setWarehouseId('WH001')
    setPlantId('C061')
    setDateFrom('2026-01-01')
    setDateTo('2026-05-18')
    setLimit(100)
    setFormError(null)
  }

  const handleCopyUrl = (type: string, path: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    const url = new URL(`${baseUrl}${path}`)
    url.searchParams.set('warehouse_id', activeFilters.warehouseId || '')
    if (activeFilters.plantId) url.searchParams.set('plant_id', activeFilters.plantId)
    if (activeFilters.dateFrom) url.searchParams.set('date_from', activeFilters.dateFrom)
    if (activeFilters.dateTo) url.searchParams.set('date_to', activeFilters.dateTo)
    url.searchParams.set('limit', String(activeFilters.limit ?? 100))

    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopiedUrlType(type)
      setTimeout(() => setCopiedUrlType(null), 2000)
    })
  }

  const getSeverityBadgeColor = (severity?: string | null) => {
    switch (severity) {
      case 'critical':
        return { bg: COLORS.dangerBg, text: COLORS.danger }
      case 'high':
        return { bg: '#ffedd5', text: COLORS.warning }
      case 'medium':
        return { bg: '#eff6ff', text: COLORS.info }
      default:
        return { bg: COLORS.slate100, text: COLORS.slate600 }
    }
  }

  const getStatusBadgeVariant = (status?: string | null): 'good' | 'warn' | 'bad' | 'info' | 'neutral' => {
    if (!status) return 'neutral'
    const low = status.toLowerCase()
    if (
      low.includes('completed') ||
      low.includes('received') ||
      low.includes('staged') ||
      low.includes('delivered')
    ) {
      return 'good'
    }
    if (
      low.includes('pending') ||
      low.includes('open') ||
      low.includes('inbound') ||
      low.includes('staging')
    ) {
      return 'info'
    }
    if (
      low.includes('overdue') ||
      low.includes('exception') ||
      low.includes('hold') ||
      low.includes('shortage')
    ) {
      return 'bad'
    }
    return 'neutral'
  }

  return (
    <div style={CONTAINER_STYLE}>
      {/* Premium Header / Status Banner */}
      <div style={BANNER_STYLE}>
        <div>
          <h1
            style={{ margin: '0 0 6px 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}
          >
            Warehouse360 Cockpit (Native)
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#93c5fd', fontWeight: 500 }}>
            Read-only direct operational views compiled against Unity Catalog views
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div
            style={{
              backgroundColor: sourceBadge.bg,
              color: sourceBadge.color,
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              boxShadow:
                displayedSource === 'databricks-api' ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: sourceBadge.color,
                display: 'inline-block',
              }}
            />
            {sourceBadge.text}
          </div>
          <span style={{ fontSize: 11, color: '#93c5fd', fontWeight: 500, textAlign: 'right' }}>
            UAT verification pending
          </span>
        </div>
      </div>

      {/* Technical Specifications Accordion */}
      <div style={{ ...CARD_STYLE, padding: 12 }}>
        <button
          onClick={() => setTechDetailsExpanded(!techDetailsExpanded)}
          style={{
            background: 'transparent',
            border: 'none',
            color: COLORS.primary,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            justifyContent: 'space-between',
            padding: 4,
          }}
        >
          <span>🛠️ Technical Specifications & Diagnostics</span>
          <span>{techDetailsExpanded ? '▲ Hide' : '▼ Show Details'}</span>
        </button>

        {techDetailsExpanded && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <VerificationStatusBanner
              title="Warehouse360 Integration Specifications"
              status="executable-pending-bv"
              sourceLabel="Databricks Unity Catalog wh360 Schema"
              routes={[
                'GET /api/warehouse360/overview',
                'GET /api/warehouse360/inbound',
                'GET /api/warehouse360/outbound',
                'GET /api/warehouse360/staging',
                'GET /api/warehouse360/exceptions',
              ]}
              sourceObjects={[
                'wh360_cockpit_summary_v',
                'wh360_inbound_v',
                'wh360_deliveries_v',
                'wh360_process_orders_v',
                'imwm_exceptions_v',
              ]}
              limitations={[
                'UAT verification pending',
                'No write-back or transactional executions allowed',
                'Read-only direct query mode against Unity Catalog views',
              ]}
              lastVerified="Pending"
            />

            {/* Safety Notice Warning */}
            <div
              style={{
                backgroundColor: '#eff6ff',
                borderLeft: `4px solid ${COLORS.info}`,
                borderRadius: 8,
                padding: 16,
                color: '#1e3a8a',
                fontSize: 13,
                fontWeight: 500,
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                ℹ️ Read-Only Operational Integrity Assurance
              </div>
              This panel operates entirely in <strong>read-only query mode</strong>. No transactions,
              postings, or inventory write-backs are possible. Dynamic filter variables are executed
              securely against configured source views: <code>wh360_cockpit_summary_v</code>,{' '}
              <code>wh360_inbound_v</code>, <code>wh360_deliveries_v</code>,{' '}
              <code>wh360_process_orders_v</code>, and <code>imwm_exceptions_v</code>.
            </div>
          </div>
        )}
      </div>

      {/* Filters Form Card */}
      <div style={CARD_STYLE}>
        <h3 style={{ margin: '0 0 16px 0', color: COLORS.slate800, fontSize: 16, fontWeight: 700 }}>
          Direct Warehouse Filters
        </h3>

        {formError && (
          <div
            style={{
              backgroundColor: COLORS.dangerBg,
              color: COLORS.danger,
              padding: '10px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            ⚠️ {formError}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
            alignItems: 'start',
            marginBottom: 16,
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.slate600,
                marginBottom: 6,
              }}
            >
              Warehouse ID <span style={{ color: COLORS.danger }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. WH001"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              style={INPUT_STYLE}
            />
            <span style={{ display: 'block', fontSize: 11, color: COLORS.slate600, marginTop: 4 }}>
              Filters lists in detailed tabs by Warehouse ID.
            </span>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.slate600,
                marginBottom: 6,
              }}
            >
              Plant ID (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. C061"
              value={plantId}
              onChange={(e) => setPlantId(e.target.value)}
              style={INPUT_STYLE}
            />
            <span style={{ display: 'block', fontSize: 11, color: COLORS.slate600, marginTop: 4 }}>
              Filters query results by Plant context if provided.
            </span>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.slate600,
                marginBottom: 6,
              }}
            >
              Date From (Optional)
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={INPUT_STYLE}
            />
            <span style={{ display: 'block', fontSize: 11, color: COLORS.slate600, marginTop: 4 }}>
              Limits records from this start date.
            </span>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.slate600,
                marginBottom: 6,
              }}
            >
              Date To (Optional)
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={INPUT_STYLE}
            />
            <span style={{ display: 'block', fontSize: 11, color: COLORS.slate600, marginTop: 4 }}>
              Limits records up to this end date.
            </span>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.slate600,
                marginBottom: 6,
              }}
            >
              Max Limit (1..500)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="range"
                min="1"
                max="500"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                style={{ flex: 1, accentColor: COLORS.primary }}
              />
              <input
                type="number"
                min="1"
                max="500"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                style={{ ...INPUT_STYLE, width: 65, textAlign: 'center', padding: '6px 4px' }}
              />
            </div>
            <span style={{ display: 'block', fontSize: 11, color: COLORS.slate600, marginTop: 4 }}>
              Max rows fetched per query (1 to 500).
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: `1px solid ${COLORS.slate100}`,
            paddingTop: 16,
          }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleRun}
              style={{
                ...BUTTON_STYLE,
                backgroundColor: COLORS.primary,
                color: '#ffffff',
                boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = COLORS.primaryHover)}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = COLORS.primary)}
            >
              🔄 Run Cockpit Queries
            </button>
            <button
              onClick={handleReset}
              style={{
                ...BUTTON_STYLE,
                backgroundColor: 'transparent',
                border: `1px solid ${COLORS.slate400}`,
                color: COLORS.slate600,
              }}
            >
              Reset
            </button>
          </div>
          <div>
            {!warehouseId && (
              <button
                onClick={handleSetDemoValues}
                style={{
                  ...BUTTON_STYLE,
                  backgroundColor: COLORS.indigoBg,
                  color: COLORS.indigoText,
                  padding: '6px 12px',
                  fontSize: 12,
                  borderRadius: 20,
                }}
              >
                💡 Load demo presets for offline testing
              </button>
            )}
            {warehouseId && (
              <span style={{ fontSize: 12, color: COLORS.slate600, fontWeight: 500 }}>
                Active Wh ID:{' '}
                <strong style={{ color: COLORS.slate800 }}>
                  {activeFilters.warehouseId || 'None'}
                </strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {!isQueryEnabled ? (
        // Blank Welcome Banner
        <div
          style={{
            ...CARD_STYLE,
            textAlign: 'center',
            padding: '64px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <span style={{ fontSize: 48 }}>🏭</span>
          <h2 style={{ margin: 0, color: COLORS.slate800, fontSize: 20, fontWeight: 700 }}>
            Enter a Warehouse ID to Begin Queries
          </h2>
          <p
            style={{
              margin: 0,
              color: COLORS.slate600,
              fontSize: 14,
              maxWidth: 500,
              lineHeight: 1.5,
            }}
          >
            To verify native Databricks connectivity in UAT, supply a valid, known warehouse ID
            (e.g. <code>WH001</code>) and click <strong>Run Cockpit Queries</strong>. All views will
            execute concurrently against your authenticated end-user OAuth token context.
          </p>
          <button
            onClick={handleSetDemoValues}
            style={{
              ...BUTTON_STYLE,
              backgroundColor: COLORS.indigoBg,
              color: COLORS.indigoText,
              boxShadow: 'none',
            }}
          >
            Or, Click here to auto-fill mock demo values
          </button>
        </div>
      ) : (
        <>
          {/* Overview KPI Info Banner */}
          <div
            style={{
              backgroundColor: '#fffbeb',
              borderLeft: `4px solid ${COLORS.warning}`,
              borderRadius: 8,
              padding: '12px 16px',
              color: '#78350f',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 16,
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            }}
          >
            <strong>⚠️ Global Metrics Notice:</strong> Overview KPIs are site-level and are not
            filtered by warehouse. Detailed lists in the tabs below are filtered by the active
            Warehouse ID.
          </div>

          {/* Overview Metrics Dashboard Card */}
          <div style={GRID_STATS_STYLE}>
            {/* Metric 1 */}
            <div style={CARD_STYLE}>
              <div
                style={{ fontSize: 12, fontWeight: 600, color: COLORS.slate600, marginBottom: 8 }}
              >
                INBOUND OPERATIONS
              </div>
              {overviewQuery.isLoading ? (
                <div style={{ fontSize: 16, color: COLORS.slate400 }}>Loading overview...</div>
              ) : overviewQuery.data?.ok ? (
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.slate800 }}>
                    {overviewQuery.data.data.inboundDueCount}
                  </div>
                  <div
                    style={{ fontSize: 12, color: COLORS.danger, fontWeight: 600, marginTop: 4 }}
                  >
                    ⚠️ {overviewQuery.data.data.inboundOverdueCount} Overdue items
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: COLORS.slate600 }}>Overview unavailable</div>
              )}
            </div>

            {/* Metric 2 */}
            <div style={CARD_STYLE}>
              <div
                style={{ fontSize: 12, fontWeight: 600, color: COLORS.slate600, marginBottom: 8 }}
              >
                OUTBOUND SHIPMENTS
              </div>
              {overviewQuery.isLoading ? (
                <div style={{ fontSize: 16, color: COLORS.slate400 }}>Loading overview...</div>
              ) : overviewQuery.data?.ok ? (
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.slate800 }}>
                    {overviewQuery.data.data.outboundDueCount}
                  </div>
                  <div
                    style={{ fontSize: 12, color: COLORS.danger, fontWeight: 600, marginTop: 4 }}
                  >
                    ⚠️ {overviewQuery.data.data.outboundOverdueCount} Overdue items
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: COLORS.slate600 }}>Overview unavailable</div>
              )}
            </div>

            {/* Metric 3 */}
            <div style={CARD_STYLE}>
              <div
                style={{ fontSize: 12, fontWeight: 600, color: COLORS.slate600, marginBottom: 8 }}
              >
                PRODUCTION STAGING
              </div>
              {overviewQuery.isLoading ? (
                <div style={{ fontSize: 16, color: COLORS.slate400 }}>Loading overview...</div>
              ) : overviewQuery.data?.ok ? (
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.slate800 }}>
                    {overviewQuery.data.data.stagingOpenCount}
                  </div>
                  <div
                    style={{ fontSize: 12, color: COLORS.warning, fontWeight: 600, marginTop: 4 }}
                  >
                    ⚠️ {overviewQuery.data.data.stagingOverdueCount} Overdue items
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: COLORS.slate600 }}>Overview unavailable</div>
              )}
            </div>

            {/* Metric 4 — BLOCKED: nearExpiryCount and reconciliationExceptionCount require governance (Gates 4 & 5) */}
            <div
              style={{
                ...CARD_STYLE,
                borderLeft: `4px solid var(--status-warn)`,
                background: '#fffbeb',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.slate600 }}>
                EXCEPTIONS & INVENTORY STATUS
              </div>
              <div>
                <GovernancePendingBadge reason="Gates 4 and 5 remain blocked for UAT" />
              </div>
              <EvidenceCaveatList
                caveats={[
                  'nearExpiryCount requires governed thresholds and inclusion rules.',
                  'reconciliationExceptionCount requires source owner acceptance.',
                ]}
              />
              <div style={{ fontSize: 11, color: COLORS.slate600 }}>
                Drill-through evidence (inbound, staging, exceptions) is accessible below.
              </div>
            </div>
          </div>

          {/* Workload Stats Card derived from loaded rows */}
          <div
            style={{
              ...CARD_STYLE,
              backgroundColor: '#faf5ff',
              border: '1px solid #f3e8ff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              <h4 style={{ margin: '0 0 4px 0', color: '#581c87', fontSize: 14, fontWeight: 700 }}>
                📊 Active Screen Workload Summary
              </h4>
              <p style={{ margin: 0, color: '#7e22ce', fontSize: 12, fontWeight: 500 }}>
                Derived in real-time from the arrays of raw rows returned above.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: '#581c87' }}>
                  {totalWorkloadEstimate}
                </span>
                <span style={{ fontSize: 11, color: '#7e22ce', fontWeight: 600 }}>Open Rows</span>
              </div>
              <div
                style={{ borderLeft: '1px solid #e9d5ff', paddingLeft: 24, textAlign: 'center' }}
              >
                <span
                  style={{ display: 'block', fontSize: 20, fontWeight: 800, color: COLORS.danger }}
                >
                  {criticalExceptionCount}
                </span>
                <span style={{ fontSize: 11, color: COLORS.danger, fontWeight: 600 }}>
                  Critical exceptions
                </span>
              </div>
              <div
                style={{ borderLeft: '1px solid #e9d5ff', paddingLeft: 24, textAlign: 'center' }}
              >
                <span
                  style={{ display: 'block', fontSize: 20, fontWeight: 800, color: COLORS.success }}
                >
                  {totalExceptionCount}
                </span>
                <span style={{ fontSize: 11, color: COLORS.success, fontWeight: 600 }}>
                  Alert Items
                </span>
              </div>
            </div>
          </div>

          {/* Core Tables Switcher & Detailed Panel Layout */}
          <div style={{ display: 'flex', gap: 16, flexDirection: 'column' }}>
            <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
              {/* Tab headers switcher */}
              <div
                style={{
                  display: 'flex',
                  borderBottom: `1px solid ${COLORS.slate100}`,
                  backgroundColor: '#ffffff',
                  padding: '0 16px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  onClick={() => setActiveTab('inbound')}
                  style={TAB_STYLE(activeTab === 'inbound')}
                >
                  📥 Inbound Receipts ({inboundQuery.isLoading ? '...' : totalInboundCount})
                </button>
                <button
                  onClick={() => setActiveTab('outbound')}
                  style={TAB_STYLE(activeTab === 'outbound')}
                >
                  📤 Outbound Deliveries ({outboundQuery.isLoading ? '...' : totalOutboundCount})
                </button>
                <button
                  onClick={() => setActiveTab('staging')}
                  style={TAB_STYLE(activeTab === 'staging')}
                >
                  🚀 Production Staging ({stagingQuery.isLoading ? '...' : totalStagingCount})
                </button>
                <button
                  onClick={() => setActiveTab('exceptions')}
                  style={TAB_STYLE(activeTab === 'exceptions')}
                >
                  🚨 Exceptions & Alerts ({exceptionsQuery.isLoading ? '...' : totalExceptionCount})
                </button>
              </div>

              {/* Inbound Table */}
              {activeTab === 'inbound' && (
                <div style={{ padding: 16, overflowX: 'auto' }}>
                  {inboundQuery.isLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: COLORS.slate600 }}>
                      🌀 Loading Inbound Receipts from Databricks...
                    </div>
                  ) : inboundQuery.data?.ok === false ? (
                    <div
                      style={{
                        backgroundColor: COLORS.dangerBg,
                        color: COLORS.danger,
                        padding: 16,
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      ❌ Inbound query failed: {inboundQuery.data.error.message}
                      <div style={{ fontSize: 12, marginTop: 6, fontWeight: 400 }}>
                        Please verify the Warehouse ID exists, confirm your OAuth credentials are
                        valid, or check network connectivity.
                      </div>
                    </div>
                  ) : inboundData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: COLORS.slate600 }}>
                      ℹ️ No inbound receipts found for Warehouse ID{' '}
                      <strong>"{activeFilters.warehouseId}"</strong>.
                      <div style={{ fontSize: 12, marginTop: 4, color: COLORS.slate400 }}>
                        If this is unexpected, verify the Warehouse ID exists and that there are
                        active Inbound POs/STOs scheduled.
                      </div>
                    </div>
                  ) : (
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 13,
                        textAlign: 'left',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: `2px solid ${COLORS.slate100}`,
                            color: COLORS.slate600,
                            fontWeight: 700,
                          }}
                        >
                          <th style={{ padding: '10px 8px' }}>Doc Type</th>
                          <th style={{ padding: '10px 8px' }}>PO / STO ID</th>
                          <th style={{ padding: '10px 8px' }}>Item</th>
                          <th style={{ padding: '10px 8px' }}>Material</th>
                          <th style={{ padding: '10px 8px' }}>Vendor / Supplying Plant</th>
                          <th style={{ padding: '10px 8px' }}>Expected Date</th>
                          <th style={{ padding: '10px 8px' }}>Qty / UOM</th>
                          <th style={{ padding: '10px 8px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inboundData.map((row, idx) => {
                          const statusVariant = getStatusBadgeVariant(row.status)
                          const docId =
                            row.documentType === 'STO'
                              ? row.stockTransportOrderId
                              : row.purchaseOrderId
                          return (
                            <tr
                              key={idx}
                              onClick={() =>
                                setSelectedRow({
                                  type: 'inbound',
                                  data: row as unknown as Record<string, unknown>,
                                })
                              }
                              style={{
                                borderBottom: `1px solid ${COLORS.slate100}`,
                                cursor: 'pointer',
                                transition: 'background-color 0.15s',
                                backgroundColor:
                                  selectedRow?.type === 'inbound' &&
                                  selectedRow.data.purchaseOrderId === row.purchaseOrderId &&
                                  selectedRow.data.itemId === row.itemId
                                    ? '#f5f3ff'
                                    : 'transparent',
                              }}
                              onMouseOver={(e) =>
                                (e.currentTarget.style.backgroundColor = '#f8fafc')
                              }
                              onMouseOut={(e) => {
                                const isSelected =
                                  selectedRow?.type === 'inbound' &&
                                  selectedRow.data.purchaseOrderId === row.purchaseOrderId &&
                                  selectedRow.data.itemId === row.itemId
                                e.currentTarget.style.backgroundColor = isSelected
                                  ? '#f5f3ff'
                                  : 'transparent'
                              }}
                            >
                              <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                                {row.documentType}
                              </td>
                              <td
                                style={{
                                  padding: '12px 8px',
                                  fontFamily: 'monospace',
                                  fontWeight: 600,
                                }}
                              >
                                {docId || '—'}
                              </td>
                              <td style={{ padding: '12px 8px' }}>{row.itemId || '—'}</td>
                              <td style={{ padding: '12px 8px' }}>
                                <div style={{ fontWeight: 600 }}>{row.materialId}</div>
                                <div style={{ fontSize: 11, color: COLORS.slate600 }}>
                                  {row.materialDescription || '—'}
                                </div>
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                {row.vendorId || row.supplyingPlantId || '—'}
                              </td>
                              <td style={{ padding: '12px 8px' }}>{row.expectedDate || '—'}</td>
                              <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                                {row.quantity} {row.unitOfMeasure}
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                <StatusBadge label={row.status || '—'} variant={statusVariant} />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Outbound Table */}
              {activeTab === 'outbound' && (
                <div style={{ padding: 16, overflowX: 'auto' }}>
                  {outboundQuery.isLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: COLORS.slate600 }}>
                      🌀 Loading Outbound Shipments from Databricks...
                    </div>
                  ) : outboundQuery.data?.ok === false ? (
                    <div
                      style={{
                        backgroundColor: COLORS.dangerBg,
                        color: COLORS.danger,
                        padding: 16,
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      ❌ Outbound query failed: {outboundQuery.data.error.message}
                      <div style={{ fontSize: 12, marginTop: 6, fontWeight: 400 }}>
                        Please verify the Warehouse ID exists, confirm your OAuth credentials are
                        valid, or check network connectivity.
                      </div>
                    </div>
                  ) : outboundData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: COLORS.slate600 }}>
                      ℹ️ No outbound deliveries found for Warehouse ID{' '}
                      <strong>"{activeFilters.warehouseId}"</strong>.
                      <div style={{ fontSize: 12, marginTop: 4, color: COLORS.slate400 }}>
                        If this is unexpected, verify the Warehouse ID exists and that there are
                        active Outbound Deliveries planned.
                      </div>
                    </div>
                  ) : (
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 13,
                        textAlign: 'left',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: `2px solid ${COLORS.slate100}`,
                            color: COLORS.slate600,
                            fontWeight: 700,
                          }}
                        >
                          <th style={{ padding: '10px 8px' }}>Delivery ID</th>
                          <th style={{ padding: '10px 8px' }}>Item</th>
                          <th style={{ padding: '10px 8px' }}>Sales Order</th>
                          <th style={{ padding: '10px 8px' }}>Material</th>
                          <th style={{ padding: '10px 8px' }}>Customer ID</th>
                          <th style={{ padding: '10px 8px' }}>Planned GI Date</th>
                          <th style={{ padding: '10px 8px' }}>Qty / UOM</th>
                          <th style={{ padding: '10px 8px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outboundData.map((row, idx) => {
                          const statusVariant = getStatusBadgeVariant(row.status)
                          return (
                            <tr
                              key={idx}
                              onClick={() =>
                                setSelectedRow({
                                  type: 'outbound',
                                  data: row as unknown as Record<string, unknown>,
                                })
                              }
                              style={{
                                borderBottom: `1px solid ${COLORS.slate100}`,
                                cursor: 'pointer',
                                transition: 'background-color 0.15s',
                                backgroundColor:
                                  selectedRow?.type === 'outbound' &&
                                  selectedRow.data.deliveryId === row.deliveryId &&
                                  selectedRow.data.deliveryItemId === row.deliveryItemId
                                    ? '#f5f3ff'
                                    : 'transparent',
                              }}
                              onMouseOver={(e) =>
                                (e.currentTarget.style.backgroundColor = '#f8fafc')
                              }
                              onMouseOut={(e) => {
                                const isSelected =
                                  selectedRow?.type === 'outbound' &&
                                  selectedRow.data.deliveryId === row.deliveryId &&
                                  selectedRow.data.deliveryItemId === row.deliveryItemId
                                e.currentTarget.style.backgroundColor = isSelected
                                  ? '#f5f3ff'
                                  : 'transparent'
                              }}
                            >
                              <td
                                style={{
                                  padding: '12px 8px',
                                  fontFamily: 'monospace',
                                  fontWeight: 600,
                                }}
                              >
                                {row.deliveryId}
                              </td>
                              <td style={{ padding: '12px 8px' }}>{row.deliveryItemId || '—'}</td>
                              <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>
                                {row.salesOrderId || '—'}
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                <div style={{ fontWeight: 600 }}>{row.materialId}</div>
                                <div style={{ fontSize: 11, color: COLORS.slate600 }}>
                                  {row.materialDescription || '—'}
                                </div>
                              </td>
                              <td style={{ padding: '12px 8px' }}>{row.customerId || '—'}</td>
                              <td style={{ padding: '12px 8px' }}>
                                {row.plannedGoodsIssueDate || '—'}
                              </td>
                              <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                                {row.quantity} {row.unitOfMeasure}
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                <StatusBadge label={row.status || '—'} variant={statusVariant} />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Production Staging Table */}
              {activeTab === 'staging' && (
                <div style={{ padding: 16, overflowX: 'auto' }}>
                  {stagingQuery.isLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: COLORS.slate600 }}>
                      🌀 Loading Production Staging from Databricks...
                    </div>
                  ) : stagingQuery.data?.ok === false ? (
                    <div
                      style={{
                        backgroundColor: COLORS.dangerBg,
                        color: COLORS.danger,
                        padding: 16,
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      ❌ Staging query failed: {stagingQuery.data.error.message}
                      <div style={{ fontSize: 12, marginTop: 6, fontWeight: 400 }}>
                        Please verify the Warehouse ID exists, confirm your OAuth credentials are
                        valid, or check network connectivity.
                      </div>
                    </div>
                  ) : stagingData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: COLORS.slate600 }}>
                      ℹ️ No production staging items found for Warehouse ID{' '}
                      <strong>"{activeFilters.warehouseId}"</strong>.
                      <div style={{ fontSize: 12, marginTop: 4, color: COLORS.slate400 }}>
                        If this is unexpected, verify the Warehouse ID exists and that there are
                        active process orders scheduled.
                      </div>
                    </div>
                  ) : (
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 13,
                        textAlign: 'left',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: `2px solid ${COLORS.slate100}`,
                            color: COLORS.slate600,
                            fontWeight: 700,
                          }}
                        >
                          <th style={{ padding: '10px 8px' }}>Process Order ID</th>
                          <th style={{ padding: '10px 8px' }}>Reservation</th>
                          <th style={{ padding: '10px 8px' }}>Material</th>
                          <th style={{ padding: '10px 8px' }}>Req Date</th>
                          <th style={{ padding: '10px 8px' }}>Required Qty</th>
                          <th style={{ padding: '10px 8px' }}>Staged Qty</th>
                          <th style={{ padding: '10px 8px' }}>Open Qty</th>
                          <th style={{ padding: '10px 8px' }}>Staging Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stagingData.map((row, idx) => {
                          const statusVariant = getStatusBadgeVariant(row.stagingStatus)
                          return (
                            <tr
                              key={idx}
                              onClick={() =>
                                setSelectedRow({
                                  type: 'staging',
                                  data: row as unknown as Record<string, unknown>,
                                })
                              }
                              style={{
                                borderBottom: `1px solid ${COLORS.slate100}`,
                                cursor: 'pointer',
                                transition: 'background-color 0.15s',
                                backgroundColor:
                                  selectedRow?.type === 'staging' &&
                                  selectedRow.data.processOrderId === row.processOrderId &&
                                  selectedRow.data.reservationItemId === row.reservationItemId
                                    ? '#f5f3ff'
                                    : 'transparent',
                              }}
                              onMouseOver={(e) =>
                                (e.currentTarget.style.backgroundColor = '#f8fafc')
                              }
                              onMouseOut={(e) => {
                                const isSelected =
                                  selectedRow?.type === 'staging' &&
                                  selectedRow.data.processOrderId === row.processOrderId &&
                                  selectedRow.data.reservationItemId === row.reservationItemId
                                e.currentTarget.style.backgroundColor = isSelected
                                  ? '#f5f3ff'
                                  : 'transparent'
                              }}
                            >
                              <td
                                style={{
                                  padding: '12px 8px',
                                  fontFamily: 'monospace',
                                  fontWeight: 600,
                                }}
                              >
                                {row.processOrderId}
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                {row.reservationId}-{row.reservationItemId}
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                <div style={{ fontWeight: 600 }}>{row.materialId}</div>
                                <div style={{ fontSize: 11, color: COLORS.slate600 }}>
                                  {row.materialDescription || '—'}
                                </div>
                              </td>
                              <td style={{ padding: '12px 8px' }}>{row.requirementDate || '—'}</td>
                              <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                                {row.requiredQuantity} {row.unitOfMeasure}
                              </td>
                              <td
                                style={{
                                  padding: '12px 8px',
                                  color: COLORS.success,
                                  fontWeight: 600,
                                }}
                              >
                                {row.stagedQuantity} {row.unitOfMeasure}
                              </td>
                              <td
                                style={{
                                  padding: '12px 8px',
                                  color:
                                    row.openQuantity && row.openQuantity > 0
                                      ? COLORS.danger
                                      : COLORS.slate600,
                                  fontWeight: 600,
                                }}
                              >
                                {row.openQuantity} {row.unitOfMeasure}
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                <StatusBadge label={row.stagingStatus || '—'} variant={statusVariant} />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Exception Items Table */}
              {activeTab === 'exceptions' && (
                <div style={{ padding: 16, overflowX: 'auto' }}>
                  {exceptionsQuery.isLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: COLORS.slate600 }}>
                      🌀 Loading Exception Items from Databricks...
                    </div>
                  ) : exceptionsQuery.data?.ok === false ? (
                    <div
                      style={{
                        backgroundColor: COLORS.dangerBg,
                        color: COLORS.danger,
                        padding: 16,
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      ❌ Exception query failed: {exceptionsQuery.data.error.message}
                      <div style={{ fontSize: 12, marginTop: 6, fontWeight: 400 }}>
                        Please verify the Warehouse ID exists, confirm your OAuth credentials are
                        valid, or check network connectivity.
                      </div>
                    </div>
                  ) : exceptionsData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: COLORS.slate600 }}>
                      ℹ️ No exception records were returned for this Warehouse ID{' '}
                      <strong>"{activeFilters.warehouseId}"</strong>.
                      <div style={{ fontSize: 12, marginTop: 4, color: COLORS.slate400 }}>
                        If this is unexpected, verify the warehouse, source coverage, and exception
                        extraction logic before assuming there are no issues.
                      </div>
                    </div>
                  ) : (
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 13,
                        textAlign: 'left',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: `2px solid ${COLORS.slate100}`,
                            color: COLORS.slate600,
                            fontWeight: 700,
                          }}
                        >
                          <th style={{ padding: '10px 8px' }}>Severity</th>
                          <th style={{ padding: '10px 8px' }}>Exception Type</th>
                          <th style={{ padding: '10px 8px' }}>Material</th>
                          <th style={{ padding: '10px 8px' }}>Batch</th>
                          <th style={{ padding: '10px 8px' }}>Qty</th>
                          <th style={{ padding: '10px 8px' }}>Expiry Date</th>
                          <th style={{ padding: '10px 8px' }}>Ref Doc</th>
                          <th style={{ padding: '10px 8px' }}>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exceptionsData.map((row, idx) => {
                          const statusVariant: 'good' | 'warn' | 'bad' | 'info' | 'neutral' =
                            row.severity === 'critical' || row.severity === 'high'
                              ? 'bad'
                              : row.severity === 'medium'
                                ? 'warn'
                                : 'info'
                          return (
                            <tr
                              key={idx}
                              onClick={() =>
                                setSelectedRow({
                                  type: 'exceptions',
                                  data: row as unknown as Record<string, unknown>,
                                })
                              }
                              style={{
                                borderBottom: `1px solid ${COLORS.slate100}`,
                                cursor: 'pointer',
                                transition: 'background-color 0.15s',
                                backgroundColor:
                                  selectedRow?.type === 'exceptions' &&
                                  selectedRow.data.materialId === row.materialId &&
                                  selectedRow.data.batchId === row.batchId &&
                                  selectedRow.data.exceptionType === row.exceptionType
                                    ? '#f5f3ff'
                                    : 'transparent',
                              }}
                              onMouseOver={(e) =>
                                (e.currentTarget.style.backgroundColor = '#f8fafc')
                              }
                              onMouseOut={(e) => {
                                const isSelected =
                                  selectedRow?.type === 'exceptions' &&
                                  selectedRow.data.materialId === row.materialId &&
                                  selectedRow.data.batchId === row.batchId &&
                                  selectedRow.data.exceptionType === row.exceptionType
                                e.currentTarget.style.backgroundColor = isSelected
                                  ? '#f5f3ff'
                                  : 'transparent'
                              }}
                            >
                              <td style={{ padding: '12px 8px' }}>
                                <StatusBadge
                                  label={row.severity ? row.severity.toUpperCase() : '—'}
                                  variant={statusVariant}
                                />
                              </td>
                              <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                                {row.exceptionType || '—'}
                              </td>
                              <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                                {row.materialId}
                              </td>
                              <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>
                                {row.batchId || '—'}
                              </td>
                              <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                                {row.quantity} {row.unitOfMeasure}
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                <div>{row.expiryDate || '—'}</div>
                                {row.daysToExpiry !== null && row.daysToExpiry !== undefined && (
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color:
                                        row.daysToExpiry <= 0 ? COLORS.danger : COLORS.slate600,
                                    }}
                                  >
                                    ({row.daysToExpiry} days left)
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>
                                {row.documentId ||
                                  row.processOrderId ||
                                  row.deliveryId ||
                                  row.purchaseOrderId ||
                                  '—'}
                              </td>
                              <td style={{ padding: '12px 8px', color: COLORS.slate600 }}>
                                {row.reason || '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Row Detail Inspector Card */}
            {selectedRow && (
              <div style={ROW_DETAIL_STYLE}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                    borderBottom: `1px solid ${COLORS.slate100}`,
                    paddingBottom: 10,
                  }}
                >
                  <h4 style={{ margin: 0, color: COLORS.slate800, fontSize: 15, fontWeight: 700 }}>
                    🔍 Selected Item Inspector Details
                  </h4>
                  <button
                    onClick={() => setSelectedRow(null)}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: COLORS.slate600,
                      cursor: 'pointer',
                      fontSize: 16,
                    }}
                  >
                    ✕ Close
                  </button>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '0 24px',
                  }}
                >
                  <DetailRow label="Source Entity Context" value={selectedRow.type.toUpperCase()} />
                  {Object.entries(selectedRow.data).map(([key, val]) => (
                    <DetailRow key={key} label={key} value={val as string | number | null} />
                  ))}
                </div>

                {selectedRow.type === 'exceptions' && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 12,
                      backgroundColor: '#fffbeb',
                      borderRadius: 6,
                      borderLeft: `3px solid ${COLORS.warning}`,
                      fontSize: 12,
                      color: '#78350f',
                    }}
                  >
                    <strong>💡 Exception Diagnostic & Review Guidance:</strong>
                    <div style={{ marginTop: 4, lineHeight: 1.4 }}>
                      {String(selectedRow.data.exceptionType || '')
                        .toLowerCase()
                        .includes('shortage') ||
                      String(selectedRow.data.description || '')
                        .toLowerCase()
                        .includes('mismatch') ||
                      String(selectedRow.data.reason || '')
                        .toLowerCase()
                        .includes('mismatch') ? (
                        <>
                          A quantity mismatch indicates IM (Inventory Management) and WM (Warehouse
                          Management) discrepancies. <strong>Review Guidance:</strong> Review IM/WM
                          reconciliation using appropriate SAP warehouse transactions and confirm
                          physical/bin status before posting corrections.
                        </>
                      ) : String(selectedRow.data.exceptionType || '')
                          .toLowerCase()
                          .includes('expiry') ||
                        String(selectedRow.data.reason || '')
                          .toLowerCase()
                          .includes('expiry') ||
                        Number(selectedRow.data.daysToExpiry) <= 30 ? (
                        <>
                          Batch is close to or past expiration date.{' '}
                          <strong>Review Guidance:</strong> Review batch status and escalate to
                          QA/QM for block, retest, or disposal decision if required.
                        </>
                      ) : String(selectedRow.data.exceptionType || '')
                          .toLowerCase()
                          .includes('hold') ||
                        String(selectedRow.data.reason || '')
                          .toLowerCase()
                          .includes('hold') ? (
                        <>
                          This batch is currently under an active quality or warehouse hold.{' '}
                          <strong>Review Guidance:</strong> Review the block reason and release
                          authority in the Quality Batch Release workspace before moving or
                          releasing stock.
                        </>
                      ) : (
                        <>
                          General warehouse exception detected. <strong>Review Guidance:</strong>{' '}
                          Review bin assignment history, physical counts, and storage unit status in
                          SAP before making corrections.
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Technical Diagnostics Collapsible Section */}
          <div style={CARD_STYLE}>
            <div
              onClick={() => setTechDetailsExpanded(!techDetailsExpanded)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <h4 style={{ margin: 0, color: COLORS.slate800, fontSize: 14, fontWeight: 700 }}>
                🔧 Developer Diagnostic Technical Logs
              </h4>
              <span
                style={{
                  fontSize: 14,
                  transform: techDetailsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                ▶
              </span>
            </div>

            {techDetailsExpanded && (
              <div
                style={{
                  marginTop: 16,
                  borderTop: `1px solid ${COLORS.slate100}`,
                  paddingTop: 16,
                  fontSize: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <div>
                  <strong style={{ display: 'block', color: COLORS.slate800, marginBottom: 6 }}>
                    Committed Request Filter Payload:
                  </strong>
                  <pre
                    style={{
                      backgroundColor: COLORS.slate100,
                      padding: 12,
                      borderRadius: 6,
                      margin: 0,
                      fontFamily: 'monospace',
                      overflowX: 'auto',
                    }}
                  >
                    {JSON.stringify(activeFilters, null, 2)}
                  </pre>
                </div>

                <div>
                  <strong style={{ display: 'block', color: COLORS.slate800, marginBottom: 8 }}>
                    Generated Endpoint Route Handlers & Mock Diagnostics:
                  </strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      {
                        type: 'Overview',
                        path: '/api/warehouse360/overview',
                        query: overviewQuery,
                      },
                      { type: 'Inbound', path: '/api/warehouse360/inbound', query: inboundQuery },
                      {
                        type: 'Outbound',
                        path: '/api/warehouse360/outbound',
                        query: outboundQuery,
                      },
                      { type: 'Staging', path: '/api/warehouse360/staging', query: stagingQuery },
                      {
                        type: 'Exceptions',
                        path: '/api/warehouse360/exceptions',
                        query: exceptionsQuery,
                      },
                    ].map((endpoint, idx) => {
                      const isSuccess = endpoint.query.data?.ok === true
                      const source = endpoint.query.data?.source

                      return (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: '#ffffff',
                            border: `1px solid ${COLORS.slate100}`,
                            borderRadius: 6,
                            padding: 12,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 12,
                          }}
                        >
                          <div>
                            <span
                              style={{ fontWeight: 700, color: COLORS.slate800, marginRight: 8 }}
                            >
                              {endpoint.type}:
                            </span>
                            <code
                              style={{
                                backgroundColor: COLORS.slate100,
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontFamily: 'monospace',
                              }}
                            >
                              {endpoint.path}
                            </code>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button
                              onClick={() => handleCopyUrl(endpoint.type, endpoint.path)}
                              style={{
                                padding: '4px 8px',
                                border: `1px solid ${COLORS.slate400}`,
                                borderRadius: 4,
                                backgroundColor: '#ffffff',
                                cursor: 'pointer',
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                            >
                              {copiedUrlType === endpoint.type ? '✅ Copied!' : '📋 Copy URL'}
                            </button>
                            <span
                              style={{
                                backgroundColor: endpoint.query.isLoading
                                  ? COLORS.slate100
                                  : isSuccess
                                    ? '#d1fae5'
                                    : COLORS.dangerBg,
                                color: endpoint.query.isLoading
                                  ? COLORS.slate600
                                  : isSuccess
                                    ? COLORS.success
                                    : COLORS.danger,
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontWeight: 700,
                                fontSize: 10,
                              }}
                            >
                              {endpoint.query.isLoading
                                ? 'PENDING'
                                : isSuccess
                                  ? `SUCCESS (${source})`
                                  : 'FAILED'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{ borderTop: `1px solid ${COLORS.slate100}`, paddingTop: 12 }}>
                  <span style={{ color: COLORS.slate600, display: 'block', marginBottom: 4 }}>
                    Last Sync Run Clock:
                  </span>
                  <span style={{ color: COLORS.slate800, fontWeight: 600 }}>
                    {overviewQuery.data && overviewQuery.data.ok
                      ? new Date(overviewQuery.data.fetchedAt).toLocaleString()
                      : 'Never'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
