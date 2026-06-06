"""Contract resolver for native Databricks query contracts."""
from __future__ import annotations

import os
from typing import Any

import yaml

from shared.query_service.object_resolver import resolve_domain_object

def _resolve_manifest_path() -> str:
    # 1. Environment variable override
    env_path = os.environ.get("APP_MANIFEST_PATH")
    if env_path:
        return os.path.abspath(env_path)

    # 2. Walk up to find repo root
    current = os.path.abspath(os.path.dirname(__file__))
    markers = {".git", "pyproject.toml", "pnpm-workspace.yaml"}
    while True:
        if any(os.path.exists(os.path.join(current, m)) for m in markers):
            manifest_path = os.path.join(current, "data-products/io-reporting/contracts/app_contract_manifest.yml")
            if os.path.exists(manifest_path):
                return os.path.abspath(manifest_path)
        parent = os.path.dirname(current)
        if parent == current:
            break
        current = parent

    # 3. Fallback to relative path traversal
    return os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "../../../../data-products/io-reporting/contracts/app_contract_manifest.yml"
        )
    )

MANIFEST_PATH = _resolve_manifest_path()

_cached_manifest: dict[str, Any] | None = None


def load_manifest() -> dict[str, Any]:
    """Load and return the contract manifest YAML file."""
    global _cached_manifest
    if _cached_manifest is None:
        if not os.path.exists(MANIFEST_PATH):
            raise FileNotFoundError(f"Contract manifest not found at {MANIFEST_PATH}")
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            _cached_manifest = yaml.safe_load(f) or {}
    return _cached_manifest


def get_contract(contract_id: str) -> dict[str, Any]:
    """Retrieve contract dictionary by ID from the manifest."""
    manifest = load_manifest()
    contracts = manifest.get("contracts", []) or []
    for contract in contracts:
        if contract.get("id") == contract_id:
            return contract
    raise ValueError(f"Contract ID '{contract_id}' not found in manifest")


def resolve_contract_view(contract_id: str) -> str:
    """Resolve contract ID to its source view name."""
    contract = get_contract(contract_id)
    source_view = contract.get("source_view")
    if not source_view:
        raise ValueError(f"Contract '{contract_id}' does not specify a source_view")
    return source_view


def resolve_contract_object(
    contract_id: str,
    domain: str,
    *,
    schema_override: str | None = None,
    catalog_override: str | None = None,
) -> str:
    """Resolve a contract ID to its fully-qualified environment-specific physical object reference.

    Args:
        contract_id: Dot-qualified contract identifier, e.g. 'warehouse360.inbound_backlog'.
        domain: One of the known query domains, e.g. 'wh360'.
        schema_override: Optional override for schema name.
        catalog_override: Optional override for catalog name.

    Returns:
        Fully-qualified physical object reference: `` `catalog`.`schema`.`object_name` ``
    """
    source_view = resolve_contract_view(contract_id)
    return resolve_domain_object(
        domain,
        source_view,
        schema_override=schema_override,
        catalog_override=catalog_override,
    )
