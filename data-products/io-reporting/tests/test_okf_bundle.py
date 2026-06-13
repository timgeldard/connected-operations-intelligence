"""OKF bundle conformance tests (offline — pure file parsing, no Spark).

Validates:
  1. Every non-reserved .md under okf/ has parseable YAML frontmatter with a
     non-empty ``type`` field (OKF v0.1 conformance requirement).
  2. Reserved files follow the spec structure:
     - domain/index.md and the root index.md have NO frontmatter EXCEPT the
       root okf/index.md which MUST carry okf_version: "0.1".
     - README.md is a valid concept (has frontmatter with type).
  3. The root index.md is the ONLY index.md with frontmatter.
  4. The generator is idempotent: running it twice produces the same output.
  5. Concept count matches the number of contracts in the manifest.
"""
from __future__ import annotations

import filecmp
import os
import re
import tempfile
from pathlib import Path

import pytest
import yaml

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_TESTS_DIR = Path(__file__).resolve().parent
_PRODUCT_DIR = _TESTS_DIR.parent
OKF_DIR = _PRODUCT_DIR / "okf"
MANIFEST_PATH = _PRODUCT_DIR / "contracts" / "app_contract_manifest.yml"
GENERATOR = _PRODUCT_DIR / "scripts" / "generate_okf_bundle.py"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


def _parse_frontmatter(path: Path) -> dict | None:
    """Return parsed YAML frontmatter dict, or None if no valid frontmatter."""
    text = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        return None
    try:
        return yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return None


def _all_md_files(root: Path) -> list[Path]:
    """Return all .md files under root (sorted for determinism)."""
    return sorted(root.rglob("*.md"))


def _is_reserved(path: Path, okf_root: Path) -> bool:
    """Return True if path is a reserved file (index.md or log.md)."""
    return path.name in ("index.md", "log.md")


