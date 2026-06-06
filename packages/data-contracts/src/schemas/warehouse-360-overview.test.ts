import { describe, it, expect } from 'vitest'
import {
  Warehouse360OverviewContextSchema,
  Warehouse360SummarySchema,
  StockZoneSchema,
  StockOverviewSchema,
  OpenHoldItemSchema,
  GoodsMovementEventSchema,
  ReplenishmentNeedSchema,
  LocationCapacitySchema,
} from './warehouse-360-overview.js'

describe('Warehouse360OverviewContextSchema', () => {
  it('accepts a valid context', () => {
    const result = Warehouse360OverviewContextSchema.safeParse({
      warehouseId: 'WH-IE10-MAIN',
      warehouseName: 'Kerry Listowel — Main Warehouse',
      plantId: 'IE10',
      totalStockLines: 347,
      holdPercent: 8.4,
      openTransfers: 23,
      capacityUtilizationPercent: 74.2,
      lastUpdatedAt: '2024-03-08T10:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects holdPercent > 100', () => {
    const result = Warehouse360OverviewContextSchema.safeParse({
      warehouseId: 'WH-IE10-MAIN',
      warehouseName: 'Kerry Listowel',
      plantId: 'IE10',
      totalStockLines: 100,
      holdPercent: 110,
      openTransfers: 0,
      capacityUtilizationPercent: 50,
      lastUpdatedAt: '2024-03-08T10:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing warehouseId', () => {
    const result = Warehouse360OverviewContextSchema.safeParse({
      warehouseName: 'Kerry Listowel',
      plantId: 'IE10',
      totalStockLines: 100,
      holdPercent: 5,
      openTransfers: 0,
      capacityUtilizationPercent: 50,
      lastUpdatedAt: '2024-03-08T10:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })
})

describe('Warehouse360SummarySchema', () => {
  it('accepts valid summary', () => {
    const result = Warehouse360SummarySchema.safeParse({
      warehouseId: 'WH-IE10-MAIN',
      totalStockLines: 347,
      unrestrictedLines: 298,
      holdLines: 29,
      qualityInspectionLines: 20,
      openGoodsReceipts: 7,
      openGoodsIssues: 12,
      openTransfers: 23,
      capacityUtilizationPercent: 74.2,
      activeReplenishmentNeeds: 5,
      confidence: 0.95,
    })
    expect(result.success).toBe(true)
  })

  it('rejects confidence > 1', () => {
    const result = Warehouse360SummarySchema.safeParse({
      warehouseId: 'WH-001',
      totalStockLines: 100,
      unrestrictedLines: 80,
      holdLines: 20,
      qualityInspectionLines: 0,
      openGoodsReceipts: 0,
      openGoodsIssues: 0,
      openTransfers: 0,
      capacityUtilizationPercent: 50,
      activeReplenishmentNeeds: 0,
      confidence: 1.5,
    })
    expect(result.success).toBe(false)
  })
})

describe('StockZoneSchema', () => {
  it('accepts valid zone', () => {
    const result = StockZoneSchema.safeParse({
      zoneId: 'ZONE-CHILL-A',
      zoneName: 'Chilled Zone A',
      zoneType: 'chilled',
      stockLines: 142,
      capacityPercent: 81,
      holdPercent: 6.3,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid zoneType', () => {
    const result = StockZoneSchema.safeParse({
      zoneId: 'ZONE-01',
      zoneName: 'Zone 1',
      zoneType: 'temperature-controlled',
      stockLines: 50,
      capacityPercent: 60,
      holdPercent: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('StockOverviewSchema', () => {
  it('accepts valid stock overview', () => {
    const result = StockOverviewSchema.safeParse({
      warehouseId: 'WH-IE10-MAIN',
      zones: [],
      totalStorageLocations: 1240,
      occupiedLocations: 920,
      blockedLocations: 47,
    })
    expect(result.success).toBe(true)
  })
})

describe('OpenHoldItemSchema', () => {
  it('accepts valid hold item', () => {
    const result = OpenHoldItemSchema.safeParse({
      holdId: 'HOLD-2024-00312',
      batchId: 'CH-240308-0047',
      materialId: 'MAT-CH-EMMENTAL-BLOCK',
      materialDescription: 'Emmental Block 4 kg',
      storageLocationId: 'CHILL-A-023-B04',
      holdReason: 'quality-hold',
      holdQuantity: 480,
      uom: 'KG',
      raisedAt: '2024-03-08T06:30:00.000Z',
      ageHours: 3.5,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid holdReason', () => {
    const result = OpenHoldItemSchema.safeParse({
      holdId: 'HOLD-001',
      materialId: 'MAT-001',
      materialDescription: 'Material',
      storageLocationId: 'LOC-001',
      holdReason: 'pending-review',
      holdQuantity: 100,
      uom: 'KG',
      raisedAt: '2024-03-08T06:30:00.000Z',
      ageHours: 1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative holdQuantity', () => {
    const result = OpenHoldItemSchema.safeParse({
      holdId: 'HOLD-001',
      materialId: 'MAT-001',
      materialDescription: 'Material',
      storageLocationId: 'LOC-001',
      holdReason: 'damaged',
      holdQuantity: -10,
      uom: 'KG',
      raisedAt: '2024-03-08T06:30:00.000Z',
      ageHours: 1,
    })
    expect(result.success).toBe(false)
  })
})

describe('GoodsMovementEventSchema', () => {
  it('accepts valid goods receipt', () => {
    const result = GoodsMovementEventSchema.safeParse({
      movementId: 'GR-2024-004812',
      timestamp: '2024-03-08T07:00:00.000Z',
      movementType: 'goods-receipt',
      materialId: 'MAT-RM-RAW-MILK',
      materialDescription: 'Raw Milk',
      quantity: 25000,
      uom: 'L',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid movementType', () => {
    const result = GoodsMovementEventSchema.safeParse({
      movementId: 'MVT-001',
      timestamp: '2024-03-08T07:00:00.000Z',
      movementType: 'internal-move',
      materialId: 'MAT-001',
      materialDescription: 'Material',
      quantity: 100,
      uom: 'KG',
    })
    expect(result.success).toBe(false)
  })
})

describe('ReplenishmentNeedSchema', () => {
  it('accepts valid replenishment need', () => {
    const result = ReplenishmentNeedSchema.safeParse({
      needId: 'REP-001',
      materialId: 'MAT-START-CULTURE-B10',
      materialDescription: 'Starter Culture B10',
      storageLocationId: 'CHILL-A-007-B03',
      currentStockQuantity: 3.5,
      reorderPoint: 5,
      targetQuantity: 15,
      uom: 'KG',
      urgency: 'high',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid urgency', () => {
    const result = ReplenishmentNeedSchema.safeParse({
      needId: 'REP-001',
      materialId: 'MAT-001',
      materialDescription: 'Material',
      storageLocationId: 'LOC-001',
      currentStockQuantity: 0,
      reorderPoint: 10,
      targetQuantity: 50,
      uom: 'KG',
      urgency: 'urgent',
    })
    expect(result.success).toBe(false)
  })
})

describe('LocationCapacitySchema', () => {
  it('accepts valid location capacity', () => {
    const result = LocationCapacitySchema.safeParse({
      locationId: 'CHILL-A-BULK-01',
      locationName: 'Chilled A — Bulk Bay 1',
      zoneId: 'ZONE-CHILL-A',
      zoneName: 'Chilled Zone A',
      totalCapacityUnits: 40000,
      usedCapacityUnits: 25000,
      utilizationPercent: 62.5,
      locationType: 'bulk-area',
      isBlocked: false,
    })
    expect(result.success).toBe(true)
  })

  it('accepts blocked location with reason', () => {
    const result = LocationCapacitySchema.safeParse({
      locationId: 'CHILL-B-011-A02',
      locationName: 'Chilled B — 011-A02',
      zoneId: 'ZONE-CHILL-B',
      zoneName: 'Chilled Zone B',
      totalCapacityUnits: 2000,
      usedCapacityUnits: 2000,
      utilizationPercent: 100,
      locationType: 'rack',
      isBlocked: true,
      blockReason: 'Quality hold',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid locationType', () => {
    const result = LocationCapacitySchema.safeParse({
      locationId: 'LOC-001',
      locationName: 'Location 1',
      zoneId: 'ZONE-001',
      zoneName: 'Zone 1',
      totalCapacityUnits: 100,
      usedCapacityUnits: 50,
      utilizationPercent: 50,
      locationType: 'pallet-bay',
      isBlocked: false,
    })
    expect(result.success).toBe(false)
  })
})
