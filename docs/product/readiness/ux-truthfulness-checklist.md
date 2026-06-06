# UX Truthfulness & Trust Checklist

This checklist defines the non-negotiable UX rules for ConnectIO RAD V2 to ensure that users (and agents) never misinterpret mock, partial, or unavailable data as a "clean" or "safe" production state.

## 1. Source Truthfulness

*   **Never show mock as live**: If data is from a mock adapter or fixture, it must be explicitly labeled (e.g., "Mock evidence", "Demo fixture").
*   **Always show source mode**: Every workspace or evidence panel must communicate its current adapter mode (`mock`, `legacy-api`, `databricks-api`, `mixed`).
*   **Distinguish "Queried At" from "Source Freshness"**: 
    *   `Queried At`: When the frontend last fetched data.
    *   `Source Freshness` (`dataAsOf`): When the data was last updated in the source system (SAP/Databricks).
    *   Never use `Queried At` to claim data is "up to date" in the source system.

## 2. Empty States & "Safe" Language

*   **Never show unavailable as zero**: If a data slice fails to load or is not yet implemented, do not show "0" or "None". Show "Unavailable" or "Pending".
*   **Never show "No records" as "All clear"**:
    *   Traceability: Instead of "No customer exposure", use "No customer exposure records returned from current source".
    *   SPC: Instead of "In control", use "No SPC signals returned".
    *   Warehouse: Instead of "No exceptions", use "No exception records returned from current source".
*   **Avoid dangerous verbs**: Avoid "Accepted", "Released", "Contained", "Approved" unless they are explicitly sourced from a live, verified record. Use "Pending verification" or "Simulated" for UAT candidates.

## 3. Partial Data & Mixed States

*   **Show partial-data warnings**: If a workspace contains multiple panels and some load while others fail/unavailable, a "Partial evidence" warning must be visible at the workspace level.
*   **Never hide failures**: If a background query fails, do not simply hide the panel. Show an error or "unavailable" state to prevent users from assuming the data is missing because it's "clean".

## 4. UAT & Verification

*   **Label UAT Candidates**: If a workspace is loaded with a hardcoded UAT candidate (e.g., a "Golden Batch"), label it as "UAT Candidate — Pending Live Verification".
*   **Standardize Evidence Capture**: Use the standardized "Copy UAT Evidence" format for audit trails. This payload must include `adapterMode`, `sourceConfidence`, and any `warnings`.

## 5. Write-back & Actions

*   **Label Simulated Actions**: If an action (e.g., "Release Batch") does not perform a real SAP transaction, the success message must explicitly state it was simulated (e.g., "Batch release simulated (mock); no live SAP release executed").