def _load_manifest_contracts() -> list[dict]:
    with MANIFEST_PATH.open(encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    return data.get("contracts") or []


def _import_generator():
    import importlib.util

    spec = importlib.util.spec_from_file_location("generate_okf_bundle", GENERATOR)
    mod = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def okf_dir():
    """Return the committed OKF directory, asserting it exists."""
    assert OKF_DIR.exists(), (
        f"OKF directory not found at {OKF_DIR}. "
        "Run `make generate-okf` and commit the output."
    )
    return OKF_DIR


@pytest.fixture(scope="session")
def all_md(okf_dir):
    return _all_md_files(okf_dir)


@pytest.fixture(scope="session")
def manifest_contracts():
    return _load_manifest_contracts()


# ---------------------------------------------------------------------------
# Test 1: every non-reserved .md has frontmatter with non-empty type
# ---------------------------------------------------------------------------

def test_all_concepts_have_type_frontmatter(okf_dir, all_md):
    """Every non-reserved .md must have parseable frontmatter with non-empty type."""
    failures: list[str] = []
    for md in all_md:
        if _is_reserved(md, okf_dir):
            continue
        fm = _parse_frontmatter(md)
        rel = md.relative_to(okf_dir)
        if fm is None:
            failures.append(f"{rel}: no parseable frontmatter")
        elif not fm.get("type"):
            failures.append(f"{rel}: frontmatter missing non-empty 'type' field")
    assert not failures, (
        "OKF conformance failures (non-reserved .md must have frontmatter + type):\n"
        + "\n".join(f"  {f}" for f in failures)
    )


# ---------------------------------------------------------------------------
# Test 2: root index.md is the ONLY index.md with frontmatter
# ---------------------------------------------------------------------------

def test_root_index_has_frontmatter_others_do_not(okf_dir, all_md):
    """Only okf/index.md may carry frontmatter; all other index.md files must not."""
    root_index = okf_dir / "index.md"
    assert root_index.exists(), "okf/index.md (root index) is missing."

    root_fm = _parse_frontmatter(root_index)
    assert root_fm is not None, "okf/index.md must have YAML frontmatter."
    assert root_fm.get("okf_version"), (
        "okf/index.md frontmatter must carry okf_version."
    )

    domain_indexes = [
        md for md in all_md
        if md.name == "index.md" and md != root_index
    ]
    violations: list[str] = []
    for idx in domain_indexes:
        fm = _parse_frontmatter(idx)
        if fm is not None:
            violations.append(str(idx.relative_to(okf_dir)))
    assert not violations, (
        "These domain index.md files must NOT have frontmatter (OKF spec §6):\n"
        + "\n".join(f"  {v}" for v in violations)
    )


# ---------------------------------------------------------------------------
# Test 3: root index.md carries okf_version "0.1"
# ---------------------------------------------------------------------------

def test_root_index_okf_version(okf_dir):
    root_index = okf_dir / "index.md"
    fm = _parse_frontmatter(root_index)
    assert fm is not None
    assert fm.get("okf_version") == "0.1", (
        f"okf/index.md must carry okf_version: '0.1', got: {fm.get('okf_version')!r}"
    )


# ---------------------------------------------------------------------------
# Test 4: README.md is a valid concept (has frontmatter with type)
# ---------------------------------------------------------------------------

def test_readme_is_valid_concept(okf_dir):
    readme = okf_dir / "README.md"
    assert readme.exists(), "okf/README.md is missing."
    fm = _parse_frontmatter(readme)
    assert fm is not None, "okf/README.md must have YAML frontmatter."
    assert fm.get("type"), "okf/README.md frontmatter must have a non-empty 'type' field."


# ---------------------------------------------------------------------------
# Test 5: concept count matches manifest contract count
# ---------------------------------------------------------------------------

def test_concept_count_matches_manifest(okf_dir, all_md, manifest_contracts):
    """Number of concept .md files must equal number of contracts in the manifest."""
    # Concepts = non-reserved .md files (excludes index.md, README.md is a concept)
    non_reserved = [
        md for md in all_md
        if not _is_reserved(md, okf_dir)
    ]
    # README.md counts as a concept (type: Reference) but is not in the manifest.
    # Subtract 1 for README.md.
    readme = okf_dir / "README.md"
    contract_concepts = [md for md in non_reserved if md != readme]

    expected = len(manifest_contracts)
    actual = len(contract_concepts)
    assert actual == expected, (
        f"Expected {expected} concept files (one per manifest contract), "
        f"found {actual}. "
        "Run `make generate-okf` to regenerate."
    )


# ---------------------------------------------------------------------------
# Test 6: generator idempotency
# ---------------------------------------------------------------------------

def test_generator_idempotency():
    """Running the generator twice must produce byte-identical output."""
    mod = _import_generator()

    with tempfile.TemporaryDirectory(prefix="okf_idem_") as tmp:
        tmp_path = Path(tmp)
        dir1 = tmp_path / "run1"
        dir2 = tmp_path / "run2"

        mod.generate(manifest_path=MANIFEST_PATH, okf_dir=dir1, verbose=False)
        mod.generate(manifest_path=MANIFEST_PATH, okf_dir=dir2, verbose=False)

        # Collect all relative paths from both runs.
        def _relpaths(root: Path) -> set[str]:
            return {
                (Path(dp) / fn).relative_to(root).as_posix()
                for dp, _, files in os.walk(root)
                for fn in files
            }

        paths1 = _relpaths(dir1)
        paths2 = _relpaths(dir2)

        assert paths1 == paths2, (
            "Generator produced different file sets on two runs:\n"
            f"  Only in run 1: {paths1 - paths2}\n"
            f"  Only in run 2: {paths2 - paths1}"
        )

        mismatches: list[str] = []
        for rel in sorted(paths1):
            f1, f2 = dir1 / rel, dir2 / rel
            if not filecmp.cmp(f1, f2, shallow=False):
                mismatches.append(rel)

        assert not mismatches, (
            "Generator is NOT idempotent -- these files differ between run 1 and run 2:\n"
            + "\n".join(f"  {m}" for m in mismatches)
        )
