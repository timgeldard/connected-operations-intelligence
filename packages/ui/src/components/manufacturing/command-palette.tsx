import * as React from 'react'
import { Dialog, DialogContent } from '../ui/dialog'

export interface CommandPaletteItem {
  /** Stable unique identifier for this item. */
  id: string
  /** Primary display text shown in the list. */
  label: string
  /** Optional secondary text for additional context. */
  description?: string
  /** Called when the user selects this item via click or keyboard. */
  onSelect: () => void
}

export interface CommandPaletteProps {
  /** Filterable list of actions and navigation destinations. */
  items: CommandPaletteItem[]
  /** Controls whether the palette is visible. */
  open: boolean
  /**
   * Called when the palette should open or close.
   * Consumers are responsible for registering any global shortcut (e.g. Ctrl+K).
   */
  onOpenChange: (open: boolean) => void
}

/**
 * CommandPalette — keyboard-accessible workspace and action search.
 * Rendered inside a Dialog overlay. Consumers should register a Ctrl+K
 * shortcut and pass `open` / `onOpenChange` to control visibility.
 */
export function CommandPalette({ items, open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Reset query when palette opens and focus the input.
  React.useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const filtered = query.trim()
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.description?.toLowerCase().includes(query.toLowerCase())
      )
    : items

  function handleSelect(item: CommandPaletteItem) {
    onOpenChange(false)
    item.onSelect()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ padding: 0, maxWidth: '560px', overflow: 'hidden' }}
        aria-label="Command palette"
      >
        <div
          style={{
            padding: 'var(--sp-3) var(--sp-4)',
            borderBottom: '1px solid var(--stroke)',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Search actions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: 'var(--fs-16)',
              color: 'var(--fg)',
              background: 'transparent',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>
        <ul
          role="listbox"
          aria-label="Results"
          style={{ listStyle: 'none', margin: 0, padding: 'var(--sp-2) 0', maxHeight: '360px', overflowY: 'auto' }}
        >
          {filtered.length === 0 ? (
            <li
              style={{
                padding: 'var(--sp-8) var(--sp-4)',
                textAlign: 'center',
                fontSize: 'var(--fs-14)',
                color: 'var(--fg-muted)',
              }}
            >
              No results found
            </li>
          ) : (
            filtered.map((item) => (
              <li key={item.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '2px',
                    padding: 'var(--sp-2) var(--sp-4)',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--stroke-soft)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-medium)', color: 'var(--fg)' }}>
                    {item.label}
                  </span>
                  {item.description && (
                    <span style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-muted)' }}>
                      {item.description}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
