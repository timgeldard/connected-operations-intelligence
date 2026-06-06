import { useState } from 'react'
import { workspaceRegistry } from '../registry/workspace-registry.js'

/** Background colour per lifecycle state. */
function lifecycleColor(lifecycle: string): string {
  switch (lifecycle) {
    case 'live': return '#16A34A'
    case 'beta': return '#2563EB'
    case 'concept-lab': return '#9CA3AF'
    case 'deprecated': return '#DC2626'
    default: return '#6B7280'
  }
}

const BADGE: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 7px',
  borderRadius: 3,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#fff',
}

const CARD: React.CSSProperties = {
  background: 'var(--shell-surface)',
  border: '1px solid var(--shell-line)',
  borderRadius: 6,
  padding: 16,
  marginBottom: 12,
}

const LABEL: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--shell-fg-3)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 4,
}

const VALUE: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--shell-fg)',
}

/** Read-only governance view showing all registered workspaces and their panel configuration. */
function WorkspacesView() {
  return (
    <div>
      {workspaceRegistry.map(w => (
        <div key={w.workspaceId} style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--shell-fg)', marginBottom: 2 }}>
                {w.displayName}
              </div>
              <div style={{ fontSize: 12, color: 'var(--shell-fg-2)', maxWidth: 560 }}>
                {w.description}
              </div>
            </div>
            <span style={{ ...BADGE, background: lifecycleColor(w.lifecycle), flexShrink: 0, marginLeft: 12 }}>
              {w.lifecycle}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <div style={LABEL}>Workspace ID</div>
              <div style={{ ...VALUE, fontFamily: 'monospace', fontSize: 11 }}>{w.workspaceId}</div>
            </div>
            <div>
              <div style={LABEL}>Owner Domain</div>
              <div style={VALUE}>{w.ownerDomain}</div>
            </div>
            <div>
              <div style={LABEL}>Telemetry ID</div>
              <div style={{ ...VALUE, fontFamily: 'monospace', fontSize: 11 }}>{w.telemetryId}</div>
            </div>
            <div>
              <div style={LABEL}>Route</div>
              <div style={{ ...VALUE, fontFamily: 'monospace', fontSize: 11 }}>{w.route}</div>
            </div>
            <div>
              <div style={LABEL}>Supported Scopes</div>
              <div style={VALUE}>{w.supportedScopes.join(', ') || '—'}</div>
            </div>
            <div>
              <div style={LABEL}>Supported Roles</div>
              <div style={{ ...VALUE, fontSize: 12 }}>{w.supportedRoles.join(', ') || '—'}</div>
            </div>
          </div>

          {w.defaultViews.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={LABEL}>Views ({w.defaultViews.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {w.defaultViews.map(v => (
                  <span
                    key={v.viewId}
                    style={{
                      padding: '3px 8px',
                      background: 'var(--shell-surface-2, #f3f4f6)',
                      border: '1px solid var(--shell-line)',
                      borderRadius: 4,
                      fontSize: 11,
                      color: 'var(--shell-fg)',
                    }}
                  >
                    {v.displayName}
                    <span style={{ color: 'var(--shell-fg-3)', marginLeft: 4 }}>
                      ({v.defaultPanels.length} panels)
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {w.drillThroughDefinitions.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={LABEL}>Drill-through Targets</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {w.drillThroughDefinitions.map((d, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '3px 8px',
                      background: 'var(--shell-surface-2, #f3f4f6)',
                      border: '1px solid var(--shell-line)',
                      borderRadius: 4,
                      fontSize: 11,
                      color: 'var(--shell-fg)',
                    }}
                  >
                    {d.label}
                    <span style={{ color: 'var(--shell-fg-3)', marginLeft: 4 }}>→ {d.targetWorkspaceId}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {w.requiredPermissions.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={LABEL}>Required Permissions</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {w.requiredPermissions.map(p => (
                  <span
                    key={p.permissionId}
                    style={{
                      padding: '3px 8px',
                      background: 'var(--shell-surface-2, #f3f4f6)',
                      border: '1px solid var(--shell-line)',
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: 'var(--shell-fg)',
                    }}
                  >
                    {p.permissionId}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** Summary table of panels registered across all workspace views. */
function PanelRegistryView() {
  type PanelEntry = {
    panelId: string
    workspaceId: string
    workspaceDisplayName: string
    viewId: string
    viewDisplayName: string
    lifecycle: string
    ownerDomain: string
    defaultOrder: number
  }

  const entries: PanelEntry[] = []
  for (const w of workspaceRegistry) {
    for (const v of w.defaultViews) {
      for (const p of v.defaultPanels) {
        entries.push({
          panelId: p.panelId,
          workspaceId: w.workspaceId,
          workspaceDisplayName: w.displayName,
          viewId: v.viewId,
          viewDisplayName: v.displayName,
          lifecycle: v.lifecycle,
          ownerDomain: w.ownerDomain,
          defaultOrder: p.defaultOrder,
        })
      }
    }
  }

  const byPanel = new Map<string, PanelEntry[]>()
  for (const e of entries) {
    if (!byPanel.has(e.panelId)) byPanel.set(e.panelId, [])
    byPanel.get(e.panelId)!.push(e)
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--shell-fg-2)', margin: '0 0 16px' }}>
        {byPanel.size} distinct panel IDs referenced across {workspaceRegistry.length} workspaces.
      </p>
      {Array.from(byPanel.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([panelId, usages]) => (
          <div key={panelId} style={{ ...CARD, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>
                {panelId}
              </span>
              <span style={{ ...BADGE, background: lifecycleColor(usages[0]?.lifecycle ?? 'concept-lab') }}>
                {usages[0]?.lifecycle}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginBottom: 6 }}>
              Owner: <strong style={{ color: 'var(--shell-fg-2)' }}>{usages[0]?.ownerDomain}</strong>
              {' · '}
              Used in {usages.length} view{usages.length !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {usages.map((u, i) => (
                <span
                  key={i}
                  style={{
                    padding: '2px 7px',
                    background: 'var(--shell-surface-2, #f3f4f6)',
                    border: '1px solid var(--shell-line)',
                    borderRadius: 3,
                    fontSize: 10,
                    color: 'var(--shell-fg-2)',
                  }}
                >
                  {u.workspaceDisplayName} / {u.viewDisplayName}
                </span>
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}

/** Source ownership and lifecycle summary across all registered workspaces. */
function LifecycleView() {
  const byLifecycle = new Map<string, typeof workspaceRegistry[number][]>()
  for (const w of workspaceRegistry) {
    if (!byLifecycle.has(w.lifecycle)) byLifecycle.set(w.lifecycle, [])
    byLifecycle.get(w.lifecycle)!.push(w)
  }

  const order = ['live', 'beta', 'concept-lab', 'deprecated']

  return (
    <div>
      {order.map(lc => {
        const items = byLifecycle.get(lc) ?? []
        if (items.length === 0) return null
        return (
          <div key={lc} style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...BADGE, background: lifecycleColor(lc) }}>{lc}</span>
              <span style={{ fontSize: 13, color: 'var(--shell-fg-2)', fontWeight: 400 }}>
                {items.length} workspace{items.length !== 1 ? 's' : ''}
              </span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
              {items.map(w => (
                <div
                  key={w.workspaceId}
                  style={{
                    padding: '10px 14px',
                    background: 'var(--shell-surface)',
                    border: '1px solid var(--shell-line)',
                    borderLeft: `3px solid ${lifecycleColor(lc)}`,
                    borderRadius: 5,
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--shell-fg)' }}>{w.displayName}</div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                    {w.ownerDomain} · {w.defaultPanels.length} panels · {w.defaultViews.length} views
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', marginTop: 4, fontFamily: 'monospace' }}>
                    {w.telemetryId}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Cross-workspace drill-through definition map. */
function DrillThroughMapView() {
  type DrillEntry = {
    sourceWorkspaceId: string
    sourceDisplayName: string
    label: string
    targetWorkspaceId: string
    targetViewId?: string
    contextScopes: readonly string[]
  }

  const entries: DrillEntry[] = []
  for (const w of workspaceRegistry) {
    for (const d of w.drillThroughDefinitions) {
      entries.push({
        sourceWorkspaceId: w.workspaceId,
        sourceDisplayName: w.displayName,
        label: d.label,
        targetWorkspaceId: d.targetWorkspaceId,
        targetViewId: d.targetViewId,
        contextScopes: d.contextScopes,
      })
    }
  }

  if (entries.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--shell-fg-3)' }}>No drill-through definitions registered.</p>
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--shell-fg-2)', margin: '0 0 16px' }}>
        {entries.length} drill-through definition{entries.length !== 1 ? 's' : ''} across {workspaceRegistry.length} workspaces.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--shell-line)' }}>
            {['Source', 'Label', 'Target Workspace', 'Target View', 'Scope'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '6px 12px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--shell-line)' }}>
              <td style={{ padding: '8px 12px', color: 'var(--shell-fg)', fontWeight: 500 }}>{e.sourceDisplayName}</td>
              <td style={{ padding: '8px 12px', color: 'var(--shell-fg)' }}>{e.label}</td>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--shell-fg-2)' }}>{e.targetWorkspaceId}</td>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--shell-fg-3)' }}>{e.targetViewId ?? '—'}</td>
              <td style={{ padding: '8px 12px', color: 'var(--shell-fg-3)' }}>{e.contextScopes.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** All required permissions registered across workspaces. */
function PermissionsView() {
  type PermEntry = {
    permissionId: string
    displayName: string
    description: string
    workspaceId: string
    workspaceDisplayName: string
    lifecycle: string
  }

  const entries: PermEntry[] = []
  for (const w of workspaceRegistry) {
    for (const p of w.requiredPermissions) {
      entries.push({
        permissionId: p.permissionId,
        displayName: p.displayName,
        description: p.description ?? '',
        workspaceId: w.workspaceId,
        workspaceDisplayName: w.displayName,
        lifecycle: w.lifecycle,
      })
    }
  }

  if (entries.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--shell-fg-3)' }}>No permissions registered.</p>
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--shell-fg-2)', margin: '0 0 16px' }}>
        {entries.length} permission{entries.length !== 1 ? 's' : ''} registered across {workspaceRegistry.length} workspaces.
      </p>
      {entries.map((e, i) => (
        <div key={i} style={{ ...CARD, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>
              {e.permissionId}
            </span>
            <span style={{ ...BADGE, background: lifecycleColor(e.lifecycle) }}>{e.lifecycle}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--shell-fg)', marginBottom: 4 }}>{e.displayName}</div>
          <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginBottom: 6 }}>{e.description}</div>
          <div style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
            Workspace: <strong style={{ color: 'var(--shell-fg-2)' }}>{e.workspaceDisplayName}</strong>
            {' '}
            <span style={{ fontFamily: 'monospace', fontSize: 10 }}>({e.workspaceId})</span>
          </div>
        </div>
      ))}
    </div>
  )
}

type GovernanceView = 'workspaces' | 'panels' | 'lifecycle' | 'drill-through' | 'permissions'

/** Admin governance page — read-only view of the product model registry. */
export function AdminGovernancePage() {
  const [activeView, setActiveView] = useState<GovernanceView>('workspaces')

  const tabs: { id: GovernanceView; label: string }[] = [
    { id: 'workspaces', label: 'Registered Workspaces' },
    { id: 'panels', label: 'Panel Registry' },
    { id: 'lifecycle', label: 'Lifecycle & Source' },
    { id: 'drill-through', label: 'Drill-through Map' },
    { id: 'permissions', label: 'Permissions' },
  ]

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: 'var(--shell-fg)' }}>
          Governance Registry
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>
          Read-only view of all registered workspaces, evidence panels, and lifecycle states.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--shell-line)', paddingBottom: 0 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveView(tab.id)}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeView === tab.id ? '2px solid var(--shell-rail-active, #005776)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeView === tab.id ? 600 : 400,
              color: activeView === tab.id ? 'var(--shell-rail-active, #005776)' : 'var(--shell-fg-2)',
              marginBottom: -1,
            }}
            aria-selected={activeView === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeView === 'workspaces' && <WorkspacesView />}
      {activeView === 'panels' && <PanelRegistryView />}
      {activeView === 'lifecycle' && <LifecycleView />}
      {activeView === 'drill-through' && <DrillThroughMapView />}
      {activeView === 'permissions' && <PermissionsView />}
    </div>
  )
}
