"""Unit tests for check_app_migration_registry_guard.py.

Verifies that None/non-dict app entries in the registry are handled
gracefully without raising AttributeError.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from check_app_migration_registry_guard import (
    _allowed_apps,
    _app_adapter_dirs,
    _namespace_to_app,
    _registered_adapter_dirs,
)

# --- None/non-dict entry guards -----------------------------------------------

def test_allowed_apps_skips_none_entry():
    """A None-valued app entry must not raise AttributeError."""
    apps = {"someapp": None, "otherapp": {"runtime_governed_contracts_allowed": True}}
    result = _allowed_apps(apps)
    assert result == {"otherapp"}


def test_allowed_apps_all_none_returns_empty():
    """All-None entries must return an empty set, not crash."""
    apps = {"app1": None, "app2": None}
    result = _allowed_apps(apps)
    assert result == set()


def test_app_adapter_dirs_skips_none_entry():
    """_app_adapter_dirs must skip None entries without raising."""
    apps = {"someapp": None, "otherapp": {"adapters": ["apps/api/adapters/foo"]}}
    result = _app_adapter_dirs(apps)
    assert "someapp" not in result
    assert len(result["otherapp"]) == 1


def test_namespace_to_app_skips_none_entry():
    """_namespace_to_app must skip None entries without raising."""
    apps = {
        "someapp": None,
        "otherapp": {"contract_namespace": "wh360"},
    }
    result = _namespace_to_app(apps)
    assert "wh360" in result
    assert result["wh360"] == "otherapp"


def test_registered_adapter_dirs_skips_none_entry():
    """_registered_adapter_dirs must skip None entries without raising."""
    apps = {"someapp": None, "otherapp": {"adapters": []}}
    result = _registered_adapter_dirs(apps)
    assert result == set()


def test_mixed_none_and_valid_entries_processed_correctly():
    """A registry with a mix of None and valid dict entries is processed correctly
    across all consumer functions without any AttributeError."""
    apps = {
        "broken_app": None,
        "good_app": {
            "runtime_governed_contracts_allowed": False,
            "adapters": [],
            "contract_namespace": "good",
        },
        "allowed_app": {
            "runtime_governed_contracts_allowed": True,
            "adapters": [],
            "contract_namespace": "allowed",
        },
    }
    # None of these should raise
    allowed = _allowed_apps(apps)
    adapter_dirs = _app_adapter_dirs(apps)
    ns_map = _namespace_to_app(apps)
    reg_dirs = _registered_adapter_dirs(apps)

    assert "broken_app" not in allowed
    assert "allowed_app" in allowed
    assert "good_app" not in allowed  # runtime_governed_contracts_allowed is False
    assert "broken_app" not in adapter_dirs
    assert "good" in ns_map
    assert "allowed" in ns_map
    assert reg_dirs == set()
