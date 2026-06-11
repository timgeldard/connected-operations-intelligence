# Browser UAT Evidence Standard

> **Status.** Framework definition only. This document does **not** assert
> that any route, panel, or data product in this repo has passed browser
> UAT. It defines what "browser UAT captured" means and what evidence
> must accompany the claim.

## 1. Purpose

Browser UAT evidence proves that the governed backend contract, the
frontend adapter, and the UI rendering work together inside a real
browser session **without converting source-truthful states into
misleading defaults**. It is the final readiness gate before a route or
data product can be considered for production promotion.

It is _not_ a substitute for source verification, contract enforcement,
mapper tests, route tests, or reference-consumer alignment — those gates
must already be closed. Browser UAT only proves that the assembled stack
behaves correctly end-to-end in a browser.

## 2. Scope

This standard applies to every governed data product in the app data
layer:

- Trace
- Quality
- SPC
- POH (Process Order Header / Process Order Review)
- Warehouse
- any future app data product that claims `browser-uat-captured`
  readiness in [`route-readiness-standard.md`](./route-readiness-standard.md)

## 3. Required evidence

For each browser UAT capture, the evidence pack **must** record:

- date / time (ISO 8601, time zone explicit)
- tester (name + role)
- environment (e.g. `dev`, `uat`, `staging`, plus the V1/Databricks
  backend host being proxied)
- branch / commit SHA being exercised
- route(s) exercised (URL path + HTTP method)
- data product(s) exercised (matching the names in the
  [domain catalog](./domain-data-product-catalog.md))
- test dataset / identifiers used (material / batch / plant / order /
  warehouse — whatever scoped the run)
- screenshots and/or screen recordings (still images preferred for
  long-term diffing)
- API / network evidence where practical (HAR file or hand-saved
  request/response JSON)
- expected governed states (e.g. _`recallRecommended` should render as
  unavailable, not as "recall not required"_)
- actual observed UI rendering (matching the expected list, point by
  point)
- pass / fail result (using the vocabulary in section 6)
- caveats (anything that affects how the result should be interpreted)
- follow-up issues (linked tickets / PRs where applicable)

If any required field is unavailable, mark it `n/a` with a one-line
justification. Do **not** omit fields silently.

## 4. Evidence storage convention

Evidence packs live under:

```
docs/app-data-layer/evidence/YYYY-MM-DD/<app-or-data-product>/
```

Examples:

```
docs/app-data-layer/evidence/2026-05-24/trace-batch-exposure/
docs/app-data-layer/evidence/2026-05-24/spc-control-chart-series/
docs/app-data-layer/evidence/2026-05-24/warehouse-exceptions/
```

Within each evidence folder:

```
README.md          ← filled-in copy of browser-uat-evidence-template.md
screenshots/       ← numbered PNGs (see section 5)
network/           ← HAR or JSON capture of relevant API calls
notes.md           ← narrative, anomalies, anything that doesn't fit the template
```

Do **not** create evidence folders speculatively. A folder exists only
because an actual capture happened.

## 5. Screenshot naming convention

Number screenshots so a reviewer can read the run top-to-bottom without
the tester's chat narration:

```
01-query-inputs.png
02-summary-panel.png
03-null-state-rendering.png
04-network-response.png
05-warning-caveat-rendering.png
06-...
```

If a single panel needs multiple shots, suffix with `-a`, `-b`, etc.
(e.g. `03-null-state-rendering-a.png`).

## 6. Pass / fail vocabulary

Use exactly these readiness states. Anything outside this list is
ambiguous and will not be honoured by the readiness standard:

| State                 | Meaning                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `not-started`         | No browser UAT attempted yet.                                                                                    |
| `evidence-captured`   | Run completed, evidence pack exists, no judgement applied yet.                                                   |
| `passed-with-caveats` | Run executed the journey successfully but with caveats that block production until resolved (caveats listed).    |
| `failed`              | Run executed but the journey did not behave per contract / spec.                                                 |
| `blocked`             | Run could not be executed — prerequisite missing (e.g. governance closure, source verification, OAuth identity). |
| `not-applicable`      | The journey does not apply (e.g. a mock-only data product).                                                      |

> **Do not** use `production-ready` as a UAT result. Production
> readiness is a separate, broader judgement defined in
> [`route-readiness-standard.md`](./route-readiness-standard.md).

## 7. Required checks across all apps

Every browser UAT, regardless of app, must verify:

- no silent mock fallback occurred in non-mock mode (adapter source
  visible in the panel; network shows the real backend)
- no invented UOM defaults (`'KG'`, `'EA'`, `'L'`, etc.) where the
  source returned null
- null / unknown / unavailable / not-evaluated values render as
  unavailable / unknown / not-evaluated — **not** as `0`, `''`,
  `'OK'`, `'released'`, `'low'`, `'safe'`, etc.
- warnings and caveats from the backend (e.g. `multipleLotsWarning`,
  `usageDecisionMappingStatus`, `governance-pending` flags) are
  preserved in the UI
- no governed claim is made without a governed source (e.g. no
  "recall not required" without `recallRecommended === false` from a
  governed source)
- response data matches the expected data product contract
  (`zod` schema in `@connectio/data-contracts` or generated Pydantic)
- the browser view does **not** contradict backend source-truth
  semantics — if the API says `unknown`, the UI must not display
  `released`

## 8. What this standard does not cover

- accessibility audits
- visual regression
- performance / load testing
- security penetration testing
- governance closure for data products that are still
  `governance-pending`

Each of those is a separate readiness gate.

## 9. Related documents

- [`browser-uat-evidence-template.md`](./browser-uat-evidence-template.md) — fill-in template
- [`route-readiness-standard.md`](./route-readiness-standard.md) — overall readiness gates
- [`evidence-pack-standard.md`](./evidence-pack-standard.md) — pattern reference
- `browser-uat-checklists/` — per-app journey checklists
