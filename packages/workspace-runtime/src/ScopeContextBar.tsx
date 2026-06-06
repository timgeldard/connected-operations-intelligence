import type { ScopeContext } from '@connectio/data-contracts'

/** Props for ScopeContextBar. */
export interface ScopeContextBarProps {
  /** Current scope values to display in the bar. */
  scope: ScopeContext
}

/** Display labels for each ScopeContext key shown in the bar. */
const SCOPE_FIELD_LABELS: Partial<Record<keyof ScopeContext, string>> = {
  plantId: 'Plant',
  lineId: 'Line',
  workCentreId: 'Work Centre',
  regionId: 'Region',
  warehouseId: 'Warehouse',
  storageLocationId: 'Stor. Loc.',
  materialId: 'Material',
  batchId: 'Batch',
  processOrderId: 'Process Order',
  supplierId: 'Supplier',
  customerId: 'Customer',
}

/** Ordered list of scope fields to render. */
const SCOPE_FIELD_ORDER: ReadonlyArray<keyof ScopeContext> = [
  'plantId',
  'lineId',
  'workCentreId',
  'regionId',
  'warehouseId',
  'storageLocationId',
  'materialId',
  'batchId',
  'processOrderId',
  'supplierId',
  'customerId',
]

/**
 * ScopeContextBar renders the 40px breadcrumb strip showing active scope fields.
 *
 * @remarks
 * Only non-null scope fields are rendered. Fields are shown in a fixed order
 * (plant → line → batch → etc.) regardless of the order they appear in the
 * ScopeContext object. Uses the `.connectio-scopebar` CSS class from shell.css.
 */
export function ScopeContextBar({ scope }: ScopeContextBarProps) {
  const activeFields = SCOPE_FIELD_ORDER.filter(
    (key) => scope[key] !== undefined && scope[key] !== null
  )

  if (activeFields.length === 0) return null

  return (
    <div className="connectio-scopebar">
      {activeFields.map((key) => (
        <div key={key} className="connectio-scopebar-field">
          <span className="lbl">{SCOPE_FIELD_LABELS[key] ?? key}</span>
          <span className="val">{scope[key]}</span>
        </div>
      ))}
      <div className="connectio-scopebar-spacer" />
    </div>
  )
}
