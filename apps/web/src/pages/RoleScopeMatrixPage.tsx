// Phase 6 snapshot — role/scope matrix as of 2026-05-15.
import { useState } from 'react'
import { StaticSnapshotBanner } from '../components/StaticSnapshotBanner.js'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
} from '@connectio/design-system'
import { workspaceRegistry } from '../registry/workspace-registry.js'
import { isVisible, isNavigable } from '@connectio/product-model'
import type { RoleScopeMatrixEntry } from '@connectio/product-model'

// ─── Roles and scope levels ───────────────────────────────────────────────────

const ALL_ROLES = [
  'quality-technician',
  'quality-lead',
  'process-engineer',
  'production-supervisor',
  'operations-manager',
  'warehouse-manager',
  'inventory-controller',
  'logistics-coordinator',
  'maintenance-technician',
  'maintenance-manager',
  'reliability-engineer',
  'site-admin',
  'platform-admin',
] as const

type Role = (typeof ALL_ROLES)[number]

const SCOPE_LEVELS = ['plant', 'line', 'batch', 'warehouse', 'work-centre'] as const
type ScopeLevel = (typeof SCOPE_LEVELS)[number]

// ─── Matrix generation ────────────────────────────────────────────────────────

function buildMatrixEntry(
  role: Role,
  scopeLevel: ScopeLevel,
  workspaceId: string,
): RoleScopeMatrixEntry {
  const registration = workspaceRegistry.find(w => w.workspaceId === workspaceId)
  if (!registration) {
    return {
      role,
      scopeLevel,
      workspaceId,
      isVisible: false,
      isNavigable: false,
      permissionSatisfied: false,
    }
  }

  const roleMatches = registration.supportedRoles.includes(role) || role === 'site-admin' || role === 'platform-admin'
  const scopeMatches = registration.supportedScopes.includes(scopeLevel as never)
  const requiredPermission = registration.requiredPermissions[0]?.permissionId

  // Admins always have access; role + scope both must match for regular roles.
  const visible = roleMatches && (scopeMatches || registration.supportedScopes.length === 0) && isVisible(registration.lifecycle)
  const navigable = roleMatches && isNavigable(registration.lifecycle)

  return {
    role,
    scopeLevel,
    workspaceId,
    isVisible: visible,
    isNavigable: navigable,
    requiredPermission,
    permissionSatisfied: roleMatches,
  }
}

const WORKSPACE_IDS = workspaceRegistry.map(w => w.workspaceId)
const WORKSPACE_LABELS: Record<string, string> = Object.fromEntries(
  workspaceRegistry.map(w => [w.workspaceId, w.displayName]),
)

// ─── Sub-views ────────────────────────────────────────────────────────────────

function CellBadge({ entry }: { readonly entry: RoleScopeMatrixEntry }) {
  if (!entry.isNavigable) return <span style={{ color: 'var(--shell-fg-3)', fontSize: 11 }}>—</span>
  if (!entry.isVisible) return <Badge variant="outline" style={{ fontSize: 10 }}>Hidden</Badge>
  return <Badge variant="default" style={{ fontSize: 10 }}>✓</Badge>
}

