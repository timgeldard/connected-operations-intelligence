#!/usr/bin/env python3
"""
Generate an Open Knowledge Format (OKF) v0.1 bundle for the io-reporting data product.

Reads: data-products/io-reporting/contracts/app_contract_manifest.yml
Writes: data-products/io-reporting/okf/

Directory layout
----------------
okf/
  index.md                          # Root index (the ONLY index with frontmatter)
  README.md                         # Generation provenance note (type: Reference)
  <domain>/
    index.md                        # Domain directory listing (NO frontmatter)
    <id_prefix>/
      <rest>.md                     # One concept per contract

Design decisions
----------------

GROUPING RULE
  Concepts are grouped by the contract's ``domain`` field.  Within that domain
  directory, a sub-directory is created for the id prefix (the part before the
  first dot in the contract id).  For example:
    id: wm_operations.worklist, domain: warehouse
    -> okf/warehouse/wm_operations/worklist.md

  The ``domain`` field is used (not the id prefix) as the top-level grouping
  axis to keep the directory tree stable if ids are ever renamed.

TYPE MAPPING
  The ``type`` frontmatter key is derived deterministically:

  - id suffix is in AGGREGATE_SUFFIXES  ->  "Aggregate View"
  - source_view contains a fragment in AGGREGATE_VIEW_FRAGMENTS  ->  "Aggregate View"
  - Everything else  ->  "Consumption View"

  This makes the mapping a pure function of manifest content.  Maintainers may
  extend AGGREGATE_SUFFIXES or AGGREGATE_VIEW_FRAGMENTS to reclassify a contract.

RESOURCE URI
  Uses the three-part Unity Catalog name (no vendor-specific prefix scheme):
    connected_plant_uat.gold_io_reporting.<source_view>
  UAT is the canonical reference catalog (the primary app consumer is UAT-bound).

DETERMINISM
  No wall-clock ``timestamp`` is emitted.  The bundle is a pure function of
  the manifest content: running the generator twice on the same manifest
  produces byte-identical output.

IDEMPOTENCY
  The entire ``okf/`` tree is deleted and rewritten on each run.  This prevents
  stale concept files when contracts are removed from the manifest.

Usage
-----
  python data-products/io-reporting/scripts/generate_okf_bundle.py
  # or via Makefile:
  make generate-okf
"""
from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    raise SystemExit("PyYAML is required: pip install pyyaml")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_SCRIPT_DIR = Path(__file__).resolve().parent
_PRODUCT_DIR = _SCRIPT_DIR.parent
MANIFEST_PATH = _PRODUCT_DIR / "contracts" / "app_contract_manifest.yml"
OKF_DIR = _PRODUCT_DIR / "okf"

# ---------------------------------------------------------------------------
# Type-mapping configuration
# ---------------------------------------------------------------------------

# These id *suffixes* (the part after the last dot) are classified as aggregates.
AGGREGATE_SUFFIXES: frozenset[str] = frozenset(
    {
        "summary",
        "worklist_summary",
        "queue_workload",
        "daily_activity",
        "staging_readiness",
        "operator_activity",
        "pareto",
        "downtime_pareto",
        "qm_characteristic_pareto",
        "qm_ud_code_pareto",
        "recon_value_summary",
        "schedule_adherence_daily",
        "recipe_benchmark",
        "campaigns",
        "handling_units",
        "bin_occupancy",
        "staging_demand",
        "staging_pace",
        "buffer_flow",
        "movement_control",
        "plants",
        "wip_stages",
    }
)

# source_view name fragments that also imply an aggregate contract.
AGGREGATE_VIEW_FRAGMENTS: frozenset[str] = frozenset({"_summary", "_pareto", "_overview"})


def _derive_type(contract_id: str, source_view: str) -> str:
    """Return the OKF type string for a contract (pure function of inputs)."""
    suffix = contract_id.rsplit(".", 1)[-1]
    if suffix in AGGREGATE_SUFFIXES:
        return "Aggregate View"
    for fragment in AGGREGATE_VIEW_FRAGMENTS:
        if fragment in (source_view or ""):
            return "Aggregate View"
    return "Consumption View"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_WORD_RE = re.compile(r"[_]+")


def _humanize(snake: str) -> str:
    """Convert ``some_snake_case`` to ``Some Snake Case``."""
    return " ".join(word.capitalize() for word in _WORD_RE.split(snake))


def _first_sentence(text: str | None) -> str:
    """Return the first sentence (up to and including the first period)."""
    if not text:
        return ""
    cleaned = " ".join(text.split())
    match = re.search(r"\.(\s|$)", cleaned)
    if match:
        return cleaned[: match.start() + 1]
    return cleaned


def _resource_uri(source_view: str) -> str:
    """Return the canonical UC three-part resource identifier."""
    return f"connected_plant_uat.gold_io_reporting.{source_view}"


def _yaml_list(items: list[str]) -> str:
    """Render a YAML inline sequence, e.g. [warehouse, draft]."""
    return "[" + ", ".join(items) + "]"


def _yaml_dquote(s: str) -> str:
    """Wrap a string in YAML double quotes with minimal escaping."""
    safe = s.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{safe}"'


