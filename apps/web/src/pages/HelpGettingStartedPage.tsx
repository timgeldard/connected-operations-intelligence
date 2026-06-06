import {
  Badge, Card, CardContent, CardHeader, CardTitle, Separator,
} from '@connectio/design-system'

export function HelpGettingStartedPage() {
  return (
    <div data-testid="help-getting-started" style={{ padding: '32px 40px', maxWidth: 820 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>Getting Started with ConnectIO-RAD V2</h1>
          <Badge variant="outline">Pilot</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--shell-fg-2)', lineHeight: 1.6 }}>
          Welcome to the pilot of ConnectIO-RAD V2. This guide will help you navigate the new workspace model, understand what you are looking at, and know where to give feedback.
        </p>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <CardHeader><CardTitle>What is ConnectIO-RAD V2?</CardTitle></CardHeader>
        <CardContent>
          <p style={{ fontSize: 13, color: 'var(--shell-fg-2)', lineHeight: 1.7, margin: 0 }}>
            ConnectIO-RAD V2 replaces the old collection of separate apps (Intelex, LabWare, PhaseManager, Manhattan WM) with a single unified workspace model. Instead of logging into a different application for each task, you work within domain-specific workspaces that bring together evidence from multiple source systems into one place.
          </p>
        </CardContent>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <CardHeader><CardTitle>How to navigate</CardTitle></CardHeader>
        <CardContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', marginBottom: 4 }}>1. Use the home screen</div>
              <p style={{ fontSize: 13, color: 'var(--shell-fg-2)', lineHeight: 1.6, margin: 0 }}>
                The home screen shows your workspaces and priority items from each domain. This is your starting point. It answers: What needs attention right now?
              </p>
            </div>
            <Separator />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', marginBottom: 4 }}>2. Select a workspace</div>
              <p style={{ fontSize: 13, color: 'var(--shell-fg-2)', lineHeight: 1.6, margin: 0 }}>
                Click a workspace card to open it. Each workspace has views (tabs at the top) and evidence panels (the data cards within each view). Use the views to switch between different perspectives on your domain.
              </p>
            </div>
            <Separator />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', marginBottom: 4 }}>3. Use Ctrl+K to search</div>
              <p style={{ fontSize: 13, color: 'var(--shell-fg-2)', lineHeight: 1.6, margin: 0 }}>
                Press Ctrl+K (or Cmd+K on Mac) to open the command palette. You can search for workspaces, admin tools, and help pages by name.
              </p>
            </div>
            <Separator />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', marginBottom: 4 }}>4. Use drill-throughs</div>
              <p style={{ fontSize: 13, color: 'var(--shell-fg-2)', lineHeight: 1.6, margin: 0 }}>
                Some evidence panels have drill-through buttons that take you to a related workspace. For example, from Batch Release you can drill through to Trace Investigation to see full trace detail for the batch.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <CardHeader><CardTitle>Pilot workspaces in scope</CardTitle></CardHeader>
        <CardContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { name: 'Trace Investigation', roles: 'Food Safety Lead, Quality Lead', lifecycle: 'live' as const },
              { name: 'Quality Batch Release', roles: 'Quality Lead, QA Technician', lifecycle: 'live' as const },
              { name: 'Operations Plan Risk', roles: 'Operations Supervisor, Plant Manager', lifecycle: 'live' as const },
              { name: 'Environmental Monitoring', roles: 'Quality Lead, QA Technician', lifecycle: 'live' as const },
              { name: 'Production Staging', roles: 'Warehouse Manager, Operations Supervisor', lifecycle: 'live' as const },
              { name: 'SPC Monitoring', roles: 'Quality Lead, QA Technician', lifecycle: 'pilot' as const },
              { name: 'Process Order Review', roles: 'Operations Supervisor', lifecycle: 'pilot' as const },
              { name: 'Warehouse 360 Overview', roles: 'Warehouse Manager', lifecycle: 'pilot' as const },
              { name: 'Maintenance & Reliability', roles: 'Maintenance Lead, Plant Manager', lifecycle: 'pilot' as const },
            ].map(w => (
              <div key={w.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--shell-surface)', borderRadius: 4 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--shell-fg)' }}>{w.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginLeft: 8 }}>{w.roles}</span>
                </div>
                <Badge variant={w.lifecycle === 'live' ? 'default' : 'outline'}>{w.lifecycle}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <CardHeader><CardTitle>What is mock vs real data?</CardTitle></CardHeader>
        <CardContent>
          <p style={{ fontSize: 13, color: 'var(--shell-fg-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
            During the pilot, some panels show <strong>mock data</strong> (example data used for demonstration) and some panels show <strong>adapter-backed data</strong> (connected to a real source system, though potentially with a mock adapter layer).
          </p>
          <p style={{ fontSize: 13, color: 'var(--shell-fg-2)', lineHeight: 1.7, margin: 0 }}>
            Look for the <strong>freshness indicator</strong> (clock icon) and <strong>confidence indicator</strong> (shield icon) on evidence panels. These tell you how current and reliable the data is. If a panel shows "mock" it is not connected to a live source.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>How to give feedback</CardTitle></CardHeader>
        <CardContent>
          <p style={{ fontSize: 13, color: 'var(--shell-fg-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
            Use the <strong>Feedback</strong> button when you find something that does not work as expected, is confusing, or is missing. Your feedback is captured against the specific workspace, view, and panel you are looking at.
          </p>
          <p style={{ fontSize: 13, color: 'var(--shell-fg-2)', lineHeight: 1.7, margin: 0 }}>
            All feedback is reviewed by the pilot team and triaged for action. See the Feedback Triage admin view for the current status of submitted feedback items.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
