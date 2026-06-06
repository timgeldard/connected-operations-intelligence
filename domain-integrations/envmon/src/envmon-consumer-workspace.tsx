import { useState } from 'react'
import type { ScopeContext, EnvMonL4Zone, EnvMonL5Coordinate } from '@connectio/data-contracts'
import {
  MOCK_FLOORS,
  INITIAL_L4_ZONES,
  INITIAL_L5_COORDINATES,
} from './envmon-consumer/mock-data.js'
import { FloorPlanCanvas } from './envmon-consumer/floor-plan-canvas.js'
import {
  Card,
  CardHeader,
  CardDescription,
  CardContent,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  StatusBadge,
} from '@connectio/design-system'

export interface EnvMonConsumerWorkspaceProps {
  readonly scope: ScopeContext
}

export function EnvMonConsumerWorkspace({ scope }: EnvMonConsumerWorkspaceProps) {
  const [selectedPlant, setSelectedPlant] = useState(scope.plantId || 'IE10')
  const [activeFloorId, setActiveFloorId] = useState('GF')
  const [activeTab, setActiveTab] = useState<'map' | 'alerts' | 'trends' | 'actions'>('map')

  // Layout states for zones and coordinates
  const [zones, setZones] = useState(INITIAL_L4_ZONES)
  const [coordinates, setCoordinates] = useState(INITIAL_L5_COORDINATES)

  const activeFloor = MOCK_FLOORS.find((f) => f.floorId === activeFloorId) || MOCK_FLOORS[0]
  const currentFloorZones = zones[activeFloorId] || []
  const currentFloorCoordinates = coordinates[activeFloorId] || []

  const updateZonesForFloor = (newZones: EnvMonL4Zone[]) => {
    setZones((prev) => ({
      ...prev,
      [activeFloorId]: newZones,
    }))
  }

  const updateCoordinatesForFloor = (newCoords: EnvMonL5Coordinate[]) => {
    setCoordinates((prev) => ({
      ...prev,
      [activeFloorId]: newCoords,
    }))
  }

  // Calculate KPIs
  const totalSwabPoints = currentFloorCoordinates.length
  const positiveFails = 1 // Mock fail swab
  const complianceRate = totalSwabPoints > 0 ? Math.round(((totalSwabPoints - positiveFails) / totalSwabPoints) * 100) : 100

  return (
    <div
      style={{
        padding: 24,
        background: '#020617',
        minHeight: '100vh',
        color: '#f8fafc',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header section with plant selector */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          background: 'rgba(30, 41, 59, 0.4)',
          backdropFilter: 'blur(8px)',
          padding: '16px 24px',
          borderRadius: 8,
          border: '1px solid #1e293b',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: '#f8fafc', fontWeight: 700 }}>
            Microbiological Environmental Surveillance (Consumer)
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Site-level swab mapping and containment area layout builder
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Plant Scope:</label>
          <select
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #334155',
              background: '#0f172a',
              color: '#f8fafc',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <option value="IE10">Kerry Listowel (IE10)</option>
            <option value="IE11">Kerry Charleville (IE11)</option>
            <option value="US10">Kerry Beloit (US10)</option>
          </select>
        </div>
      </header>

      {/* KPI stats bar */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ background: '#0f172a', padding: 16, borderRadius: 6, border: '1px solid #1e293b' }}>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Compliance Rate</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: complianceRate > 90 ? '#10b981' : '#f59e0b', marginTop: 4 }}>
            {complianceRate}%
          </div>
        </div>
        <div style={{ background: '#0f172a', padding: 16, borderRadius: 6, border: '1px solid #1e293b' }}>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mapped L4 Zones</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#6366f1', marginTop: 4 }}>
            {currentFloorZones.length} Areas
          </div>
        </div>
        <div style={{ background: '#0f172a', padding: 16, borderRadius: 6, border: '1px solid #1e293b' }}>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>L5 Swab Points</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981', marginTop: 4 }}>
            {totalSwabPoints} Active
          </div>
        </div>
        <div style={{ background: '#0f172a', padding: 16, borderRadius: 6, border: '1px solid #1e293b' }}>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Microbial Alerts</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444', marginTop: 4 }}>
            {positiveFails} Open Fail
          </div>
        </div>
      </section>

      {/* View Switcher Tabs & Floor Selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          borderBottom: '1px solid #1e293b',
          paddingBottom: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={() => setActiveTab('map')}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px 12px',
              color: activeTab === 'map' ? '#10b981' : '#64748b',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              borderBottom: activeTab === 'map' ? '2px solid #10b981' : 'none',
            }}
          >
            🗺 Interactive Layout Editor
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px 12px',
              color: activeTab === 'alerts' ? '#10b981' : '#64748b',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              borderBottom: activeTab === 'alerts' ? '2px solid #10b981' : 'none',
            }}
          >
            🚨 Swab Alert Log
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px 12px',
              color: activeTab === 'trends' ? '#10b981' : '#64748b',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              borderBottom: activeTab === 'trends' ? '2px solid #10b981' : 'none',
            }}
          >
            📈 Microbiological Trends
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px 12px',
              color: activeTab === 'actions' ? '#10b981' : '#64748b',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              borderBottom: activeTab === 'actions' ? '2px solid #10b981' : 'none',
            }}
          >
            📋 Corrective Actions
          </button>
        </div>

        {/* Floor switcher */}
        <div style={{ display: 'flex', gap: 8 }}>
          {MOCK_FLOORS.map((floor) => (
            <button
              key={floor.floorId}
              onClick={() => setActiveFloorId(floor.floorId)}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                border: '1px solid #1e293b',
                background: activeFloorId === floor.floorId ? '#0f172a' : 'transparent',
                color: activeFloorId === floor.floorId ? '#f8fafc' : '#64748b',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {floor.name.split(' — ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Views Container */}
      <main style={{ background: '#0a0f1d', borderRadius: 8, border: '1px solid #1e293b', overflow: 'hidden' }}>
        {activeTab === 'map' && (
          <FloorPlanCanvas
            floor={activeFloor}
            zones={currentFloorZones}
            coordinates={currentFloorCoordinates}
            onSaveZones={updateZonesForFloor}
            onSaveCoordinates={updateCoordinatesForFloor}
          />
        )}

        {activeTab === 'alerts' && (
          <div style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#f8fafc' }}>Environmental Surveillance Alerts</h3>
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #1e293b', color: '#94a3b8' }}>
                    <th style={{ padding: '10px 12px' }}>Alert ID</th>
                    <th style={{ padding: '10px 12px' }}>Site Location</th>
                    <th style={{ padding: '10px 12px' }}>Pathogen/MIC</th>
                    <th style={{ padding: '10px 12px' }}>Severity</th>
                    <th style={{ padding: '10px 12px' }}>Detected Date</th>
                    <th style={{ padding: '10px 12px' }}>Remediation Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #1e293b', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <td style={{ padding: '12px 12px', fontWeight: 600, color: '#fca5a5' }}>ALT-202605-890</td>
                    <td style={{ padding: '12px 12px' }}>Homogenizer Seal Drainage Basin (LOC-GF-004)</td>
                    <td style={{ padding: '12px 12px', color: '#fca5a5' }}>Listeria spp. (MIC-LISP)</td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{ padding: '2px 6px', background: '#7f1d1d', color: '#fca5a5', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>High</span>
                    </td>
                    <td style={{ padding: '12px 12px' }}>2026-05-26 14:32</td>
                    <td style={{ padding: '12px 12px', color: '#f59e0b', fontWeight: 600 }}>In Progress</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#f8fafc', textAlign: 'left' }}>Biological Compliance Trends</h3>
            <p style={{ fontSize: 13, textAlign: 'left', marginBottom: 20 }}>Historical microbial test pass rates and pathogen isolation frequency.</p>
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #1e293b', borderRadius: 6 }}>
              📈 Interactive SVG compliance charts loading...
            </div>
          </div>
        )}

        {activeTab === 'actions' && (
          <div style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#f8fafc' }}>Active Corrective Actions (CAPA)</h3>
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #1e293b', color: '#94a3b8' }}>
                    <th style={{ padding: '10px 12px' }}>Action ID</th>
                    <th style={{ padding: '10px 12px' }}>Description</th>
                    <th style={{ padding: '10px 12px' }}>Assignee</th>
                    <th style={{ padding: '10px 12px' }}>Due Date</th>
                    <th style={{ padding: '10px 12px' }}>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '12px 12px', fontWeight: 600 }}>CAPA-2026-0045</td>
                    <td style={{ padding: '12px 12px' }}>Perform hot water flush and sanitize Pasteurizer Valve 04 line</td>
                    <td style={{ padding: '12px 12px' }}>Site Sanitation Team B</td>
                    <td style={{ padding: '12px 12px' }}>2026-05-29</td>
                    <td style={{ padding: '12px 12px', color: '#ef4444' }}>Critical</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