function RoleMatrixView() {
  const [selectedScope, setSelectedScope] = useState<ScopeLevel>('plant')
  const [selectedRole, setSelectedRole] = useState<Role | 'all'>('all')

  const rolesToShow = selectedRole === 'all' ? ALL_ROLES : [selectedRole]

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Scope Level
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {SCOPE_LEVELS.map(s => (
            <Button
              key={s}
              size="sm"
              variant={selectedScope === s ? 'default' : 'outline'}
              onClick={() => setSelectedScope(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Role Filter
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Button size="sm" variant={selectedRole === 'all' ? 'default' : 'outline'} onClick={() => setSelectedRole('all')}>
            All Roles
          </Button>
          {ALL_ROLES.map(r => (
            <Button
              key={r}
              size="sm"
              variant={selectedRole === r ? 'default' : 'outline'}
              onClick={() => setSelectedRole(r)}
            >
              {r}
            </Button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--shell-fg-3)', borderBottom: '1px solid var(--shell-line)', whiteSpace: 'nowrap' }}>
                Role
              </th>
              {WORKSPACE_IDS.map(wsId => (
                <th key={wsId} style={{
                  textAlign: 'center',
                  padding: '4px 6px',
                  color: 'var(--shell-fg-3)',
                  borderBottom: '1px solid var(--shell-line)',
                  writingMode: 'vertical-lr',
                  minWidth: 36,
                  maxWidth: 36,
                }}>
                  {WORKSPACE_LABELS[wsId] ?? wsId}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rolesToShow.map((role, i) => (
              <tr key={role} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--shell-bg)' }}>
                <td style={{ padding: '6px 8px', color: 'var(--shell-fg-2)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                  {role}
                </td>
                {WORKSPACE_IDS.map(wsId => {
                  const entry = buildMatrixEntry(role, selectedScope, wsId)
                  return (
                    <td key={wsId} style={{ textAlign: 'center', padding: '4px 6px' }}>
                      <CellBadge entry={entry} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function WorkspaceDetailView() {
  const [selectedWorkspace, setSelectedWorkspace] = useState(WORKSPACE_IDS[0])
  const registration = workspaceRegistry.find(w => w.workspaceId === selectedWorkspace)

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {WORKSPACE_IDS.map(wsId => (
          <Button
            key={wsId}
            size="sm"
            variant={selectedWorkspace === wsId ? 'default' : 'outline'}
            onClick={() => setSelectedWorkspace(wsId)}
          >
            {WORKSPACE_LABELS[wsId] ?? wsId}
          </Button>
        ))}
      </div>

      {registration && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card>
            <CardHeader style={{ paddingBottom: 8 }}>
              <CardTitle style={{ fontSize: 14 }}>{registration.displayName}</CardTitle>
            </CardHeader>
            <CardContent style={{ paddingTop: 0 }}>
              <div style={{ display: 'flex', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Lifecycle</div>
                  <Badge variant={registration.lifecycle === 'live' ? 'default' : registration.lifecycle === 'pilot' ? 'secondary' : 'outline'}>
                    {registration.lifecycle}
                  </Badge>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Supported Scopes</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {registration.supportedScopes.length > 0
                      ? registration.supportedScopes.map(s => <Badge key={s} variant="outline">{s}</Badge>)
                      : <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Any</span>
                    }
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Required Permission</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {registration.requiredPermissions.length > 0
                      ? registration.requiredPermissions.map(p => <Badge key={p.permissionId} variant="outline">{p.permissionId}</Badge>)
                      : <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>None</span>
                    }
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Supported Roles ({registration.supportedRoles.length})
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {registration.supportedRoles.map(r => <Badge key={r} variant="outline">{r}</Badge>)}
              </div>
            </CardContent>
          </Card>

          <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', fontStyle: 'italic' }}>
            Roles with ✓ in the matrix above have `isVisible: true` for at least one scope level that the workspace supports.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type MatrixTab = 'matrix' | 'workspace-detail'

export function RoleScopeMatrixPage() {
  const [activeTab, setActiveTab] = useState<MatrixTab>('matrix')

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <StaticSnapshotBanner snapshotDate="2026-05-15" />
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--shell-fg)', margin: 0, marginBottom: 4 }}>
          Role/Scope Visibility Matrix
        </h1>
        <p style={{ fontSize: 13, color: 'var(--shell-fg-2)', margin: 0 }}>
          Which workspaces are visible (✓) for each role and scope level combination.
          Derived from workspace registrations — no separate configuration required.
          Admins (site-admin, platform-admin) have access to all navigable workspaces.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MatrixTab)}>
        <TabsList style={{ marginBottom: 16 }}>
          <TabsTrigger value="matrix">Visibility Matrix</TabsTrigger>
          <TabsTrigger value="workspace-detail">Workspace Role Detail</TabsTrigger>
        </TabsList>
        <TabsContent value="matrix">
          <RoleMatrixView />
        </TabsContent>
        <TabsContent value="workspace-detail">
          <WorkspaceDetailView />
        </TabsContent>
      </Tabs>
    </div>
  )
}
