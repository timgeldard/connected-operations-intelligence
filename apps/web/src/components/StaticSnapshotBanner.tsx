interface Props {
  snapshotDate: string
}

export function StaticSnapshotBanner({ snapshotDate }: Props) {
  return (
    <div
      role="alert"
      aria-label="Static snapshot notice"
      style={{
        background: '#FEF3C7',
        border: '1px solid #F59E0B',
        borderRadius: 6,
        padding: '8px 14px',
        marginBottom: 20,
        fontSize: 13,
        color: '#92400E',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontWeight: 600 }}>⚠ Static Snapshot</span>
      <span>— data accurate as of {snapshotDate}. This page does not reflect live system state.</span>
    </div>
  )
}
