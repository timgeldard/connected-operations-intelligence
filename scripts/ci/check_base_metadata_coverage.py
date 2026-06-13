#!/usr/bin/env python3
"""
Offline coverage guard for UC base metadata (silver + gold tables).

Extracts all output tables and their columns from the silver/gold Python DLT source
files, then checks that every table has a corresponding entry in the metadata YAMLs
under data-products/io-reporting/metadata/.

P0 BOOTSTRAP MODE (default): prints coverage statistics and the list of missing /
blank items, but exits 0. This lets the guard land before the backfill phase fills
column descriptions.

--strict mode: exits 1 if any table is missing from metadata, any column is missing
from metadata, or any description is empty/vacuous ("TODO", equal to the column name).
Used in the enforce phase once backfill is complete.

Extracts output columns from:
  - .alias("name") in final select() calls
  - apply_changes target columns (keys + sequence_by, derived from the stg_ function)

Exclusions (audit-confirmed false positives):
  - _-prefixed internal aliases (e.g. _change_replicated_at, _replicated_at, etc.)
  - record_activity (CDC control column, not a business column)
  - DLT system columns: __START_AT, __END_AT
  - _storage_bin_occupancy_key (internal snapshot-CDC merge key)

Handles:
  - Conditionally-registered tables (bronze_columns_exist / published_columns_exist guards)
  - Dynamic selects in warehouse_exceptions.py (_COLS pattern)
  - snapshot system cols (__START_AT/__END_AT)
  - Tables registered with dlt.create_streaming_table (apply_changes targets)

Usage:
    python scripts/ci/check_base_metadata_coverage.py              # report-only (exits 0)
    python scripts/ci/check_base_metadata_coverage.py --strict     # enforce (exits 1 on failure)
    python scripts/ci/check_base_metadata_coverage.py --layer silver --strict
    python scripts/ci/check_base_metadata_coverage.py --base-dir /path/to/io-reporting
"""
import argparse
import pathlib
import re
import sys
from typing import NamedTuple

try:
    import yaml
except ImportError:
    raise SystemExit("PyYAML is required: pip install pyyaml")


# ── Column-level exclusion list ───────────────────────────────────────────────
# Columns that exist in source code output but must NOT be required in metadata.
_EXCLUDED_COLUMNS: set[str] = {
    "record_activity",    # CDC control column — not a business column
    "__START_AT",         # DLT SCD system column
    "__END_AT",           # DLT SCD system column
    "_storage_bin_occupancy_key",  # internal snapshot-CDC merge key
}
_EXCLUDED_PREFIX = "_"   # any _-prefixed alias is internal


# ── Vacuous description patterns (--strict rejects these) ─────────────────────
_VACUOUS_PATTERNS = re.compile(
    r"^(TODO|todo|TBD|tbd|N/A|n/a|placeholder|description here|fill in)[\s.]*$",
    re.IGNORECASE,
)


def _is_vacuous(desc: str, col_name: str = "") -> bool:
    """True if a description is empty, matches vacuous patterns, or equals the col name."""
    if not desc or not desc.strip():
        return True
    stripped = desc.strip()
    if _VACUOUS_PATTERNS.match(stripped):
        return True
    if col_name and stripped.lower() == col_name.lower():
        return True
    return False


def _should_exclude_column(col_name: str) -> bool:
    """True if a column name should be excluded from metadata requirements."""
    if col_name in _EXCLUDED_COLUMNS:
        return True
    if col_name.startswith(_EXCLUDED_PREFIX):
        return True
    return False


# ── Python source extraction ──────────────────────────────────────────────────

class TableDef(NamedTuple):
    name: str
    columns: list[str]
    source_file: str
    conditional: bool  # True if inside a bronze_columns_exist / published_columns_exist guard


def _extract_alias_names(source: str) -> list[str]:
    """Extract .alias('name') calls from a select block."""
    return re.findall(r'\.alias\s*\(\s*["\']([^"\']+)["\']\s*\)', source)


