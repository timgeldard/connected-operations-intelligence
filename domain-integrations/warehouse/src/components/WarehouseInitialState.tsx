
interface EvidenceStatus {
  readonly name: string
  readonly status: 'mock' | 'pilot' | 'live' | 'planned'
  readonly description: string
}

export interface WarehouseInitialStateProps {
  onLoadCandidate: () => void
  adapterMode: string
}

export function WarehouseInitialState({ onLoadCandidate, adapterMode }: WarehouseInitialStateProps) {
  const evidenceSlices: EvidenceStatus[] = [
    { 
      name: 'Warehouse Summary', 
      status: 'pilot', 
      description: 'KPI summary via legacy API; full lot reconciliation pending.' 
    },
    { 
      name: 'Stock Overview', 
      status: 'mock', 
      description: 'Bin-level stock simulation; live inventory sync pending.' 
    },
    { 
      name: 'Holds Management', 
      status: 'mock', 
      description: 'Stale hold status simulation; live WMS hold sync pending.' 
    },
    { 
      name: 'Goods Movements', 
      status: 'mock', 
      description: 'Activity history simulation; not linked to live movement logs.' 
    },
    { 
      name: 'Capacity Analysis', 
      status: 'mock', 
      description: 'Zone capacity simulation based on static master data.' 
    },
    { 
      name: 'Replenishment', 
      status: 'mock', 
      description: 'Requirement simulation; no automated replenishment triggers.' 
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
        <h1 style={{ fontSize: '32px', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--shell-fg)' }}>Warehouse 360</h1>
        <p style={{ fontSize: '16px', color: 'var(--shell-fg-2)', lineHeight: 1.6, maxWidth: 700, margin: '0 auto' }}>
          Explore warehouse-level KPIs, bin-level stock accuracy, and hold status. 
          This workspace provides a role-aware cockpit for warehouse supervisors 
          to monitor inventory flow and resolve reconciliation exceptions.
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
             <span style={{ color: 'var(--shell-fg-2)' }}>WMS Summary: <span style={{ color: statusColors['pilot'] }}>Pilot (Legacy API)</span></span>
             <span style={{ color: 'var(--shell-fg-3)' }}>|</span>
             <span style={{ color: 'var(--shell-fg-2)' }}>Inventory: <span style={{ color: statusColors['mock'] }}>Mock Simulation</span></span>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '11px', color: 'var(--shell-fg-3)', maxWidth: 400 }}>
          Warehouse KPIs are driven by the V1 WMS proxy. Detailed stock lines and movement 
          history are currently high-fidelity simulations.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
        <div style={{ background: 'var(--shell-surface)', border: '1px solid var(--shell-line)', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 16px 0' }}>Evidence Preview</h2>
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
              Load the primary Warehouse UAT candidate for validation. This profile includes 
              mock bin accuracy data, hold reconciliation scenarios, and capacity alerts.
            </p>
            <div style={{ fontSize: '12px', fontFamily: 'monospace', background: 'var(--shell-surface-2)', padding: '10px', borderRadius: '4px', color: 'var(--shell-fg-2)', marginBottom: 20 }}>
              Warehouse: WH-LISTOWEL-01<br />
              Plant: IE10<br />
              SLoc: 1001 (Main Storage)
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
            Run UAT Candidate Warehouse View
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
            Movement history and bin stock levels are currently simulated. 
            <strong> 'Unavailable' status indicates no response from the current WMS source. 
            It must not be interpreted as zero stock or empty bin locations.</strong> 
          </p>
        </div>
      </div>
    </div>
  )
}
