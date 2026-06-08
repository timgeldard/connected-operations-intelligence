# UAT Evidence — Storage Root

> **Storage convention** (from
> [`browser-uat-evidence-standard.md`](../browser-uat-evidence-standard.md)):
>
> ```
> docs/app-data-layer/evidence/YYYY-MM-DD/<app-or-data-product>/
> ```
>
> **Do not create evidence folders speculatively.** A dated folder exists
> only because an actual browser UAT capture happened.

---

## Pending Captures

Pre-prepared capture packs live under `pending/`. Each folder has all
known fields pre-filled (routes, expected governed states, forbidden
claims). When running a UAT session:

1. Copy the relevant folder from `pending/` to
   `YYYY-MM-DD/<journey-slug>/` (ISO date, today's date).
2. Fill in the tester, environment, branch/commit, identifiers, and
   actual results.
3. Drop screenshots into the new `screenshots/` subfolder.
4. File network evidence in `network/` where practical.
5. Update the `Result` line from `not-started` to the appropriate
   outcome from the evidence standard.

The `pending/` templates are version-controlled here so the filled-in
fields stay in sync with the current data products and checklists.

---

## Journey Index

| # | Journey slug                                 | Priority | UAT entry status             |
|---|----------------------------------------------|----------|------------------------------|
| 1 | `trace-batch-header-customer-exposure`        | 1        | `ready-for-uat-with-caveats` |
| 2 | `trace-supplier-exposure-mass-balance`        | 2        | `ready-for-uat-with-caveats` |
| 3 | `quality-usage-decision-evidence`             | 3        | `ready-for-uat-with-caveats` |
| 4 | `poh-process-order-header`                    | 4        | `ready-for-uat-with-caveats` |
| 5 | `spc-chart-data-series`                       | 5        | `ready-for-uat-with-caveats` |
| 6 | `warehouse-inbound`                           | 6        | `ready-for-uat-with-caveats` |
| 7 | `warehouse-staging`                           | 7        | `ready-for-uat-with-caveats` |
| 8 | `warehouse-exceptions`                        | 8        | `ready-for-uat-with-caveats` |

---

## Related

- [`browser-uat-evidence-standard.md`](../browser-uat-evidence-standard.md)
- [`browser-uat-evidence-template.md`](../browser-uat-evidence-template.md)
- [`uat-entry-plan.md`](../uat-entry-plan.md)
- `browser-uat-checklists/` — per-domain checklists
