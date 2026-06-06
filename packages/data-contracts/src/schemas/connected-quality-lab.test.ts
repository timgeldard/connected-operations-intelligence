import { describe, it, expect } from 'vitest'
import {
  ConnectedQualityLabFailureSchema,
  ConnectedQualityLabFailuresResponseSchema,
  ConnectedQualityLabPlantSchema,
} from './connected-quality-lab.js'

describe('ConnectedQualityLabFailureSchema', () => {
  it('parses a valid fail record', () => {
    const raw = {
      mat: 'Kerry Gold Butter 500g',
      matNo: 'MAT-KG-500',
      lot: 'LOT-2026-00881',
      batch: 'BATCH-2026-001',
      line: 'LINE-A1',
      char: 'CHAR-PH-001',
      text: 'pH Value',
      res: 5.12,
      lo: 5.15,
      hi: 5.35,
      units: 'pH',
      sev: 'fail',
      ts: '2026-05-14T09:30:00.000Z',
      lotType: '89',
    }
    const result = ConnectedQualityLabFailureSchema.safeParse(raw)
    expect(result.success).toBe(true)
  })

  it('parses a warn record with null timestamp', () => {
    const raw = {
      mat: 'Clona Butter 250g',
      matNo: 'MAT-CP-250',
      lot: 'LOT-2026-00882',
      batch: 'BATCH-2026-002',
      line: 'LINE-A2',
      char: 'CHAR-MOISTURE-001',
      text: 'Moisture Content',
      res: 44.1,
      lo: 38.0,
      hi: 44.0,
      units: '%',
      sev: 'warn',
      ts: null,
      lotType: '89',
    }
    const result = ConnectedQualityLabFailureSchema.safeParse(raw)
    expect(result.success).toBe(true)
  })

  it('parses a record with absent batch, lo, hi and line fields', () => {
    const raw = {
      mat: 'Kerry Gold Butter 500g',
      matNo: 'MAT-KG-500',
      lot: 'LOT-2026-00881',
      char: 'CHAR-PH-001',
      text: 'pH Value',
      res: 5.12,
      units: 'pH',
      sev: 'fail',
      ts: '2026-05-14T09:30:00.000Z',
      lotType: '89',
    }
    const result = ConnectedQualityLabFailureSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.line).toBeUndefined()
      expect(result.data.batch).toBeUndefined()
      expect(result.data.lo).toBeUndefined()
      expect(result.data.hi).toBeUndefined()
    }
  })

  it('rejects an invalid severity value', () => {
    const raw = {
      mat: 'Test',
      matNo: 'M001',
      lot: 'L001',
      batch: 'B001',
      line: 'LINE-1',
      char: 'C001',
      text: 'Characteristic',
      res: 1.0,
      lo: 0.0,
      hi: 2.0,
      units: '%',
      sev: 'error',
      ts: null,
      lotType: '89',
    }
    const result = ConnectedQualityLabFailureSchema.safeParse(raw)
    expect(result.success).toBe(false)
  })
})

describe('ConnectedQualityLabFailuresResponseSchema', () => {
  it('parses a response with dataAvailable=false', () => {
    const raw = {
      fails: [],
      dataAvailable: false,
      reason: 'No published dataset yet for plant IE10',
      plantId: 'IE10',
    }
    const result = ConnectedQualityLabFailuresResponseSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.dataAvailable).toBe(false)
      expect(result.data.fails).toHaveLength(0)
    }
  })

  it('parses a response with fails array', () => {
    const raw = {
      fails: [
        {
          mat: 'Emmental Block 4kg',
          matNo: 'MAT-CH-EMMENTAL-BLOCK',
          lot: 'LOT-2026-00881',
          batch: 'BATCH-2026-001',
          line: 'LINE-CHILL-01',
          char: 'CHAR-FAT-DM-001',
          text: 'Fat in Dry Matter',
          res: 44.8,
          lo: 45.0,
          hi: 48.0,
          units: '%',
          sev: 'fail',
          ts: '2026-05-14T08:15:00.000Z',
          lotType: '89',
        },
      ],
      dataAvailable: true,
      plantId: 'IE10',
    }
    const result = ConnectedQualityLabFailuresResponseSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.fails).toHaveLength(1)
      expect(result.data.fails[0].sev).toBe('fail')
    }
  })
})

describe('ConnectedQualityLabPlantSchema', () => {
  it('parses a plant record', () => {
    const raw = { plantId: 'IE10', plantName: 'Kerry Listowel' }
    const result = ConnectedQualityLabPlantSchema.safeParse(raw)
    expect(result.success).toBe(true)
  })
})