# ---------------------------------------------------------------------------
# Content builders
# ---------------------------------------------------------------------------


def _build_concept_md(contract: dict) -> str:
    """Build the full .md content for a single contract concept."""
    cid: str = contract["id"]
    suffix = cid.rsplit(".", 1)[-1]
    domain: str = contract.get("domain", "unknown")
    lifecycle: str = contract.get("lifecycle", "unknown")
    description: str = contract.get("description", "")
    source_view: str = contract.get("source_view", "")
    grain: str = contract.get("grain", "")
    freshness: dict = contract.get("freshness") or {}
    access_policy: dict = contract.get("access_policy") or {}
    fields: list[dict] = contract.get("fields") or []
    version: str = str(contract.get("version", ""))

    okf_type = _derive_type(cid, source_view)
    title = _humanize(suffix)
    tags = _yaml_list([domain, lifecycle])
    resource = _resource_uri(source_view)
    short_desc = _first_sentence(description)

    # frontmatter
    lines: list[str] = [
        "---",
        f"type: {okf_type}",
        f"title: {_yaml_dquote(title)}",
        f"description: {_yaml_dquote(short_desc)}",
        f"resource: {resource}",
        f"tags: {tags}",
        f"contract_id: {cid}",
        f"contract_version: {_yaml_dquote(version)}",
        "---",
        "",
        f"# {title}",
        "",
    ]

    # Schema table
    if fields:
        lines += [
            "# Schema",
            "",
            "| Column | Type | Required | Description |",
            "| --- | --- | --- | --- |",
        ]
        for f in fields:
            fname = f.get("name", "")
            ftype = f.get("type", "")
            freq = "yes" if f.get("required") else "no"
            fdesc = " ".join((f.get("description") or "").split())
            fdesc = fdesc.replace("|", "&#124;")
            lines.append(f"| `{fname}` | {ftype} | {freq} | {fdesc} |")
        lines.append("")

    # Grain
    lines += [
        "# Grain",
        "",
        grain or "_Not specified._",
        "",
    ]

    # Freshness SLA
    exp = freshness.get("expected_minutes", "")
    warn = freshness.get("warning_minutes", "")
    crit = freshness.get("critical_minutes", "")
    lines += [
        "# Freshness",
        "",
        "| SLA tier | Minutes |",
        "| --- | --- |",
        f"| Expected | {exp} |",
        f"| Warning | {warn} |",
        f"| Critical | {crit} |",
        "",
    ]

    # Access policy
    rlk = access_policy.get("row_level_key", "")
    ent = access_policy.get("entitlement_source", "")
    lines += [
        "# Access",
        "",
        f"Row-level security key: `{rlk}`",
        "",
        f"Entitlement source: `{ent}`",
        "",
    ]

    # Source
    lines += [
        "# Source",
        "",
        f"Served via the governed `gold_io_reporting` layer as `{source_view}`.",
        "",
        f"Unity Catalog resource: `{resource}`",
        "",
    ]

    return "\n".join(lines)


def _build_domain_index_md(
    domain: str, concepts: list[tuple[str, str, str]]
) -> str:
    """Build the domain index.md (NO frontmatter per OKF spec §6).

    concepts: list of (rel_path_from_okf_root, title, short_description)
    """
    lines = [
        f"# {_humanize(domain)} -- Consumption Contracts",
        "",
        f"This directory lists all `{domain}` contracts in the io-reporting data product.",
        "",
    ]
    for rel_path, title, desc in sorted(concepts, key=lambda x: x[1]):
        link = "/" + rel_path
        lines.append(f"- [{title}]({link}) -- {desc}")
    lines.append("")
    return "\n".join(lines)


def _build_root_index_md(domain_dirs: list[tuple[str, str, int]]) -> str:
    """Build the root okf/index.md.

    This is the ONLY index.md with frontmatter; it carries okf_version per spec §5.

    domain_dirs: list of (domain_name, domain_rel_dir, concept_count)
    """
    lines = [
        "---",
        'okf_version: "0.1"',
        "---",
        "",
        "# io-reporting -- Open Knowledge Format Bundle",
        "",
        "This is the OKF v0.1 bundle for the `connected-operations-intelligence`",
        "io-reporting data product.  Each concept file documents a consumption contract",
        "served via the governed `gold_io_reporting` layer.",
        "",
        "> **Generated artefact.** Do not hand-edit. Regenerate with `make generate-okf`.",
        "> Source of truth: `data-products/io-reporting/contracts/app_contract_manifest.yml`.",
        "",
        "## Domains",
        "",
    ]
    for domain_name, domain_rel, count in sorted(domain_dirs, key=lambda x: x[0]):
        domain_link = f"/{domain_rel}/index.md"
        lines.append(
            f"- [{_humanize(domain_name)}]({domain_link}) -- {count} contract(s)"
        )
    lines.append("")
    return "\n".join(lines)