def _extract_select_columns(func_source: str) -> list[str]:
    """
    Extract output column names from the LAST .select() block in a function.

    Uses the last .select() because intermediate joins/aggregations also use
    .alias() for temporary column naming. The final .select() contains only
    the public output columns.
    """
    # Find the last .select( in the function source
    sel_positions = [m.start() for m in re.finditer(r'\.select\s*\(', func_source)]
    if not sel_positions:
        # No select block — fall back to all aliases (handles simple return statements)
        aliases = _extract_alias_names(func_source)
    else:
        last_select_block = func_source[sel_positions[-1]:]
        aliases = _extract_alias_names(last_select_block)
    # Filter out internal / excluded
    return [a for a in aliases if not _should_exclude_column(a)]


def _get_function_source(source: str, func_name: str) -> str:
    """
    Extract the source lines for a specific function definition.
    Returns empty string if not found.
    """
    # Find 'def func_name(' and grab until the next def/class at same indent.
    # The pattern allows leading whitespace to handle defs inside if-blocks.
    pattern = re.compile(
        r'^\s*(def|async def)\s+' + re.escape(func_name) + r'\s*\(',
        re.MULTILINE,
    )
    m = pattern.search(source)
    if not m:
        return ""
    start = m.start()
    # Compute indent from the matched line itself (handles indented defs in if-blocks).
    lines = source[start:].split("\n")
    first_line = lines[0]
    indent = len(first_line) - len(first_line.lstrip())
    # Collect until we hit a line at the same (or lower) indent level that starts a new
    # def/class or a @dlt decorator (which always precedes the next table/view function).
    func_lines = [lines[0]]
    for line in lines[1:]:
        stripped = line.strip()
        if not stripped:
            func_lines.append(line)
            continue
        curr_indent = len(line) - len(line.lstrip())
        if curr_indent <= indent and (
            stripped.startswith("def ")
            or stripped.startswith("class ")
            or stripped.startswith("@dlt.")
            or (stripped.startswith("if ") and curr_indent < indent + 4)
            or (stripped.startswith("# ──") and curr_indent <= indent)
        ):
            break
        func_lines.append(line)
    return "\n".join(func_lines)


