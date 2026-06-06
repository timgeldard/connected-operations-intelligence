# Agent Contribution Rules

This repository builds **consumer-grade manufacturing applications** on top of a **governed app-facing data-product layer**. 

Agents must treat consumer workflow, design-system consistency, and governed data semantics as equal delivery concerns.

---

## Core Rules

- **Equal Focus on App & Data Layer**: Do not block consumer-grade app progress solely because a downstream data product is not production-ready. Design the user experience with explicit warning states or mock modes where backend catalog endpoints are still pending.
- **Do Not Bypass Contracts**: Agents must not add raw UI features or state mutations that bypass governed data-product schemas. All data exchanges must use `@connectio/data-contracts`.
- **Surface Caveats Clearly**: Agents must display visible caveats in the UI where data products are partial, governance-pending, browser-UAT-pending, or source-limited.
- **Distinguish Maturity Axes**: Always distinguish application experience maturity (A0-A6) from data-product maturity (D0-D6). Do not describe an application as production-ready unless both maturity axes support that claim.
- **Terminology Shift**: Avoid the phrase "reference consumer" when referring to first-class product features. Use "consumer application" or "product experience" instead.
- **Data Governance Boundaries**:
  - No new runtime functionality during code freeze.
  - No new route without a data-product spec.
  - No new field without field classification.
  - No new UI consuming live data unless the route/contract/readiness are known.
  - No business decision labels without source/governance.
  - No silent mock fallback in non-mock adapter modes.
  - No UAT or production-readiness claims without verified evidence.
  - Every PR must declare its category.

---

## PR Categories

When creating PRs, agents must classify the work into one of the following:

- `consumer-application`
- `governed-data-product`
- `design-system`
- `readiness-evidence`
- `repo-hygiene`
- `deployment-assets`

---

## Future Implementation Prompts

Future implementation prompts should start by identifying:

- Target consumer application and maturity (A0-A6)
- Associated data product and maturity (D0-D6)
- Business object
- Pattern
- Source impact
- Field classifications
- Surfaced caveats & forbidden claims

---

## Style Requirements

- Be concise but explicit.
- Use Markdown tables where useful.
- Do not overclaim current implementation quality.
- Do not claim browser UAT evidence exists unless provided by the user.
- Do not claim production readiness without evidence logs.
- Treat existing apps as first-class consumer applications.
