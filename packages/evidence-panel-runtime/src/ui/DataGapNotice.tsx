import { EmptyState } from '@connectio/design-system'

export interface DataGapNoticeProps {
  readonly source: string
  readonly tracking: string
}

export function DataGapNotice({ source, tracking }: DataGapNoticeProps) {
  const description = `Unresolved SAP dependency: ${source} (tracked under ${tracking})`
  return (
    <EmptyState
      title="Data gap"
      description={description}
    />
  )
}