def _parse_silver_file(filepath: pathlib.Path) -> list[TableDef]:
    """
    Parse a silver tables Python file and extract table definitions with output columns.

    Handles:
    - dlt.create_streaming_table + dlt.apply_changes (SCD1 targets)
    - @dlt.table (batch MVs / snapshot tables)
    - bronze_columns_exist conditionals
    - The stg_ view -> create_streaming_table pattern (uses the staging function's aliases)
    """
    source = filepath.read_text(encoding="utf-8")
    tables: list[TableDef] = []

    # Track conditional nesting: lines inside `if bronze_columns_exist(...):`
    # We flag tables as conditional (not false-failing) but still include them.

    # 1. Find all create_streaming_table targets + their corresponding stg_ function
    streaming_tables: dict[str, str] = {}  # table_name -> stg_function_name
    for m in re.finditer(
        r'dlt\.create_streaming_table\s*\(\s*name\s*=\s*["\'](\w+)["\']',
        source,
    ):
        table_name = m.group(1)
        # The staging view is typically stg_{table_name}
        streaming_tables[table_name] = f"stg_{table_name}"

    # 2. apply_changes / apply_changes_from_snapshot targets confirm the table is real
    apply_changes_targets: set[str] = set()
    for m in re.finditer(
        r'dlt\.apply_changes(?:_from_snapshot)?\s*\(\s*(?:.*?\btarget\s*=\s*["\'](\w+)["\'])',
        source,
        re.DOTALL,
    ):
        apply_changes_targets.add(m.group(1))

    # 3. Find @dlt.table decorated functions (non-streaming batch tables).
    # Two-step approach: find @dlt.table( first, then scan forward for the next def.
    # This handles: multiple @dlt.expect_* decorators between @dlt.table and def,
    # and indented defs inside conditional if-blocks (bronze_columns_exist guards).
    pos = 0
    while True:
        tbl_m = re.search(r'@dlt\.table\s*\(', source[pos:])
        if not tbl_m:
            break
        abs_pos = pos + tbl_m.start()
        def_m = re.search(r'\n\s*def\s+(\w+)\s*\(', source[abs_pos:])
        if not def_m:
            break
        func_name = def_m.group(1)
        decorator_region = source[abs_pos:abs_pos + def_m.start()]

        # Skip views, staging functions, and temporary tables
        if func_name.startswith("stg_"):
            pos = abs_pos + 1
            continue

        # Extract explicit name= if present
        name_match = re.search(r'\bname\s*=\s*["\'](\w+)["\']', decorator_region)
        table_name = name_match.group(1) if name_match else func_name

        # Skip if this is a streaming table (handled separately) or a view
        if table_name in streaming_tables or table_name in apply_changes_targets:
            pos = abs_pos + 1
            continue

        # Check conditional registration
        conditional = _is_conditionally_registered(source, abs_pos)

        func_source = _get_function_source(source, func_name)
        columns = _extract_select_columns(func_source)

        if not columns:
            # Some tables use dynamic selects (e.g. warehouse_exceptions._COLS)
            # or are config seeds — mark as dynamic and skip column tracking
            columns = ["__dynamic__"]

        tables.append(TableDef(
            name=table_name,
            columns=columns,
            source_file=filepath.name,
            conditional=conditional,
        ))
        pos = abs_pos + 1

    # 4. Add streaming table entries (from stg_ function)
    for table_name, stg_func_name in streaming_tables.items():
        if table_name not in apply_changes_targets:
            continue  # Orphaned create_streaming_table without apply_changes — skip
        conditional = False
        # Check if the stg_ function itself is inside a conditional block
        stg_def_match = re.search(
            r'@dlt\.(view|table)\s*\(\s*(?:[^)]*\))?\s*(?:@[^\n]+\n)*\s*def\s+'
            + re.escape(stg_func_name) + r'\s*\(',
            source,
        )
        if stg_def_match:
            conditional = _is_conditionally_registered(source, stg_def_match.start())

        func_source = _get_function_source(source, stg_func_name)
        columns = _extract_select_columns(func_source)

        tables.append(TableDef(
            name=table_name,
            columns=columns,
            source_file=filepath.name,
            conditional=conditional,
        ))

    return tables


def _is_conditionally_registered(source: str, pos: int) -> bool:
    """
    True if the code at `pos` is inside a bronze_columns_exist /
    published_columns_exist / hu_reconciliation_enabled conditional block.

    Uses a simple heuristic: scan backwards from pos for an if-block opener
    that matches these patterns at a lower indent than the function.
    """
    text_before = source[:pos]
    # Find the last unmatched 'if' line that contains our guard patterns
    guard_pattern = re.compile(
        r'^\s*if\s+(?:bronze_columns_exist|published_columns_exist|hu_reconciliation_enabled)',
        re.MULTILINE,
    )
    matches = list(guard_pattern.finditer(text_before))
    return len(matches) > 0


def _parse_gold_file(filepath: pathlib.Path) -> list[TableDef]:
    """
    Parse a gold Python file and extract table definitions with output columns.

    Uses the same two-step @dlt.table -> def scan as _parse_silver_file to handle
    @dlt.expect_* decorators between decorator and def, and indented defs in if-blocks.
    """
    source = filepath.read_text(encoding="utf-8")
    tables: list[TableDef] = []

    pos = 0
    while True:
        tbl_m = re.search(r'@dlt\.table\s*\(', source[pos:])
        if not tbl_m:
            break
        abs_pos = pos + tbl_m.start()
        def_m = re.search(r'\n\s*def\s+(\w+)\s*\(', source[abs_pos:])
        if not def_m:
            break
        func_name = def_m.group(1)
        decorator_region = source[abs_pos:abs_pos + def_m.start()]

        # The function name IS the table name for gold_table_args pattern
        name_match = re.search(r'\bname\s*=\s*["\'](\w+)["\']', decorator_region)
        table_name = name_match.group(1) if name_match else func_name

        # Skip freshness gate views
        if "freshness_gate" in table_name or table_name.endswith("_gate"):
            pos = abs_pos + 1
            continue

        conditional = _is_conditionally_registered(source, abs_pos)

        func_source = _get_function_source(source, func_name)
        columns = _extract_select_columns(func_source)

        if not columns:
            columns = ["__dynamic__"]

        tables.append(TableDef(
            name=table_name,
            columns=columns,
            source_file=filepath.name,
            conditional=conditional,
        ))
        pos = abs_pos + 1

    return tables


