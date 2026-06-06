import * as React from 'react'

export type VerificationStatus =
  | 'native-live'
  | 'executable-pending-bv'
  | 'partial-native'
  | 'mock-demo'
  | 'source-blocked'
  | 'error'

export interface VerificationStatusBannerProps {
  title: string
  status: VerificationStatus
  sourceLabel?: string
  routes?: string[]
  sourceObjects?: string[]
  limitations?: string[]
  lastVerified?: string
  commitSha?: string
  compact?: boolean
}

const statusConfig: Record<
  VerificationStatus,
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  'native-live': {
    label: 'NATIVE LIVE',
    color: '#34D399',
    bg: 'rgba(16, 185, 129, 0.06)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    icon: '✅',
  },
  'executable-pending-bv': {
    label: 'EXECUTABLE · PENDING BROWSER VERIFICATION',
    color: '#FBBF24',
    bg: 'rgba(245, 158, 11, 0.06)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    icon: '⚡',
  },
  'partial-native': {
    label: 'PARTIAL NATIVE',
    color: '#A78BFA',
    bg: 'rgba(139, 92, 246, 0.06)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    icon: '🧩',
  },
  'mock-demo': {
    label: 'SANDBOX / DEMO ONLY',
    color: '#F87171',
    bg: 'rgba(239, 68, 68, 0.06)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    icon: '🧪',
  },
  'source-blocked': {
    label: 'SOURCE BLOCKED',
    color: '#9CA3AF',
    bg: 'rgba(156, 163, 175, 0.06)',
    border: '1px solid rgba(156, 163, 175, 0.2)',
    icon: '🔒',
  },
  error: {
    label: 'ERROR',
    color: '#F87171',
    bg: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid #EF4444',
    icon: '❌',
  },
}

export function VerificationStatusBanner({
  title,
  status,
  sourceLabel,
  routes = [],
  sourceObjects = [],
  limitations = [],
  lastVerified,
  commitSha,
  compact = false,
}: VerificationStatusBannerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const config = statusConfig[status]

  return (
    <div
      style={{
        background: config.bg,
        border: config.border,
        borderRadius: 8,
        padding: compact ? '10px 14px' : '14px 18px',
        marginBottom: 16,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>{config.icon}</span>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: compact ? 13 : 15,
                fontWeight: 600,
                color: '#FFFFFF',
                lineHeight: 1.2,
              }}
            >
              {title}
            </h2>
            {sourceLabel && (
              <span
                style={{
                  fontSize: 11,
                  color: '#9CA3AF',
                  marginTop: 2,
                  display: 'inline-block',
                }}
              >
                Source: <span style={{ color: '#E5E7EB' }}>{sourceLabel}</span>
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: config.color,
              background: 'rgba(0, 0, 0, 0.2)',
              border: `1px solid ${config.color}33`,
              padding: '4px 10px',
              borderRadius: 4,
              letterSpacing: '0.05em',
            }}
          >
            {config.label}
          </span>

          {!compact && (routes.length > 0 || sourceObjects.length > 0 || limitations.length > 0) && (
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-expanded={isOpen}
              aria-controls="specs-drawer"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {isOpen ? 'Hide Specs ▲' : 'Show Specs ▼'}
            </button>
          )}
        </div>
      </div>

      {isOpen && !compact && (
        <div
          id="specs-drawer"
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {routes.length > 0 && (
            <div>
              <h4
                style={{
                  margin: '0 0 6px 0',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#9CA3AF',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Governance API Routes
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {routes.map(r => (
                  <code
                    key={r}
                    style={{
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: '#E5E7EB',
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '2px 6px',
                      borderRadius: 3,
                      alignSelf: 'flex-start',
                    }}
                  >
                    {r}
                  </code>
                ))}
              </div>
            </div>
          )}

          {sourceObjects.length > 0 && (
            <div>
              <h4
                style={{
                  margin: '0 0 6px 0',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#9CA3AF',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Databricks Source Views
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {sourceObjects.map(obj => (
                  <code
                    key={obj}
                    style={{
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: '#34D399',
                      background: 'rgba(52, 211, 153, 0.05)',
                      border: '1px solid rgba(52, 211, 153, 0.1)',
                      padding: '2px 6px',
                      borderRadius: 3,
                    }}
                  >
                    {obj}
                  </code>
                ))}
              </div>
            </div>
          )}

          {limitations.length > 0 && (
            <div>
              <h4
                style={{
                  margin: '0 0 6px 0',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#9CA3AF',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Scope & Limitations
              </h4>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 16,
                  fontSize: 11,
                  color: '#D1D5DB',
                  lineHeight: 1.5,
                }}
              >
                {limitations.map(lim => (
                  <li key={lim} style={{ marginBottom: 2 }}>
                    {lim}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(lastVerified || commitSha) && (
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, fontSize: 10, color: '#6B7280' }}>
              {lastVerified && (
                <span>
                  Last Verified: <strong style={{ color: '#9CA3AF' }}>{lastVerified}</strong>
                </span>
              )}
              {commitSha && (
                <span>
                  Commit SHA: <code style={{ fontFamily: 'monospace', color: '#9CA3AF' }}>{commitSha}</code>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
