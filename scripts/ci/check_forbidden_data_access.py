#!/usr/bin/env python3
"""Repository boundary check — fails if application code references forbidden data objects.

Application code under ``apps/``, ``packages/``, and ``domain-integrations/`` must consume
governed ``vw_consumption_*`` / ``vw_genie_*`` views through approved contracts. It must NOT
directly reference raw SAP tables, or bronze/silver/gold-tier objects by hard-coded name.

What this gate catches (and does not):
  * Pass 1 (regex) CATCHES hard-coded references: ``catalog.gold.x``, ``FROM gold_batch_x``,
    ``.bronze.`` / ``.silver.`` / ``.sap.`` qualifiers, and the named raw SAP tables (MSEG, AFKO, …)
    in a FROM/JOIN clause.
  * Pass 2 (AST migration gate) parses ``resolve_domain_object("<domain>", "<object>")`` calls — the
    sanctioned access path the regex deliberately ignores — and flags any whose target object is not a
    governed consumption view (``vw_consumption_*`` / ``vw_genie_*``), i.e. a domain still reaching
    gold/legacy directly. Domains in ``MIGRATION_PENDING_DOMAINS`` are reported informationally and the
    build stays green; a domain NOT in that allowlist resolving to a non-consumption object is a hard
    failure. The allowlist shrinks as each domain migrates; it cannot lie (remove a domain that still
    resolves directly and its access becomes a hard failure).

Noise handling (explicit allowed exceptions per the hardening plan):
  * Markdown (``.md``) documentation is excluded — examples and source-mapping tables are allowed.
  * Test files are excluded (the "test fixture" category). Trade-off: a genuine violation written
    *inside* a test file will not be caught here. Acceptable for now; revisit if tests start
    embedding real data access.
  * Python comments and docstrings / bare string-expression statements are stripped before scanning
    (prose describing source objects is not access). Hard-coded SQL in assignments/calls is kept
    and still scanned.
"""
import ast
import os
import re
import sys

# Directories to scan
SCAN_DIRS = ["apps", "packages", "domain-integrations"]

# Case-insensitive: schema-qualified access or `from <tier>_...` direct access.
SCHEMA_PATTERNS = [
    r"\.bronze\.",
    r"\.silver\.",
    r"\.gold\.",
    r"\.sap\.",
    r"\bfrom\s+silver_",
    r"\bfrom\s+bronze_",
    r"\bfrom\s+gold_",
    r"\bfrom\s+sap\.",
]
_SCHEMA_RE = [re.compile(p, re.IGNORECASE) for p in SCHEMA_PATTERNS]

# Named raw SAP tables (hardening plan §2.2). Matched WHOLE-WORD and CASE-SENSITIVE (uppercase)
# inside a FROM/JOIN clause, so prose like "jest" or "the AUFK header" does not trigger and only
# real SQL access is caught. FROM/JOIN keyword itself is case-insensitive.
SAP_TABLES = [
    "MSEG", "CHVW", "AFKO", "AFPO", "AUFK", "JEST",
    "LTAP", "LTAK", "LQUA", "MCH1", "MCHA", "MARA",
]
_SAP_RE = re.compile(r"\b(?i:from|join)\s+(" + "|".join(SAP_TABLES) + r")\b")

# --- Migration-progress gate (resolver pass) ----------------------------------
# The sanctioned access path resolve_domain_object("<domain>", "<object>") is NOT a hard-coded SQL
# reference, so the regex pass above deliberately ignores it. This second pass parses those calls and
# flags any whose target object is not a governed consumption view (vw_consumption_* / vw_genie_*) — i.e.
# a domain still reaching gold/legacy directly. Domains listed below are KNOWN to be mid-migration: their
# direct access is reported informationally and the build stays green. A domain NOT listed that resolves
# to a non-consumption object is a hard failure (catches regressions in migrated/new domains). The list
# shrinks as each domain moves to vw_consumption_*; removing a domain that still resolves directly turns
# its access into a hard failure, so the allowlist cannot lie.
MIGRATION_PENDING_DOMAINS = {"poh", "cq", "spc", "trace2", "envmon", "wh360"}

# Object-name prefixes that ARE governed consumption objects (migrated — never a violation).
_CONSUMPTION_PREFIXES = ("vw_consumption_", "vw_genie_")
_RESOLVER_FUNC = "resolve_domain_object"