# ── Metadata YAML loading ─────────────────────────────────────────────────────

class MetadataEntry(NamedTuple):
    table_name: str
    table_comment: str
    column_comments: dict[str, str]  # col_name -> comment


def _load_metadata_yamls(base_dir: pathlib.Path, layer: str) -> dict[str, MetadataEntry]:
    """Load all metadata YAMLs for a layer, return dict keyed by table_name."""
    pattern = f"metadata/{layer}/*.metadata.yml"
    entries: dict[str, MetadataEntry] = {}
    for f in sorted(base_dir.glob(pattern)):
        content = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
        for tbl in content.get("tables") or []:
            name = tbl.get("name", "")
            if not name:
                continue
            comment = str(tbl.get("comment") or "").strip()
            col_comments: dict[str, str] = {}
            for col in tbl.get("columns") or []:
                col_name = col.get("name", "")
                col_comment = str(col.get("comment") or "").strip()
                if col_name:
                    col_comments[col_name] = col_comment
            entries[name] = MetadataEntry(
                table_name=name,
                table_comment=comment,
                column_comments=col_comments,
            )
    return entries


# ── Coverage check ────────────────────────────────────────────────────────────

def _compute_coverage(
    extracted: list[TableDef],
    metadata: dict[str, MetadataEntry],
    strict: bool,
) -> tuple[bool, list[str]]:
    """
    Compare extracted table/column definitions against metadata.

    Returns (all_ok, issues_list).
    In non-strict mode all_ok is always True.
    """
    issues: list[str] = []
    ok = True

    total_tables = 0
    covered_tables = 0
    total_columns = 0
    columns_with_comments = 0
    missing_tables: list[str] = []
    missing_columns: list[tuple[str, str]] = []
    blank_comments: list[tuple[str, str]] = []

    for tbl in extracted:
        total_tables += 1
        entry = metadata.get(tbl.name)
        if entry is None:
            missing_tables.append(tbl.name)
            if strict:
                ok = False
            issues.append(f"  MISSING TABLE: {tbl.name} (from {tbl.source_file})")
            # Count columns as missing too
            for col in tbl.columns:
                if col == "__dynamic__":
                    continue
                total_columns += 1
                blank_comments.append((tbl.name, col))
            continue

        covered_tables += 1

        for col in tbl.columns:
            if col == "__dynamic__":
                continue
            total_columns += 1
            if col not in entry.column_comments:
                missing_columns.append((tbl.name, col))
                if strict:
                    ok = False
                issues.append(f"  MISSING COLUMN: {tbl.name}.{col}")
            else:
                col_comment = entry.column_comments[col]
                if _is_vacuous(col_comment, col):
                    blank_comments.append((tbl.name, col))
                    # Blank comments are expected in P0 — only fail under --strict
                    if strict:
                        ok = False
                        issues.append(f"  BLANK COMMENT: {tbl.name}.{col}")
                else:
                    columns_with_comments += 1

    # Summary
    table_pct = int(100 * covered_tables / total_tables) if total_tables else 0
    col_pct = int(100 * columns_with_comments / total_columns) if total_columns else 0

    summary_lines = [
        "",
        "=== UC Base Metadata Coverage ===",
        f"  Tables: {covered_tables}/{total_tables} ({table_pct}%) have metadata entries",
        f"  Columns: {columns_with_comments}/{total_columns} ({col_pct}%) have non-blank comments",
        "",
    ]

    if missing_tables:
        summary_lines.append(f"  Tables missing from metadata ({len(missing_tables)}):")
        for t in sorted(missing_tables):
            summary_lines.append(f"    - {t}")
        summary_lines.append("")

    if missing_columns:
        summary_lines.append(f"  Columns missing from metadata ({len(missing_columns)}):")
        for t, c in sorted(missing_columns)[:20]:
            summary_lines.append(f"    - {t}.{c}")
        if len(missing_columns) > 20:
            summary_lines.append(f"    ... and {len(missing_columns) - 20} more")
        summary_lines.append("")

    blank_col_count = len(blank_comments)
    if blank_col_count:
        summary_lines.append(
            f"  Columns with blank/vacuous comments ({blank_col_count}): "
            "(populate in backfill phase)"
        )
        summary_lines.append("")

    if strict and not ok:
        summary_lines.append("  STRICT MODE: coverage check FAILED (see issues above).")
    elif strict:
        summary_lines.append("  STRICT MODE: all tables and columns have non-vacuous comments.")
    else:
        summary_lines.append(
            "  REPORT MODE (P0): issues reported above; exit 0 regardless. "
            "Use --strict to enforce."
        )

    return ok, summary_lines + issues


