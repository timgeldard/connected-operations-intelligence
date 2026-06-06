
interface EvidenceStatus {
  readonly name: string
  readonly status: 'mock' | 'pilot' | 'live' | 'planned'
  readonly description: string
}

export interface BatchReleaseInitialStateProps {
  onLoadCandidate: () => void
  adapterMode: string
}

export function BatchReleaseInitialState({ onLoadCandidate, adapterMode }: BatchReleaseInitialStateProps) {
  const evidenceSlices: EvidenceStatus[] = [
    { 
      name: 'Release Summary', 
      status: 'mock', 
      description: 'Consolidated readiness simulation; usage decisions do not write back to SAP QM.' 
    },
    { 
      name: 'Quality Results', 
      status: 'pilot', 
      description: 'Live lab failure data available via legacy API; full lot verification pending.' 
    },
    { 
      name: 'CoA Readiness', 
      status: 'mock', 
      description: 'Simulated certificate availability based on quality inspection lot status.' 
    },
    { 
      name: 'SPC Signals', 
      status: 'mock', 
      description: 'Nelson/Western Electric rule simulation; not yet linked to live SPC catalog.' 
    },
    { 
      name: 'Operations / POH', 
      status: 'mock', 
      description: 'Process order history and goods movement simulation for conformance review.' 
    },
    { 
      name: 'Trace Exposure', 
      status: 'mock', 
      description: 'Read-only trace lineage for recall readiness and impact analysis.' 
    }
  ]

  const statusColors: Record<string, string> = {
    live: 'var(--shell-good, #1F8B4C)',
    pilot: 'var(--shell-accent, #0066CC)',
    mock: 'var(--shell-warn, #C7821C)',
    planned: 'var(--shell-fg-3)'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--shell-fg)' }}>Release a batch</h1>
        <p style={{ fontSize: '16px', color: 'var(--shell-fg-2)', lineHeight: 1.6, maxWidth: 700, margin: '0 auto' }}>
          Finalize usage decisions by reviewing cross-domain evidence. 
          This cockpit aggregates quality results, SPC signals, deviations, 
          and trace exposure to provide a consolidated release recommendation.
        </p>
      </div>

      <div style={{ 
        background: 'var(--shell-surface-2)', 
        border: '1px solid var(--shell-line)', 
        borderRadius: '8px', 
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>Source Readiness:</span>
          <div style={{ display: 'flex', gap: 8, fontSize: '12px' }}>
             <span style={{ color: 'var(--shell-fg-2)' }}>Mode: <strong>{adapterMode}</strong></span>
             <span style={{ color: 'var(--shell-fg-3)' }}>|</span>
             <span style={{ color: 'var(--shell-fg-2)' }}>Lab Board: <span style={{ color: statusColors['pilot'] }}>Pilot (Legacy API)</span></span>
             <span style={{ color: 'var(--shell-fg-3)' }}>|</span>
             <span style={{ color: 'var(--shell-fg-2)' }}>Decisions: <span style={{ color: statusColors['mock'] }}>Mock Simulation</span></span>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '11px', color: 'var(--shell-fg-3)', maxWidth: 400 }}>
          Most evidence panels in this workspace are currently in mock/simulation mode. 
          Lab board data is live via the Connected Quality V1 proxy.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
        <div style={{ background: 'var(--shell-surface)', border: '1px solid var(--shell-line)', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 16px 0' }}>Evidence Completeness</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {evidenceSlices.map(slice => (
              <div key={slice.name} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>{slice.name}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: statusColors[slice.status] }}>{slice.status}</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--shell-fg-3)' }}>{slice.description}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--shell-surface)', border: '1px solid var(--shell-line)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 12px 0' }}>UAT Candidate</h2>
            <p style={{ fontSize: '13px', color: 'var(--shell-fg-2)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Load the primary cross-domain UAT candidate for validation. This case links 
              Traceability, SPC, and Warehouse evidence into a single decision workflow.
            </p>
            <div style={{ fontSize: '12px', fontFamily: 'monospace', background: 'var(--shell-surface-2)', padding: '10px', borderRadius: '4px', color: 'var(--shell-fg-2)', marginBottom: 20 }}>
              Release Case: RC-2024-001847<br />
              Material: 20035129<br />
              Batch: 800
            </div>
          </div>
          <button 
            onClick={onLoadCandidate}
            style={{ 
              width: '100%', 
              padding: '12px', 
              background: 'var(--shell-surface-2)', 
              border: '1px solid var(--shell-line)', 
              borderRadius: '6px', 
              fontWeight: 600,
              cursor: 'pointer',
              color: 'var(--shell-fg)'
            }}
          >
            Run UAT Candidate Release Workflow
          </button>
        </div>
      </div>

      <div style={{ 
        background: 'rgba(199, 51, 21, 0.05)', 
        border: '1px solid rgba(199, 51, 21, 0.2)', 
        borderRadius: '8px', 
        padding: '16px',
        display: 'flex',
        gap: 16
      }}>
        <span style={{ fontSize: '20px' }}>⚠️</span>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--shell-bad, #C73315)', margin: '0 0 4px 0' }}>Trust & Readiness Notice</h3>
          <p style={{ fontSize: '12px', color: 'var(--shell-fg-2)', lineHeight: 1.5, margin: 0 }}>
            Usage decisions made in this workspace do not write back to SAP QM. 
            <strong> Simulated 'Ready' status indicates workflow feasibility, not production approval.</strong> 
            Unavailable evidence must not be interpreted as zero exposure or no risk.
          </p>
        </div>
      </div>
    </div>
  )
}
