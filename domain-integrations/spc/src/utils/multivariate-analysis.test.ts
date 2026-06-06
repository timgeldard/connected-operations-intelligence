import { describe, it, expect } from 'vitest'
import {
  calculatePearsonCorrelation,
  invertMatrix,
  alignSeriesByBatch,
  computeMultivariateT2,
} from './multivariate-analysis.js'
import type { ControlChartSeries } from '@connectio/data-contracts'

describe('Multivariate Analysis Helpers', () => {
  describe('calculatePearsonCorrelation', () => {
    it('returns perfect correlation for identical arrays', () => {
      const x = [1, 2, 3, 4, 5]
      const y = [2, 4, 6, 8, 10]
      expect(calculatePearsonCorrelation(x, y)).toBeCloseTo(1.0, 5)
    })

    it('returns negative correlation for inverse relationship', () => {
      const x = [1, 2, 3, 4, 5]
      const y = [5, 4, 3, 2, 1]
      expect(calculatePearsonCorrelation(x, y)).toBeCloseTo(-1.0, 5)
    })

    it('returns null if array lengths are less than 2', () => {
      expect(calculatePearsonCorrelation([1], [1])).toBeNull()
    })
  })

  describe('invertMatrix', () => {
    it('correctly inverts an identity matrix', () => {
      const identity = [
        [1, 0],
        [0, 1],
      ]
      const inv = invertMatrix(identity)
      expect(inv).not.toBeNull()
      expect(inv![0][0]).toBeCloseTo(1.0, 3)
      expect(inv![0][1]).toBeCloseTo(0.0, 3)
      expect(inv![1][0]).toBeCloseTo(0.0, 3)
      expect(inv![1][1]).toBeCloseTo(1.0, 3)
    })

    it('correctly inverts a general 2x2 matrix', () => {
      const mat = [
        [4, 7],
        [2, 6],
      ]
      const inv = invertMatrix(mat)
      expect(inv).not.toBeNull()
      // Expected inverse: [ [ 0.6, -0.7 ], [ -0.2, 0.4 ] ]
      expect(inv![0][0]).toBeCloseTo(0.6, 1)
      expect(inv![0][1]).toBeCloseTo(-0.7, 1)
      expect(inv![1][0]).toBeCloseTo(-0.2, 1)
      expect(inv![1][1]).toBeCloseTo(0.4, 1)
    })
  })

  describe('alignSeriesByBatch and computeMultivariateT2', () => {
    it('aligns multiple series and calculates Hotelling T^2', () => {
      const seriesA: ControlChartSeries = {
        chartId: 'A',
        chartType: 'individuals',
        characteristicId: 'char-1',
        characteristicName: 'pH',
        centerLine: 6.5,
        confidence: 0.95,
        points: [
          { pointId: '1', batchId: 'batch-1', value: 6.6, timestamp: '2026-05-01T00:00:00Z', signalIds: [], status: 'in-control' },
          { pointId: '2', batchId: 'batch-2', value: 6.4, timestamp: '2026-05-01T01:00:00Z', signalIds: [], status: 'in-control' },
        ],
      }

      const seriesB: ControlChartSeries = {
        chartId: 'B',
        chartType: 'individuals',
        characteristicId: 'char-2',
        characteristicName: 'moisture',
        centerLine: 39.0,
        confidence: 0.95,
        points: [
          { pointId: '3', batchId: 'batch-1', value: 39.2, timestamp: '2026-05-01T00:00:00Z', signalIds: [], status: 'in-control' },
          { pointId: '4', batchId: 'batch-2', value: 38.8, timestamp: '2026-05-01T01:00:00Z', signalIds: [], status: 'in-control' },
        ],
      }

      // Add dummy points to make N >= 5 so multivariate runs
      for (let i = 3; i <= 6; i++) {
        seriesA.points.push({ pointId: `A-${i}`, batchId: `batch-${i}`, value: 6.5 + (i % 2 === 0 ? 0.1 : -0.1), timestamp: `2026-05-01T0${i}:00:00Z`, signalIds: [], status: 'in-control' })
        seriesB.points.push({ pointId: `B-${i}`, batchId: `batch-${i}`, value: 39.0 + (i % 2 === 0 ? 0.2 : -0.2), timestamp: `2026-05-01T0${i}:00:00Z`, signalIds: [], status: 'in-control' })
      }

      const aligned = alignSeriesByBatch([seriesA, seriesB])
      expect(aligned.length).toBe(6)
      expect(aligned[0].values['char-1']).toBe(6.6)
      expect(aligned[0].values['char-2']).toBe(39.2)

      const t2Points = computeMultivariateT2([seriesA, seriesB], aligned)
      expect(t2Points.length).toBe(6)
      expect(t2Points[0].t2).toBeGreaterThanOrEqual(0)
      expect(t2Points[0].contributors.length).toBe(2)
    })
  })
})
