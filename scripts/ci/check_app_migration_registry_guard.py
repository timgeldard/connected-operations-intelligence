#!/usr/bin/env python3
"""Guard app contract migration sequencing.

This offline CI guard prevents non-approved apps from accidentally gaining
runtime governed-contract behavior while Warehouse360 remains the pilot.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = REPO_ROOT / "data-products/io-reporting/contracts/app_migration_registry.yml"
CONTRACTS_DIR = REPO_ROOT / "data-products/io-reporting/contracts"

SOURCE_MODE_RE = re.compile(r"[A-Z0-9_]+_SOURCE_MODE")
GOVERNED_MODE_RE = re.compile(r"governed_contracts")
QUERYSPEC_CONTRACT_RE = re.compile(r"QuerySpec\s*\([^)]*contract_id\s*=", re.DOTALL)
CONSUMPTION_VIEW_RE = re.compile(r"vw_consumption_[a-z0-9_]+")

ACTIVE_MARKERS = {
    "active",
    "route-covered",
    "route_covered",
    "dev_validated",
    "uat_ready",
    "production",
    "prod",
}

IGNORED_CONTRACT_PATH_PARTS = {
    "_templates",
}


def _load_yaml(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def _registry_apps() -> dict[str, Any]:
    if not REGISTRY_PATH.exists():
        raise FileNotFoundError(f"Missing app migration registry: {REGISTRY_PATH}")
    registry = _load_yaml(REGISTRY_PATH)
    apps = registry.get("apps") or {}
    if not isinstance(apps, dict):
        raise ValueError("app_migration_registry.yml must contain an 'apps' mapping")
    return apps


def _allowed_apps(apps: dict[str, Any]) -> set[str]:
    return {
        app_key
        for app_key, config in apps.items()
        if bool(config.get("runtime_governed_contracts_allowed"))
    }


def _app_adapter_dirs(apps: dict[str, Any]) -> dict[str, list[Path]]:
    result: dict[str, list[Path]] = {}
    for app_key, config in apps.items():
        result[app_key] = [REPO_ROOT / adapter for adapter in (config.get("adapters") or [])]
    return result


def _namespace_to_app(apps: dict[str, Any]) -> dict[str, str]:
    result: dict[str, str] = {}
    for app_key, config in apps.items():
        namespaces = [config.get("contract_namespace")]
        namespaces.extend(config.get("alternate_contract_namespaces") or [])
        for namespace in namespaces:
            if namespace:
                result[str(namespace)] = app_key
    return result


def _iter_python_files(path: Path) -> list[Path]:
    if not path.exists():
        return []
    if path.is_file() and path.suffix == ".py":
        return [path]
    return sorted(p for p in path.rglob("*.py") if "tests" not in p.parts)


def _scan_adapters(apps: dict[str, Any], allowed: set[str]) -> list[str]:
    errors: list[str] = []
    for app_key, adapter_dirs in _app_adapter_dirs(apps).items():
        if app_key in allowed:
            continue
        for adapter_dir in adapter_dirs:
            for path in _iter_python_files(adapter_dir):
                rel_path = path.relative_to(REPO_ROOT)
                text = path.read_text(encoding="utf-8", errors="ignore")

                if SOURCE_MODE_RE.search(text) and GOVERNED_MODE_RE.search(text):
                    errors.append(
                        f"{rel_path}: non-approved app '{app_key}' must not introduce "
                        "*_SOURCE_MODE governed_contracts runtime behavior"
                    )

                if QUERYSPEC_CONTRACT_RE.search(text):
                    errors.append(
                        f"{rel_path}: non-approved app '{app_key}' must not set "
                        "QuerySpec(contract_id=...)"
                    )

                for match in CONSUMPTION_VIEW_RE.finditer(text):
                    errors.append(
                        f"{rel_path}: non-approved app '{app_key}' must not resolve "
                        f"runtime consumption view '{match.group(0)}'"
                    )
    return errors


def _iter_yaml_nodes(value: Any) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    if isinstance(value, dict):
        nodes.append(value)
        for child in value.values():
            nodes.extend(_iter_yaml_nodes(child))
    elif isinstance(value, list):
        for child in value:
            nodes.extend(_iter_yaml_nodes(child))
    return nodes


def _contract_yaml_files() -> list[Path]:
    paths: list[Path] = []
    for path in CONTRACTS_DIR.rglob("*.yml"):
        if path == REGISTRY_PATH:
            continue
        if any(part in IGNORED_CONTRACT_PATH_PARTS for part in path.parts):
            continue
        paths.append(path)
    for path in CONTRACTS_DIR.rglob("*.yaml"):
        if any(part in IGNORED_CONTRACT_PATH_PARTS for part in path.parts):
            continue
        paths.append(path)
    return sorted(paths)


def _marker_values(node: dict[str, Any]) -> set[str]:
    values: set[str] = set()
    for key in ("status", "lifecycle", "route_coverage", "runtime_coverage", "validation_status"):
        raw = node.get(key)
        if raw is not None:
            values.add(str(raw).strip().lower())
    if bool(node.get("route-covered")):
        values.add("route-covered")
    if bool(node.get("active")):
        values.add("active")
    return values


def _scan_contract_yaml(apps: dict[str, Any], allowed: set[str]) -> list[str]:
    errors: list[str] = []
    namespaces = _namespace_to_app(apps)
    for path in _contract_yaml_files():
        rel_path = path.relative_to(REPO_ROOT)
        try:
            loaded = _load_yaml(path)
        except Exception as exc:  # noqa: BLE001 - report all YAML load failures consistently.
            errors.append(f"{rel_path}: could not parse YAML: {exc}")
            continue

        for node in _iter_yaml_nodes(loaded):
            contract_id = node.get("id") or node.get("contract_id")
            if not contract_id or "." not in str(contract_id):
                continue
            namespace = str(contract_id).split(".", 1)[0]
            app_key = namespaces.get(namespace)
            if not app_key or app_key in allowed:
                continue

            markers = _marker_values(node)
            active_markers = sorted(markers & ACTIVE_MARKERS)
            if active_markers:
                errors.append(
                    f"{rel_path}: contract '{contract_id}' for non-approved app "
                    f"'{app_key}' is marked active/runtime-covered ({', '.join(active_markers)})"
                )
    return errors


def run_checks() -> int:
    print("Running App Migration Registry Guard...")
    try:
        apps = _registry_apps()
    except Exception as exc:  # noqa: BLE001 - fail with direct CI output.
        print(f"Registry guard failed: {exc}")
        return 1

    allowed = _allowed_apps(apps)
    errors = []
    errors.extend(_scan_adapters(apps, allowed))
    errors.extend(_scan_contract_yaml(apps, allowed))

    if errors:
        print("\nApp migration registry guard failed:")
        for error in errors:
            print(f" - {error}")
        return 1

    print("App migration registry guard passed.")
    return 0


if __name__ == "__main__":
    sys.exit(run_checks())
