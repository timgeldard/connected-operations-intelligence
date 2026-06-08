# Business Object Model

This document outlines the core business objects within the ConnectIO-RAD governed app data layer.

## Batch

- **Description:** A specific quantity of a material produced under identical conditions.
- **Typical identity keys:** `batch_id`, `material_id`, `plant_id`
- **Related data products:** Batch Summary, Quality Evidence, Movement Ledger, Lineage Graph, Exposure Evidence, Investigation Pack

## Material

- **Description:** A manufactured, purchased, or intermediate product within the supply chain.
- **Typical identity keys:** `material_id`
- **Related data products:** Material Summary, Specification Pack

## Inspection Lot

- **Description:** A request to a plant to inspect a specific quantity of material or piece of equipment.
- **Typical identity keys:** `inspection_lot_id`, `plant_id`
- **Related data products:** Identity, Result Evidence, Decision Context, Timeline

## MIC Result

- **Description:** The result of a Master Inspection Characteristic (MIC) evaluation during quality control.
- **Typical identity keys:** `mic_id`, `inspection_lot_id`, `sample_id`
- **Related data products:** Value Snapshot, Trend Timeline

## Process Order

- **Description:** An order that defines the production of materials in process manufacturing.
- **Typical identity keys:** `process_order_id`, `plant_id`
- **Related data products:** Execution Evidence, Yield Summary

## Delivery

- **Description:** An outbound shipment to a customer or a transfer between facilities.
- **Typical identity keys:** `delivery_id`
- **Related data products:** Delivery Timeline, Exposure Record

## Purchase Order

- **Description:** A request to a supplier for the procurement of materials or services.
- **Typical identity keys:** `purchase_order_id`, `supplier_id`
- **Related data products:** Procurement Timeline, Exception Summary

## Stock Position

- **Description:** The current inventory level of a material at a specific location.
- **Typical identity keys:** `material_id`, `plant_id`, `storage_location_id`
- **Related data products:** Snapshot, Movement Ledger

## Supplier Batch

- **Description:** A batch of raw material provided by an external vendor.
- **Typical identity keys:** `supplier_batch_id`, `material_id`, `vendor_id`
- **Related data products:** Identity, Supplier Exposure

## Customer Exposure

- **Description:** The extent to which a specific finished product or intermediate has reached customers.
- **Typical identity keys:** `batch_id`, `customer_id`
- **Related data products:** Exposure Ledger

## SPC Characteristic

- **Description:** A process parameter or material property monitored over time using statistical process control methods.
- **Typical identity keys:** `material_id`, `plant_id`, `mic_id`, `operation_id`
- **Related data products:** Identity, Subgroup Series, Limit Provenance, Signal Evidence, Capability Evidence

## Warehouse Exception

- **Description:** An anomaly or error flagged during warehouse operations (e.g., discrepancies, missing stock).
- **Typical identity keys:** `exception_id`, `warehouse_id`
- **Related data products:** Exception Details
