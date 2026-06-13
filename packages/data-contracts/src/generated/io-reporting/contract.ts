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
 * Material shortfalls — open transfer-requirement backlog aggregated to plant x material (ADR-0004 D2; upstream lineage: the transfer-requirement material-backlog gold MV over the silver warehouse transfer requirements). Candidate contract pending DEV profiling.

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
  /** Linked IM delivery item (VBELP_IM); NULL on pre-existing rows until next full refresh/churn */
  delivery_item_number?: string;
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
  /** Timestamp of the most recent TO item confirmation (query-time, _live view) */
  latest_to_confirmed_ts?: string;
  /** Hours from TR creation to latest TO confirmation (cycle time proxy — null until at least one TO item is confirmed for the TR)
 */
  cycle_hours?: number;
  /** Hours since TR creation (query-time, _live view) */
  age_hours?: number;
  /** Planned execution time passed and job not complete (query-time) */
  is_overdue?: boolean;
  /** Sum of absolute difference quantities across TO items with a non-zero discrepancy */
  short_pick_qty?: number;
  /** Count of TO line items with a non-zero difference quantity (short-pick signal) */
  short_pick_item_count?: number;
  /** Production line (AUFK CRVER) of the linked process order — 99.99% populated at C061/P817 (35 lines / 18-19 lines respectively, verified UAT 2026-06-11). NULL when the TR source is not a process order or the order is not found.
 */
  order_production_line?: string;
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
 * Version: 0.2.0
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
  /** Sum of unrestricted batch_stock across order component materials */
  qty_unrestricted?: number;
  /** Sum of quality-inspection + blocked stock across component materials */
  quality_hold_qty?: number;
  /** Open QM lots (no usage decision) across component materials */
  open_lot_count?: number;
  /** RELEASED | PARTIAL_HOLD | QUALITY_BLOCKED | NO_QM_DATA */
  quality_release_status?: string;
  /** QUALITY_HOLD | QUALITY_PARTIAL_HOLD | QM_SOURCE_ABSENT when applicable */
  readiness_reason?: string;
  /** Production line (AUFK CRVER) of the process order — 99.99% populated at C061/P817 (35 lines / 18-19 lines respectively, verified UAT 2026-06-11).
 */
  production_line?: string;
}