# Files/extensions to ignore. Markdown is documentation (an allowed exception).
IGNORE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",
    ".zip", ".tar", ".gz", ".pyc", ".md",
}
IGNORE_FILES = {".gitkeep", "package-lock.json", "pnpm-lock.yaml"}


def _normalize(file_path):
    return file_path.replace("\\", "/")


def is_test_path(file_path):
    """True for test files — excluded as the 'test fixture' category."""
    norm = _normalize(file_path)
    parts = norm.split("/")
    if "tests" in parts or "test" in parts:
        return True
    base = os.path.basename(norm)
    return base.startswith("test_") or base.endswith("_test.py")


def should_ignore(file_path):
    _, ext = os.path.splitext(file_path)
    if ext.lower() in IGNORE_EXTENSIONS:
        return True
    if os.path.basename(file_path) in IGNORE_FILES:
        return True
    # Ignore generated contract folder to prevent self-triggering
    if "src/generated" in _normalize(file_path):
        return True
    if is_test_path(file_path):
        return True
    return False


def _strip_python_prose(source):
    """Blank out docstrings and bare string-expression statements in Python source.

    Line numbers are preserved (blanked lines become empty) so reported violation line
    numbers stay accurate. Regular string literals (assignments, call args) are kept, so
    hard-coded SQL is still scanned. Falls back to the raw source if it does not parse.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return source
    lines = source.splitlines()
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Expr)
            and isinstance(node.value, ast.Constant)
            and isinstance(node.value.value, str)
        ):
            end = getattr(node, "end_lineno", node.lineno) or node.lineno
            for ln in range(node.lineno, end + 1):
                if 1 <= ln <= len(lines):
                    lines[ln - 1] = ""
    return "\n".join(lines)


def scan_text(text, *, is_python=False):
    """Return a list of (line_no, line_content, matched_fragment) for forbidden references.

    Importable for tests: pass a snippet directly. Set is_python=True to strip Python
    comments/docstrings before scanning.
    """
    if is_python:
        text = _strip_python_prose(text)

    violations = []
    for line_no, line in enumerate(text.splitlines(), 1):
        clean_line = line.strip()
        # Skip whole-line comments (defence in depth; docstrings already stripped for Python).
        if clean_line.startswith(("//", "#", "/*", "*")):
            continue
        for rx in _SCHEMA_RE:
            match = rx.search(line)
            if match:
                violations.append((line_no, clean_line, match.group(0)))
        sap_match = _SAP_RE.search(line)
        if sap_match:
            violations.append((line_no, clean_line, sap_match.group(1)))
    return violations


def check_file(file_path):
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
    except Exception as exc:
        print(f"Warning: Could not read {file_path}: {exc}")
        return []
    return scan_text(text, is_python=file_path.endswith(".py"))


def _func_name(func):
    """Return the called function's bare name for a Call node's func (Name or Attribute)."""
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return None


def scan_resolver_calls(source):
    """Find resolve_domain_object(domain, object_name, ...) calls in Python source.

    Returns a list of (domain, object_name, is_direct, line_no) tuples, where ``is_direct`` is True
    when the target is NOT a governed consumption object (vw_consumption_* / vw_genie_*). Module-level
    string constants (e.g. ``_SPC_MV = "spc_quality_metric_subgroup_mv"``) are resolved so Name args
    classify correctly; a non-resolvable object arg is treated as direct (object_name = "<dynamic>").
    Returns [] if the source does not parse. Importable for tests.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []
    consts = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
            for tgt in node.targets:
                if isinstance(tgt, ast.Name):
                    consts[tgt.id] = node.value.value

    findings = []
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Call) and _func_name(node.func) == _RESOLVER_FUNC):
            continue
        if not node.args:
            continue
        dom_arg = node.args[0]
        domain = dom_arg.value if (isinstance(dom_arg, ast.Constant) and isinstance(dom_arg.value, str)) else None
        obj = "<dynamic>"
        if len(node.args) >= 2:
            obj_arg = node.args[1]
            if isinstance(obj_arg, ast.Constant) and isinstance(obj_arg.value, str):
                obj = obj_arg.value
            elif isinstance(obj_arg, ast.Name) and obj_arg.id in consts:
                obj = consts[obj_arg.id]
        is_direct = not obj.startswith(_CONSUMPTION_PREFIXES)
        findings.append((domain, obj, is_direct, node.lineno))
    return findings


