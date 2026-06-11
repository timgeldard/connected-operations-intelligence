# ADR 013: Current-state snapshot MVs for CDC-less SAP sources

## Status
Accepted (2026-06-11)

## Context
Replicated SAP bronze tables fall into two classes — full CDC (AEDATTM + AERUNID/AERECNO/RecordActivity) and AEDATTM-only. The imported designs assumed streaming SCD1 everywhere; AEDATTM-only sources were source-guarded off ("not run-eligible"), which silently parked quality_inspection_lot, downtime_event, process_order_operation and pi_sheet_execution. AEDATTM is an extraction timestamp, not an event order; fabricating sequencing from it was rejected.

## Decision
AEDATTM-only sources are modelled as full-recompute snapshot materialized views (the batch_stock/MCHB precedent), with (1) plant/time gates applied as pre-gate pushdown at the source read, (2) AEDATTM carried as _replicated_at (extraction timestamp only), (3) source guards testing the REAL business columns the select uses — never CDC columns the source lacks, and never unverified field names (DD03L verification is mandatory after three fabricated-field incidents; note the client column varies per source: MANDT / MANDANT / CLIENT).

## Consequences
Recompute cost scales with the gated source scan and is bounded by the gates (measured under the cost-observation period); MVs self-correct on gate/config changes with no manual full refresh; no child-before-parent stream ordering holes. Individual tables can convert to streaming SCD1 later if real CDC metadata is replicated.
