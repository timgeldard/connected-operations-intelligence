#!/usr/bin/env python3
"""Repository boundary check — fails if application code references forbidden data objects.

Application code under ``apps/``, ``packages/``, and ``domain-integrations/`` must consume
governed ``vw_consumption_*`` / ``vw_genie_*`` views through approved contracts. It must NOT
directly reference raw SAP tables, or bronze/silver/gold-tier objects by hard-coded name.

What this gate catches (and does not):
  * CATCHES hard-coded references: ``catalog.gold.x``, ``FROM gold_batch_x``, ``.bronze.`` /
    ``.silver.`` / ``.sap.`` qualifiers, and the named raw SAP tables (MSEG, AFKO, …) in a
    FROM/JOIN clause.
  * DOES NOT catch the sanctioned resolver path
    ``resolve_domain_object("trace2", "gold_batch_lineage")`` — the object name is a string-literal
    argument, never a hard-coded SQL reference. Whether the resolver may target the gold schema is
    a Wave-migration policy question (move to ``vw_consumption_*``), enforced elsewhere — NOT by
    this regex gate.

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


def run_boundary_check():
    print("Running Repository Boundary Check...")
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))

    total_violations = 0
    scanned_count = 0

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
                violations = check_file(file_path)
                if violations:
                    rel_path = os.path.relpath(file_path, root_dir)
                    print(f"\n[VIOLATION] in file: {rel_path}")
                    for line_no, content, matched in violations:
                        print(f"  Line {line_no}: Matched '{matched}' -> \"{content}\"")
                    total_violations += len(violations)

    print(f"\nScan complete. Scanned {scanned_count} files.")
    if total_violations > 0:
        print(f"Found {total_violations} forbidden direct references to Bronze/Silver/Gold/SAP tables.")
        sys.exit(1)
    else:
        print("Boundary check succeeded: No direct database access violations found!")
        sys.exit(0)


if __name__ == "__main__":
    run_boundary_check()
