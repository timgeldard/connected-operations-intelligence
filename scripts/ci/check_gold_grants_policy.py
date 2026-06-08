#!/usr/bin/env python3
"""Guard: no base Gold table may be granted to the `users` consumer group.

SECURITY.md requires that consumer access to Gold data flow only through governed views — the
plant-scoped ``*_secured`` views (which enforce row-level security) and the ``vw_consumption_*`` /
``vw_genie_*`` views — never a direct grant on a base Gold table. This static guard scans the
grant-bearing SQL under ``data-products/io-reporting/resources/sql`` and fails if any
``GRANT ... TO `users``` targets an object that is not one of those governed views (or a table on the
documented-exception list below, for genuinely plant-agnostic platform-health data).

Catches the contradiction reconciled in 2026-06 (readiness/validation base tables granted to `users`
in access_grants_{uat,prod}.sql, against SECURITY.md) and prevents it from being reintroduced.

Exit 0 = every consumer grant targets a governed view (or documented exception); exit 1 = a base-table
grant to `users`.
"""
import glob
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SQL_GLOBS = [
    "data-products/io-reporting/resources/sql/access_grants_*.sql",
    "data-products/io-reporting/resources/sql/gold_security_*.sql",  # generated: grants *_secured views
]

# Principals that are the application/consumer audience (not data-engineering admins).
CONSUMER_PRINCIPALS = {"users"}

# Object-name shapes that ARE governed views (sanctioned grant targets).
_GOVERNED_SUFFIX = "_secured"
_GOVERNED_PREFIXES = ("vw_consumption_", "vw_genie_")

# Documented exceptions: base objects intentionally granted to `users` (plant-agnostic platform-health
# data with no RLS axis). Keep empty unless a real exception is agreed and recorded in SECURITY.md.
# Map object_name -> rationale.
DOCUMENTED_EXCEPTIONS: dict[str, str] = {}

# GRANT <privs> ON [TABLE|VIEW] <obj> TO <principal>
_GRANT_RE = re.compile(
    r"\bGRANT\b\s+.+?\s+\bON\b\s+(?:TABLE|VIEW)?\s*(?P<obj>[`\w.]+)\s+\bTO\b\s+(?P<principal>[`\w]+)",
    re.IGNORECASE | re.DOTALL,
)


def _strip_comments(sql):
    out = []
    for ln in sql.splitlines():
        i = ln.find("--")
        out.append(ln if i < 0 else ln[:i])
    return "\n".join(out)


def _unquote(ident):
    return ident.replace("`", "")


def parse_grants(sql):
    """Return [(object_fqn, object_name, principal), ...] for GRANT statements in sql."""
    grants = []
    for stmt in _strip_comments(sql).split(";"):
        if not stmt.strip():
            continue
        m = _GRANT_RE.search(stmt)
        if not m:
            continue
        obj_fqn = _unquote(m.group("obj"))
        obj_name = obj_fqn.split(".")[-1]
        principal = _unquote(m.group("principal"))
        grants.append((obj_fqn, obj_name, principal))
    return grants


def is_governed_target(object_name):
    return object_name.endswith(_GOVERNED_SUFFIX) or object_name.startswith(_GOVERNED_PREFIXES)


def check():
    errors = []
    files = []
    for pattern in SQL_GLOBS:
        files.extend(sorted(glob.glob(os.path.join(REPO, pattern))))
    for path in files:
        with open(path, encoding="utf-8") as f:
            for obj_fqn, obj_name, principal in parse_grants(f.read()):
                if principal not in CONSUMER_PRINCIPALS:
                    continue
                if is_governed_target(obj_name) or obj_name in DOCUMENTED_EXCEPTIONS:
                    continue
                errors.append(
                    f"{os.path.relpath(path, REPO)}: GRANT to `{principal}` on base object "
                    f"'{obj_fqn}' — not a *_secured / vw_consumption_* / vw_genie_* view. Grant the "
                    f"governed view instead, or add '{obj_name}' to DOCUMENTED_EXCEPTIONS with a "
                    f"rationale recorded in SECURITY.md."
                )
    return errors, len(files)


def main():
    errors, n_files = check()
    if errors:
        print("Gold grants policy guard: FAILED")
        for e in errors:
            print(f"  - {e}")
        return 1
    print(f"Gold grants policy guard: OK (scanned {n_files} grant file(s); "
          f"every consumer grant targets a governed view or documented exception)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
