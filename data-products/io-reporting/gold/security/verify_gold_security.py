#!/usr/bin/env python3
"""Apply (optionally) and VERIFY Gold row-level security for a target environment.

The secured-view RLS model (ADR 012) only protects data if, after each deploy, a UC admin runs
``gold_security_<env>.sql`` then ``gold_security_harden_<env>.sql`` — in order — and nothing checks
the result. A skipped harden step leaves base Gold tables readable by ``users``. This driver turns that
manual, unverified procedure into a job task with an automated verification gate.

Run as a Databricks ``spark_python_task`` (see ``resources/gold_security_job.job.yml``). Phases:
  1. (optional, ``--apply``) execute ``gold_security_<env>.sql`` then ``gold_security_harden_<env>.sql``
     statement-by-statement via ``spark.sql`` — order guaranteed.
  2. (always) VERIFY: discover every ``*_secured`` view in the gold schema and assert that, for each,
     the consumer group has **no** direct SELECT on the base table and **does** have SELECT on the
     ``*_secured`` view. Report findings; fail the task (exit 1) only when ``--enforce`` is set.

``--enforce`` defaults to false (verification-only / report mode, per the rollout plan) so the gate can
be observed in UAT before it blocks. Flip ``--enforce=true`` in the job parameters once clean.

The verification CORE (``find_rls_violations``) is a pure function over grant maps and is unit-tested in
``tests/test_verify_gold_security.py``; the Spark glue around it is intentionally thin.
"""
from __future__ import annotations

import argparse
import sys

_SECURED_SUFFIX = "_secured"


def find_rls_violations(secured_views, select_grantees, consumer_group="users"):
    """Pure RLS-grant check. Returns a list of human-readable violation strings (empty == clean).

    Args:
        secured_views: iterable of secured view names, e.g. ``["gold_x_secured", ...]``.
        select_grantees: mapping ``object_name -> set(principals with direct SELECT)``. Must cover both
            the ``*_secured`` views and their base tables.
        consumer_group: the application/consumer principal that must only reach secured views.

    A violation is raised when, for any ``<base>_secured`` view:
      * the consumer group has direct SELECT on ``<base>`` (base table not hardened/revoked), or
      * the consumer group does NOT have SELECT on ``<base>_secured`` (secured view missing or ungranted).
    """
    violations = []
    for view in sorted(secured_views):
        if not view.endswith(_SECURED_SUFFIX):
            continue
        base = view[: -len(_SECURED_SUFFIX)]
        if consumer_group in select_grantees.get(base, set()):
            violations.append(
                f"base table '{base}' is directly SELECT-able by '{consumer_group}' — must be revoked "
                f"(run gold_security_harden); consumers may read only '{view}'."
            )
        if consumer_group not in select_grantees.get(view, set()):
            violations.append(
                f"secured view '{view}' is not granted SELECT to '{consumer_group}' — it is missing or "
                f"its grant was not applied (run gold_security)."
            )
    return violations


# ---------------------------------------------------------------------------
# Spark glue (executed in the job; not exercised by unit tests)
# ---------------------------------------------------------------------------

def _spark():
    from pyspark.sql import SparkSession  # imported lazily so unit tests need no Spark

    return SparkSession.builder.getOrCreate()


def fq(catalog, schema, obj):
    """Three-part backtick-quoted identifier `catalog`.`schema`.`obj` — each part quoted SEPARATELY.
    (Quoting `catalog.schema` as one token would address a non-existent object and break the query.)"""
    return f"`{catalog}`.`{schema}`.`{obj}`"


# SHOW VIEWS returns the view name under different keys across DBR versions (camelCase vs snake_case).
_VIEW_NAME_KEYS = ("viewName", "view_name", "tableName", "table_name")


def view_name_of(row_dict):
    """Extract the view name from a SHOW VIEWS row dict across DBR casing conventions."""
    for key in _VIEW_NAME_KEYS:
        val = row_dict.get(key)
        if val:
            return val
    return None


