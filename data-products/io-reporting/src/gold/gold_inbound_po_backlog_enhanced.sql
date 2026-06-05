-- Companion Databricks SQL definition for enhanced inbound PO backlog.
-- Production Lakeflow source of truth: gold/warehouse_inbound_gold.py.
--
-- GR semantics are classification-driven. In the current overlay, PO receipt
-- is 103 and PO receipt reversal is 104. If a plant confirms PO-linked 101
-- semantics, update silver.movement_type_classification rather than this view.

CREATE OR REFRESH MATERIALIZED VIEW gold_inbound_po_backlog_enhanced AS
WITH open_items AS (
  SELECT *
  FROM purchase_order
  WHERE NOT coalesce(is_delivery_complete, false)
    AND NOT coalesce(is_item_deleted, false)
),
gr_by_item AS (
  SELECT
    gm.purchase_order_number,
    gm.purchase_order_item,
    coalesce(
      sum(
        CASE
          WHEN mt.is_po_receipt THEN gm.quantity
          WHEN mt.is_po_receipt_reversal THEN -gm.quantity
          ELSE 0.0
        END
      ),
      0.0
    ) AS gr_quantity,
    max(gm.posting_date) AS latest_gr_posting_date
  FROM goods_movement AS gm
  INNER JOIN movement_type_classification AS mt
    ON gm.movement_type_code = mt.movement_type_code
  WHERE gm.purchase_order_number IS NOT NULL
    AND gm.purchase_order_item IS NOT NULL
    AND (coalesce(mt.is_po_receipt, false) OR coalesce(mt.is_po_receipt_reversal, false))
  GROUP BY
    gm.purchase_order_number,
    gm.purchase_order_item
),
item_summary AS (
  SELECT
    oi.plant_code,
    oi.vendor_code,
    oi.purchasing_org,
    count(*) AS open_item_count,
    count(DISTINCT oi.purchase_order_number) AS open_po_count,
    coalesce(sum(oi.ordered_quantity), 0.0) AS total_ordered_qty,
    coalesce(sum(coalesce(gr.gr_quantity, 0.0)), 0.0) AS total_gr_qty,
    coalesce(
      sum(greatest(coalesce(oi.ordered_quantity, 0.0) - coalesce(gr.gr_quantity, 0.0), 0.0)),
      0.0
    ) AS remaining_open_qty,
    coalesce(sum(oi.net_value), 0.0) AS total_open_value,
    min(oi.purchase_order_date) AS earliest_po_date,
    max(gr.latest_gr_posting_date) AS latest_gr_posting_date,
    sum(CASE WHEN coalesce(gr.gr_quantity, 0.0) <= 0.0 THEN 1 ELSE 0 END) AS item_without_gr_count,
    sum(
      CASE
        WHEN coalesce(gr.gr_quantity, 0.0) > 0.0
         AND coalesce(gr.gr_quantity, 0.0) < coalesce(oi.ordered_quantity, 0.0)
        THEN 1 ELSE 0
      END
    ) AS partial_gr_item_count,
    sum(
      CASE
        WHEN coalesce(gr.gr_quantity, 0.0) >= coalesce(oi.ordered_quantity, 0.0)
        THEN 1 ELSE 0
      END
    ) AS fully_gr_item_count,
    sum(CASE WHEN oi.qa_stock_type = 'Q' THEN 1 ELSE 0 END) AS qa_inspection_item_count
  FROM open_items AS oi
  LEFT JOIN gr_by_item AS gr
    ON oi.purchase_order_number = gr.purchase_order_number
   AND oi.item_number = gr.purchase_order_item
  GROUP BY
    oi.plant_code,
    oi.vendor_code,
    oi.purchasing_org
),
po_group_keys AS (
  SELECT DISTINCT
    plant_code,
    vendor_code,
    purchasing_org,
    purchase_order_number
  FROM open_items
),
putaway_summary AS (
  SELECT
    p.plant_code,
    p.vendor_code,
    p.purchasing_org,
    count(DISTINCT t.transfer_order_number) AS putaway_to_count,
    count(DISTINCT CASE WHEN t.item_status = 'Fully Confirmed' THEN t.transfer_order_number END) AS confirmed_putaway_to_count,
    min(t.created_datetime) AS oldest_putaway_to_created_datetime,
    max(t.confirmed_date) AS latest_putaway_to_confirmed_date
  FROM po_group_keys AS p
  LEFT JOIN warehouse_transfer_order AS t
    ON p.purchase_order_number = t.source_reference_number
   AND p.plant_code = t.plant_code
  GROUP BY
    p.plant_code,
    p.vendor_code,
    p.purchasing_org
)
SELECT
  i.plant_code,
  i.vendor_code,
  i.purchasing_org,
  i.open_item_count,
  i.open_po_count,
  i.total_ordered_qty,
  i.total_gr_qty,
  i.remaining_open_qty,
  i.total_open_value,
  i.earliest_po_date,
  i.latest_gr_posting_date,
  i.item_without_gr_count,
  i.partial_gr_item_count,
  i.fully_gr_item_count,
  i.qa_inspection_item_count,
  coalesce(p.putaway_to_count, 0) AS putaway_to_count,
  coalesce(p.confirmed_putaway_to_count, 0) AS confirmed_putaway_to_count,
  p.oldest_putaway_to_created_datetime,
  p.latest_putaway_to_confirmed_date
FROM item_summary AS i
LEFT JOIN putaway_summary AS p
  ON i.plant_code = p.plant_code
 AND i.vendor_code = p.vendor_code
 AND i.purchasing_org = p.purchasing_org;
