/**
 * This file is auto-generated from app_contract_manifest.yml.
 * Do not modify this file manually.
 */

/**
 * Overview metrics for the Warehouse 360 dashboard. Candidate contract pending DEV profiling of grain, primary key uniqueness, plant_id nullability, data types, and freshness.

 * Source View: vw_consumption_warehouse360_overview
 * Version: 0.1.0
 */
export interface Warehouse360Overview {
  /** SAP plant ID or 'GLOBAL' */
  plant_id: string;
  /** Timestamp of overview snapshot generation */
  snapshot_ts: string;
  /** Total open process orders */
  orders_total?: number;
  /** Process orders in critical status (high risk) */
  orders_red?: number;
  /** Process orders in warning status (medium risk) */
  orders_amber?: number;
  /** Total open transfer requirements */
  trs_open?: number;
  /** Total open transfer orders */
  tos_open?: number;
  /** Total outbound deliveries scheduled for today */
  deliveries_today?: number;
  /** Total outbound deliveries at risk of delay */
  deliveries_at_risk?: number;
  /** Total open inbound purchase orders */
  inbound_open?: number;
  /** Total blocked storage bins */
  bins_blocked?: number;
  /** Total warehouse storage bins */
  bins_total?: number;
  /** Bin occupancy utilization rate percentage */
  bin_util_pct?: number;
}

