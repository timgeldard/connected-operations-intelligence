import { Tabs, TabsList, TabsTrigger } from '@connectio/design-system'
import { isNavigable } from '@connectio/product-model'
import type { ViewRegistration } from '@connectio/product-model'

/** Props for WorkspaceTabs. */
export interface WorkspaceTabsProps {
  /** All view registrations from the workspace. Non-navigable views are filtered out. */
  views: readonly ViewRegistration[]
  /** The currently active view ID (controlled). */
  activeViewId: string
  /** Called with the new view ID when the user selects a tab. */
  onViewChange: (viewId: string) => void
}

/**
 * WorkspaceTabs renders the sub-navigation tab strip for a workspace.
 *
 * @remarks
 * Only views whose lifecycle is navigable (live, pilot, or concept-lab) are
 * rendered. Deprecated and hidden views are suppressed. The active state is
 * fully controlled via `activeViewId` / `onViewChange` — no internal state.
 */
export function WorkspaceTabs({
  views,
  activeViewId,
  onViewChange,
}: WorkspaceTabsProps) {
  const navigableViews = views.filter((v) => isNavigable(v.lifecycle))

  if (navigableViews.length === 0) return null

  return (
    <div className="connectio-workspace-subnav">
      <Tabs value={activeViewId} onValueChange={onViewChange}>
        <TabsList
          style={{
            background: 'transparent',
            height: 'var(--shell-subnav-height)',
            padding: 0,
            borderRadius: 0,
            gap: 0,
          }}
        >
          {navigableViews.map((view) => (
            <TabsTrigger
              key={view.viewId}
              value={view.viewId}
              className="tab"
              style={{ borderRadius: 0 }}
            >
              {view.displayName}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
