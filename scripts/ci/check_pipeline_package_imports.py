#!/usr/bin/env python3
"""IOReporting pipeline package-import checker (offline).

Guards the fix for `ModuleNotFoundError: No module named 'silver'` at DLT runtime.
The entrypoints use absolute imports (`import silver.tables.*`, `from gold._shared import`),
which require the bundle root on sys.path at runtime. That is provided by editable-installing
the synced bundle root into each pipeline's serverless environment — which in turn requires the
bundle-root pyproject to be an installable package and the dirs to be real packages.

Enforces:
1. Package markers exist: silver/__init__.py, silver/tables/__init__.py, gold/__init__.py.
2. Bundle-root pyproject.toml has a [build-system] and scopes packages to silver*/gold*.
3. Every IOReporting pipeline declares `environment.dependencies: --editable ${workspace.file_path}`.
4. Absolute `silver.*` imports in the silver entrypoints map to real packaged files.
"""
import os
import re
import sys

import yaml

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../.."))
PRODUCT = os.path.join(REPO_ROOT, "data-products/io-reporting")
RESOURCES = os.path.join(PRODUCT, "resources")

REQUIRED_INITS = [
    "silver/__init__.py",
    "silver/tables/__init__.py",
    "gold/__init__.py",
]

PIPELINE_YMLS = [
    "silver_fast_pipeline.pipeline.yml",
    "silver_slow_pipeline.pipeline.yml",
    "silver_quality_pipeline.pipeline.yml",
    "gold_pipeline.pipeline.yml",
]

SILVER_ENTRYPOINTS = [
    "silver/dlt_silver_fast.py",
    "silver/dlt_silver_slow.py",
    "silver/dlt_silver_quality.py",
]

EDITABLE_DEP = "--editable ${workspace.file_path}"


def _pipeline_deps(doc: dict) -> list:
    """Collect environment.dependencies across every pipeline in a resources yml."""
    deps = []
    pipelines = (doc or {}).get("resources", {}).get("pipelines", {})
    for cfg in pipelines.values():
        env = (cfg or {}).get("environment", {}) or {}
        deps.extend(env.get("dependencies", []) or [])
    return deps


def run_checks() -> int:
    print("Running IOReporting pipeline package-import check...")
    errors = []

    # 1. Package markers
    for rel in REQUIRED_INITS:
        if not os.path.isfile(os.path.join(PRODUCT, rel)):
            errors.append(f"[packages] Missing package marker: {rel}")

    # 2. Bundle-root pyproject is installable + scoped
    pyproject = os.path.join(PRODUCT, "pyproject.toml")
    if not os.path.isfile(pyproject):
        errors.append("[pyproject] data-products/io-reporting/pyproject.toml is missing")
    else:
        text = open(pyproject, encoding="utf-8").read()
        if "[build-system]" not in text:
            errors.append("[pyproject] missing [build-system] — bundle root is not pip-installable")
        if "[tool.setuptools.packages.find]" not in text:
            errors.append("[pyproject] missing [tool.setuptools.packages.find] package scoping")
        elif not re.search(r'include\s*=\s*\[[^\]]*"(silver|gold)\*?"', text):
            errors.append("[pyproject] packages.find should include silver*/gold*")

    # 3. Editable install declared by every pipeline
    for fname in PIPELINE_YMLS:
        path = os.path.join(RESOURCES, fname)
        if not os.path.isfile(path):
            errors.append(f"[pipelines] missing pipeline yml: {fname}")
            continue
        with open(path, encoding="utf-8") as f:
            doc = yaml.safe_load(f)
        deps = _pipeline_deps(doc)
        if not any(EDITABLE_DEP in str(d) for d in deps):
            errors.append(
                f"[pipelines] {fname} does not declare environment.dependencies "
                f"'{EDITABLE_DEP}' — silver/gold packages will not be importable at runtime"
            )

    # 4. Absolute silver.* imports resolve to packaged files
    import_re = re.compile(r"^\s*import\s+(silver\.[\w.]+)", re.MULTILINE)
    for rel in SILVER_ENTRYPOINTS:
        path = os.path.join(PRODUCT, rel)
        if not os.path.isfile(path):
            errors.append(f"[imports] missing entrypoint: {rel}")
            continue
        for mod in import_re.findall(open(path, encoding="utf-8").read()):
            mod_path = os.path.join(PRODUCT, mod.replace(".", "/") + ".py")
            if not os.path.isfile(mod_path):
                errors.append(f"[imports] {rel} imports '{mod}' but {mod}.py is not present")

    if errors:
        print("\nPipeline package-import check FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("\nPipeline package-import check passed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(run_checks())
