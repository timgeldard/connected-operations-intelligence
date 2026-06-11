#!/usr/bin/env python3
"""Static guard: every source column a Warehouse360 consumption view SELECTs must resolve against the
Gold serving view it reads FROM — or be a documented blocker (approved_exceptions).

Catches the consumption-vs-Gold drift found in PR #39 (e.g. selecting `po_id`/`delivery_id`/`material_id`
when Gold exposes aggregates / `delivery_number` / `material_code`). Purely static: it parses
resources/sql/warehouse360_consumption_views_{dev,uat,prod}.sql and checks each referenced Gold-source
identifier against the captured column snapshot in
contracts/warehouse360_consumption_column_contract.yml.

A consumption view is considered LIVE-VALIDATABLE only when it has NO approved_exceptions left. This
guard does not prove the views run — it prevents silent drift and enumerates the known blockers.
Exit 0 = every selected source column is resolved or a listed exception; exit 1 = unaccounted column.
"""
import os
import re
import sys

import yaml

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(REPO, "data-products", "io-reporting")
CONTRACT = os.path.join(BASE, "contracts", "warehouse360_consumption_column_contract.yml")
SQL_FILES = [
    os.path.join(BASE, "resources", "sql", f"warehouse360_consumption_views_{env}.sql")
    for env in ("dev", "uat", "prod")
]

# SQL tokens that are never Gold source columns (types, functions, keywords, literals).
_NON_COLUMN = {
    "select", "as", "from", "cast", "null", "case", "when", "then", "else", "end", "and", "or",
    "not", "on", "distinct", "true", "false", "timestamp", "date", "long", "int", "integer",
    "bigint", "smallint", "double", "float", "decimal", "string", "boolean", "coalesce",
    "datediff", "current_date", "current_timestamp", "count", "sum", "min", "max", "avg", "round",
    "quality", "inspection", "blocked", "returns", "transit", "unrestricted", "red",
}

_VIEW_RE = re.compile(
    r"CREATE\s+OR\s+REPLACE\s+VIEW\s+(?:[\w.]*\.)?(?P<view>vw_consumption_warehouse360_\w+)\s+AS\s+"
    # Source columns are only checked in the SELECT list; any trailing clause after `FROM <src>`
    # (e.g. a GROUP BY on an aggregate consumption view) is consumed up to the statement terminator.
    r"SELECT\s+(?P<select>.*?)\s+FROM\s+(?:[\w.]*\.)?(?P<src>\w+)\b[\s\S]*?;",
    re.IGNORECASE | re.DOTALL,
)


def _split_top_level(select_list: str) -> list[str]:
    """Split a SELECT list on commas that are at parenthesis depth 0."""
    items, depth, buf = [], 0, []
    for ch in select_list:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            items.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    if "".join(buf).strip():
        items.append("".join(buf))
    return items


def _expr_of(item: str) -> str:
    """Strip the trailing depth-0 ` AS <alias>` so only the source expression remains."""
    depth, last_as = 0, -1
    tokens = list(re.finditer(r"\(|\)|\bAS\b", item, re.IGNORECASE))
    for m in tokens:
        t = m.group(0)
        if t == "(":
            depth += 1
        elif t == ")":
            depth -= 1
        elif depth == 0:  # top-level AS
            last_as = m.start()
    return item[:last_as] if last_as != -1 else item


def _source_columns(expr: str) -> set[str]:
    cols = set()
    for ident in re.findall(r"[A-Za-z_][A-Za-z0-9_]*", expr):
        low = ident.lower()
        if low in _NON_COLUMN:
            continue
        cols.add(low)
    return cols


def check() -> list[str]:
    with open(CONTRACT, encoding="utf-8") as f:
        contract = yaml.safe_load(f)
    gold = {k: {c.lower() for c in v} for k, v in contract["gold_source_columns"].items()}
    exceptions = {k: set((v or {}).keys()) for k, v in (contract["approved_exceptions"] or {}).items()}

    errors = []
    for path in SQL_FILES:
        if not os.path.exists(path):
            errors.append(f"Missing consumption SQL: {os.path.relpath(path, REPO)}")
            continue
        sql = open(path, encoding="utf-8").read()
        views = list(_VIEW_RE.finditer(sql))
        if not views:
            errors.append(f"{os.path.basename(path)}: no consumption views parsed (format changed?)")
            continue
        for m in views:
            view, src = m.group("view"), m.group("src")
            if src not in gold:
                errors.append(f"{os.path.basename(path)}: {view} reads unknown Gold source '{src}' "
                              f"(add it to gold_source_columns).")
                continue
            available = gold[src]
            allowed_exc = exceptions.get(view, set())
            for item in _split_top_level(m.group("select")):
                for col in _source_columns(_expr_of(item)):
                    if col in available or col in allowed_exc:
                        continue
                    errors.append(
                        f"{os.path.basename(path)}: {view} selects source column '{col}' not present in "
                        f"Gold view '{src}' and not a documented exception. Add an alias if the Gold "
                        f"column is merely renamed, fix the SQL, or list it under approved_exceptions "
                        f"(missing/grain) in warehouse360_consumption_column_contract.yml."
                    )
    return errors


def main() -> int:
    errs = check()
    if errs:
        print("Warehouse360 consumption-view column guard: FAILED")
        for e in errs:
            print(f"  - {e}")
        return 1
    # Summarise outstanding (documented) blockers so a green run still surfaces what's not live-validated.
    with open(CONTRACT, encoding="utf-8") as f:
        exc = yaml.safe_load(f)["approved_exceptions"] or {}
    pending = {v: list(c.keys()) for v, c in exc.items() if c}
    print("Warehouse360 consumption-view column guard: OK (every selected source column resolved or documented)")
    if pending:
        print(f"  NOTE: {len(pending)} view(s) still have documented blockers (NOT live-validated):")
        for v, cols in pending.items():
            print(f"    - {v}: {', '.join(cols)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
