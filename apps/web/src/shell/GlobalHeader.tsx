import { useCallback, useEffect, useState } from 'react'
import { useAuthScope } from '@connectio/auth-scope'
import { CommandPalette } from './CommandPalette.js'
import { useWorkspaceShellState } from './useWorkspaceShellState.js'
import { workspaceRegistry } from '../registry/workspace-registry.js'

const ADMIN_PAGE_TITLES: Record<string, string> = {
  'admin-governance': 'Governance Registry',
  'admin-legacy-retirement': 'Legacy Retirement Readiness',
  'admin-production-readiness': 'Production Readiness Dashboard',
  'admin-workspace-parity': 'Workspace Parity Assessment',
  'admin-cutover-simulation': 'Cutover Simulation',
  'admin-role-scope-matrix': 'Role/Scope Visibility Matrix',
  'admin-design-system-compliance': 'Design-System Compliance',
  'admin-telemetry': 'Telemetry Dashboard',
  'admin-pilot-workspace-pack': 'Pilot Workspace Pack',
  'admin-pilot-scenario-validation': 'Scenario Validation Centre',
  'admin-pilot-feedback': 'Feedback Triage',
  'admin-pilot-signoff': 'Stakeholder Sign-Off',
  'admin-pilot-release-gates': 'Release Gate Dashboard',
  'admin-pilot-exit-criteria': 'Pilot Exit Criteria',
  'admin-pilot-data-integration-readiness': 'Data Integration Readiness',
  'admin-pilot-security-access-review': 'Security Access Review',
  'help-getting-started': 'Getting Started',
  'help-concepts': 'V2 Concepts Glossary',
  'help-scenarios': 'Scenario Review Guide',
  'admin-pilot-execution-dashboard': 'Pilot Execution Dashboard',
  'admin-pilot-scenario-execution': 'Scenario Execution Tracking',
  'admin-pilot-feedback-burndown': 'Feedback Burn-Down',
  'admin-pilot-issues': 'Pilot Issue Register',
  'admin-pilot-success-metrics': 'Pilot Success Metrics',
  'admin-pilot-training-readiness': 'Training Readiness',
  'admin-pilot-support-readiness': 'Support Readiness',
  'admin-pilot-data-quality-gaps': 'Data Quality Gaps',
  'admin-pilot-access-exceptions': 'Access Exceptions',
  'admin-pilot-adoption': 'Workspace Adoption',
  'admin-pilot-cutover-recommendation': 'Cutover Recommendation',
  'admin-pilot-go-no-go': 'Go / No-Go Assessment',
  'admin-pilot-rollout-plan': 'Rollout Wave Plan',
  'admin-pilot-lessons-learned': 'Lessons Learned',
}

/**
 * Global top-bar header rendered across all views.
 *
 * @remarks
 * Phase 1 additions:
 * - Search / command palette toggle (Ctrl+K / Cmd+K)
 * - Active scope breadcrumb (plant + batch when set)
 * - Notifications placeholder
 * - User avatar / display name with a simple dropdown menu
 *
 * The command palette is rendered as a portal from this component so it
 * overlays the entire viewport regardless of where the header sits in the DOM.
 */
export function GlobalHeader() {
  const { user, activeScope } = useAuthScope()
  const { workspaceId } = useWorkspaceShellState()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  /** Open/close command palette on Ctrl+K or Cmd+K. */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(open => !open)
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false)
        setUserMenuOpen(false)
      }
    },
    [],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Update document.title on workspace change for screen reader route announcements.
  useEffect(() => {
    if (!workspaceId) {
      document.title = 'ConnectIO'
      return
    }
    const adminTitle = ADMIN_PAGE_TITLES[workspaceId]
    if (adminTitle) {
      document.title = `${adminTitle} — ConnectIO`
      return
    }
    const registration = workspaceRegistry.find(w => w.workspaceId === workspaceId)
    if (registration) {
      document.title = `${registration.displayName} — ConnectIO`
    }
  }, [workspaceId])

  /** Derive display initials for the user avatar. */
  function getInitials(name: string | null): string {
    if (!name) return '?'
    const parts = name.split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <>
      <header className="connectio-topbar">
        {/* Left side: product name + workspace breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--shell-fg)', letterSpacing: '-0.01em' }}>
            ConnectIO
          </span>
          {workspaceId && (
            <>
              <span style={{ color: 'var(--shell-fg-3)', fontSize: 12 }}>/</span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--shell-fg-2)',
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {workspaceId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            </>
          )}
          {activeScope.plantId && (
            <>
              <span style={{ color: 'var(--shell-fg-3)', fontSize: 12 }}>/</span>
              <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{activeScope.plantId}</span>
            </>
          )}
          {activeScope.batchId && (
            <>
              <span style={{ color: 'var(--shell-fg-3)', fontSize: 12 }}>/</span>
              <span style={{ fontSize: 11, color: 'var(--shell-fg-3)', fontFamily: 'monospace' }}>
                {activeScope.batchId}
              </span>
            </>
          )}
        </div>

        {/* Right side: search, notifications, user menu */}
        <div className="connectio-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Command palette trigger */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette (Ctrl+K)"
            title="Search (Ctrl+K)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: 'var(--shell-surface)',
              border: '1px solid var(--shell-line)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--shell-fg-2)',
            }}
          >
            <span aria-hidden="true">⌕</span>
            <span>Search</span>
            <kbd
              style={{
                fontSize: 10,
                padding: '1px 4px',
                background: 'var(--shell-bg)',
                border: '1px solid var(--shell-line)',
                borderRadius: 3,
                color: 'var(--shell-fg-3)',
              }}
            >
              Ctrl K
            </kbd>
          </button>

          {/* Notifications placeholder */}
          <button
            type="button"
            aria-label="Notifications (Phase 2)"
            title="Notifications — Phase 2"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              color: 'var(--shell-fg-3)',
              padding: '4px 6px',
              position: 'relative',
            }}
          >
            <span aria-hidden="true">🔔</span>
          </button>

          {/* User avatar + menu */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(open => !open)}
              aria-label="User menu"
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--shell-rail-active, var(--valentia-slate, #005776))',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {getInitials(user.displayName)}
            </button>
            {userMenuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: 36,
                  right: 0,
                  minWidth: 200,
                  background: 'var(--shell-bg)',
                  border: '1px solid var(--shell-line)',
                  borderRadius: 6,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  zIndex: 500,
                  padding: '8px 0',
                }}
              >
                <div style={{ padding: '6px 16px 10px', borderBottom: '1px solid var(--shell-line)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)' }}>
                    {user.displayName ?? 'User'}
                  </div>
                  {user.email && (
                    <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                      {user.email}
                    </div>
                  )}
                </div>
                <UserMenuItem label="Profile" onClick={() => setUserMenuOpen(false)} />
                <UserMenuItem label="Settings" onClick={() => setUserMenuOpen(false)} />
                <div style={{ height: 1, background: 'var(--shell-line)', margin: '4px 0' }} />
                <UserMenuItem label="Sign out" onClick={() => setUserMenuOpen(false)} />
              </div>
            )}
            {/* Close user menu when clicking outside */}
            {userMenuOpen && (
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 499 }}
                aria-hidden="true"
                onClick={() => setUserMenuOpen(false)}
              />
            )}
          </div>
        </div>
      </header>

      {/* Command palette (mounted at body level via portal-like conditional render) */}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </>
  )
}

/** Single item in the user dropdown menu. */
function UserMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '6px 16px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        color: 'var(--shell-fg)',
      }}
    >
      {label}
    </button>
  )
}
