import { ConnectedQualityLabBoardPanel } from '../panels/connected-quality-lab-board-panel.js'
import type { ConnectedQualityLabAdapterRequest } from '../adapters/connected-quality-lab-adapter.js'

export interface LabBoardViewProps {
  readonly request: ConnectedQualityLabAdapterRequest
}

export function LabBoardView({ request }: LabBoardViewProps) {
  return <ConnectedQualityLabBoardPanel request={request} />
}
