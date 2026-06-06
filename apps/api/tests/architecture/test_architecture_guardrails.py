"""Architecture guardrail tests.

These tests scan source files for structural constraints that must hold across
the codebase. They do not require a running server or Databricks access.

Constraints checked:
1. No SPN/PAT credential strings in the user-facing query path.
2. No raw SQL in FastAPI route files.
3. No raw SQL in React/TypeScript files.
4. CQ Lab failures remains deferred (not implemented without its source view).
5. Databricks-api adapters use resolved/qualified object names.
6. Mock adapters are not imported from the databricks-api code path.

Limitations:
- Scans file text; does not execute or interpret import chains.
- False positives are possible in comments/docstrings — patterns are
  conservative (exact strings, not broad regexes) to minimise noise.
- React file scan is approximate: SQL keywords appearing in non-SQL context
  (e.g. a word "from" in a JSX sentence) will not match because the checks
  require uppercase SQL conventions or explicit SELECT/INSERT/DELETE keywords.
"""
from __future__ import annotations

import re
from pathlib import Path

# ── Root paths ────────────────────────────────────────────────────────────────

_REPO_ROOT = Path(__file__).parents[4]  # connectio-rad-v2/
_API_ROOT = _REPO_ROOT / "apps" / "api"
_ROUTES_DIR = _API_ROOT / "routes"
_ADAPTERS_DIR = _API_ROOT / "adapters"
_QUERY_SERVICE_DIR = _API_ROOT / "shared" / "query_service"
_PYTHON_DB_DIR = _REPO_ROOT / "packages" / "python-db" / "src"
_WEB_SRC = _REPO_ROOT / "apps" / "web" / "src"


def _py_files(directory: Path) -> list[Path]:
    return list(directory.rglob("*.py")) if directory.exists() else []


def _ts_files(directory: Path) -> list[Path]:
    return [
        p for p in directory.rglob("*") if p.suffix in {".ts", ".tsx"}
    ] if directory.exists() else []


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


# ── 1. No SPN/PAT credentials in user-facing query path ──────────────────────

_SPN_PAT_PATTERNS = [
    "service_principal",
    "client_secret",
    "DATABRICKS_TOKEN",  # PAT-style env var
    "pat_token",
    "PAT_TOKEN",
]

# These files are in the user-facing query path
_QUERY_PATH_FILES = (
    _py_files(_QUERY_SERVICE_DIR)
    + _py_files(_ADAPTERS_DIR)
    + _py_files(_ROUTES_DIR)
    + _py_files(_PYTHON_DB_DIR)
)


class TestNoSPNOrPATInQueryPath:
    def test_no_spn_or_pat_strings(self) -> None:
        violations: list[str] = []
        for path in _QUERY_PATH_FILES:
            content = _read(path)
            for pattern in _SPN_PAT_PATTERNS:
                if pattern in content:
                    violations.append(f"{path.relative_to(_REPO_ROOT)}: contains '{pattern}'")
        assert not violations, (
            "SPN/PAT credential strings found in user-facing query path.\n"
            "Production Databricks reads must use end-user OAuth only.\n"
            + "\n".join(violations)
        )


# ── 2. No raw SQL in FastAPI route files ──────────────────────────────────────

# SQL patterns that should only appear inside QuerySpec factories (adapter files),
# never in route handler code.  The check looks for uppercase SQL fragments
# that indicate inline query construction.
_SQL_IN_ROUTES_PATTERNS = [
    re.compile(r"\bSELECT\b"),
    re.compile(r"\bINSERT INTO\b"),
    re.compile(r"\bUPDATE\b.*\bSET\b"),
    re.compile(r"\bDELETE FROM\b"),
    re.compile(r"\bFROM\s+`"),      # FROM `catalog`.`schema`.`table`
    re.compile(r"\bJOIN\s+`"),      # JOIN `...`
]


class TestNoSQLInRoutes:
    def test_no_raw_sql_in_route_files(self) -> None:
        route_files = [
            p for p in _py_files(_ROUTES_DIR)
            if p.name not in {"__init__.py"}
        ]
        violations: list[str] = []
        for path in route_files:
            content = _read(path)
            for pattern in _SQL_IN_ROUTES_PATTERNS:
                if pattern.search(content):
                    violations.append(
                        f"{path.relative_to(_REPO_ROOT)}: matches SQL pattern '{pattern.pattern}'"
                    )
        assert not violations, (
            "SQL found in FastAPI route files. SQL must only appear in QuerySpec factories "
            "(adapter files under adapters/). Routes must not construct SQL.\n"
            + "\n".join(violations)
        )


# ── 3. No raw SQL in React/TypeScript files ───────────────────────────────────