def _build_readme_md() -> str:
    """Build okf/README.md (OKF concept with type: Reference)."""
    lines = [
        "---",
        'type: "Reference"',
        'title: "OKF Bundle -- Generation Provenance"',
        'description: "This bundle is generated from app_contract_manifest.yml; do not hand-edit."',
        "---",
        "",
        "# OKF Bundle -- Generation Provenance",
        "",
        "This directory is a **generated** Open Knowledge Format (OKF) v0.1 bundle.",
        "",
        "## Source of truth",
        "",
        "```",
        "data-products/io-reporting/contracts/app_contract_manifest.yml",
        "```",
        "",
        "The manifest is the single source of truth for all io-reporting data contracts.",
        "This OKF bundle is a downstream artefact -- the same relationship as the",
        "UC-metadata SQL files generated by `scripts/generate_contract_metadata_sql.py`.",
        "",
        "## Regenerate",
        "",
        "```bash",
        "make generate-okf",
        "# or directly:",
        "python data-products/io-reporting/scripts/generate_okf_bundle.py",
        "```",
        "",
        "## Do not hand-edit",
        "",
        "Any manual change to a `.md` file under `okf/` will be overwritten on the",
        "next generator run.  CI (`scripts/ci/check_okf_bundle_fresh.py`) flags drift.",
        "",
        "## Consumers",
        "",
        "AI coding agents, OKF-aware tools, and documentation pipelines read this bundle",
        "as portable structured knowledge about the io-reporting governed surface.",
        "Each non-reserved `.md` is an OKF concept with YAML frontmatter and a markdown body.",
        "",
        "## Mandate",
        "",
        "Any change to `app_contract_manifest.yml` or the data product's governed surface",
        "MUST be accompanied in the same PR by (a) updated documentation and",
        "(b) a regenerated OKF bundle (`make generate-okf`).",
        "CI (`check_okf_bundle_fresh.py`) blocks drift.",
        "",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main generation logic
# ---------------------------------------------------------------------------


def load_manifest(path: Path) -> list[dict]:
    """Load and return the contracts list from the manifest YAML."""
    if not path.exists():
        print(f"Error: manifest not found at {path}", file=sys.stderr)
        sys.exit(1)
    with path.open(encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if not isinstance(data, dict) or not isinstance(data.get("contracts"), list):
        print(
            "Error: manifest must be a dict with a 'contracts' list.", file=sys.stderr
        )
        sys.exit(1)
    return data["contracts"]


def generate(
    manifest_path: Path = MANIFEST_PATH,
    okf_dir: Path = OKF_DIR,
    verbose: bool = True,
) -> None:
    """Generate the OKF bundle from the manifest.

    This is the single entry point used by both the CLI and the drift-guard test.
    """
    contracts = load_manifest(manifest_path)

    # Full wipe + recreate for idempotency: no stale files from deleted contracts.
    if okf_dir.exists():
        shutil.rmtree(okf_dir)
    okf_dir.mkdir(parents=True)

    # Group by domain field.
    domain_groups: dict[str, list[dict]] = {}
    for c in contracts:
        cid = c.get("id", "")
        if not cid:
            continue
        domain = c.get("domain", "unknown")
        domain_groups.setdefault(domain, []).append(c)

    domain_dir_info: list[tuple[str, str, int]] = []  # (domain, rel_path, count)

    for domain, domain_contracts in domain_groups.items():
        domain_concepts: list[tuple[str, str, str]] = []

        for c in domain_contracts:
            cid: str = c["id"]
            # id format: "prefix.rest"  (e.g. "wm_operations.worklist")
            if "." in cid:
                prefix, rest = cid.split(".", 1)
            else:
                prefix, rest = cid, cid

            # Concept file path: okf/<domain>/<prefix>/<rest>.md
            concept_rel = f"{domain}/{prefix}/{rest}.md"
            concept_path = okf_dir / domain / prefix / f"{rest}.md"
            concept_path.parent.mkdir(parents=True, exist_ok=True)

            concept_path.write_text(_build_concept_md(c), encoding="utf-8")

            title = _humanize(rest)
            short_desc = _first_sentence(c.get("description", ""))
            domain_concepts.append((concept_rel, title, short_desc))

        # Domain index.md -- NO frontmatter (OKF spec §6)
        domain_index = okf_dir / domain / "index.md"
        domain_index.write_text(
            _build_domain_index_md(domain, domain_concepts), encoding="utf-8"
        )

        domain_dir_info.append((domain, domain, len(domain_contracts)))

    # Root index.md -- ONLY index with frontmatter; carries okf_version (spec §5)
    (okf_dir / "index.md").write_text(
        _build_root_index_md(domain_dir_info), encoding="utf-8"
    )

    # README.md -- OKF concept (type: Reference)
    (okf_dir / "README.md").write_text(_build_readme_md(), encoding="utf-8")

    total = sum(len(v) for v in domain_groups.values())
    if verbose:
        print(f"OKF bundle generated: {okf_dir}")
        print(f"  {total} concept(s) across {len(domain_groups)} domain(s)")
        for domain, _, count in sorted(domain_dir_info):
            print(f"  {domain}: {count} concept(s)")


def main() -> None:
    generate()


if __name__ == "__main__":
    main()
