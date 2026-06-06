# Mass Balance Movement Category Register

**Status:** Observed values captured 2026-05-20 — no direction assigned without validation
**Created:** 2026-05-21
**Open issues:** TRACE-P1-010 (direction mapping), TRACE-P1-011 (BALANCE_QTY semantics)
**Related:** `mass-balance-source-mapping.md`, `mass-balance-semantic-validation-pack.md`

This register records every MOVEMENT_CATEGORY value observed in `gold_batch_mass_balance_v` and tracks the approval state of each direction assignment.

No direction is assigned here from engineering assumptions. The "Proposed Direction" column may contain an engineering hypothesis for review — it must not be treated as confirmed until the "Approved Direction" and "Approved By" columns are filled in by the data-platform or business owner.

---

## Movement Category Register

| MOVEMENT_CATEGORY | Observed in UAT? | Approx row count | Proposed Direction (hypothesis) | Confidence | Current V2 Treatment | Approved Direction | Approved By | Approval Date | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `Production` | Yes | 13,657,021 | inbound | Medium — production receipt typically adds to batch | production | — | — | — | Mapped in `_MOVEMENT_CATEGORY_MAP`; direction not yet business-verified |
| `Shipment` | Yes | 6,452,963 | outbound | Medium — shipment typically reduces batch | shipment | — | — | — | Mapped in `_MOVEMENT_CATEGORY_MAP`; direction not yet business-verified |
| `STO Receipt` | Yes | 11,912,997 | unknown | Low — could be inbound or transfer depending on plant context | adjustment | — | — | — | TRACE-P1-010: currently treated as adjustment; may be inbound for queried batch |
| `STO Transfer` | Yes | 15,005,495 | unknown | Low — could be inbound, outbound, or transfer | adjustment | — | — | — | TRACE-P1-010: inter-plant stock transfer order; direction ambiguous |
| `Other (261)` | Yes | 65,391,459 | unknown | Low — SAP movement type 261 is goods issue for order; typically outbound | adjustment | — | — | — | TRACE-P1-010: largest volume category; direction unconfirmed |
| `Other (321)` | Yes | 7,040,890 | unknown | Low | adjustment | — | — | — | TRACE-P1-010 |
| `Other (262)` | Yes (low) | 1,525,848 | unknown | Low — SAP 262 is return from order; potentially inbound | adjustment | — | — | — | TRACE-P1-010; may reverse 261 rows |
| `Write-Off` | Yes | 378,927 | unknown | Low — likely outbound but must be confirmed | adjustment | — | — | — | TRACE-P1-010 |
| `Other (Z01)` | Yes | 10,346,164 | unknown | Unknown — Kerry-local movement type | adjustment | — | — | — | TRACE-P1-010; Z-prefix = Kerry custom |
| `Other (Z61)` | Yes | 8,129,937 | unknown | Unknown | adjustment | — | — | — | TRACE-P1-010; Z-prefix = Kerry custom |
| `Other (Z62)` | Yes | 4,111,642 | unknown | Unknown | adjustment | — | — | — | TRACE-P1-010; Z-prefix = Kerry custom |
| `Other (Z12)` | Yes | 353,595 | unknown | Unknown | adjustment | — | — | — | TRACE-P1-010; Z-prefix = Kerry custom |
| `Other (311)` | Yes | 1,547,028 | unknown | Low | adjustment | — | — | — | TRACE-P1-010 |
| `Other (341)` | Yes | 650,174 | unknown | Low | adjustment | — | — | — | TRACE-P1-010 |
| `Other (343)` | Yes | 464,314 | unknown | Low | adjustment | — | — | — | TRACE-P1-010 |
| `Other (344)` | Yes | 431,076 | unknown | Low | adjustment | — | — | — | TRACE-P1-010 |
| `Other (681)` | Yes | 592,012 | unknown | Low | adjustment | — | — | — | TRACE-P1-010 |
| `Other (342)` | Yes | 342,290 | unknown | Low | adjustment | — | — | — | TRACE-P1-010 |
| `Other (201)` | Yes | 344,384 | unknown | Low | adjustment | — | — | — | TRACE-P1-010 |
| `Other (711)` | Yes | 893,404 | unknown | Low | adjustment | — | — | — | TRACE-P1-010 |

**Direction vocabulary:**

| Value | Meaning |
|---|---|
| `inbound` | Movement adds stock to the queried batch |
| `outbound` | Movement removes stock from the queried batch |
| `transfer` | Movement moves stock between plants or storage locations without net change |
| `adjustment` | Inventory correction — direction depends on sign of QUANTITY |
| `neutral` | No net material flow (e.g. revaluation) |
| `unknown` | Direction not determinable from available information — requires data-platform or business confirmation |

---

## BALANCE_QTY Decision Table

| Question | Evidence Needed | Owner Decision | Status |
|---|---|---|---|
| Is BALANCE_QTY a precomputed running balance per batch? | SQL query comparing BALANCE_QTY to manually summed directional quantities for the same batch | Data platform | Not done — TRACE-P1-011 |
| Is BALANCE_QTY always 0 across all batches, or only for the UAT candidate? | Run spot-check across multiple batches (not just 20035129 / 8000049668) | Data platform | Not done — only UAT candidate checked; all 10 sample rows = 0.000 |
| Is BALANCE_QTY populated by a nightly batch job that hasn't run for UAT data? | Check job schedule and last run date for the gold view | Data platform | Not done |
| Should V2 compute its own running balance from directionally mapped QUANTITY values? | Depends on direction mapping (TRACE-P1-010) and QUANTITY sign semantics | Engineering + data platform | Not started |
| Is QUANTITY already directionally signed (negative for outbound)? | Select rows with known outbound movement types; check QUANTITY sign | Data platform | Not done — only ABS_QUANTITY confirmed |