export const WmOperationsOrderReadinessContract = {
  id: "wm_operations.order_readiness",
  version: "0.2.0",
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

/**
 * Component-level staging detail for active process orders — the drill-through behind Order Readiness. TR/TO/PSA rollups are at order x material grain; components sharing a material are flagged via material_component_count. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_order_components
 * Version: 0.1.0
 */
export interface WmOperationsOrderComponents {
  plant_id: string;
  order_id: string;
  reservation_id: string;
  reservation_item: string;
  operation_number?: string;
  warehouse_id?: string;
  material_id?: string;
  material_name?: string;
  batch_id?: string;
  required_qty?: number;
  open_qty?: number;
  uom?: string;
  production_supply_area?: string;
  requirement_date?: string;
  material_component_count?: number;
  tr_count?: number;
  tr_required_qty?: number;
  tr_open_qty?: number;
  tr_coverage_status: string;
  to_item_count?: number;
  to_items_confirmed?: number;
  to_confirmed_qty?: number;
  pick_progress_fraction?: number;
  psa_supplied_qty?: number;
  is_supplied?: boolean;
}

export const WmOperationsOrderComponentsContract = {
  id: "wm_operations.order_components",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_order_components",
  grain: "one row per plant_id, order_id, reservation_id and reservation_item",
  primaryKey: ["plant_id", "order_id", "reservation_id", "reservation_item"],
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
 * RF operator pick activity per day from confirmed transfer-order items. Quantity totals mix base UoMs — item counts are the comparable measure. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_operator_activity
 * Version: 0.1.0
 */
export interface WmOperationsOperatorActivity {
  plant_id: string;
  warehouse_id: string;
  operator: string;
  activity_date: string;
  shift?: string;
  items_confirmed?: number;
  transfer_orders?: number;
  materials?: number;
  transfer_requirements?: number;
  confirmed_qty?: number;
}

export const WmOperationsOperatorActivityContract = {
  id: "wm_operations.operator_activity",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_operator_activity",
  grain: "one row per plant_id, warehouse_id, operator, activity_date and shift",
  primaryKey: ["plant_id", "warehouse_id", "operator", "activity_date", "shift"],
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
 * Current open WM workload by queue and work area (non-complete worklist jobs). Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_queue_workload
 * Version: 0.1.0
 */
export interface WmOperationsQueueWorkload {
  plant_id: string;
  warehouse_id: string;
  queue: string;
  work_area: string;
  open_jobs?: number;
  in_progress_jobs?: number;
  parked_jobs?: number;
  no_stock_jobs?: number;
  operator_count?: number;
  earliest_planned_ts?: string;
  earliest_created_ts?: string;
}

export const WmOperationsQueueWorkloadContract = {
  id: "wm_operations.queue_workload",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_queue_workload",
  grain: "one row per plant_id, warehouse_id, queue and work_area",
  primaryKey: ["plant_id", "warehouse_id", "queue", "work_area"],
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
 * Outbound delivery picking board — pick progress and goods-issue risk per open delivery (reuses gold_delivery_pick_status with query-time risk bands). Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_outbound
 * Version: 0.1.0
 */
export interface WmOperationsOutbound {
  plant_id: string;
  warehouse_id?: string;
  delivery_id: string;
  delivery_type?: string;
  ship_to_customer_id?: string;
  ship_to_customer_name?: string;
  line_count?: number;
  delivery_qty?: number;
  picked_qty?: number;
  pick_fraction?: number;
  has_mixed_base_uom?: boolean;
  planned_goods_issue_date?: string;
  actual_goods_issue_date?: string;
  is_shipped?: boolean;
  days_to_goods_issue?: number;
  risk_band?: string;
}

export const WmOperationsOutboundContract = {
  id: "wm_operations.outbound",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_outbound",
  grain: "one row per plant_id and delivery_id",
  primaryKey: ["plant_id", "delivery_id"],
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
 * Inbound delivery expected-receipt board — EL (standard inbound) and ELST (inbound stock transport) SAP delivery types with expected receipt date, line counts, receipt progress, and query-time receipt_band. Counterpart to wm_operations.outbound; vendor/supplier columns are not available (LIKP ship_to/sold_to are customer fields; supplier not replicated). Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_inbound_deliveries
 * Version: 0.1.0
 */
export interface WmOperationsInboundDeliveries {
  /** SAP plant ID */
  plant_id: string;
  /** SAP warehouse number (LGNUM) */
  warehouse_id?: string;
  /** SAP inbound delivery number (VBELN) */
  delivery_id: string;
  /** SAP delivery type (EL = standard inbound; ELST = inbound stock transport) */
  delivery_type?: string;
  /** SAP shipping point (VSTEL) */
  shipping_point?: string;
  /** Number of delivery line items */
  line_count?: number;
  /** Total delivery quantity (sum of line quantities; mix of base UoMs when has_mixed_base_uom) */
  delivery_qty?: number;
  /** Received quantity from confirmed GR transfer orders */
  received_qty?: number;
  /** received_qty / delivery_qty (0..1; null when delivery_qty is zero or mixed UoM) */
  receipt_fraction?: number;
  /** True when delivery lines carry more than one base unit of measure (quantity totals approximate) */
  has_mixed_base_uom?: boolean;
  /** WM overall status code from LIKP (overall WM activity status) */
  wm_status_code?: string;
  /** Expected goods receipt date (LIKP WADAT — SAP planned GI/GR date) */
  expected_receipt_date?: string;
  /** Actual goods receipt date (first confirmed GR TO confirmation date) */
  actual_receipt_date?: string;
  /** True when the delivery has at least one confirmed GR transfer order */
  is_received?: boolean;
  /** Days from today until expected_receipt_date (query-time, _live view; negative = overdue) */
  days_until_expected_receipt?: number;
  /** Query-time receipt risk band (green = on track; amber = due soon; red = overdue; grey = received) */
  receipt_band?: string;
}

export const WmOperationsInboundDeliveriesContract = {
  id: "wm_operations.inbound_deliveries",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_inbound_deliveries",
  grain: "one row per plant_id and delivery_id",
  primaryKey: ["plant_id", "delivery_id"],
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
 * Severe reconciliation alerts (IM-WM stock, HU, physical inventory) for the shift-handover digest. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_recon_alerts
 * Version: 0.1.0
 */
export interface WmOperationsReconAlerts {
  plant_id: string;
  warehouse_id?: string;
  alert_key: string;
  alert_type: string;
  alert_priority?: string;
  material_id?: string;
  batch_id?: string;
  reason_code?: string;
  delta_qty?: number;
  delta_value?: number;
}

export const WmOperationsReconAlertsContract = {
  id: "wm_operations.recon_alerts",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_recon_alerts",
  grain: "one row per alert_key",
  primaryKey: ["alert_key"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Handling-unit (SSCC) counts by status for the inbound/putaway board. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_handling_units
 * Version: 0.1.0
 */
export interface WmOperationsHandlingUnits {
  plant_id: string;
  warehouse_id: string;
  handling_unit_status: string;
  reference_document_category: string;
  hu_item_count?: number;
  distinct_sscc_count?: number;
  distinct_hu_count?: number;
  linked_delivery_count?: number;
  distinct_material_count?: number;
  total_gross_weight?: number;
}

export const WmOperationsHandlingUnitsContract = {
  id: "wm_operations.handling_units",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_handling_units",
  grain: "one row per plant_id, warehouse_id, handling_unit_status and reference_document_category",
  primaryKey: ["plant_id", "warehouse_id", "handling_unit_status", "reference_document_category"],
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
 * Batch-level shelf-life risk with query-time expiry buckets. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_expiry_risk
 * Version: 0.1.0
 */
export interface WmOperationsExpiryRisk {
  plant_id: string;
  material_id: string;
  material_name?: string;
  batch_id: string;
  uom?: string;
  minimum_expiry_date?: string;
  shelf_life_days?: number;
  minimum_remaining_shelf_life_days?: number;
  total_stock_qty?: number;
  minimum_days_to_expiry?: number;
  expired_qty?: number;
  highest_expiry_risk_bucket?: string;
  has_minimum_shelf_life_breach?: boolean;
}

export const WmOperationsExpiryRiskContract = {
  id: "wm_operations.expiry_risk",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_expiry_risk",
  grain: "one row per plant_id, material_id and batch_id",
  primaryKey: ["plant_id", "material_id", "batch_id"],
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
 * Quant-level QI/blocked/restricted holds with query-time age. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_stock_holds
 * Version: 0.1.0
 */
export interface WmOperationsStockHolds {
  plant_id: string;
  warehouse_id: string;
  storage_type?: string;
  bin_id?: string;
  quant_id: string;
  material_id?: string;
  batch_id?: string;
  hold_type: string;
  qty?: number;
  uom?: string;
  goods_receipt_date?: string;
  age_hours?: number;
}

export const WmOperationsStockHoldsContract = {
  id: "wm_operations.stock_holds",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_stock_holds",
  grain: "one row per plant_id, warehouse_id and quant_id",
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

/**
 * Aged warehouse exceptions (expired-with-stock, aged QI/blocked, aged open TOs). Served from the _live view ONLY — base rows are unconfirmed candidates. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_exceptions
 * Version: 0.1.0
 */
export interface WmOperationsExceptions {
  plant_id: string;
  warehouse_id?: string;
  exception_type: string;
  severity?: string;
  sla_hours?: number;
  material_id?: string;
  batch_id?: string;
  reference_id: string;
  qty?: number;
  aging_reference_date?: string;
  age_days?: number;
  detail?: string;
}

export const WmOperationsExceptionsContract = {
  id: "wm_operations.exceptions",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_exceptions",
  grain: "one row per confirmed exception",
  primaryKey: ["plant_id", "exception_type", "reference_id"],
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
 * IM-WM stock reconciliation exceptions at batch/category grain (workbench detail). Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_recon_exceptions
 * Version: 0.1.0
 */
export interface WmOperationsReconExceptions {
  plant_id: string;
  warehouse_id: string;
  material_id: string;
  material_name?: string;
  batch_id?: string;
  stock_category: string;
  uom?: string;
  im_qty?: number;
  wm_qty?: number;
  delta_qty?: number;
  delta_percent?: number;
  delta_value?: number;
  mismatch_reason: string;
  mismatch_severity?: string;
  is_trusted?: boolean;
}

export const WmOperationsReconExceptionsContract = {
  id: "wm_operations.recon_exceptions",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_recon_exceptions",
  grain: "one row per plant_id, warehouse_id, material_id, batch_id and stock_category",
  primaryKey: ["plant_id", "warehouse_id", "material_id", "batch_id", "stock_category"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Value-control rollup of reconciliation exceptions by reason and severity. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_recon_value_summary
 * Version: 0.1.0
 */
export interface WmOperationsReconValueSummary {
  plant_id: string;
  warehouse_id: string;
  mismatch_reason: string;
  mismatch_severity: string;
  row_count?: number;
  tolerance_exceeded_count?: number;
  net_delta_value?: number;
  abs_delta_value?: number;
  abs_delta_quantity?: number;
  value_reconciliation_status?: string;
}

export const WmOperationsReconValueSummaryContract = {
  id: "wm_operations.recon_value_summary",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_recon_value_summary",
  grain: "one row per plant_id, warehouse_id, mismatch_reason and mismatch_severity",
  primaryKey: ["plant_id", "warehouse_id", "mismatch_reason", "mismatch_severity"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Campaign-grouped picking progress (LTBK ZZ_CAMPAIGN). Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_campaigns
 * Version: 0.1.0
 */
export interface WmOperationsCampaigns {
  plant_id: string;
  warehouse_id: string;
  campaign_id: string;
  tr_count?: number;
  complete_trs?: number;
  in_progress_trs?: number;
  parked_trs?: number;
  no_stock_trs?: number;
  order_count?: number;
  operator_count?: number;
  work_area?: string;
  required_qty?: number;
  open_qty?: number;
  earliest_planned_ts?: string;
  earliest_created_ts?: string;
}

export const WmOperationsCampaignsContract = {
  id: "wm_operations.campaigns",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_campaigns",
  grain: "one row per plant_id, warehouse_id and campaign_id",
  primaryKey: ["plant_id", "warehouse_id", "campaign_id"],
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
 * Daily warehouse activity series (TO confirmations, TRs created, IM receipts/issues) for trend charts. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_daily_activity
 * Version: 0.1.0
 */
export interface WmOperationsDailyActivity {
  plant_id: string;
  activity_date: string;
  to_items_confirmed?: number;
  active_operators?: number;
  trs_created?: number;
  goods_receipt_lines?: number;
  goods_issue_lines?: number;
}

export const WmOperationsDailyActivityContract = {
  id: "wm_operations.daily_activity",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_daily_activity",
  grain: "one row per plant_id and activity_date",
  primaryKey: ["plant_id", "activity_date"],
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
 * Physical inventory count-vs-book detail (counts due, recounts, unposted differences). Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_physical_inventory
 * Version: 0.1.0
 */
export interface WmOperationsPhysicalInventory {
  plant_id: string;
  pi_document_id: string;
  fiscal_year: string;
  item_number: string;
  storage_location_id?: string;
  material_id?: string;
  batch_id?: string;
  planned_count_date?: string;
  count_date?: string;
  book_qty?: number;
  counted_qty?: number;
  delta_qty?: number;
  delta_value?: number;
  is_counted?: boolean;
  is_recount_required?: boolean;
  is_difference_posted?: boolean;
  physical_inventory_status?: string;
}

export const WmOperationsPhysicalInventoryContract = {
  id: "wm_operations.physical_inventory",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_physical_inventory",
  grain: "one row per plant_id, pi_document_id, fiscal_year and item_number",
  primaryKey: ["plant_id", "pi_document_id", "fiscal_year", "item_number"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Bin occupancy and capacity by storage type and bin type (putaway planning). Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_bin_occupancy
 * Version: 0.1.0
 */
export interface WmOperationsBinOccupancy {
  plant_id: string;
  warehouse_id: string;
  storage_type: string;
  bin_type: string;
  bin_record_count?: number;
  occupied_bin_count?: number;
  empty_bin_count?: number;
  blocked_bin_count?: number;
  stock_removal_blocked_bin_count?: number;
  putaway_blocked_bin_count?: number;
  occupancy_rate?: number;
  total_stock_qty?: number;
  available_stock_qty?: number;
  open_transfer_stock_qty?: number;
  /** Sum of max_quant_count across bins (LAGP.MAXQU); NULL until full refresh/churn */
  total_max_quant_count?: number;
  /** Sum of maximum_weight across bins (LAGP.MGEWI); NULL until full refresh/churn */
  total_maximum_weight?: number;
  /** occupied_bin_count / total_max_quant_count; NULL when denominator absent */
  quant_utilisation_fraction?: number;
}

export const WmOperationsBinOccupancyContract = {
  id: "wm_operations.bin_occupancy",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_bin_occupancy",
  grain: "one row per plant_id, warehouse_id, storage_type and bin_type",
  primaryKey: ["plant_id", "warehouse_id", "storage_type", "bin_type"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Value-weighted stock aging by material and batch with query-time age buckets. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_slow_movers
 * Version: 0.1.0
 */
export interface WmOperationsSlowMovers {
  plant_id: string;
  warehouse_id: string;
  material_id: string;
  material_name?: string;
  batch_id?: string;
  uom?: string;
  quant_count?: number;
  total_qty?: number;
  stock_value?: number;
  standard_price?: number;
  last_movement_ts?: string;
  earliest_goods_receipt_date?: string;
  earliest_expiry_date?: string;
  days_since_last_movement?: number;
  age_bucket?: string;
}

export const WmOperationsSlowMoversContract = {
  id: "wm_operations.slow_movers",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_slow_movers",
  grain: "one row per plant_id, warehouse_id, material_id and batch_id",
  primaryKey: ["plant_id", "warehouse_id", "material_id", "batch_id"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * IM goods-movement postings reconciled to WM confirmed-TO activity per posting date. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_movement_control
 * Version: 0.1.0
 */
export interface WmOperationsMovementControl {
  plant_id: string;
  warehouse_id: string;
  posting_date?: string;
  material_id: string;
  batch_id?: string;
  uom?: string;
  movement_type_code: string;
  im_document_line_count?: number;
  im_qty?: number;
  im_value?: number;
  wm_to_line_count?: number;
  wm_qty?: number;
  delta_qty?: number;
  abs_delta_qty?: number;
  movement_reconciliation_status?: string;
}

export const WmOperationsMovementControlContract = {
  id: "wm_operations.movement_control",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_movement_control",
  grain: "one row per plant_id, warehouse_id, posting_date, material_id, batch_id and movement_type_code",
  primaryKey: ["plant_id", "warehouse_id", "posting_date", "material_id", "batch_id", "movement_type_code"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Hourly staged-in throughput (confirmed TO items into palletising/production-supply zones) — derived from TO flows pending bulk-drop log replication. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_staging_pace
 * Version: 0.1.0
 */
export interface WmOperationsStagingPace {
  plant_id: string;
  warehouse_id: string;
  destination_zone: string;
  activity_hour: string;
  items_staged?: number;
  qty_staged?: number;
  operators?: number;
}

export const WmOperationsStagingPaceContract = {
  id: "wm_operations.staging_pace",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_staging_pace",
  grain: "one row per plant_id, warehouse_id, destination_zone and activity_hour",
  primaryKey: ["plant_id", "warehouse_id", "destination_zone", "activity_hour"],
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
 * Planned staging demand wave: open TR quantity by planned execution hour and work area. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_staging_demand
 * Version: 0.1.0
 */
export interface WmOperationsStagingDemand {
  plant_id: string;
  warehouse_id: string;
  work_area: string;
  production_supply_area?: string;
  demand_hour: string;
  open_trs?: number;
  open_qty?: number;
}

export const WmOperationsStagingDemandContract = {
  id: "wm_operations.staging_demand",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_staging_demand",
  grain: "one row per plant_id, warehouse_id, work_area, production_supply_area and demand_hour",
  primaryKey: ["plant_id", "warehouse_id", "work_area", "production_supply_area", "demand_hour"],
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
 * Hourly flows in/out of the palletising (bulk-drop) buffer from confirmed TO items — input for client-side B(t) buffer reconstruction. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_buffer_flow
 * Version: 0.1.0
 */
export interface WmOperationsBufferFlow {
  plant_id: string;
  warehouse_id: string;
  activity_hour: string;
  items_in?: number;
  qty_in?: number;
  items_out?: number;
  qty_out?: number;
  net_qty?: number;
}

export const WmOperationsBufferFlowContract = {
  id: "wm_operations.buffer_flow",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_buffer_flow",
  grain: "one row per plant_id, warehouse_id and activity_hour",
  primaryKey: ["plant_id", "warehouse_id", "activity_hour"],
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
 * Quality inspection-lot context per material and batch (open lots, latest usage decision) for held-stock and inbound enrichment. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_qm_lots
 * Version: 0.1.0
 */
export interface WmOperationsQmLots {
  plant_id: string;
  material_id: string;
  batch_id?: string;
  lot_count?: number;
  open_lot_count?: number;
  latest_lot_number?: string;
  lot_origin_code?: string;
  oldest_open_start_date?: string;
  last_usage_decision?: string;
  last_usage_decision_date?: string;
}

export const WmOperationsQmLotsContract = {
  id: "wm_operations.qm_lots",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_qm_lots",
  grain: "one row per plant_id, material_id and batch_id",
  primaryKey: ["plant_id", "material_id", "batch_id"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Process-order operations enriched with work-centre description — one row per plant_id, order_number, routing_number, and operation_counter. Drill-through behind the Order Detail overlay. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_order_operations
 * Version: 0.1.0
 */
export interface WmOperationsOrderOperations {
  plant_id: string;
  order_number: string;
  routing_number: string;
  operation_counter: string;
  operation_number?: string;
  operation_description?: string;
  control_key?: string;
  work_centre_code?: string;
  work_centre_description?: string;
  scheduled_start_datetime?: string;
  scheduled_finish_datetime?: string;
  actual_start_datetime?: string;
  actual_finish_date?: string;
  operation_quantity?: number;
  confirmed_yield_quantity?: number;
  confirmed_scrap_quantity?: number;
  is_confirmed?: boolean;
}

export const WmOperationsOrderOperationsContract = {
  id: "wm_operations.order_operations",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_order_operations",
  grain: "one row per plant_id, order_number, routing_number and operation_counter",
  primaryKey: ["plant_id", "order_number", "routing_number", "operation_counter"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Weekly production downtime pareto aggregated by plant, week, reason code, sub-reason code, and work centre. Feeds the Production Health view Pareto chart and KPI tiles. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_downtime_pareto
 * Version: 0.1.0
 */
export interface WmOperationsDowntimePareto {
  plant_id: string;
  week_start: string;
  downtime_reason_code?: string;
  sub_reason_code?: string;
  work_centre_code?: string;
  downtime_reason_description?: string;
  sub_reason_description?: string;
  production_line_description?: string;
  event_count?: number;
  total_duration_minutes?: number;
  avg_duration_minutes?: number;
  distinct_order_count?: number;
}

export const WmOperationsDowntimeParetoContract = {
  id: "wm_operations.downtime_pareto",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_downtime_pareto",
  grain: "one row per plant_id, week_start, downtime_reason_code, sub_reason_code and work_centre_code",
  primaryKey: ["plant_id", "week_start", "downtime_reason_code", "sub_reason_code", "work_centre_code"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Onboarded WM Operations plants — one row per plant_id and warehouse_id, derived from vw_consumption_wm_operations_worklist_summary (RLS inherited). Used by the command palette to enumerate plants dynamically. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_plants
 * Version: 0.1.0
 */
export interface WmOperationsPlants {
  /** SAP plant ID */
  plant_id: string;
  /** SAP warehouse number (LGNUM) */
  warehouse_id: string;
  /** Total transfer requirements in the worklist summary (activity indicator) */
  worklist_tr_count?: number;
}

export const WmOperationsPlantsContract = {
  id: "wm_operations.plants",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_plants",
  grain: "one row per plant_id and warehouse_id",
  primaryKey: ["plant_id", "warehouse_id"],
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
 * Production downtime events at event grain — passthrough from silver.downtime_event. One row per downtime entry; multiple entries can share the same plant_id, order_number, operation_number, and item_number. Feeds the Production Health recent-events table. Candidate contract pending DEV profiling.

 * Source View: vw_consumption_wm_operations_downtime_events
 * Version: 0.1.0
 */
export interface WmOperationsDowntimeEvents {
  plant_id: string;
  work_centre_code?: string;
  machine_code?: string;
  machine_description?: string;
  production_line_description?: string;
  order_number?: string;
  material_code?: string;
  operation_number?: string;
  item_number?: string;
  downtime_reason_code?: string;
  downtime_reason_description?: string;
  sub_reason_code?: string;
  sub_reason_description?: string;
  start_datetime?: string;
  end_datetime?: string;
  duration_minutes?: number;
  reported_by_user?: string;
  comment?: string;
}

export const WmOperationsDowntimeEventsContract = {
  id: "wm_operations.downtime_events",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_downtime_events",
  grain: "one row per downtime entry (plant_id + order_number + operation_number + item_number is the closest natural key; multiple downtime entries can share these fields)",
  primaryKey: ["plant_id", "order_number", "operation_number", "item_number"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * QM inspection lot status — one row per plant_id and lot_id (all lots in the silver lookback window). Carries lot header, material name, the latest usage decision, and query-time date-relative columns (lot_age_days, ud_lead_time_days, is_overdue). Source-guarded: view only exists when silver QM tables are present.

 * Source View: vw_consumption_wm_operations_qm_lot_status
 * Version: 0.1.0
 */
export interface WmOperationsQmLotStatus {
  plant_id: string;
  lot_id: string;
  inspection_lot_origin_code?: string;
  inspection_type?: string;
  material_id?: string;
  material_name?: string;
  batch_id?: string;
  order_id?: string;
  lot_created_date?: string;
  inspection_start_date?: string;
  inspection_end_date?: string;
  lot_qty?: number;
  lot_uom?: string;
  has_usage_decision?: boolean;
  last_usage_decision?: string;
  last_usage_decision_date?: string;
  last_usage_decision_by?: string;
  quality_score?: string;
  lot_age_days?: number;
  ud_lead_time_days?: number;
  is_overdue?: boolean;
}

export const WmOperationsQmLotStatusContract = {
  id: "wm_operations.qm_lot_status",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_qm_lot_status",
  grain: "one row per plant_id and lot_id",
  primaryKey: ["plant_id", "lot_id"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * QM disposition queue — open lots only (no usage decision), enriched with blocked stock quantity (MCHB.CINSM) and estimated blocked value (blocked_qty × standard_price / price_unit). Grain: plant_id × lot_id. Date-relative columns (lot_age_days, is_overdue) added at query time via the _live serving view. Source-guarded: view only exists when silver QM tables are present.

 * Source View: vw_consumption_wm_operations_qm_disposition_queue
 * Version: 0.1.0
 */
export interface WmOperationsQmDispositionQueue {
  plant_id: string;
  lot_id: string;
  inspection_lot_origin_code?: string;
  inspection_type?: string;
  material_id?: string;
  material_name?: string;
  batch_id?: string;
  order_id?: string;
  lot_created_date?: string;
  inspection_start_date?: string;
  inspection_end_date?: string;
  lot_qty?: number;
  lot_uom?: string;
  blocked_qty?: number;
  blocked_uom?: string;
  est_blocked_value?: number;
  lot_age_days?: number;
  is_overdue?: boolean;
}

export const WmOperationsQmDispositionQueueContract = {
  id: "wm_operations.qm_disposition_queue",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_qm_disposition_queue",
  grain: "one row per plant_id and lot_id (open lots only)",
  primaryKey: ["plant_id", "lot_id"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * QM characteristic (MIC) Pareto for the Command Centre drill view. Counts all lab results in the silver lookback window; fail_rate = fail_count/result_count. last_result_date is the per-plant×material data freshness signal (replication may lag by plant). Source: gold_qm_characteristic_pareto.

 * Source View: vw_consumption_wm_operations_qm_characteristic_pareto
 * Version: 0.1.0
 */
export interface WmOperationsQmCharacteristicPareto {
  plant_id: string;
  material_id: string;
  characteristic_id: string;
  characteristic_text?: string;
  unit?: string;
  result_count: number;
  fail_count: number;
  warn_count: number;
  fail_rate?: number;
  /** Latest result recording date for this plant×material (freshness signal) */
  last_result_date?: string;
}

export const WmOperationsQmCharacteristicParetoContract = {
  id: "wm_operations.qm_characteristic_pareto",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_qm_characteristic_pareto",
  grain: "one row per plant_id, material_id, and characteristic_id",
  primaryKey: ["plant_id", "material_id", "characteristic_id"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * QM usage-decision code distribution Pareto. Plant from parent lot (not QAVE VWERKS). Source: gold_qm_ud_code_pareto.

 * Source View: vw_consumption_wm_operations_qm_ud_code_pareto
 * Version: 0.1.0
 */
export interface WmOperationsQmUdCodePareto {
  plant_id: string;
  usage_decision_code: string;
  /** Accepted | Rejected | Other Decision */
  usage_decision?: string;
  /** Raw QAVE VBEWERTUNG (A/R/blank) */
  usage_decision_valuation?: string;
  lot_count: number;
  last_decision_date?: string;
}

export const WmOperationsQmUdCodeParetoContract = {
  id: "wm_operations.qm_ud_code_pareto",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_qm_ud_code_pareto",
  grain: "one row per plant_id and usage_decision_code",
  primaryKey: ["plant_id", "usage_decision_code"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Order/Batch Journey Timeline summary -- one row per plant_id x order_id. Milestones aggregated from five silver sources (process_order, TR/TO via TBNUM, process_order_operation, pi_sheet_execution, goods_movement) to populate the flagship per-order journey view. All milestone timestamps nullable; PI columns absent at plants without PI data (P806). Derived lag hours (release->staged->produced->GR) only populated when both endpoints exist. No date-relative columns -- no _live wrapper; reads _secured directly.

 * Source View: vw_consumption_wm_operations_order_journey
 * Version: 0.1.0
 */
export interface WmOperationsOrderJourney {
  /** SAP plant ID */
  plant_id: string;
  /** Process order number (AUFNR) */
  order_id: string;
  /** Finished-good material code */
  material_code?: string;
  /** Finished-good material description */
  material_name?: string;
  /** Order quantity (AFKO GAMNG) */
  order_qty?: number;
  /** Order quantity unit of measure */
  uom?: string;
  /** Production line (AUFK CRVER — work centre version / line assignment) */
  production_line?: string;
  /** Order creation timestamp (AUFK ERDAT/ERZET) */
  order_created_ts?: string;
  /** Order release date (AUFK FTRMI — actual release date) */
  release_date?: string;
  /** Scheduled production start date (AFKO GSTRS) */
  scheduled_start_date?: string;
  /** Scheduled production finish date (AFKO GLTRS) */
  scheduled_finish_date?: string;
  /** Timestamp of the first staging transfer requirement created for this order */
  first_tr_created_ts?: string;
  /** Number of staging transfer requirements linked to this order (LTBK BETYP='P') */
  staging_tr_count?: number;
  /** Timestamp of the first confirmed staging transfer order item (LTAK QDATU/QZEIT) */
  staging_first_confirmed_ts?: string;
  /** Timestamp of the most recent confirmed staging transfer order item */
  staging_last_confirmed_ts?: string;
  /** Count of fully confirmed staging TO items linked to this order */
  staged_item_count?: number;
  /** Total staging TO items (confirmed + open) linked to this order */
  staged_item_total?: number;
  /** Actual start timestamp of the first confirmed production operation (AFVC ISDD/ISTD) */
  production_first_actual_start?: string;
  /** Actual finish timestamp of the last confirmed production operation (AFVC IEDD/IETD) */
  production_last_actual_finish?: string;
  /** Total confirmed yield quantity from production operations (AFVC LMNGA) */
  confirmed_yield_qty?: number;
  /** Total confirmed scrap quantity from production operations (AFVC XMNGA) */
  confirmed_scrap_qty?: number;
  /** Timestamp of the first PI sheet execution start (absent at plants without PI replication, e.g. P806) */
  pi_first_start?: string;
  /** Timestamp of the last PI sheet execution end (absent at plants without PI replication) */
  pi_last_end?: string;
  /** Earliest goods receipt posting date (movement 101 against this order) */
  first_gr_posting_date?: string;
  /** Latest goods receipt posting date (movement 101 against this order) */
  last_gr_posting_date?: string;
  /** Net goods receipt quantity (movement 101 minus 102 reversals) against this order */
  gr_qty?: number;
  /** Net component issue quantity (movement 261 minus 262 reversals) against this order */
  issue_qty?: number;
  /** Count of distinct outbound deliveries linked to goods movements for this order */
  delivery_count?: number;
  /** Total QM inspection lots linked to this order */
  qm_lot_count?: number;
  /** Open QM inspection lots (no usage decision yet) linked to this order */
  qm_open_lot_count?: number;
  /** Hours from order release_date to first_tr_created_ts (null when either is absent) */
  release_to_first_tr_hours?: number;
  /** Hours from first_tr_created_ts to staging_last_confirmed_ts (null when either is absent) */
  tr_to_staged_hours?: number;
  /** Hours from staging_last_confirmed_ts to production_first_actual_start (null when either is absent) */
  staged_to_production_hours?: number;
  /** Hours from production_last_actual_finish to first_gr_posting_date (null when either is absent) */
  production_to_gr_hours?: number;
}

export const WmOperationsOrderJourneyContract = {
  id: "wm_operations.order_journey",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_order_journey",
  grain: "one row per plant_id and order_id",
  primaryKey: ["plant_id", "order_id"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Order/Batch Journey Timeline events -- long-format per-order event feed. One row per plant_id x order_id x event_seq. Event types: ORDER_CREATED, RELEASED, TR_CREATED, STAGING_CONFIRMED, PI_START, OPERATION_CONFIRMED, PI_END, GR_POSTED, COMPONENT_ISSUED, QM_LOT_CREATED, QM_UD_TAKEN. PI and QM events absent at plants without those silver tables. event_seq is row_number ordered by event_ts NULLS LAST within the order. No date-relative columns -- no _live wrapper; reads _secured directly.

 * Source View: vw_consumption_wm_operations_order_journey_events
 * Version: 0.1.0
 */
export interface WmOperationsOrderJourneyEvents {
  plant_id: string;
  order_id: string;
  event_seq: number;
  event_ts?: string;
  event_type: string;
  qty?: number;
  uom?: string;
  reference_id?: string;
  detail?: string;
}

export const WmOperationsOrderJourneyEventsContract = {
  id: "wm_operations.order_journey_events",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_order_journey_events",
  grain: "one row per plant_id, order_id, and event_seq",
  primaryKey: ["plant_id", "order_id", "event_seq"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Active process order WIP funnel — one row per plant_id x order_id for released, not-finished orders. stage values: RELEASED / STAGING / STAGED / IN_PRODUCTION / GR_PARTIAL / GR_COMPLETE, derived deterministically from journey milestones. Includes order qty, material, scheduled dates. No current_date/current_timestamp.

 * Source View: vw_consumption_wm_operations_wip_stages
 * Version: 0.1.0
 */
export interface WmOperationsWipStages {
  plant_id: string;
  order_id: string;
  material_code?: string;
  material_name?: string;
  order_qty?: number;
  uom?: string;
  scheduled_start_date?: string;
  scheduled_finish_date?: string;
  /** RELEASED | STAGING | STAGED | IN_PRODUCTION | GR_PARTIAL | GR_COMPLETE */
  stage: string;
  first_tr_created_ts?: string;
  staging_last_confirmed_ts?: string;
  production_first_actual_start?: string;
  first_gr_posting_date?: string;
  gr_qty?: number;
}

export const WmOperationsWipStagesContract = {
  id: "wm_operations.wip_stages",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_wip_stages",
  grain: "one row per plant_id and order_id (active orders only)",
  primaryKey: ["plant_id", "order_id"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Schedule adherence aggregated to plant x scheduled_finish_date (day) grain. planned_count = orders scheduled to finish on this date; completed_count = orders that actually finished; on_time_count = completed on or before scheduled date. max_actual_date is the latest actual_finish_date in the source table — use this to anchor the S-curve chart instead of wall-clock date. No current_date/current_timestamp. Source: gold_process_order_schedule_adherence (completed/closed orders).

 * Source View: vw_consumption_wm_operations_schedule_adherence_daily
 * Version: 0.1.0
 */
export interface WmOperationsScheduleAdherenceDaily {
  plant_id: string;
  scheduled_date: string;
  planned_count: number;
  completed_count: number;
  on_time_count: number;
  max_actual_date?: string;
}

export const WmOperationsScheduleAdherenceDailyContract = {
  id: "wm_operations.schedule_adherence_daily",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_schedule_adherence_daily",
  grain: "one row per plant_id and scheduled_date",
  primaryKey: ["plant_id", "scheduled_date"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Order-grain yield summary for the Yield & Loss analytics view. planned_qty = order_quantity (AFKO.GAMNG); delivered_qty = net GR (movement 101 minus 102). yield_pct = delivered_qty / planned_qty (null when planned_qty is zero/null). is_complete = actual_finish_date IS NOT NULL. Source: gold_wm_order_yield (process_order + goods_movement).

 * Source View: vw_consumption_wm_operations_order_yield
 * Version: 0.1.0
 */
export interface WmOperationsOrderYield {
  /** SAP plant ID */
  plant_id: string;
  /** Process order number (AUFNR) */
  order_id: string;
  /** Finished-good material code */
  material_id?: string;
  /** Finished-good material description */
  material_name?: string;
  /** Production line (AUFK CRVER) */
  production_line?: string;
  /** Planned order quantity (AFKO GAMNG) */
  planned_qty?: number;
  /** Net goods receipt quantity (movement 101 minus 102 reversals; clamped at 0) */
  delivered_qty?: number;
  /** Order quantity unit of measure */
  uom?: string;
  /** delivered_qty / planned_qty (null when planned_qty is zero or null) */
  yield_pct?: number;
  /** True when delivered_qty > 0 (at least one GR movement 101 exists) */
  has_goods_receipt?: boolean;
  /** True when actual_finish_date is not null (order has an actual finish) */
  is_complete?: boolean;
  /** True when the order has been released (AUFK is_released or actual_release_date present) */
  is_released?: boolean;
  /** True when the order carries the TECO (technically complete) status flag */
  is_completed?: boolean;
  /** True when the order is closed (AUFK is_closed) */
  is_closed?: boolean;
  /** Scheduled production start date (AFKO GSTRS) */
  scheduled_start_date?: string;
  /** Scheduled production finish date (AFKO GLTRS) */
  scheduled_finish_date?: string;
  /** Actual finish date (AFKO IEDD — the primary completion signal) */
  actual_finish_date?: string;
  /** Earliest goods receipt posting date (movement 101 against this order) */
  first_gr_date?: string;
  /** Latest goods receipt posting date (movement 101 against this order) */
  last_gr_date?: string;
}

export const WmOperationsOrderYieldContract = {
  id: "wm_operations.order_yield",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_order_yield",
  grain: "one row per plant_id and order_id",
  primaryKey: ["plant_id", "order_id"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Recipe-line benchmark distribution for the Campaigns view. Aggregates complete process orders with goods receipt evidence from gold_wm_order_yield. Grain is plant_id, material_id, and production_line; null production_line is grouped as UNASSIGNED. Percentiles compare yield_pct and GR duration for runs of the same recipe on the same line.

 * Source View: vw_consumption_wm_operations_recipe_benchmark
 * Version: 0.1.0
 */
export interface WmOperationsRecipeBenchmark {
  /** SAP plant ID */
  plant_id: string;
  /** Finished-good material code */
  material_id: string;
  /** Production line used for benchmarking, with null source values grouped as UNASSIGNED */
  production_line: string;
  /** Count of complete orders with goods receipt evidence in this recipe-line distribution */
  run_count: number;
  /** Median delivered/planned yield percentage across qualifying runs */
  median_yield_pct?: number;
  /** 10th percentile delivered/planned yield percentage across qualifying runs */
  p10_yield_pct?: number;
  /** 90th percentile delivered/planned yield percentage across qualifying runs */
  p90_yield_pct?: number;
  /** Median goods-receipt duration in hours, excluding zero/negative or missing spans */
  median_duration_hours?: number;
  /** 10th percentile goods-receipt duration in hours */
  p10_duration_hours?: number;
  /** 90th percentile goods-receipt duration in hours */
  p90_duration_hours?: number;
  /** Latest goods receipt finish date contributing to this benchmark bucket */
  last_run_finish_date?: string;
}

export const WmOperationsRecipeBenchmarkContract = {
  id: "wm_operations.recipe_benchmark",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_recipe_benchmark",
  grain: "one row per plant_id, material_id, and production_line",
  primaryKey: ["plant_id", "material_id", "production_line"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Order + material grain material variance for the Yield & Loss waterfall. One row per plant_id, order_id, material_id (aggregated from reservation_requirement). Silver goods_movement carries no reservation references (MSEG has no RSNUM/RSPOS in the replication schema), so reservation grain would double-count issued_qty for orders with multiple RESB rows for the same material. Grain changed from reservation-item to order+material in v0.2.0. variance_qty = issued_qty - required_qty (positive = over-issue / loss; negative = under-issue). est_loss_value = over-issued qty × standard_price / price_unit (null when no price data). Quantities stay in each row's own base_uom — no cross-material aggregation in gold. Source: gold_wm_order_component_variance (reservation_requirement + goods_movement + material_valuation).

 * Source View: vw_consumption_wm_operations_component_variance
 * Version: 0.2.0
 */
export interface WmOperationsComponentVariance {
  /** SAP plant ID */
  plant_id: string;
  /** Process order number (AUFNR) */
  order_id: string;
  /** Component material code */
  material_id: string;
  /** Component material description */
  material_name?: string;
  /** Base unit of measure for quantities in this row */
  uom?: string;
  /** SAP movement type code (261 = goods issue for production; 261X = batch-where variant) */
  movement_type_code?: string;
  /** Required component quantity aggregated from reservation_requirement (RESB) at order+material grain */
  required_qty: number;
  /** Withdrawn quantity from reservations (RESB ENMNG — already-issued signal from planning) */
  withdrawn_qty?: number;
  /** Net issued quantity from goods movements (261 minus 262 reversals) against this order+material */
  issued_qty?: number;
  /** issued_qty minus required_qty (positive = over-issue / loss; negative = under-issue) */
  variance_qty?: number;
  /** variance_qty / required_qty (null when required_qty is zero; positive = over-issued fraction) */
  variance_pct?: number;
  /** Estimated over-issue value = MAX(variance_qty, 0) × standard_price / price_unit (null when no standard_price available from material_valuation)
 */
  est_loss_value?: number;
  /** Standard price per price_unit from material_valuation (MBEW STPRS) */
  standard_price?: number;
  /** True when the reservation carries the final-issue flag (RESB KZEAR) */
  is_final_issue?: boolean;
}

export const WmOperationsComponentVarianceContract = {
  id: "wm_operations.component_variance",
  version: "0.2.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_component_variance",
  grain: "one row per plant_id, order_id, and material_id",
  primaryKey: ["plant_id", "order_id", "material_id"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
  },
  accessPolicy: {
    rowLevelKey: "plant_id",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

/**
 * Order-grain adherence miss root-cause classification for Production Progress. One row per late/missed process order. root_cause_class precedence: LATE_RELEASE (release after scheduled start) > MATERIAL_SHORT (component under-issue) > CAPACITY (production start lagged >24h after release) > UNCLASSIFIED. is_open_late is query-time (unfinished past scheduled_finish_date). Source: gold_wm_adherence_root_cause.

 * Source View: vw_consumption_wm_operations_adherence_root_cause
 * Version: 0.1.0
 */
export interface WmOperationsAdherenceRootCause {
  /** SAP plant ID */
  plant_id: string;
  /** Process order number (AUFNR) */
  order_id: string;
  /** Header material code (AFPO MATNR) */
  material_id?: string;
  /** Material description */
  material_name?: string;
  /** Planned order quantity (AFKO GAMNG) */
  order_qty?: number;
  /** Order quantity unit of measure */
  uom?: string;
  /** Production line / work centre */
  production_line?: string;
  /** Scheduled start date (AFKO GSTRS) */
  scheduled_start_date?: string;
  /** Scheduled finish date (AFKO GLTRS) */
  scheduled_finish_date?: string;
  /** Actual release date (AUFK FTRMI) */
  actual_release_date?: string;
  /** Actual finish date (AUFK GLTRI); null when order still open */
  actual_finish_date?: string;
  /** LATE_RELEASE | MATERIAL_SHORT | CAPACITY | UNCLASSIFIED */
  root_cause_class: string;
  /** True when actual_release_date > scheduled_start_date */
  is_late_release?: boolean;
  /** True when any component variance_qty is below tolerance (under-issue) */
  has_material_short?: boolean;
  /** Count of components with under-issue beyond tolerance */
  shortfall_component_count?: number;
  /** Most negative component variance_qty on the order (under-issue depth) */
  min_variance_qty?: number;
  /** Hours from release to first operation actual start (capacity signal) */
  release_to_production_hours?: number;
  /** First operation actual start timestamp (AFVC/operation confirmations) */
  production_first_actual_start?: string;
  /** True when actual_finish_date > scheduled_finish_date */
  is_finish_late?: boolean;
  /** True when unfinished and scheduled_finish_date is before today (query-time) */
  is_open_late?: boolean;
}

export const WmOperationsAdherenceRootCauseContract = {
  id: "wm_operations.adherence_root_cause",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_wm_operations_adherence_root_cause",
  grain: "one row per plant_id and order_id",
  primaryKey: ["plant_id", "order_id"],
  freshness: {
    expectedMinutes: 60,
    warningMinutes: 120,
    criticalMinutes: 240,
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
    "wm_operations.order_components": WmOperationsOrderComponentsContract,
    "wm_operations.operator_activity": WmOperationsOperatorActivityContract,
    "wm_operations.queue_workload": WmOperationsQueueWorkloadContract,
    "wm_operations.outbound": WmOperationsOutboundContract,
    "wm_operations.inbound_deliveries": WmOperationsInboundDeliveriesContract,
    "wm_operations.recon_alerts": WmOperationsReconAlertsContract,
    "wm_operations.handling_units": WmOperationsHandlingUnitsContract,
    "wm_operations.expiry_risk": WmOperationsExpiryRiskContract,
    "wm_operations.stock_holds": WmOperationsStockHoldsContract,
    "wm_operations.exceptions": WmOperationsExceptionsContract,
    "wm_operations.recon_exceptions": WmOperationsReconExceptionsContract,
    "wm_operations.recon_value_summary": WmOperationsReconValueSummaryContract,
    "wm_operations.campaigns": WmOperationsCampaignsContract,
    "wm_operations.daily_activity": WmOperationsDailyActivityContract,
    "wm_operations.physical_inventory": WmOperationsPhysicalInventoryContract,
    "wm_operations.bin_occupancy": WmOperationsBinOccupancyContract,
    "wm_operations.slow_movers": WmOperationsSlowMoversContract,
    "wm_operations.movement_control": WmOperationsMovementControlContract,
    "wm_operations.staging_pace": WmOperationsStagingPaceContract,
    "wm_operations.staging_demand": WmOperationsStagingDemandContract,
    "wm_operations.buffer_flow": WmOperationsBufferFlowContract,
    "wm_operations.qm_lots": WmOperationsQmLotsContract,
    "wm_operations.order_operations": WmOperationsOrderOperationsContract,
    "wm_operations.downtime_pareto": WmOperationsDowntimeParetoContract,
    "wm_operations.plants": WmOperationsPlantsContract,
    "wm_operations.downtime_events": WmOperationsDowntimeEventsContract,
    "wm_operations.qm_lot_status": WmOperationsQmLotStatusContract,
    "wm_operations.qm_disposition_queue": WmOperationsQmDispositionQueueContract,
    "wm_operations.qm_characteristic_pareto": WmOperationsQmCharacteristicParetoContract,
    "wm_operations.qm_ud_code_pareto": WmOperationsQmUdCodeParetoContract,
    "wm_operations.order_journey": WmOperationsOrderJourneyContract,
    "wm_operations.order_journey_events": WmOperationsOrderJourneyEventsContract,
    "wm_operations.wip_stages": WmOperationsWipStagesContract,
    "wm_operations.schedule_adherence_daily": WmOperationsScheduleAdherenceDailyContract,
    "wm_operations.order_yield": WmOperationsOrderYieldContract,
    "wm_operations.recipe_benchmark": WmOperationsRecipeBenchmarkContract,
    "wm_operations.component_variance": WmOperationsComponentVarianceContract,
    "wm_operations.adherence_root_cause": WmOperationsAdherenceRootCauseContract,
  },
} as const;
