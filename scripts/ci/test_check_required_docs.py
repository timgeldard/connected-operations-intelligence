"""Unit tests for check_required_docs.py."""

import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from check_required_docs import check_docs


def test_check_docs_missing_file(tmp_path):
    from unittest.mock import patch

    with patch("check_required_docs.REPO_ROOT", str(tmp_path)):
        errors = check_docs()
        assert len(errors) > 0
        assert any("Missing required documentation file" in err for err in errors)


def test_check_docs_unqualified_claims(tmp_path):
    from unittest.mock import patch

    # Create all required files with safe content
    for doc in [
        "docs/README.md",
        "docs/architecture/warehouse360-governed-path-status.md",
        "docs/contracts/warehouse360-contract-status.md",
        "docs/contracts/warehouse360-route-to-contract-map.md",
        "docs/decisions/ADR-0001-apps-use-consumption-views-only.md",
        "docs/decisions/ADR-0002-secured-live-consumption-view-boundaries.md",
        "docs/decisions/ADR-0003-dev-before-uat-validation.md",
    ]:
        path = tmp_path / doc
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("Safe documentation file.", encoding="utf-8")

    with patch("check_required_docs.REPO_ROOT", str(tmp_path)):
        errors = check_docs()
        assert len(errors) == 0

    # Write forbidden claim in one file
    bad_file = tmp_path / "docs/architecture/warehouse360-governed-path-status.md"
    bad_file.write_text("Yes, governed_contracts is ready now!", encoding="utf-8")

    with patch("check_required_docs.REPO_ROOT", str(tmp_path)):
        errors = check_docs()
        assert len(errors) == 1
        assert "governed_contracts is ready" in errors[0]

    # Qualify it with negative context
    bad_file.write_text("No, governed_contracts is ready is not yet true.", encoding="utf-8")
    with patch("check_required_docs.REPO_ROOT", str(tmp_path)):
        errors = check_docs()
        assert len(errors) == 0