export const Warehouse360OverviewContract = {
  id: "warehouse360.overview",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_warehouse360_overview",
  grain: "one row per plant_id and snapshot timestamp",
  primaryKey: ["plant_id", "snapshot_ts"],
  freshness: {
    expectedMinutes: 15,
    warningMinutes: 30,
    criticalMinutes: 60,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Inbound purchase-order backlog at PO-LINE grain (first wave — ADR-0004 D1; sourced from gold_inbound_po_line_backlog / silver.purchase_order EKKO/EKPO). Core fields + material name; gr_qty/open_qty (goods-receipt aggregation), delivery_date (EKET), qa_status, and vendor_name are deferred future enrichment. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_warehouse360_inbound_backlog
 * Version: 0.2.0
 */
export interface Warehouse360InboundBacklog {
  /** SAP plant ID */
  plant_id: string;
  /** Purchase order ID */
  po_id: string;
  /** Purchase order item line number */
  po_item: string;
  /** PO document type */
  doc_type?: string;
  /** Vendor identifier */
  vendor_id?: string;
  /** Target storage location ID */
  storage_loc?: string;
  /** Material code */
  material_id?: string;
  /** Material description */
  material_name?: string;
  /** Total ordered quantity */
  ordered_qty?: number;
  /** Base unit of measure */
  uom?: string;
  /** Purchase order creation date (EKKO BEDAT, cast to DATE in silver) */
  po_date?: string;
  /** Age of the oldest open PO line in days */
  oldest_po_age_days?: number;
  /** Backlog risk band (green/amber/red) */
  inbound_backlog_risk_band?: string;
}

export const Warehouse360InboundBacklogContract = {
  id: "warehouse360.inbound_backlog",
  version: "0.2.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_warehouse360_inbound_backlog",
  grain: "one row per plant_id, purchase order ID, and PO item",
  primaryKey: ["plant_id", "po_id", "po_item"],
  freshness: {
    expectedMinutes: 30,
    warningMinutes: 60,
    criticalMinutes: 120,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Outbound deliveries picking backlog and cutoff risk. Candidate contract pending DEV profiling of grain, primary key uniqueness, plant_id nullability, data types, and freshness.

 * Source View: vw_consumption_warehouse360_outbound_backlog
 * Version: 0.1.0
 */
export interface Warehouse360OutboundBacklog {
  /** SAP plant ID */
  plant_id: string;
  /** Outbound delivery number */
  delivery_id: string;
  /** Delivery document type */
  delivery_type?: string;
  /** Ship-to customer number */
  customer_id?: string;
  /** Customer name */
  customer_name?: string;
  /** Planned goods issue date */
  planned_gi_date?: string;
  /** Actual goods issue date */
  actual_gi_date?: string;
  /** SAP delivery date (string) */
  delivery_date?: string;
  /** Gross weight of the delivery */
  gross_weight?: number;
  /** Picking progress percentage */
  pick_pct: number;
  /** Total line items in delivery */
  line_count: number;
  /** Computed risk band (red/amber/green/grey) */
  risk: string;
  /** Delivery goods-issue shipped status */
  shipped: boolean;
}

export const Warehouse360OutboundBacklogContract = {
  id: "warehouse360.outbound_backlog",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_warehouse360_outbound_backlog",
  grain: "one row per plant_id and delivery ID",
  primaryKey: ["plant_id", "delivery_id"],
  freshness: {
    expectedMinutes: 15,
    warningMinutes: 30,
    criticalMinutes: 60,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Process-order staging workload and readiness at ORDER grain (first wave — ADR-0004 D3). Component-grain detail (reservation_no, batch_id) and the SAP order number (sap_order) are deferred to a future staging_components contract. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_warehouse360_staging_workload
 * Version: 0.2.0
 */
export interface Warehouse360StagingWorkload {
  /** SAP plant ID */
  plant_id: string;
  /** Process order identifier */
  order_id: string;
  /** Material code being staged */
  material_id?: string;
  /** Process order total quantity */
  order_qty?: number;
  /** Unit of measure */
  uom?: string;
  /** Material description */
  material_name?: string;
  /** Scheduled production start date */
  sched_start?: string;
  /** Scheduled production finish date */
  sched_finish?: string;
  /** Staging transfer order items completion percentage */
  staging_pct: number;
  /** Total transfer order line items generated for staging */
  to_items_total: number;
  /** Staged (completed) transfer order line items */
  to_items_done: number;
  /** Time remaining until scheduled production start in minutes */
  mins_to_start?: number;
  /** Computed staging risk band (red/amber/green/grey/unvalidated) */
  risk: string;
}

export const Warehouse360StagingWorkloadContract = {
  id: "warehouse360.staging_workload",
  version: "0.2.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_warehouse360_staging_workload",
  grain: "one row per plant_id and process order",
  primaryKey: ["plant_id", "order_id"],
  freshness: {
    expectedMinutes: 15,
    warningMinutes: 30,
    criticalMinutes: 60,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Warehouse stock exceptions including expiry, shelf life breach, and status blocks. Candidate contract pending DEV profiling of grain, primary key uniqueness, plant_id nullability, data types, and freshness.

 * Source View: vw_consumption_warehouse360_stock_exceptions
 * Version: 0.2.0
 */
export interface Warehouse360StockExceptions {
  /** SAP plant ID */
  plant_id: string;
  /** Material code */
  material_id: string;
  /** Batch number */
  batch_id: string;
  /** Computed exception bucket (EXPIRED/LT_7_DAYS/DAYS_7_30/DAYS_30_90) */
  exception_type: string;
  /** Exceptional stock quantity */
  qty?: number;
  /** Days remaining until the batch expires */
  minimum_days_to_expiry?: number;
  /** True if remaining shelf life is below minimum limits */
  has_minimum_shelf_life_breach?: boolean;
}

export const Warehouse360StockExceptionsContract = {
  id: "warehouse360.stock_exceptions",
  version: "0.2.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_warehouse360_stock_exceptions",
  grain: "one row per plant_id, material_id, batch_id, and exception type",
  primaryKey: ["plant_id", "material_id", "batch_id", "exception_type"],
  freshness: {
    expectedMinutes: 30,
    warningMinutes: 60,
    criticalMinutes: 120,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Material shortfalls — open transfer-requirement backlog aggregated to plant x material (ADR-0004 D2; sourced from gold_transfer_requirement_material_backlog / silver.warehouse_transfer_requirement). Candidate contract pending DEV profiling.

 * Source View: vw_consumption_warehouse360_shortfalls
 * Version: 0.2.0
 */
export interface Warehouse360Shortfalls {
  /** SAP plant ID */
  plant_id: string;
  /** Shortage material code */
  material_id: string;
  /** Total open transfer requirement quantity pending staging */
  shortfall_qty?: number;
  /** Count of open transfer requirement lines for this material */
  open_items_count?: number;
  /** Creation date of the oldest open transfer requirement */
  oldest_tr_date?: string;
}

export const Warehouse360ShortfallsContract = {
  id: "warehouse360.shortfalls",
  version: "0.2.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_warehouse360_shortfalls",
  grain: "one row per plant_id and material_id",
  primaryKey: ["plant_id", "material_id"],
  freshness: {
    expectedMinutes: 15,
    warningMinutes: 30,
    criticalMinutes: 60,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * IM/WM stock discrepancies summarised per material and exception type (first-wave AGGREGATE contract — ADR-0004 D6). gold_warehouse_exceptions carries no stable per-exception variance key (storage_location_id/bin_id absent; reference_id ~99% null), so detail rows are rolled up to plant x material x batch x exception_type with count/quantity/severity/age/date measures. A detail-grain reconciliation contract is future work, only once a stable variance key exists upstream. detected_date is the QUERY-TIME evaluation date (the underlying gold_warehouse_exceptions_live serving view confirms age-threshold exceptions and stamps detected_date at query time; the deterministic base MV does not persist a first-seen date), so oldest_/latest_detected_date both equal the evaluation date today — they are kept for interface stability until a persisted first-seen date exists upstream. Candidate contract pending DEV profiling of primary key uniqueness, plant_id nullability, and freshness.

 * Source View: vw_consumption_warehouse360_im_wm_reconciliation
 * Version: 0.2.0
 */
export interface Warehouse360ImWmReconciliation {
  /** SAP plant ID */
  plant_id: string;
  /** Material code */
  material_id: string;
  /** Batch number (null for non-batch-managed exceptions) */
  batch_id?: string;
  /** Type of discrepancy (e.g. IM_WM_TRUE_VARIANCE, NEGATIVE_WM_QUANT) */
  exception_type: string;
  /** Number of source exception rows aggregated into this summary row */
  exception_count: number;
  /** Total discrepant stock quantity across the aggregated exceptions */
  qty?: number;
  /** Maximum exception severity rating across the aggregated exceptions */
  severity?: number;
  /** Maximum exception age in days across the aggregated exceptions */
  max_age_days?: number;
  /** Earliest detection date across the aggregated exceptions. Currently the query-time evaluation date (no persisted first-seen date upstream) — equals latest_detected_date. */
  oldest_detected_date?: string;
  /** Most recent detection date across the aggregated exceptions. Currently the query-time evaluation date (no persisted first-seen date upstream). */
  latest_detected_date?: string;
  /** Representative context detail from the aggregated exceptions */
  detail_text?: string;
}

export const Warehouse360ImWmReconciliationContract = {
  id: "warehouse360.im_wm_reconciliation",
  version: "0.2.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_warehouse360_im_wm_reconciliation",
  grain: "one row per plant_id, material_id, batch_id, and exception type (aggregate exception summary)",
  primaryKey: ["plant_id", "material_id", "batch_id", "exception_type"],
  freshness: {
    expectedMinutes: 30,
    warningMinutes: 60,
    criticalMinutes: 120,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Dispensary staging component weighing and preparation queue. Candidate contract pending DEV profiling of grain, primary key uniqueness, plant_id nullability, data types, and freshness.

 * Source View: vw_consumption_warehouse360_dispensary_queue
 * Version: 0.1.0
 */
export interface Warehouse360DispensaryQueue {
  /** SAP plant ID */
  plant_id: string;
  /** Process order ID */
  order_id: string;
  /** Weighing component material code */
  component_id: string;
  /** Dispensary task identifier */
  task_id: string;
  /** Dispensary task status */
  status?: string;
}

export const Warehouse360DispensaryQueueContract = {
  id: "warehouse360.dispensary_queue",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_warehouse360_dispensary_queue",
  grain: "one row per plant_id, process order, component, and weighing task",
  primaryKey: ["plant_id", "order_id", "component_id", "task_id"],
  freshness: {
    expectedMinutes: 15,
    warningMinutes: 30,
    criticalMinutes: 60,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Warehouse stock zone capacities and bin counts.
 * Source View: vw_consumption_warehouse360_stock_zones
 * Version: 0.1.0
 */
export interface Warehouse360StockZones {
  /** SAP plant ID */
  plant_id: string;
  /** Warehouse number */
  warehouse_number: string;
  /** Storage type */
  storage_type: string;
  /** Bin type */
  bin_type: string;
  /** Total bin count */
  bin_record_count: number;
  /** Occupied bin count */
  occupied_bin_count: number;
  /** Empty bin count */
  empty_bin_count: number;
  /** Blocked bin count */
  blocked_bin_count: number;
  /** Occupancy rate */
  occupancy_rate: number;
}

export const Warehouse360StockZonesContract = {
  id: "warehouse360.stock_zones",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_warehouse360_stock_zones",
  grain: "one row per plant_id, warehouse_number, storage_type, and bin_type",
  primaryKey: ["plant_id", "warehouse_number", "storage_type", "bin_type"],
  freshness: {
    expectedMinutes: 30,
    warningMinutes: 60,
    criticalMinutes: 120,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Warehouse stock and hold status for a batch, release-decision oriented.
 * Source View: vw_consumption_warehouse360_batch_hold_status
 * Version: 0.1.0
 */
export interface Warehouse360BatchHoldStatus {
  /** SAP plant ID */
  plant_id: string;
  /** Storage location ID */
  storage_location_id: string;
  /** Material ID */
  material_id: string;
  /** Batch ID */
  batch_id: string;
  /** Base unit of measure */
  uom: string;
  /** Unrestricted stock quantity */
  unrestricted_quantity: number;
  /** Blocked stock quantity */
  blocked_quantity: number;
  /** Restricted stock quantity */
  restricted_quantity: number;
  /** Total stock quantity */
  total_quantity: number;
  /** Stock status category */
  stock_type: string;
  /** Whether batch is under any blocking hold */
  has_blocking_hold: boolean;
  /** Timestamp when status was last updated */
  last_updated_at: string;
}

export const Warehouse360BatchHoldStatusContract = {
  id: "warehouse360.batch_hold_status",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_warehouse360_batch_hold_status",
  grain: "one row per plant_id, storage_location_id, material_id, and batch_id",
  primaryKey: ["plant_id", "storage_location_id", "material_id", "batch_id"],
  freshness: {
    expectedMinutes: 30,
    warningMinutes: 60,
    criticalMinutes: 120,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Production staging readiness summary counts.
 * Source View: vw_consumption_warehouse360_staging_readiness
 * Version: 0.1.0
 */
export interface Warehouse360StagingReadiness {
  /** SAP plant ID */
  plant_id: string;
  /** Planned staging start date */
  plan_date: string;
  /** Total number of scheduled process orders */
  total_orders: number;
  /** Count of fully staged orders */
  fully_staged: number;
  /** Count of partially staged orders */
  partially_staged: number;
  /** Count of not staged orders */
  not_staged: number;
  /** Count of orders in the red staging-risk band (staging_fraction and scheduled-start derived) — a staging-risk classification, NOT a QM/blocking-hold count (hold provenance is a documented data gap).
 */
  blocked: number;
}

export const Warehouse360StagingReadinessContract = {
  id: "warehouse360.staging_readiness",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_warehouse360_staging_readiness",
  grain: "one row per plant_id and plan_date",
  primaryKey: ["plant_id", "plan_date"],
  freshness: {
    expectedMinutes: 30,
    warningMinutes: 60,
    criticalMinutes: 120,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Occupied WM quants under hold (quality-inspection, blocked, or batch-restricted stock) with quantity and goods-receipt age. Hold provenance (who placed the hold / why) is a documented data gap: no QM hold log is replicated. age_hours is the query-time evaluation age.

 * Source View: vw_consumption_warehouse360_open_holds
 * Version: 0.1.0
 */
export interface Warehouse360OpenHolds {
  /** SAP plant ID */
  plant_id: string;
  /** Warehouse number */
  warehouse_number: string;
  /** Storage type holding the quant */
  storage_type?: string;
  /** Bin code holding the quant */
  storage_bin?: string;
  /** WM quant number (LQUA) */
  quant_number: string;
  /** Material code */
  material_id: string;
  /** Batch number (null for non-batch-managed stock) */
  batch_id?: string;
  /** Hold classification — quality, blocked, or restricted */
  hold_type: string;
  /** Quant total quantity */
  quantity?: number;
  /** Base unit of measure */
  uom?: string;
  /** Goods receipt date (hold age basis) */
  goods_receipt_date?: string;
  /** Query-time age in hours since goods receipt */
  age_hours?: number;
}

export const Warehouse360OpenHoldsContract = {
  id: "warehouse360.open_holds",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_warehouse360_open_holds",
  grain: "one row per plant_id, warehouse_number, and quant under hold",
  primaryKey: ["plant_id", "warehouse_number", "quant_number"],
  freshness: {
    expectedMinutes: 30,
    warningMinutes: 60,
    criticalMinutes: 120,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Open transfer-order items (item_status != 'Fully Confirmed') as staging pick tasks, with source/destination locations, quantities, status, and process-order linkage (BETYP/BENUM). assignee maps to confirmed_by_user when present. age_hours is the query-time evaluation age.

 * Source View: vw_consumption_warehouse360_pick_tasks
 * Version: 0.1.0
 */
export interface Warehouse360PickTasks {
  /** SAP plant ID */
  plant_id: string;
  /** Warehouse number */
  warehouse_number: string;
  /** Transfer order number */
  task_id: string;
  /** Transfer order item number */
  item_number: string;
  /** Material code */
  material_id: string;
  /** Batch number */
  batch_id?: string;
  /** Source storage type */
  source_storage_type?: string;
  /** Source bin */
  source_storage_bin?: string;
  /** Destination storage type */
  destination_storage_type?: string;
  /** Destination bin */
  destination_storage_bin?: string;
  /** Requested quantity (VSOLM) */
  requested_quantity?: number;
  /** Confirmed quantity (VISTA) */
  confirmed_quantity?: number;
  /** Open or Partially Confirmed (Fully Confirmed excluded) */
  item_status: string;
  /** Transfer order creation timestamp */
  created_datetime?: string;
  /** SAP reference type (BETYP; F = process order) */
  order_reference_type?: string;
  /** SAP reference number (BENUM; process order when BETYP='F') */
  order_reference_number?: string;
  /** Transfer priority */
  transfer_priority?: string;
  /** Linked delivery number */
  delivery_number?: string;
  /** TO creator (BNAME) */
  created_by_user?: string;
  /** Confirming user (QNAME) — maps to assignee in the app */
  confirmed_by_user?: string;
  /** Query-time age in hours since TO creation */
  age_hours?: number;
}

export const Warehouse360PickTasksContract = {
  id: "warehouse360.pick_tasks",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_warehouse360_pick_tasks",
  grain: "one row per warehouse_number, task_id (transfer order), and item_number",
  primaryKey: ["warehouse_number", "task_id", "item_number"],
  freshness: {
    expectedMinutes: 30,
    warningMinutes: 60,
    criticalMinutes: 120,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Open transfer-requirement items (not processing-complete, open_quantity > 0) as warehouse move requests, with source/destination locations, queue, priority, and reference linkage. Assignee is a documented data gap (LTBK carries none). age_hours is the query-time evaluation age.

 * Source View: vw_consumption_warehouse360_move_requests
 * Version: 0.1.0
 */
export interface Warehouse360MoveRequests {
  /** SAP plant ID */
  plant_id: string;
  /** Warehouse number */
  warehouse_number: string;
  /** Transfer requirement number */
  request_id: string;
  /** Transfer requirement item number */
  item_number: string;
  /** Material code */
  material_id: string;
  /** Batch number */
  batch_id?: string;
  /** Source storage type */
  source_storage_type?: string;
  /** Source bin */
  source_storage_bin?: string;
  /** Destination storage type */
  destination_storage_type?: string;
  /** Destination bin */
  destination_storage_bin?: string;
  /** Required quantity (MENGE) */
  required_quantity?: number;
  /** Open quantity (MENGE - TAMEN) */
  open_quantity?: number;
  /** Transfer requirement creation timestamp */
  created_datetime?: string;
  /** Planned execution timestamp */
  planned_execution_datetime?: string;
  /** WM queue (custom ZZQUEUE) */
  queue?: string;
  /** Transfer priority */
  transfer_priority?: string;
  /** SAP reference type (BETYP) */
  order_reference_type?: string;
  /** SAP reference number (BENUM) */
  order_reference_number?: string;
  /** Query-time age in hours since TR creation */
  age_hours?: number;
}

export const Warehouse360MoveRequestsContract = {
  id: "warehouse360.move_requests",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_warehouse360_move_requests",
  grain: "one row per warehouse_number, request_id (transfer requirement), and item_number",
  primaryKey: ["warehouse_number", "request_id", "item_number"],
  freshness: {
    expectedMinutes: 30,
    warningMinutes: 60,
    criticalMinutes: 120,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Goods-movement activity feed at material-document-line (MSEG) grain with movement-type classification flags. HIGH-VOLUME dataset under mandatory cost controls: the route enforces a default 1-day posting_date window, a hard 31-day maximum window, and limit <= 500. UAT performance/cost validation is required before frontend consumption ships.

 * Source View: vw_consumption_warehouse360_goods_movements
 * Version: 0.1.0
 */
export interface Warehouse360GoodsMovements {
  /** SAP plant ID */
  plant_id: string;
  /** Storage location */
  storage_location_id?: string;
  /** Material document number (MBLNR) */
  document_number: string;
  /** Material document fiscal year (MJAHR) */
  fiscal_year: string;
  /** Material document line (ZEILE) */
  line_item: string;
  /** Material code */
  material_id: string;
  /** Batch number */
  batch_id?: string;
  /** SAP movement type (BWART) */
  movement_type_code: string;
  /** Conformed movement label */
  movement_label?: string;
  /** Conformed event category (RECEIPT/ISSUE/TRANSFER/...) */
  event_category?: string;
  /** Movement classified as goods receipt */
  is_goods_receipt: boolean;
  /** Movement classified as goods issue */
  is_goods_issue: boolean;
  /** Movement classified as transfer */
  is_transfer: boolean;
  /** Movement classified as reversal */
  is_reversal: boolean;
  /** Debit/credit indicator (SHKZG) */
  debit_credit_indicator?: string;
  /** Movement quantity in base UoM */
  quantity?: number;
  /** Base unit of measure */
  uom?: string;
  /** Movement value in local currency */
  amount_local_currency?: number;
  /** Local currency */
  currency?: string;
  /** Posting date (clustering / window key) */
  posting_date?: string;
  /** Document date */
  document_date?: string;
  /** Linked order (AUFNR) */
  order_number?: string;
  /** Linked purchase order (EBELN) */
  purchase_order_number?: string;
  /** Linked IM delivery (VBELN_IM) */
  delivery_number?: string;
  /** Linked sales order (KDAUF) */
  sales_order_number?: string;
  /** Posting user (USNAM) */
  posted_by?: string;
  /** SAP transaction code */
  transaction_code?: string;
}

export const Warehouse360GoodsMovementsContract = {
  id: "warehouse360.goods_movements",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_warehouse360_goods_movements",
  grain: "one row per document_number, fiscal_year, and line_item",
  primaryKey: ["document_number", "fiscal_year", "line_item"],
  freshness: {
    expectedMinutes: 30,
    warningMinutes: 60,
    criticalMinutes: 120,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Supervisor staging/picking worklist at transfer-requirement (job) grain for the WM Operations workspace — read-only mirror of the SAP WM Cockpit (WMA-E-19) Job Assignment grid: work area, RF pick status, assigned operator, queue, campaign and pick progress from linked transfer orders. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_worklist
 * Version: 0.1.0
 */
export interface WmOperationsWorklist {
  /** SAP plant ID */
  plant_id: string;
  /** SAP warehouse number (LGNUM) */
  warehouse_id: string;
  /** Transfer requirement number (LTBK TBNUM) */
  tr_id: string;
  /** PRODUCTION_STAGING | DISPENSARY_REPLENISHMENT | DISPENSARY_PICKING | WAREHOUSE_OTHER */
  work_area: string;
  /** OPEN | IN_PROGRESS | PARKED | NO_STOCK | COMPLETE (from site RF pick-status fields) */
  worklist_status: string;
  /** Source reference type (LTBK BETYP; 'P' = process order) */
  reference_type?: string;
  /** Source reference number (process order for BETYP='P') */
  reference_id?: string;
  /** Finished-good material of the referenced process order */
  order_material_id?: string;
  /** Scheduled start of the referenced process order */
  order_scheduled_start_date?: string;
  /** Source storage type (LTBK VLTYP) */
  source_storage_type?: string;
  /** Storage zone of the source storage type */
  source_zone?: string;
  /** Destination storage type (LTBK NLTYP) */
  destination_storage_type?: string;
  /** Storage zone of the destination storage type */
  destination_zone?: string;
  /** Destination bin (LTBK NLPLA) */
  destination_bin?: string;
  /** RF queue (ZZQUEUE) */
  queue?: string;
  /** Campaign reference (ZZ_CAMPAIGN) */
  campaign_id?: string;
  /** Assigned RF operator ('~' park prefix stripped) */
  assigned_operator?: string;
  /** Supervisor-assigned job sequence */
  job_sequence?: string;
  /** Transfer priority (TBPRI) */
  transfer_priority?: string;
  /** TR creator (BNAME) */
  created_by_user?: string;
  /** TR creation timestamp */
  created_ts?: string;
  /** Planned execution timestamp (PDATU/PZEIT) */
  planned_execution_ts?: string;
  /** TR item count */
  item_count?: number;
  /** Items still open (not ELIKZ, open qty > 0) */
  open_item_count?: number;
  /** Distinct materials on the TR */
  material_count?: number;
  /** Material (single-material TRs only) */
  material_id?: string;
  /** Material description (single-material TRs only) */
  material_name?: string;
  /** Total required quantity (MENGE) */
  required_qty?: number;
  /** Total open quantity (MENGE - TAMEN, clamped >= 0) */
  open_qty?: number;
  /** Base unit of measure (first item) */
  uom?: string;
  /** True when items mix base UoMs (quantity totals approximate) */
  has_mixed_base_uom?: boolean;
  /** Linked transfer-order items (LTAK TBNUM) */
  to_item_count?: number;
  /** Linked TO items fully confirmed */
  to_items_confirmed?: number;
  /** Confirmed (picked) quantity across linked TOs */
  to_confirmed_qty?: number;
  /** Latest TO confirmation date */
  latest_to_confirmed_date?: string;
  /** Confirmed TO qty / required qty (0..1; null for mixed-UoM TRs) */
  pick_progress_fraction?: number;
  /** Hours since TR creation (query-time, _live view) */
  age_hours?: number;
  /** Planned execution time passed and job not complete (query-time) */
  is_overdue?: boolean;
}

export const WmOperationsWorklistContract = {
  id: "wm_operations.worklist",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_worklist",
  grain: "one row per plant_id, warehouse_id and transfer requirement",
  primaryKey: ["plant_id", "warehouse_id", "tr_id"],
  freshness: {
    expectedMinutes: 30,
    warningMinutes: 60,
    criticalMinutes: 120,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * WM worklist rolled up by plant, warehouse, work area and status — the WM Operations manager KPI strip. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_worklist_summary
 * Version: 0.1.0
 */
export interface WmOperationsWorklistSummary {
  /** SAP plant ID */
  plant_id: string;
  /** SAP warehouse number (LGNUM) */
  warehouse_id: string;
  /** PRODUCTION_STAGING | DISPENSARY_REPLENISHMENT | DISPENSARY_PICKING | WAREHOUSE_OTHER */
  work_area: string;
  /** OPEN | IN_PROGRESS | PARKED | NO_STOCK | COMPLETE */
  worklist_status: string;
  /** Transfer requirements in this bucket */
  tr_count?: number;
  /** Sum of open quantity */
  total_open_qty?: number;
  /** Sum of required quantity */
  total_required_qty?: number;
  /** Distinct assigned operators */
  operator_count?: number;
  /** Earliest planned execution timestamp in the bucket */
  earliest_planned_ts?: string;
  /** Earliest TR creation timestamp in the bucket */
  earliest_created_ts?: string;
}

export const WmOperationsWorklistSummaryContract = {
  id: "wm_operations.worklist_summary",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_worklist_summary",
  grain: "one row per plant_id, warehouse_id, work_area and worklist_status",
  primaryKey: ["plant_id", "warehouse_id", "work_area", "worklist_status"],
  freshness: {
    expectedMinutes: 30,
    warningMinutes: 60,
    criticalMinutes: 120,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Released process orders with derived TR coverage (component demand converted to TRs — the WM Cockpit 'TR' status) and PSA supply status (stock in order-keyed Production Supply bins — the cockpit 'ST' status), plus a query-time readiness band. Coverage denominators use WM-managed components only; quantity comparisons assume base-UoM consistency. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_order_readiness
 * Version: 0.1.0
 */
export interface WmOperationsOrderReadiness {
  /** SAP plant ID */
  plant_id: string;
  /** Process order number (AUFNR) */
  order_id: string;
  /** Warehouse serving the order's WM components */
  warehouse_id?: string;
  /** Finished-good material */
  material_id?: string;
  /** Finished-good material description */
  material_name?: string;
  /** Order quantity (GAMNG) */
  order_qty?: number;
  /** Order quantity UoM */
  uom?: string;
  /** Scheduled start (GSTRS) */
  scheduled_start_date?: string;
  /** Scheduled finish */
  scheduled_finish_date?: string;
  /** Production supply area (RESB PRVBE, first non-null) */
  production_supply_area?: string;
  /** Production-consumption component reservations */
  component_count?: number;
  /** Components carrying a WM warehouse number */
  wm_component_count?: number;
  /** Required quantity across WM-managed components */
  wm_component_required_qty?: number;
  /** Open (unissued) component quantity */
  component_open_qty?: number;
  /** Transfer requirements created for the order */
  tr_count?: number;
  /** Quantity covered by TRs */
  tr_required_qty?: number;
  /** TR quantity not yet converted to TOs */
  tr_open_qty?: number;
  /** NONE | PARTIAL | FULL (cockpit 'TR' status) */
  tr_coverage_status: string;
  /** Stock in order-keyed Production Supply bins */
  psa_supplied_qty?: number;
  /** NOT_SUPPLIED | PARTIAL | SUPPLIED (cockpit 'ST' status) */
  supply_status: string;
  /** SUPPLIED | STAGING_PLANNED | PARTIALLY_PLANNED | NOT_STARTED | NO_WM_DEMAND */
  readiness_status: string;
  /** Days until scheduled start (query-time, _live view) */
  days_to_start?: number;
  /** red | amber | green | grey (query-time traffic light) */
  readiness_band?: string;
}

export const WmOperationsOrderReadinessContract = {
  id: "wm_operations.order_readiness",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_order_readiness",
  grain: "one row per plant_id and process order",
  primaryKey: ["plant_id", "order_id"],
  freshness: {
    expectedMinutes: 30,
    warningMinutes: 60,
    criticalMinutes: 120,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Quant-grain stock & bin explorer with storage-zone classification (dispensary / production supply / palletising / interim / warehouse), stock category, block flags and expiry. The dispensary stock-health view is this contract filtered to storage_zone = 'DISPENSARY'. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_bin_stock
 * Version: 0.1.0
 */
export interface WmOperationsBinStock {
  /** SAP plant ID */
  plant_id: string;
  /** SAP warehouse number (LGNUM) */
  warehouse_id: string;
  /** WM storage type (LGTYP) */
  storage_type?: string;
  /** DISPENSARY | PRODUCTION_SUPPLY | PALLETISING | INTERIM | WAREHOUSE */
  storage_zone?: string;
  /** Storage bin (LGPLA) */
  bin_id?: string;
  /** Picking area (KOBER) */
  picking_area?: string;
  /** Quant number (LQNUM) */
  quant_id: string;
  /** Material */
  material_id?: string;
  /** Material description */
  material_name?: string;
  /** Batch (CHARG, exact SAP identifier) */
  batch_id?: string;
  /** UNRESTRICTED | QUALITY | BLOCKED | OTHER (from BESTQ) */
  stock_category?: string;
  /** Total quant quantity (GESME) */
  total_qty?: number;
  /** Available quantity (VERME) */
  available_qty?: number;
  /** Open putaway quantity (EINME) */
  putaway_qty?: number;
  /** Open pick quantity (AUSME) */
  pick_qty?: number;
  /** Open transfer quantity (TRAME) */
  open_transfer_qty?: number;
  /** Base unit of measure */
  uom?: string;
  /** Goods receipt date (WDATU) */
  goods_receipt_date?: string;
  /** Shelf-life expiry date (VFDAT) */
  expiry_date?: string;
  /** Last movement timestamp */
  last_movement_ts?: string;
  /** Quant blocked for stock removal (SKZUA) */
  is_blocked_for_stock_removal?: boolean;
  /** Quant blocked for putaway (SKZUE) */
  is_blocked_for_putaway?: boolean;
  /** Bin carries a blocking reason (SPGRU) */
  is_bin_blocked?: boolean;
  /** Bin blocking reason code */
  blocking_reason_code?: string;
  /** Days until expiry (query-time, _live view) */
  days_to_expiry?: number;
  /** Expiry date in the past (query-time) */
  is_expired?: boolean;
}

export const WmOperationsBinStockContract = {
  id: "wm_operations.bin_stock",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_bin_stock",
  grain: "one row per plant_id, warehouse_id and quant",
  primaryKey: ["plant_id", "warehouse_id", "quant_id"],
  freshness: {
    expectedMinutes: 30,
    warningMinutes: 60,
    criticalMinutes: 120,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

export const ioReportingContracts = {
  contractVersion: "0.1.0",
  product: "connected-operations-intelligence",
  contracts: {
    "warehouse360.overview": Warehouse360OverviewContract,
    "warehouse360.inbound_backlog": Warehouse360InboundBacklogContract,
    "warehouse360.outbound_backlog": Warehouse360OutboundBacklogContract,
    "warehouse360.staging_workload": Warehouse360StagingWorkloadContract,
    "warehouse360.stock_exceptions": Warehouse360StockExceptionsContract,
    "warehouse360.shortfalls": Warehouse360ShortfallsContract,
    "warehouse360.im_wm_reconciliation": Warehouse360ImWmReconciliationContract,
    "warehouse360.dispensary_queue": Warehouse360DispensaryQueueContract,
    "warehouse360.stock_zones": Warehouse360StockZonesContract,
    "warehouse360.batch_hold_status": Warehouse360BatchHoldStatusContract,
    "warehouse360.staging_readiness": Warehouse360StagingReadinessContract,
    "warehouse360.open_holds": Warehouse360OpenHoldsContract,
    "warehouse360.pick_tasks": Warehouse360PickTasksContract,
    "warehouse360.move_requests": Warehouse360MoveRequestsContract,
    "warehouse360.goods_movements": Warehouse360GoodsMovementsContract,
    "wm_operations.worklist": WmOperationsWorklistContract,
    "wm_operations.worklist_summary": WmOperationsWorklistSummaryContract,
    "wm_operations.order_readiness": WmOperationsOrderReadinessContract,
    "wm_operations.bin_stock": WmOperationsBinStockContract,
  },
} as const;
