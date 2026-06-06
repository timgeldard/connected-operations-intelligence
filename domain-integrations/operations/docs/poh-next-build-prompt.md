# POH Next Build Prompt

Use this prompt for the next Process Order History / POH build block.

## Context

ConnectIO RAD V2 is moving toward UAT readiness. Process Order History is a
strong read-only UAT candidate with native Databricks routes for order header,
operations, confirmations, and goods movements, plus section-level evidence
completeness and copyable UAT evidence.

Known UAT candidate:

- `processOrderId`: `7006965038`
- `plantId`: `C113`

## Additional Follow-On Instruction: Deep Dive V1 Process Order History Before Coding

Before implementing POH changes in V2, inspect the V1 repo to understand how
Process Order History worked previously.

V1 repo:

- <https://github.com/timgeldard/ConnectIO-RAD>

V2 repo:

- <https://github.com/timgeldard/connectio-rad-v2>

Purpose:

Do not build POH purely from current V2 assumptions. First compare V1 Process
Order History functionality, data access, UI behaviour, and evidence model
against V2. Use V1 to identify functional parity gaps and avoid missing useful
operational details.

Search the V1 repo for:

- process order
- processorder
- process order history
- order history
- POH
- production order
- operations
- confirmations
- goods movements
- material document
- batch
- AFKO
- AUFK
- AFPO
- AFVC
- AFVV
- AFRU
- MSEG
- MATDOC
- RESB
- components
- phases
- resources
- work centre
- process order status
- TECO
- REL
- CNF
- PCNF
- GMPS
- batch genealogy
- Databricks
- SQL
- gold_process_order
- gold_order
- gold_operations
- gold_confirmations
- gold_goods_movement

Inspect V1 for:

1. POH screens/pages/components

For each V1 screen or component, document:

- file path
- purpose
- input fields
- filters
- sections shown
- tables/cards/charts shown
- drill-throughs
- empty states
- source badges or evidence indicators, if any

2. V1 POH data sources

Identify:

- API routes
- backend services
- SQL queries
- Databricks tables/views
- mock/fixture data
- environment variables
- source schemas
- query parameters

For each source, document:

| V1 Source | File Path | Grain | Key Columns | V2 Equivalent | Gap |
|---|---|---|---|---|---|

3. V1 functional capability inventory

Compare V1 and V2 for:

- order header
- material/batch context
- plant
- order status
- planned dates
- actual dates
- operations/phases
- resources/work centres
- confirmations
- yields/scrap/rework
- goods movements
- component consumption
- produced batches
- material documents
- reservations
- order timeline
- status history
- exceptions/delays
- links to traceability
- links to quality
- links to warehouse/staging

Create or update:

- `domain-integrations/operations/docs/poh-v1-v2-functional-parity.md`

Use this matrix:

| Capability | V1 Behaviour | V1 Files / Sources | V2 Current State | Gap | Priority | Recommendation |
|---|---|---|---|---|---|---|

Status values:

- parity-achieved
- partial-parity
- v2-missing
- mock-only
- source-blocked
- v2-improved
- deferred
- unknown

Priority values:

- P0: required for credible read-only POH UAT
- P1: required for near-functional parity
- P2: useful enhancement
- P3: later polish

4. V1 to V2 source mapping

Map V1 source fields to V2 POH contracts.

Review V2 contracts under:

- `packages/data-contracts/src/**`
- `domain-integrations/operations/src/**`
- `apps/api/contracts/generated.py`

Create a mapping table:

| V2 Field / Concept | V1 Source | V1 Column / Expression | Transform Needed | Confidence | Gap / Risk |
|---|---|---|---|---|---|

Confidence values:

- High: exact V1 field/source found
- Medium: derivable with simple transform
- Low: inferred but not proven
- Missing: not found
- Unknown: unresolved

5. Identify the next V2 build slice

After V1 review, choose the highest-value bounded V2 POH implementation slice.

Candidate slices may include:

- operation/phase detail parity
- confirmation detail parity
- goods movement/material document parity
- component consumption evidence
- produced batch evidence
- order timeline/status history
- source/evidence completeness improvements
- UAT evidence payload improvements

Do not implement everything in one PR. Choose one bounded slice that improves
UAT readiness and functional parity.

6. Safety rules

Do not:

- invent Databricks columns
- invent SAP statuses
- invent expected counts
- silently fall back to mock in Databricks mode
- treat no confirmations as "not confirmed"
- treat no goods movements as "no movement history"
- add SAP write-back
- add order confirmation posting
- add goods movement posting
- claim production readiness

7. Documentation updates

Update or create:

- `domain-integrations/operations/docs/poh-v1-v2-functional-parity.md`
- `domain-integrations/operations/docs/poh-uat-readiness-notes.md`
- `domain-integrations/operations/docs/golden-process-orders.md`
- `docs/readiness/domain-readiness-index.md`, if readiness changes materially

8. Expected final response

Include:

- V1 files inspected
- V2 files inspected
- V1 POH functionality found
- V1 data sources found
- V1 to V2 parity matrix summary
- highest-priority POH gaps
- selected implementation slice
- files changed
- tests run and results
- remaining POH UAT blockers
- confirmation that:
  - no SAP write-back was added
  - no source columns were invented
  - no mock fallback was added to Databricks mode
  - no-record sections are not treated as complete absence
  - no production readiness was claimed

## Current V2 Guardrails

- Keep POH read-only.
- Keep POH changes bounded to the Operations domain unless shared type
  compilation requires otherwise.
- Do not broaden into Traceability, SPC, Warehouse, or Quality implementation
  work during the V1 parity review.
- Validate live/native paths honestly; do not claim browser verification unless
  it was actually performed.
