# ADR 010 — Living data dictionary & Unity Catalog lineage

## Status
Proposed

## Context
Documentation is static (`generate_data_dictionary.py` + `schema_documentation.md`). It is not
queryable, carries no Unity Catalog column comments / tags / owners, and has no lineage. We want
living, governed documentation that leverages native UC lineage.

## Decision
1. **Extend `generate_data_dictionary.py`** to read from Unity Catalog rather than static config:
   - `information_schema.columns` (names, types, **comments**), `*.table_tags` / `*.column_tags`
     (tags), table `owner`.
   - Lineage summary from **`system.access.table_lineage`** and `system.access.column_lineage`
     (upstream sources, downstream consumers) — column-level where available.
   - Emit **Markdown + HTML + JSON**; add a business-glossary mapping (SAP term → Gold field).
2. **Standardise column comments** as part of the pipeline: set `COMMENT`s carrying SAP source
   table, business rule, transformation note, example. Add a CI check that flags
   Gold/Silver columns without comments.
3. **Governance tags & ownership:** apply domain tags (`#pp_pi`, `#wm`, `#mm`, `#operations`),
   sensitivity tags (`financial`, `pii`), and set table `owner` to the data-product owner.
4. **`gold_metadata_lineage_summary`** — a periodically-refreshed table built on `system.access.*`
   lineage for monitoring upstream/downstream and orphaned tables.
5. **Delivery:** a **post-deploy DAB job** regenerates the dictionary; CI auto-commits the
   artifacts to `docs/`; publish to a **UC Volume** for consumption. Add a runbook note on
   exploring lineage in Catalog Explorer.

## Consequences
- Lineage and tags only populate **after** pipelines deploy and run on UC-enabled compute;
  the generator degrades gracefully (empty lineage section) pre-deploy.
- Reading `system.access.*` needs grants (or runs as a principal with access).
- Most self-contained of the three initiatives — no business config required (tags/glossary are
  conventions we set).
