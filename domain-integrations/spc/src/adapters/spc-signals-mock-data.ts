import type { SPCSignalSummary } from '@connectio/data-contracts'

/** Mock SPC signal summary — one active X-bar alarm on pH for the emmental process order. */
export const mockSPCSignalSummary: SPCSignalSummary = {
  processOrderId: 'PO-240308-3847',
  batchId: 'CH-240308-0047',
  activeAlarmCount: 1,
  resolvedAlarmCount: 2,
  criticalAlarmCount: 0,
  alarms: [
    {
      alarmId: 'ALARM-2024-00847',
      chartType: 'xbar-r',
      parameter: 'pH',
      ruleViolated: 'Rule 1: Point beyond 3σ control limit',
      severity: 'major',
      firedAt: '2026-05-14T05:45:00.000Z',
      resolvedAt: undefined,
      status: 'active',
    },
    {
      alarmId: 'ALARM-2024-00831',
      chartType: 'individuals',
      parameter: 'Moisture %',
      ruleViolated: 'Rule 2: 9 consecutive points on same side of centreline',
      severity: 'minor',
      firedAt: '2026-05-13T14:00:00.000Z',
      resolvedAt: '2026-05-13T16:30:00.000Z',
      status: 'resolved',
    },
    {
      alarmId: 'ALARM-2024-00819',
      chartType: 'xbar-r',
      parameter: 'Fat %',
      ruleViolated: 'Rule 4: 14 alternating points',
      severity: 'minor',
      firedAt: '2026-05-12T09:00:00.000Z',
      resolvedAt: '2026-05-12T11:00:00.000Z',
      status: 'resolved',
    },
  ],
  lastCheckedAt: '2026-05-14T10:00:00.000Z',
}
