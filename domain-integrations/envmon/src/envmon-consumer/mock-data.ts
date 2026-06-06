import type { EnvMonL4Zone, EnvMonL5Coordinate } from '@connectio/data-contracts'

export interface EnvMonFloor {
  floorId: string
  name: string
  width: number
  height: number
}

export const MOCK_FLOORS: EnvMonFloor[] = [
  { floorId: 'GF', name: 'Ground Floor — Wet Processing & Intake', width: 800, height: 600 },
  { floorId: 'FF', name: 'First Floor — Dry Blending & Packaging', width: 800, height: 600 },
]

export const INITIAL_L4_ZONES: Record<string, EnvMonL4Zone[]> = {
  GF: [
    {
      zoneId: 'Z-GF-INTAKE',
      label: 'Milk Intake Bay (L4)',
      points: [
        { x: 50, y: 50 },
        { x: 350, y: 50 },
        { x: 350, y: 250 },
        { x: 50, y: 250 },
      ],
    },
    {
      zoneId: 'Z-GF-PAST',
      label: 'Pasteurizer Zone (L4)',
      points: [
        { x: 400, y: 50 },
        { x: 750, y: 50 },
        { x: 750, y: 250 },
        { x: 400, y: 250 },
      ],
    },
    {
      zoneId: 'Z-GF-WET',
      label: 'Wet Evaporator Floor (L4)',
      points: [
        { x: 50, y: 300 },
        { x: 750, y: 300 },
        { x: 750, y: 550 },
        { x: 50, y: 550 },
      ],
    },
  ],
  FF: [
    {
      zoneId: 'Z-FF-BLEND',
      label: 'Dry Blender Suite (L4)',
      points: [
        { x: 50, y: 50 },
        { x: 380, y: 50 },
        { x: 380, y: 550 },
        { x: 50, y: 550 },
      ],
    },
    {
      zoneId: 'Z-FF-PACK',
      label: 'Packaging Line 1 & 2 (L4)',
      points: [
        { x: 420, y: 50 },
        { x: 750, y: 50 },
        { x: 750, y: 300 },
        { x: 420, y: 300 },
      ],
    },
    {
      zoneId: 'Z-FF-WAREHOUSE',
      label: 'Staging & Palletization (L4)',
      points: [
        { x: 420, y: 330 },
        { x: 750, y: 330 },
        { x: 750, y: 550 },
        { x: 420, y: 550 },
      ],
    },
  ],
}

export const INITIAL_L5_COORDINATES: Record<string, EnvMonL5Coordinate[]> = {
  GF: [
    {
      locationId: 'LOC-GF-001',
      label: 'Intake Bay Pump Floor Swab',
      parentZoneId: 'Z-GF-INTAKE',
      x: 100,
      y: 120,
    },
    {
      locationId: 'LOC-GF-002',
      label: 'Raw Tank Valve 04 Head',
      parentZoneId: 'Z-GF-INTAKE',
      x: 280,
      y: 180,
    },
    {
      locationId: 'LOC-GF-003',
      label: 'Pasteurizer Plate 02 Surface',
      parentZoneId: 'Z-GF-PAST',
      x: 450,
      y: 100,
    },
    {
      locationId: 'LOC-GF-004',
      label: 'Homogenizer Seal Drainage Basin',
      parentZoneId: 'Z-GF-PAST',
      x: 620,
      y: 150,
    },
    {
      locationId: 'LOC-GF-005',
      label: 'Evaporator Column A Base Swab',
      parentZoneId: 'Z-GF-WET',
      x: 200,
      y: 420,
    },
    {
      locationId: 'LOC-GF-006',
      label: 'Sanitation Station 1 Floor Drain',
      parentZoneId: 'Z-GF-WET',
      x: 580,
      y: 480,
    },
  ],
  FF: [
    {
      locationId: 'LOC-FF-001',
      label: 'Blender Hopper Gasket Swab',
      parentZoneId: 'Z-FF-BLEND',
      x: 150,
      y: 150,
    },
    {
      locationId: 'LOC-FF-002',
      label: 'Powder Sifter Chute Ring',
      parentZoneId: 'Z-FF-BLEND',
      x: 200,
      y: 400,
    },
    {
      locationId: 'LOC-FF-003',
      label: 'Packaging Line 1 Filler Nozzle',
      parentZoneId: 'Z-FF-PACK',
      x: 500,
      y: 180,
    },
    {
      locationId: 'LOC-FF-004',
      label: 'Sealer Belt Surface Area',
      parentZoneId: 'Z-FF-PACK',
      x: 680,
      y: 220,
    },
    {
      locationId: 'LOC-FF-005',
      label: 'Palletizer Feed Roller Bar',
      parentZoneId: 'Z-FF-WAREHOUSE',
      x: 550,
      y: 450,
    },
  ],
}
