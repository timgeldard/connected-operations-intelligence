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
 * IM/WM stock discrepancies summarised per material and exception type (first-wave AGGREGATE contract — ADR-0004 D6). gold_warehouse_exceptions carries no stable per-exception variance key (storage_location_id/bin_id absent; reference_id ~99% null), so detail rows are rolled up to plant x material x batch x exception_type with count/quantity/severity/age/date measures. A detail-grain reconciliation contract is future work, only once a stable variance key exists upstream. Candidate contract pending DEV profiling of primary key uniqueness, plant_id nullability, and freshness.

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
  /** Earliest detection date across the aggregated exceptions */
  oldest_detected_date?: string;
  /** Most recent detection date across the aggregated exceptions */
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
  },
} as const;
