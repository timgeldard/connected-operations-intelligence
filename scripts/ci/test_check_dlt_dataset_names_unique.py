"""Unit tests for check_dlt_dataset_names_unique.py."""

import ast
import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from check_dlt_dataset_names_unique import get_dlt_decorator_info, scan_file_for_dlt_datasets


def test_get_dlt_decorator_info_simple_decorator():
    tree = ast.parse("@dlt.table\ndef func(): pass")
    func_node = tree.body[0]
    dec = func_node.decorator_list[0]
    info = get_dlt_decorator_info(dec)
    assert info == {"type": "table", "explicit_name": None}


def test_get_dlt_decorator_info_decorator_with_call():
    tree = ast.parse("@dlt.table(name=\"my_custom_table\", comment=\"test\")\ndef func(): pass")
    func_node = tree.body[0]
    dec = func_node.decorator_list[0]
    info = get_dlt_decorator_info(dec)
    assert info == {"type": "table", "explicit_name": "my_custom_table"}


def test_get_dlt_decorator_info_non_dlt():
    tree = ast.parse("@other_decorator\ndef func(): pass")
    func_node = tree.body[0]
    dec = func_node.decorator_list[0]
    assert get_dlt_decorator_info(dec) is None


def test_scan_file_for_dlt_datasets_implicit_and_explicit(tmp_path):
    code = """
import dlt

@dlt.table
def implicit_dataset():
    pass

@dlt.view(name="explicit_view_name")
def some_view():
    pass

def regular_helper():
    pass
"""
    test_file = tmp_path / "test_module.py"
    test_file.write_text(code, encoding="utf-8")

    datasets = scan_file_for_dlt_datasets(str(test_file))
    assert len(datasets) == 2

    # Verify implicit
    ds1 = [d for d in datasets if d["function_name"] == "implicit_dataset"][0]
    assert ds1["dataset_name"] == "implicit_dataset"
    assert ds1["type"] == "table"

    # Verify explicit
    ds2 = [d for d in datasets if d["function_name"] == "some_view"][0]
    assert ds2["dataset_name"] == "explicit_view_name"
    assert ds2["type"] == "view"


def test_check_dlt_dataset_names_duplicates(tmp_path, capsys):
    from unittest.mock import patch

    import check_dlt_dataset_names_unique

    # Create expected gold/silver directories in tmp_path
    gold_dir = tmp_path / "data-products" / "io-reporting" / "gold"
    silver_dir = tmp_path / "data-products" / "io-reporting" / "silver"
    gold_dir.mkdir(parents=True)
    silver_dir.mkdir(parents=True)

    file1 = gold_dir / "file1.py"
    file1.write_text("""
@dlt.table
def duplicate_name():
    pass
""", encoding="utf-8")

    file2 = silver_dir / "file2.py"
    file2.write_text("""
@dlt.table(name="duplicate_name")
def other_func():
    pass
""", encoding="utf-8")

    with patch("check_dlt_dataset_names_unique.REPO_ROOT", str(tmp_path)):
        code = check_dlt_dataset_names_unique.main()
        assert code == 1

    captured = capsys.readouterr()
    assert "Duplicate DLT dataset names detected" in captured.err
    assert "duplicate_name" in captured.err