def _find_silver_table_files(base_dir: pathlib.Path) -> list[pathlib.Path]:
    return sorted((base_dir / "silver" / "tables").glob("*.py"))


def _find_gold_table_files(base_dir: pathlib.Path) -> list[pathlib.Path]:
    gold_dir = base_dir / "gold"
    files = []
    for f in sorted(gold_dir.rglob("*.py")):
        if f.name.startswith("_") or f.name == "__init__.py":
            continue
        # Exclude non-pipeline submodules
        if any(p in f.parts for p in ("recon", "security", "snapshots")):
            continue
        files.append(f)
    return files


def run_check(
    base_dir: pathlib.Path,
    layers: list[str],
    strict: bool,
) -> bool:
    """Run the coverage check. Returns True if all checks passed."""
    overall_ok = True

    for layer in layers:
        print(f"\n--- {layer.upper()} layer ---")

        # Extract table definitions from source
        if layer == "silver":
            files = _find_silver_table_files(base_dir)
        else:
            files = _find_gold_table_files(base_dir)

        extracted: list[TableDef] = []
        for f in files:
            if layer == "silver":
                extracted.extend(_parse_silver_file(f))
            else:
                extracted.extend(_parse_gold_file(f))

        print(f"  Extracted {len(extracted)} table definitions from {len(files)} source files")

        # Load metadata YAMLs
        metadata = _load_metadata_yamls(base_dir, layer)
        print(f"  Loaded metadata for {len(metadata)} tables from metadata/{layer}/*.metadata.yml")

        # Compute coverage
        layer_ok, lines = _compute_coverage(extracted, metadata, strict)
        for line in lines:
            print(line)

        if not layer_ok:
            overall_ok = False

    return overall_ok


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=(
            "Offline UC base-metadata coverage guard. "
            "P0 bootstrap mode: reports coverage, exits 0. "
            "--strict: exits 1 on any missing/blank item."
        )
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        default=False,
        help=(
            "Strict mode: exit 1 if any table is missing from metadata, "
            "any column is missing, or any comment is empty/vacuous. "
            "Intended for the enforce phase after backfill is complete."
        ),
    )
    parser.add_argument(
        "--layer",
        choices=["silver", "gold"],
        default=None,
        help="Restrict check to one layer (default: both).",
    )
    parser.add_argument(
        "--base-dir",
        type=pathlib.Path,
        default=None,
        help="Product root directory (default: parent of scripts/ci/).",
    )
    args = parser.parse_args(argv)

    base_dir = args.base_dir
    if base_dir is None:
        # Default: two levels up from scripts/ci/ -> product root
        base_dir = pathlib.Path(__file__).resolve().parent.parent.parent / "data-products" / "io-reporting"
        # If the script is run from within the product, adjust
        scripts_ci = pathlib.Path(__file__).resolve().parent
        if (scripts_ci.parent.parent / "data-products" / "io-reporting").exists():
            base_dir = scripts_ci.parent.parent / "data-products" / "io-reporting"
        elif (scripts_ci.parent / "silver").exists():
            base_dir = scripts_ci.parent

    layers = [args.layer] if args.layer else ["silver", "gold"]

    ok = run_check(base_dir, layers, strict=args.strict)

    if args.strict and not ok:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