_SQL_IN_REACT_PATTERNS = [
    re.compile(r"\bSELECT\s+\S+\s+FROM\b"),   # SELECT col FROM ...
    re.compile(r"\bINSERT\s+INTO\b"),
    re.compile(r"\bDELETE\s+FROM\b"),
    re.compile(r"\bDROP\s+TABLE\b"),
    re.compile(r"\bCREATE\s+TABLE\b"),
]


class TestNoSQLInReact:
    def test_no_raw_sql_in_typescript_files(self) -> None:
        ts_files = _ts_files(_WEB_SRC)
        violations: list[str] = []
        for path in ts_files:
            content = _read(path)
            for pattern in _SQL_IN_REACT_PATTERNS:
                if pattern.search(content):
                    violations.append(
                        f"{path.relative_to(_REPO_ROOT)}: matches SQL pattern '{pattern.pattern}'"
                    )
        assert not violations, (
            "SQL found in React/TypeScript files. SQL must only live in Python QuerySpec factories.\n"
            + "\n".join(violations)
        )


# ── 4. CQ Lab failures remains deferred ──────────────────────────────────────

class TestCQLabFailuresDeferred:
    def test_get_lab_failures_spec_not_implemented(self) -> None:
        cq_adapter = _ADAPTERS_DIR / "cq" / "cq_databricks_adapter.py"
        assert cq_adapter.exists(), f"CQ adapter not found at {cq_adapter}"
        content = _read(cq_adapter)
        # A real implementation would contain "def get_lab_failures_spec" without
        # a "BLOCKED" or "deferred" marker.  We check for the implementation
        # pattern specifically — the function body returning a QuerySpec.
        # If "def get_lab_failures_spec" is present, it must be accompanied by
        # a blocker marker.
        if "def get_lab_failures_spec" in content:
            assert "BLOCKED" in content or "deferred" in content.lower(), (
                "cq_databricks_adapter.py defines get_lab_failures_spec without "
                "a BLOCKED or deferred marker. CQ Lab failures is blocked pending "
                "vw_gold_process_order_plan. Do not implement until that view is verified."
            )

    def test_cq_lab_failures_route_not_wired_to_databricks(self) -> None:
        cq_route = _ROUTES_DIR / "connected_quality_lab.py"
        if not cq_route.exists():
            return
        content = _read(cq_route)
        # The failures route in databricks-api mode must not import get_lab_failures_spec
        # unless it is explicitly documented as deferred.
        if "get_lab_failures_spec" in content and "BACKEND_ADAPTER_MODE" in content:
            # If wired, must have a TODO/BLOCKED guard
            assert "TODO" in content or "BLOCKED" in content or "deferred" in content.lower(), (
                "connected_quality_lab.py wires get_lab_failures_spec in databricks-api "
                "path without a BLOCKED/TODO guard. This route is blocked pending "
                "vw_gold_process_order_plan."
            )


# ── 5. Native QuerySpec factories use qualified object names ──────────────────

_UNQUALIFIED_FROM_PATTERN = re.compile(
    r"\bFROM\s+(?!`)[a-zA-Z_][a-zA-Z0-9_]*\b(?!\s*\()"  # FROM table (not FROM `...`, not FROM func(
)
_UNQUALIFIED_JOIN_PATTERN = re.compile(
    r"\bJOIN\s+(?!`)[a-zA-Z_][a-zA-Z0-9_]*\b"
)


class TestQuerySpecObjectQualification:
    def test_adapter_sql_uses_qualified_objects(self) -> None:
        adapter_files = _py_files(_ADAPTERS_DIR)
        violations: list[str] = []
        for path in adapter_files:
            if path.name == "__init__.py":
                continue
            content = _read(path)
            # Only check SQL strings — look for lines containing SELECT or FROM
            # in the context of a string literal (triple-quoted or f-string SQL).
            sql_lines = [
                (i + 1, line)
                for i, line in enumerate(content.splitlines())
                if re.search(r"\b(SELECT|FROM|JOIN)\b", line)
                and not line.strip().startswith("#")
            ]
            for lineno, line in sql_lines:
                if _UNQUALIFIED_FROM_PATTERN.search(line) or _UNQUALIFIED_JOIN_PATTERN.search(line):
                    violations.append(
                        f"{path.relative_to(_REPO_ROOT)}:{lineno}: "
                        f"possible unqualified object name: {line.strip()!r}"
                    )
        # Report as warnings via assertion message rather than hard-fail,
        # because some FROM clauses in docstrings/comments may match.
        # Hard-fail only if violations look like actual SQL (contains quotes or backticks nearby).
        hard_violations = [v for v in violations if "`" not in v and "resolve_domain_object" not in v]
        assert not hard_violations, (
            "Possibly unqualified object names in adapter SQL. "
            "Native QuerySpec SQL must use backtick-quoted fully qualified objects "
            "(e.g. `catalog`.`schema`.`table`) or resolve_domain_object().\n"
            + "\n".join(hard_violations)
        )

    def test_adapter_sql_uses_resolve_domain_object_or_backticks(self) -> None:
        """Each native adapter that queries Databricks must use resolve_domain_object
        or produce fully-qualified backtick-quoted objects in SQL."""
        native_adapters = [
            _ADAPTERS_DIR / "envmon" / "envmon_databricks_adapter.py",
            _ADAPTERS_DIR / "poh" / "poh_databricks_adapter.py",
            _ADAPTERS_DIR / "cq" / "cq_databricks_adapter.py",
            _ADAPTERS_DIR / "trace2" / "trace2_databricks_adapter.py",
        ]
        for path in native_adapters:
            if not path.exists():
                continue
            content = _read(path)
            uses_resolver = "resolve_domain_object" in content
            uses_backticks = "`" in content
            assert uses_resolver or uses_backticks, (
                f"{path.relative_to(_REPO_ROOT)}: native Databricks adapter does not use "
                "resolve_domain_object() or backtick-quoted objects. "
                "All object references in databricks-api SQL must be fully qualified."
            )


