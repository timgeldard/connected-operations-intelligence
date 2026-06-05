# ADR-002: Run pipeline in Continuous mode

**Status:** Accepted  
**Date:** 2026-05-30

## Context

Aecorsoft replicates SAP changes incrementally and near-continuously. The silver pipeline can run in one of two modes:

1. **Triggered (scheduled job)** — pipeline runs on a cron/periodic schedule, processes accumulated changes, then stops. Lower cost; adds scheduling lag (minutes to hours).
2. **Continuous** — pipeline runs indefinitely, processing changes as they arrive. Higher cost; near-real-time delivery.

The primary consumers are warehouse operatives and supervisors who need current stock, bin, and transfer order state to make decisions on the shop floor.

## Decision

Run in **Continuous** mode with no scheduling job.

## Consequences

- Silver tables reflect SAP state within seconds of Aecorsoft replication, not on a schedule.
- Serverless compute runs continuously; cost is higher than triggered mode. Review actual DBU consumption after the first week of prod operation.
- No scheduling job to maintain or monitor.
- A daily restart window (`restart_window: start_hour: 2, time_zone_id: UTC`) allows Databricks to apply cluster updates with minimal impact on off-peak hours.
- If near-real-time is not required for a subset of tables in future, those can be split into a separate triggered pipeline without affecting this one.