def classify_resolver_calls(source):
    """Split resolver findings into (pending, violations).

    pending: direct-access calls whose domain is in MIGRATION_PENDING_DOMAINS (informational).
    violations: direct-access calls whose domain is NOT allowlisted (hard failure).
    Consumption-view targets (vw_consumption_*/vw_genie_*) appear in neither.
    """
    pending, violations = [], []
    for domain, obj, is_direct, line_no in scan_resolver_calls(source):
        if not is_direct:
            continue
        # A non-literal domain arg (None) is a dynamic dispatch / wrapper (e.g. the resolver itself),
        # not a hard-coded direct access — cannot classify it, so it is not a violation.
        if domain is None:
            continue
        bucket = pending if domain in MIGRATION_PENDING_DOMAINS else violations
        bucket.append((domain, obj, line_no))
    return pending, violations


def run_boundary_check():
    print("Running Repository Boundary Check...")
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))

    total_violations = 0
    scanned_count = 0
    resolver_pending = {}      # domain -> [(rel_path, line_no, obj), ...]  (informational)
    resolver_violations = []   # [(rel_path, line_no, domain, obj), ...]    (hard failure)

    for scan_dir in SCAN_DIRS:
        target_path = os.path.join(root_dir, scan_dir)
        if not os.path.exists(target_path):
            continue

        for root, dirs, files in os.walk(target_path):
            # Prune node_modules and dist directories in-place to prevent walking into them
            dirs[:] = [d for d in dirs if d not in ("node_modules", "dist")]
            for file in files:
                file_path = os.path.join(root, file)
                if should_ignore(file_path):
                    continue

                scanned_count += 1
                rel_path = os.path.relpath(file_path, root_dir)
                violations = check_file(file_path)
                if violations:
                    print(f"\n[VIOLATION] in file: {rel_path}")
                    for line_no, content, matched in violations:
                        print(f"  Line {line_no}: Matched '{matched}' -> \"{content}\"")
                    total_violations += len(violations)

                # Resolver-path migration gate (Python only).
                if file_path.endswith(".py"):
                    try:
                        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                            py_text = f.read()
                    except Exception:
                        py_text = ""
                    pend, viol = classify_resolver_calls(py_text)
                    for domain, obj, line_no in pend:
                        resolver_pending.setdefault(domain or "<unknown>", []).append((rel_path, line_no, obj))
                    for domain, obj, line_no in viol:
                        resolver_violations.append((rel_path, line_no, domain, obj))

    print(f"\nScan complete. Scanned {scanned_count} files.")

    # Migration progress (informational): allowlisted domains still resolving to gold/legacy directly.
    if resolver_pending:
        total_pending = sum(len(v) for v in resolver_pending.values())
        print(f"\nMigration pending - {total_pending} direct gold/legacy resolver call(s) across "
              f"{len(resolver_pending)} allowlisted domain(s) (not yet on vw_consumption_*/vw_genie_*):")
        for domain in sorted(resolver_pending):
            calls = resolver_pending[domain]
            objs = ", ".join(sorted({o for _, _, o in calls}))
            print(f"  - {domain}: {len(calls)} call(s) -> {objs}")

    # Stale allowlist entries (informational): listed but no direct access seen — candidates to remove.
    stale = sorted(MIGRATION_PENDING_DOMAINS - set(resolver_pending))
    if stale:
        print(f"\nNote: allowlisted domains with no direct gold/legacy access this scan "
              f"(remove from MIGRATION_PENDING_DOMAINS once confirmed migrated): {', '.join(stale)}")

    if resolver_violations:
        print(f"\n[BOUNDARY VIOLATION] {len(resolver_violations)} resolver call(s) reach gold/legacy in a "
              f"domain NOT in MIGRATION_PENDING_DOMAINS - migrate to a vw_consumption_*/vw_genie_* view "
              f"or (if genuinely mid-migration) add the domain to the allowlist:")
        for rel_path, line_no, domain, obj in resolver_violations:
            print(f"  {rel_path}:{line_no}: resolve_domain_object({domain!r}, {obj!r})")

    if total_violations > 0 or resolver_violations:
        if total_violations:
            print(f"\nFound {total_violations} forbidden direct references to Bronze/Silver/Gold/SAP tables.")
        if resolver_violations:
            print(f"Found {len(resolver_violations)} non-allowlisted direct gold/legacy resolver access(es).")
        sys.exit(1)

    print("\nBoundary check succeeded: no hard-coded violations; all direct resolver access is within "
          "the migration-pending allowlist.")
    sys.exit(0)


if __name__ == "__main__":
    run_boundary_check()
