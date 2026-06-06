/**
 * Fallback page rendered when the `workspace` URL param does not match any
 * entry in the workspace registry.
 */
export function NotFound() {
  return (
    <div style={{ padding: '64px 40px', textAlign: 'center' }}>
      <p style={{ fontSize: 14, color: 'var(--shell-fg-2)' }}>
        Workspace not found.
      </p>
    </div>
  )
}