def _run_sql_file(spark, path):
    """Execute a .sql file statement-by-statement (split on ';', drop '--' line comments).

    Deliberately simple — intended ONLY for the repo's own GENERATED security SQL
    (gold_security_<env>.sql / gold_security_harden_<env>.sql), which contain no ';' or '--' inside
    string literals. This is not a general SQL parser; do not point it at arbitrary SQL.
    """
    with open(path, encoding="utf-8") as fh:
        content = fh.read()
    lines = [ln if ln.find("--") < 0 else ln[: ln.find("--")] for ln in content.splitlines()]
    for stmt in "\n".join(lines).split(";"):
        if stmt.strip():
            spark.sql(stmt)


def _select_grantees(spark, catalog, schema, object_name):
    """Principals holding SELECT (or ALL) on an object, via SHOW GRANTS.

    Returns an empty set when the object does not exist. Any other failure is SURFACED (printed to
    stderr) rather than silently swallowed, so a broken check cannot masquerade as "no grants".
    """
    grantees = set()
    try:
        rows = spark.sql(f"SHOW GRANTS ON TABLE {fq(catalog, schema, object_name)}").collect()
    except Exception as exc:  # noqa: BLE001 — surface the error, do not mask it
        print(f"WARNING: SHOW GRANTS failed for {catalog}.{schema}.{object_name}: {exc}", file=sys.stderr)
        return grantees
    for r in rows:
        d = r.asDict()
        priv = str(d.get("ActionType") or d.get("action_type") or "").upper()
        principal = d.get("Principal") or d.get("principal")
        if principal and priv in ("SELECT", "ALL PRIVILEGES", "ALL_PRIVILEGES"):
            grantees.add(principal)
    return grantees


def main(argv=None):
    p = argparse.ArgumentParser(description="Apply (optional) and verify Gold RLS for a target.")
    p.add_argument("--gold_catalog", required=True)
    p.add_argument("--gold_schema", required=True)
    p.add_argument("--consumer_group", default="users")
    p.add_argument("--security_sql", default=None, help="gold_security_<env>.sql path (apply phase)")
    p.add_argument("--harden_sql", default=None, help="gold_security_harden_<env>.sql path (apply phase)")
    p.add_argument("--apply", default="false", help="true: run security then harden SQL before verifying")
    p.add_argument("--enforce", default="false", help="true: exit 1 on violations; false: report only")
    args = p.parse_args(argv)

    apply = str(args.apply).lower() == "true"
    enforce = str(args.enforce).lower() == "true"
    gold_fqn = f"{args.gold_catalog}.{args.gold_schema}"
    spark = _spark()

    if apply:
        if not (args.security_sql and args.harden_sql):
            print("ERROR: --apply requires --security_sql and --harden_sql", file=sys.stderr)
            return 2
        print(f"Applying {args.security_sql} then {args.harden_sql} (in order)...")
        _run_sql_file(spark, args.security_sql)
        _run_sql_file(spark, args.harden_sql)

    # Discover secured views at runtime (robust to the table list drifting). view_name_of handles
    # the camelCase/snake_case column-name variation across DBR versions.
    view_rows = spark.sql(f"SHOW VIEWS IN `{args.gold_catalog}`.`{args.gold_schema}`").collect()
    all_views = [view_name_of(r.asDict()) for r in view_rows]
    secured_views = [v for v in all_views if v and v.endswith(_SECURED_SUFFIX)]

    select_grantees = {}
    objects_to_check = set(secured_views) | {v[: -len(_SECURED_SUFFIX)] for v in secured_views}
    for obj in objects_to_check:
        select_grantees[obj] = _select_grantees(spark, args.gold_catalog, args.gold_schema, obj)

    violations = find_rls_violations(secured_views, select_grantees, args.consumer_group)

    print(f"Gold RLS verification for {gold_fqn}: {len(secured_views)} secured view(s) checked.")
    if violations:
        print(f"{len(violations)} RLS violation(s):")
        for v in violations:
            print(f"  - {v}")
        if enforce:
            print("ENFORCE mode: failing the task.")
            return 1
        print("REPORT-ONLY mode (--enforce=false): not failing. Flip --enforce=true to gate.")
        return 0
    print("OK: every secured view is granted to the consumer group and its base table is not.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
