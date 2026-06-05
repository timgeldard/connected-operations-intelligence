/**
 * This file is auto-generated from app_contract_manifest.yml.
 * Do not modify this file manually.
 */

/**
 * Overview metrics for the Warehouse 360 dashboard.
 * Source View: vw_consumption_warehouse360_overview
 * Version: 0.1.0
 */
export interface Warehouse360Overview {
  /** SAP plant code */
  plant_code: string;
  /** Percentage of occupied warehouse bins */
  occupancy_rate: number;
}

export const Warehouse360OverviewContract = {
  id: "warehouse360.overview",
  version: "0.1.0",
  domain: "warehouse",
  owner: "warehouse-operations",
  lifecycle: "draft",
  sourceView: "vw_consumption_warehouse360_overview",
  grain: "one row per plant per refresh",
  primaryKey: ["plant_code"],
  freshness: {
    expectedMinutes: 15,
    warningMinutes: 30,
    criticalMinutes: 60,
  },
  accessPolicy: {
    rowLevelKey: "plant_code",
    entitlementSource: "published.central_services.user_plant_access",
  },
} as const;

export const ioReportingContracts = {
  contractVersion: "0.1.0",
  product: "connected-operations-intelligence",
  contracts: {
    "warehouse360.overview": Warehouse360OverviewContract,
  },
} as const;
