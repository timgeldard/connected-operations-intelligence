import React, { createContext, useContext } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Context used by the Tabs stub to propagate `onValueChange` down to
 * individual TabsTrigger stubs without threading props through TabsList.
 */
const TabsCtx = createContext<{
  onValueChange: (v: string) => void
  activeValue: string
}>({ onValueChange: () => undefined, activeValue: '' })

vi.mock('@connectio/design-system', () => ({
  Tabs: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode
    value: string
    onValueChange: (v: string) => void
  }) => (
    <TabsCtx.Provider value={{ onValueChange, activeValue: value }}>
      <div>{children}</div>
    </TabsCtx.Provider>
  ),

  TabsList: ({ children }: { children: React.ReactNode }) => <div role="tablist">{children}</div>,

  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => {
    const { onValueChange, activeValue } = useContext(TabsCtx)
    return (
      <button
        role="tab"
        data-value={value}
        aria-selected={activeValue === value}
        onClick={() => onValueChange(value)}
      >
        {children}
      </button>
    )
  },
}))

import { WorkspaceTabs } from './WorkspaceTabs.js'
import type { ViewRegistration } from '@connectio/product-model'

const makeView = (
  viewId: string,
  displayName: string,
  lifecycle: ViewRegistration['lifecycle'] = 'live',
): ViewRegistration => ({
  viewId,
  displayName,
  lifecycle,
  sortOrder: 0,
  defaultPanels: [],
})

describe('WorkspaceTabs', () => {
  it('renders a tab for each navigable view', () => {
    const views = [makeView('v1', 'Overview'), makeView('v2', 'Details')]
    render(<WorkspaceTabs views={views} activeViewId="v1" onViewChange={() => undefined} />)
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Details' })).toBeInTheDocument()
  })

  it('marks the active tab with aria-selected true', () => {
    const views = [makeView('v1', 'Overview'), makeView('v2', 'Details')]
    render(<WorkspaceTabs views={views} activeViewId="v1" onViewChange={() => undefined} />)
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
  })

  it('marks inactive tabs with aria-selected false', () => {
    const views = [makeView('v1', 'Overview'), makeView('v2', 'Details')]
    render(<WorkspaceTabs views={views} activeViewId="v1" onViewChange={() => undefined} />)
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onViewChange with the clicked view ID', async () => {
    const user = userEvent.setup()
    const onViewChange = vi.fn()
    const views = [makeView('v1', 'Overview'), makeView('v2', 'Details')]
    render(<WorkspaceTabs views={views} activeViewId="v1" onViewChange={onViewChange} />)

    await user.click(screen.getByRole('tab', { name: 'Details' }))

    expect(onViewChange).toHaveBeenCalledOnce()
    expect(onViewChange).toHaveBeenCalledWith('v2')
  })

  it('filters out deprecated views', () => {
    const views = [makeView('v1', 'Overview', 'live'), makeView('v2', 'Legacy', 'deprecated')]
    render(<WorkspaceTabs views={views} activeViewId="v1" onViewChange={() => undefined} />)
    expect(screen.queryByRole('tab', { name: 'Legacy' })).toBeNull()
  })

  it('filters out hidden views', () => {
    const views = [makeView('v1', 'Overview', 'live'), makeView('v2', 'Internal', 'hidden')]
    render(<WorkspaceTabs views={views} activeViewId="v1" onViewChange={() => undefined} />)
    expect(screen.queryByRole('tab', { name: 'Internal' })).toBeNull()
  })

  it('renders nothing when all views are non-navigable', () => {
    const views = [makeView('v1', 'Old', 'deprecated')]
    const { container } = render(
      <WorkspaceTabs views={views} activeViewId="v1" onViewChange={() => undefined} />,
    )
    expect(container.firstChild).toBeNull()
  })
})
