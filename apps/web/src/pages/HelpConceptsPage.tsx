import {
  Badge, Card, CardContent, CardHeader, CardTitle, Separator,
} from '@connectio/design-system'

interface ConceptEntry {
  readonly term: string
  readonly definition: string
  readonly example?: string
}

const CONCEPTS: readonly ConceptEntry[] = [
  {
    term: 'Domain',
    definition: 'A bounded area of business ownership. Each domain owns its source data, evidence panels, and action flows. Examples: Quality, Traceability, Operations, Warehouse, Maintenance.',
    example: 'The Quality domain owns the QualityResultsPanel and the Batch Release action.',
  },
  {
    term: 'Workspace',
    definition: 'A purpose-built operational view that brings together evidence panels from one or more domains. A workspace answers a specific business question (e.g. "Is this batch safe to release?").',
    example: 'The Quality Batch Release workspace brings together quality results, SPC signals, trace exposure, warehouse hold status, and process order data.',
  },
  {
    term: 'View',
    definition: 'A named perspective within a workspace. Workspaces can have multiple views that group panels by task or context. Views are the tabs at the top of a workspace.',
    example: 'The Batch Release workspace has views: Release Queue, Batch Decision, Evidence Summary.',
  },
  {
    term: 'Evidence Panel',
    definition: 'A reusable data card that shows information from a specific source system. Each panel is owned by a domain and carries freshness and confidence metadata.',
    example: 'The QualityResultsPanel is owned by the Quality domain and shows inspection results from LabWare.',
  },
  {
    term: 'Action Flow',
    definition: 'A structured workflow that allows users to perform a governed operation. Actions validate inputs, capture context, emit telemetry, and can trigger downstream events.',
    example: 'The "Release Batch" action validates release conditions, records the decision, and sends a release signal to the source system.',
  },
  {
    term: 'Owner Badge',
    definition: 'A label shown on evidence panels indicating which domain owns the data shown. This tells you who is accountable for the data quality and freshness.',
    example: 'The WarehouseHoldStatusPanel shows "owner: warehouse" — meaning the Warehouse domain is responsible for this data.',
  },
  {
    term: 'Freshness',
    definition: 'How recently the data in a panel was last updated from its source system. Freshness policies define the expected update frequency and staleness threshold.',
    example: 'An environmental monitoring panel with a freshness of 15 minutes means data older than 15 minutes should trigger a staleness indicator.',
  },
  {
    term: 'Confidence',
    definition: 'A quality signal indicating how reliable the data in a panel is. Confidence may reflect data completeness, source availability, or validation status.',
    example: 'A trace panel with low confidence may indicate the trace graph is incomplete due to missing upstream batch records.',
  },
  {
    term: 'Drill-Through',
    definition: 'A navigation action from one evidence panel to a related workspace, carrying the current context (e.g. batchId). Drill-throughs allow cross-domain investigation without losing context.',
    example: 'Clicking "Open Trace Investigation" in Batch Release drills through to the Trace Investigation workspace with the batch pre-selected.',
  },
  {
    term: 'Lifecycle',
    definition: 'The maturity state of a workspace or panel. Values: live (production-deployed), pilot (validated for pilot use), concept-lab (prototype only), deprecated (to be retired), hidden.',
    example: 'SPC Monitoring is lifecycle=pilot — it is available in the pilot but not yet fully source-integrated.',
  },
  {
    term: 'Scope',
    definition: 'The contextual boundary for a workspace — the level at which data is filtered (e.g. plant, line, batch, warehouse). Setting scope narrows the evidence panels to relevant records.',
    example: 'Setting scope to plantId=IE10 shows data for Kerry Listowel only across all evidence panels.',
  },
]

export function HelpConceptsPage() {
  return (
    <div data-testid="help-concepts" style={{ padding: '32px 40px', maxWidth: 820 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--shell-fg)' }}>V2 Concepts Glossary</h1>
          <Badge variant="outline">Pilot</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--shell-fg-2)', lineHeight: 1.6 }}>
          Key terms used in ConnectIO-RAD V2. Understanding these concepts will help you validate the pilot and provide meaningful feedback.
        </p>
      </div>

      {CONCEPTS.map((concept) => (
        <Card key={concept.term} style={{ marginBottom: 12 }}>
          <CardHeader style={{ paddingBottom: 6 }}>
            <CardTitle style={{ fontSize: 15 }}>{concept.term}</CardTitle>
          </CardHeader>
          <CardContent>
            <p style={{ fontSize: 13, color: 'var(--shell-fg-2)', lineHeight: 1.7, margin: concept.example ? '0 0 10px' : 0 }}>{concept.definition}</p>
            {concept.example && (
              <>
                <Separator style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 12, color: 'var(--shell-fg-3)', fontStyle: 'italic', margin: 0 }}>
                  Example: {concept.example}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
