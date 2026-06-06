import type { ReactNode } from 'react'
import { Badge, Tabs, TabsList, TabsTrigger } from '@connectio/design-system'

interface AdminPageShellTab {
  readonly tabId: string
  readonly label: string
}

interface AdminPageShellProps {
  readonly title: string
  readonly description: string
  readonly badge?: string
  readonly badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline'
  readonly tabs?: readonly AdminPageShellTab[]
  readonly activeTab?: string
  readonly onTabChange?: (tabId: string) => void
  readonly children: ReactNode
  readonly kpiBar?: ReactNode
}

export function AdminPageShell({ title, description, badge, badgeVariant = 'outline', tabs, activeTab, onTabChange, children, kpiBar }: AdminPageShellProps) {
  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>{title}</h1>
          {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg-2)' }}>{description}</p>
      </div>

      {kpiBar && <div style={{ marginBottom: 20 }}>{kpiBar}</div>}

      {tabs && tabs.length > 0 ? (
        <Tabs value={activeTab ?? tabs[0].tabId} onValueChange={onTabChange}>
          <TabsList style={{ marginBottom: 16 }}>
            {tabs.map(t => (
              <TabsTrigger key={t.tabId} value={t.tabId}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
          {children}
        </Tabs>
      ) : (
        <>{children}</>
      )}
    </div>
  )
}
