import { useState, useEffect, useRef, useCallback } from 'react'
import { isNavigable } from '@connectio/product-model'
import { useAuthScope } from '@connectio/auth-scope'
import { workspaceRegistry } from '../registry/workspace-registry.js'
import { useWorkspaceShellState } from './useWorkspaceShellState.js'

/** Props for the CommandPalette. */
export interface CommandPaletteProps {
  /** Called when the palette should be dismissed. */
  readonly onClose: () => void
}

/** A single selectable command in the palette. */
interface Command {
  readonly id: string
  readonly label: string
  readonly description?: string
  readonly category: string
  readonly action: () => void
}

/**
 * Global command palette (Ctrl+K / Cmd+K).
 *
 * @remarks
 * Provides keyboard-driven navigation to workspaces, investigations, and
 * actions. Rendered as a full-viewport overlay with an auto-focused search
 * input. Commands are filtered by the current query string.
 *
 * Accessibility: traps focus within the overlay; Escape closes; Arrow keys
 * navigate the command list; Enter activates the highlighted command.
 */
export function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { setWorkspace, navigateToTraceInvestigation } = useWorkspaceShellState()
  const { setActiveScope } = useAuthScope()

  /** Auto-focus the input on mount. */
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  /** Admin tool pages (not in workspace registry). */
  const adminCommands: Command[] = [
    { id: 'admin-governance', label: 'Governance Registry', description: 'Workspace registry, drill-through map, permissions', category: 'Admin Tools', action: () => { setWorkspace('admin-governance'); onClose() } },
    { id: 'admin-legacy-retirement', label: 'Legacy Retirement Readiness', description: 'Retirement status across all 6 legacy systems', category: 'Admin Tools', action: () => { setWorkspace('admin-legacy-retirement'); onClose() } },
    { id: 'admin-production-readiness', label: 'Production Readiness Dashboard', description: 'ReadinessFinding audit across all 9 workspaces', category: 'Admin Tools', action: () => { setWorkspace('admin-production-readiness'); onClose() } },
    { id: 'admin-workspace-parity', label: 'Workspace Parity Assessment', description: 'Coverage scores vs legacy systems', category: 'Admin Tools', action: () => { setWorkspace('admin-workspace-parity'); onClose() } },
    { id: 'admin-cutover-simulation', label: 'Cutover Simulation', description: 'Per-legacy-system simulation mode and results', category: 'Admin Tools', action: () => { setWorkspace('admin-cutover-simulation'); onClose() } },
    { id: 'admin-role-scope-matrix', label: 'Role/Scope Visibility Matrix', description: 'Workspace visibility per role and scope', category: 'Admin Tools', action: () => { setWorkspace('admin-role-scope-matrix'); onClose() } },
    { id: 'admin-design-system-compliance', label: 'Design-System Compliance Report', description: 'ESLint boundary and inline-style audit', category: 'Admin Tools', action: () => { setWorkspace('admin-design-system-compliance'); onClose() } },
    { id: 'admin-telemetry', label: 'Telemetry Dashboard', description: 'Platform event log and workspace usage stats', category: 'Admin Tools', action: () => { setWorkspace('admin-telemetry'); onClose() } },
  ]

  const pilotAdminCommands: Command[] = [
    { id: 'admin-pilot-workspace-pack', label: 'Pilot Workspace Pack', description: 'Which workspaces are in the pilot and why', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-workspace-pack'); onClose() } },
    { id: 'admin-pilot-scenario-validation', label: 'Scenario Validation Centre', description: 'Validate V2 by business scenario', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-scenario-validation'); onClose() } },
    { id: 'admin-pilot-feedback', label: 'Feedback Triage', description: 'Review and triage pilot feedback', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-feedback'); onClose() } },
    { id: 'admin-pilot-signoff', label: 'Stakeholder Sign-Off', description: 'Domain sign-off status and workflow', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-signoff'); onClose() } },
    { id: 'admin-pilot-release-gates', label: 'Release Gate Dashboard', description: '10 release gates for pilot exit', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-release-gates'); onClose() } },
    { id: 'admin-pilot-exit-criteria', label: 'Pilot Exit Criteria', description: '12 criteria for pilot phase exit', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-exit-criteria'); onClose() } },
    { id: 'admin-pilot-data-integration-readiness', label: 'Data Integration Readiness', description: 'Source integration status for all pilot workspaces', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-data-integration-readiness'); onClose() } },
    { id: 'admin-pilot-security-access-review', label: 'Security Access Review', description: 'Role/scope access review matrix', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-security-access-review'); onClose() } },
    { id: 'admin-pilot-execution-dashboard', label: 'Pilot Execution Dashboard', description: 'Master pilot status — readiness, KPIs, cutover preview', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-execution-dashboard'); onClose() } },
    { id: 'admin-pilot-scenario-execution', label: 'Scenario Execution Tracking', description: 'Per-scenario execution results and pass rate', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-scenario-execution'); onClose() } },
    { id: 'admin-pilot-feedback-burndown', label: 'Feedback Burn-Down', description: 'Issue burn-down trend and categorised issue log', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-feedback-burndown'); onClose() } },
    { id: 'admin-pilot-issues', label: 'Pilot Issue Register', description: 'All pilot issues — blockers, status, and ownership', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-issues'); onClose() } },
    { id: 'admin-pilot-success-metrics', label: 'Pilot Success Metrics', description: '10 defined success metrics with targets and actuals', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-success-metrics'); onClose() } },
    { id: 'admin-pilot-training-readiness', label: 'Training Readiness', description: 'Per-role training completion and blockers', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-training-readiness'); onClose() } },
    { id: 'admin-pilot-support-readiness', label: 'Support Readiness', description: 'Runbook, support contact, and escalation readiness by workspace', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-support-readiness'); onClose() } },
    { id: 'admin-pilot-data-quality-gaps', label: 'Data Quality Gaps', description: 'Mock vs real data gaps across all source systems', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-data-quality-gaps'); onClose() } },
    { id: 'admin-pilot-access-exceptions', label: 'Access Exceptions', description: 'Role/workspace access discrepancies found in pilot', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-access-exceptions'); onClose() } },
    { id: 'admin-pilot-adoption', label: 'Workspace Adoption', description: 'Active user counts and session data per workspace', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-adoption'); onClose() } },
    { id: 'admin-pilot-cutover-recommendation', label: 'Cutover Recommendation', description: 'Derived Go / No-Go and required actions for cutover', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-cutover-recommendation'); onClose() } },
    { id: 'admin-pilot-go-no-go', label: 'Go / No-Go Assessment', description: '12-dimension assessment against pilot exit criteria', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-go-no-go'); onClose() } },
    { id: 'admin-pilot-rollout-plan', label: 'Rollout Wave Plan', description: '4-wave production rollout plan (Wave 0–3)', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-rollout-plan'); onClose() } },
    { id: 'admin-pilot-lessons-learned', label: 'Lessons Learned', description: '12 lessons and recommendations from pilot execution', category: 'Pilot Admin', action: () => { setWorkspace('admin-pilot-lessons-learned'); onClose() } },
  ]

  const helpCommands: Command[] = [
    { id: 'help-getting-started', label: 'Getting Started', description: 'V2 navigation guide for pilot users', category: 'Help & Training', action: () => { setWorkspace('help-getting-started'); onClose() } },
    { id: 'help-concepts', label: 'V2 Concepts Glossary', description: 'Domain, workspace, evidence panel, drill-through, and more', category: 'Help & Training', action: () => { setWorkspace('help-concepts'); onClose() } },
    { id: 'help-scenarios', label: 'Scenario Review Guide', description: 'Step-by-step training scenarios by role', category: 'Help & Training', action: () => { setWorkspace('help-scenarios'); onClose() } },
  ]

  /** Build the full command list from registered workspaces + quick actions. */
  const allCommands: Command[] = [
    ...workspaceRegistry
      .filter(w => isNavigable(w.lifecycle))
      .map(w => ({
        id: `workspace-${w.workspaceId}`,
        label: `Go to ${w.displayName}`,
        description: w.description,
        category: 'Workspaces',
        action: () => {
          setWorkspace(w.workspaceId)
          onClose()
        },
      })),
    ...adminCommands,
    ...pilotAdminCommands,
    ...helpCommands,
    {
      id: 'wh360-mock',
      label: 'Open Warehouse 360 — WH-IE10-MAIN · Kerry Listowel',
      description: 'Main warehouse · Plant IE10 · 347 stock lines',
      category: 'Recent Investigations',
      action: () => {
        setActiveScope({ warehouseId: 'WH-IE10-MAIN', plantId: 'IE10' })
        setWorkspace('warehouse-360-overview')
        onClose()
      },
    },
    {
      id: 'por-mock',
      label: 'Open Process Order — PO-240308-3847',
      description: 'EMMENTAL BLOCK NATURAL 100KG · Batch CH-240308-0047 · Kerry Listowel',
      category: 'Recent Investigations',
      action: () => {
        setActiveScope({ processOrderId: 'PO-240308-3847', plantId: 'IE10', batchId: 'CH-240308-0047' })
        setWorkspace('process-order-review')
        onClose()
      },
    },
    {
      id: 'trace-inv-mock',
      label: 'Open Trace Investigation — INV-2024-003847',
      description: 'EMMENTAL BLOCK NATURAL 100KG · Batch CH-240308-0047 · Kerry Listowel',
      category: 'Recent Investigations',
      action: () => {
        setActiveScope({ materialId: '100023847', batchId: 'CH-240308-0047', plantId: 'IE10' })
        navigateToTraceInvestigation('INV-2024-003847', 'overview')
        onClose()
      },
    },
    {
      id: 'trace-inv-mock-recall',
      label: 'Open Trace Investigation — INV-2024-003847 (Recall Readiness)',
      description: 'Jump directly to recall readiness assessment',
      category: 'Recent Investigations',
      action: () => {
        setActiveScope({ materialId: '100023847', batchId: 'CH-240308-0047', plantId: 'IE10' })
        navigateToTraceInvestigation('INV-2024-003847', 'recall-readiness')
        onClose()
      },
    },
  ]

  /** Filter commands by the current query (case-insensitive). */
  const filteredCommands = query.trim()
    ? allCommands.filter(
        c =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.description?.toLowerCase().includes(query.toLowerCase()),
      )
    : allCommands

  /** Reset highlighted index when the filtered list changes. */
  useEffect(() => {
    setHighlighted(0)
  }, [query])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlighted(i => Math.min(i + 1, filteredCommands.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlighted(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        filteredCommands[highlighted]?.action()
      } else if (e.key === 'Escape') {
        onClose()
      }
    },
    [filteredCommands, highlighted, onClose],
  )

  /** Group commands by category for rendering. */
  const grouped = filteredCommands.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {})

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        zIndex: 2000,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: 560,
          maxWidth: '90vw',
          background: 'var(--shell-bg)',
          border: '1px solid var(--shell-line)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--shell-line)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16, color: 'var(--shell-fg-3)' }} aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            type="search"
            placeholder="Search workspaces, investigations, actions…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search command palette"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 14,
              color: 'var(--shell-fg)',
            }}
          />
          <kbd
            style={{
              fontSize: 10,
              padding: '2px 6px',
              background: 'var(--shell-surface)',
              border: '1px solid var(--shell-line)',
              borderRadius: 3,
              color: 'var(--shell-fg-3)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div
          style={{ maxHeight: '60vh', overflowY: 'auto' }}
          role="listbox"
          aria-label="Commands"
        >
          {filteredCommands.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--shell-fg-3)', fontSize: 13 }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            Object.entries(grouped).map(([category, commands]) => {
              // Track global index offset for the highlighted index
              const categoryOffset = filteredCommands.indexOf(commands[0])
              return (
                <div key={category}>
                  <div
                    style={{
                      padding: '6px 16px 4px',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--shell-fg-3)',
                    }}
                  >
                    {category}
                  </div>
                  {commands.map((cmd, localIdx) => {
                    const globalIdx = categoryOffset + localIdx
                    const isHighlighted = globalIdx === highlighted
                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        role="option"
                        aria-selected={isHighlighted}
                        onClick={cmd.action}
                        onMouseEnter={() => setHighlighted(globalIdx)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 16px',
                          background: isHighlighted
                            ? 'var(--shell-rail-active, var(--valentia-slate, #005776))'
                            : 'none',
                          border: 'none',
                          cursor: 'pointer',
                          gap: 2,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: isHighlighted ? '#fff' : 'var(--shell-fg)',
                          }}
                        >
                          {cmd.label}
                        </span>
                        {cmd.description && (
                          <span
                            style={{
                              fontSize: 11,
                              color: isHighlighted ? 'rgba(255,255,255,0.7)' : 'var(--shell-fg-3)',
                            }}
                          >
                            {cmd.description}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--shell-line)',
            display: 'flex',
            gap: 16,
            fontSize: 11,
            color: 'var(--shell-fg-3)',
          }}
        >
          <span><kbd style={kbdStyle}>↑↓</kbd> navigate</span>
          <span><kbd style={kbdStyle}>↵</kbd> select</span>
          <span><kbd style={kbdStyle}>ESC</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

const kbdStyle: React.CSSProperties = {
  fontSize: 10,
  padding: '1px 4px',
  background: 'var(--shell-surface)',
  border: '1px solid var(--shell-line)',
  borderRadius: 3,
  color: 'var(--shell-fg-3)',
  marginRight: 4,
}
