"""Tests for shared.query_service.contract_resolver.

Verifies:
- Normal path: resolver finds manifest via repo-walk when APP_MANIFEST_PATH is unset.
- Error path: when APP_MANIFEST_PATH is set but file is absent, raises FileNotFoundError
  with an actionable message naming the copy step (make prep-app-deploy).
- get_contract raises ValueError for unknown IDs.
- resolve_contract_view raises ValueError when source_view is absent.
"""
from __future__ import annotations

import os
import textwrap

import pytest
import yaml

import shared.query_service.contract_resolver as resolver_module
from shared.query_service.contract_resolver import get_contract, resolve_contract_view


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _write_minimal_manifest(path: str) -> None:
    """Write a minimal valid manifest YAML to *path*."""
    manifest = {
        "contract_version": "0.1.0",
        "contracts": [
            {
                "id": "test.my_contract",
                "version": "0.1.0",
                "source_view": "vw_consumption_test_my_contract",
            }
        ],
    }
    with open(path, "w", encoding="utf-8") as f:
        yaml.safe_dump(manifest, f)


# ---------------------------------------------------------------------------
# APP_MANIFEST_PATH missing-file error
# ---------------------------------------------------------------------------

class TestManifestPathEnvVar:
    def test_missing_file_raises_file_not_found(self, monkeypatch, tmp_path) -> None:
        """When APP_MANIFEST_PATH points to a non-existent file, _resolve_manifest_path
        must raise FileNotFoundError with an actionable message."""
        absent = str(tmp_path / "does_not_exist.yml")
        monkeypatch.setenv("APP_MANIFEST_PATH", absent)

        with pytest.raises(FileNotFoundError) as exc_info:
            resolver_module._resolve_manifest_path()

        msg = str(exc_info.value)
        # Must name the missing path
        assert absent in msg or "does_not_exist" in msg
        # Must include an actionable fix referencing the copy step
        assert "make prep-app-deploy" in msg or "prep-app-deploy" in msg
        # Must mention the data-products source
        assert "data-products" in msg

    def test_missing_file_message_names_both_paths(self, monkeypatch, tmp_path) -> None:
        """Error message must name both the missing deploy path and the source path."""
        absent = str(tmp_path / "missing_manifest.yml")
        monkeypatch.setenv("APP_MANIFEST_PATH", absent)

        with pytest.raises(FileNotFoundError) as exc_info:
            resolver_module._resolve_manifest_path()

        msg = str(exc_info.value)
        assert "data-products/io-reporting/contracts/app_contract_manifest.yml" in msg

    def test_present_file_returns_path(self, monkeypatch, tmp_path) -> None:
        """When APP_MANIFEST_PATH points to an existing file, _resolve_manifest_path
        returns its absolute path without raising."""
        manifest_file = tmp_path / "manifest.yml"
        _write_minimal_manifest(str(manifest_file))
        monkeypatch.setenv("APP_MANIFEST_PATH", str(manifest_file))

        result = resolver_module._resolve_manifest_path()
        assert os.path.isabs(result)
        assert os.path.exists(result)


# ---------------------------------------------------------------------------
# get_contract and resolve_contract_view (use repo-walk fallback via env clear)
# ---------------------------------------------------------------------------

class TestGetContract:
    def test_unknown_contract_raises_value_error(self, monkeypatch) -> None:
        """get_contract raises ValueError for a contract ID not in the manifest."""
        monkeypatch.delenv("APP_MANIFEST_PATH", raising=False)
        # Reset module-level cache and path so the repo-walk fallback is used
        monkeypatch.setattr(resolver_module, "_cached_manifest", None)
        # The repo-walk will find the real data-products manifest
        with pytest.raises(ValueError, match="not found in manifest"):
            get_contract("nonexistent.contract_id_xyz")

    def test_known_contract_returns_dict(self, monkeypatch) -> None:
        """get_contract returns a dict for a contract that exists in the manifest."""
        monkeypatch.delenv("APP_MANIFEST_PATH", raising=False)
        monkeypatch.setattr(resolver_module, "_cached_manifest", None)
        # warehouse360.overview is always present in the data-products manifest
        contract = get_contract("warehouse360.overview")
        assert contract["id"] == "warehouse360.overview"
        assert "source_view" in contract


class TestResolveContractView:
    def test_returns_source_view_name(self, monkeypatch) -> None:
        monkeypatch.delenv("APP_MANIFEST_PATH", raising=False)
        monkeypatch.setattr(resolver_module, "_cached_manifest", None)
        view = resolve_contract_view("warehouse360.overview")
        assert view == "vw_consumption_warehouse360_overview"

    def test_missing_source_view_raises(self, monkeypatch, tmp_path) -> None:
        """resolve_contract_view raises ValueError when source_view is absent."""
        manifest_file = tmp_path / "manifest.yml"
        # Contract without source_view
        data = {
            "contract_version": "0.1.0",
            "contracts": [{"id": "test.no_view", "version": "0.1.0"}],
        }
        with open(manifest_file, "w") as f:
            yaml.safe_dump(data, f)

        # MANIFEST_PATH is a module-level constant set at import time; patch it
        # directly so load_manifest() reads from our temp file.
        monkeypatch.setattr(resolver_module, "MANIFEST_PATH", str(manifest_file))
        monkeypatch.setattr(resolver_module, "_cached_manifest", None)

        with pytest.raises(ValueError, match="source_view"):
            resolve_contract_view("test.no_view")