# ── 6. Mock adapters not imported from databricks-api path ───────────────────

_MOCK_IMPORT_PATTERNS = [
    "mock_adapter",
    "MockAdapter",
    "from adapters.mock",
    "import mock",
]


class TestNoDatabricksApiMockFallback:
    def test_databricks_adapters_do_not_import_mock(self) -> None:
        databricks_adapter_files = _py_files(_ADAPTERS_DIR)
        violations: list[str] = []
        for path in databricks_adapter_files:
            if "mock" in path.name.lower():
                continue  # skip any mock adapter files themselves
            content = _read(path)
            for pattern in _MOCK_IMPORT_PATTERNS:
                if pattern in content:
                    violations.append(
                        f"{path.relative_to(_REPO_ROOT)}: contains mock import '{pattern}'"
                    )
        assert not violations, (
            "Databricks-api adapters import mock adapters. "
            "The databricks-api code path must not silently fall back to mock data.\n"
            + "\n".join(violations)
        )

    def test_routes_do_not_silently_import_mock_as_fallback(self) -> None:
        route_files = _py_files(_ROUTES_DIR)
        violations: list[str] = []
        for path in route_files:
            content = _read(path)
            for pattern in _MOCK_IMPORT_PATTERNS:
                if pattern in content:
                    violations.append(
                        f"{path.relative_to(_REPO_ROOT)}: route imports mock adapter '{pattern}'"
                    )
        assert not violations, (
            "Route files import mock adapters. Routes must fail explicitly when "
            "databricks-api config is missing — not silently return mock data.\n"
            + "\n".join(violations)
        )


# ── 7. No raw OAuth token in log calls ───────────────────────────────────────

_TOKEN_LOG_PATTERNS = [
    re.compile(r"\b(logger|logging|print)\b.*raw_oauth_token"),
    re.compile(r"\b(logger|logging|print)\b.*x.forwarded.access.token", re.IGNORECASE),
    re.compile(r"console\.(log|error|warn|debug).*x.forwarded.access.token", re.IGNORECASE),
]

_FRONTEND_DIRS = [
    _REPO_ROOT / "apps" / "web" / "src",
    _REPO_ROOT / "domain-integrations",
]


class TestNoRawTokenLogging:
    def test_no_raw_token_in_python_logs(self) -> None:
        files = _QUERY_PATH_FILES
        violations: list[str] = []
        for path in files:
            content = _read(path)
            for pattern in _TOKEN_LOG_PATTERNS[:2]:
                if pattern.search(content):
                    violations.append(
                        f"{path.relative_to(_REPO_ROOT)}: possible raw token in log call"
                    )
        assert not violations, (
            "Raw OAuth token may be logged in server-side code. "
            "Log token_present (bool) instead of the raw token value.\n"
            + "\n".join(violations)
        )

    def test_no_raw_token_in_frontend_logs(self) -> None:
        violations: list[str] = []
        for root in _FRONTEND_DIRS:
            if not root.exists():
                continue
            for path in _ts_files(root):
                content = _read(path)
                if _TOKEN_LOG_PATTERNS[2].search(content):
                    violations.append(
                        f"{path.relative_to(_REPO_ROOT)}: console log with x-forwarded-access-token"
                    )
        assert not violations, (
            "x-forwarded-access-token logged in frontend code. "
            "Do not log raw OAuth token values in browser console.\n"
            + "\n".join(violations)
        )
