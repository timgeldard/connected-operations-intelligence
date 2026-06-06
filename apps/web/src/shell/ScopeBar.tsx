import { useAuthScope } from '@connectio/auth-scope'

/**
 * Contextual scope bar displayed below the topbar when a workspace is active.
 *
 * Renders the active plant, line, and batch identifiers sourced from the
 * active scope context in {@link useAuthScope}. Fields are omitted individually
 * when not set in the current scope context.
 */
export function ScopeBar() {
  const { activeScope } = useAuthScope()

  return (
    <div className="connectio-scopebar" aria-label="Scope context">
      {activeScope.plantId && (
        <div className="connectio-scopebar-field">
          <span className="lbl">Plant</span>
          <span className="val">{activeScope.plantId}</span>
        </div>
      )}
      {activeScope.lineId && (
        <div className="connectio-scopebar-field">
          <span className="lbl">Line</span>
          <span className="val">{activeScope.lineId}</span>
        </div>
      )}
      {activeScope.batchId && (
        <div className="connectio-scopebar-field">
          <span className="lbl">Batch</span>
          <span className="val">{activeScope.batchId}</span>
        </div>
      )}
      <div className="connectio-scopebar-spacer" />
    </div>
  )
}