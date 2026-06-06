import { DomainSidebar } from './DomainSidebar.js'
import { GlobalHeader } from './GlobalHeader.js'
import { ScopeBar } from './ScopeBar.js'
import { MainBody } from './MainBody.js'
import { useWorkspaceShellState } from './useWorkspaceShellState.js'
import { getConsumerAppForWorkspace } from '../registry/consumer-app-registry.js'

/**
 * Root CSS grid shell for the ConnectIO unified interface.
 *
 * Grid slots:
 * - `.connectio-rail`     — 56 px left nav rail (always visible)
 * - `.connectio-topbar`   — 48 px global header
 * - `.connectio-scopebar` — 40 px contextual scope bar (conditionally rendered)
 * - `.connectio-body`     — remaining viewport, scrollable content area
 *
 * The `.no-scope` modifier is applied to the root when no workspace is active,
 * allowing the grid to collapse the scopebar row via CSS.
 */
export function ShellLayout() {
  const { hasScope, workspaceId } = useWorkspaceShellState()
  const consumerApp = workspaceId ? getConsumerAppForWorkspace(workspaceId) : undefined
  const isFullscreenApp = consumerApp?.shellPresentation === 'fullscreen'

  return (
    <>
      {/* Skip-to-main-content link for keyboard and screen-reader users. */}
      <a
        href="#connectio-main-content"
        style={{
          position: 'absolute',
          top: -100,
          left: 0,
          zIndex: 9999,
          padding: '8px 16px',
          background: 'var(--shell-surface)',
          color: 'var(--shell-fg)',
          fontWeight: 600,
          fontSize: 13,
          textDecoration: 'none',
          borderBottom: '2px solid var(--valentia-slate, #005776)',
          outline: 'none',
        }}
        onFocus={(e) => { (e.currentTarget as HTMLAnchorElement).style.top = '0' }}
        onBlur={(e) => { (e.currentTarget as HTMLAnchorElement).style.top = '-100px' }}
      >
        Skip to main content
      </a>
      <div
        className={`connectio-shell${hasScope ? '' : ' no-scope'}${isFullscreenApp ? ' fullscreen' : ''}`}
        data-testid="workspace-shell"
      >
        <DomainSidebar />
        <GlobalHeader />
        {hasScope && <ScopeBar />}
        <MainBody />
      </div>
    </>
  )
}
