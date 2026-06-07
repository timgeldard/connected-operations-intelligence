#!/usr/bin/env python3
"""CI check to ensure all DLT dataset names are unique across gold and silver layers.

Scans Python files in data-products/io-reporting/gold and data-products/io-reporting/silver.
Exits non-zero if duplicate DLT dataset names are defined.
"""

import ast
import glob
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def get_dlt_decorator_info(decorator_node):
    is_call = isinstance(decorator_node, ast.Call)
    func_node = decorator_node.func if is_call else decorator_node

    name = None
    if isinstance(func_node, ast.Name):
        name = func_node.id
    elif isinstance(func_node, ast.Attribute):
        if isinstance(func_node.value, ast.Name) and func_node.value.id == "dlt":
            name = func_node.attr

    if name not in ("table", "view"):
        return None

    explicit_name = None
    if is_call:
        for kw in decorator_node.keywords:
            if kw.arg == "name":
                if isinstance(kw.value, ast.Constant):
                    explicit_name = str(kw.value.value)
                elif hasattr(ast, "Str") and isinstance(kw.value, ast.Str):
                    explicit_name = kw.value.s
                else:
                    # Non-static name
                    pass

    return {
        "type": name,
        "explicit_name": explicit_name
    }


def scan_file_for_dlt_datasets(file_path: str) -> list[dict]:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    try:
        tree = ast.parse(content, filename=file_path)
    except SyntaxError as e:
        print(f"Syntax error in {file_path}: {e}", file=sys.stderr)
        return []

    datasets = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for dec in node.decorator_list:
                info = get_dlt_decorator_info(dec)
                if info:
                    dataset_name = info["explicit_name"] or node.name
                    datasets.append({
                        "dataset_name": dataset_name,
                        "file_path": file_path,
                        "line_number": node.lineno,
                        "function_name": node.name,
                        "type": info["type"]
                    })
    return datasets


def main() -> int:
    search_dirs = [
        os.path.join(REPO_ROOT, "data-products/io-reporting/gold"),
        os.path.join(REPO_ROOT, "data-products/io-reporting/silver"),
    ]

    all_datasets = []
    for search_dir in search_dirs:
        if not os.path.exists(search_dir):
            continue
        # Recursively find all python files
        pattern = os.path.join(search_dir, "**", "*.py")
        for file_path in glob.glob(pattern, recursive=True):
            if os.path.basename(file_path).startswith("test_") or "snapshots" in file_path:
                continue
            all_datasets.extend(scan_file_for_dlt_datasets(file_path))

    # Check for duplicates
    by_name = {}
    for ds in all_datasets:
        by_name.setdefault(ds["dataset_name"], []).append(ds)

    duplicates = {name: defs for name, defs in by_name.items() if len(defs) > 1}

    if duplicates:
        print("ERROR: Duplicate DLT dataset names detected:", file=sys.stderr)
        for name, defs in duplicates.items():
            print(f"\n  Dataset Name: '{name}' ({len(defs)} definitions)", file=sys.stderr)
            for d in defs:
                rel_path = os.path.relpath(d["file_path"], REPO_ROOT)
                print(f"    - File: {rel_path}:{d['line_number']} (func: {d['function_name']}, type: dlt.{d['type']})", file=sys.stderr)
        return 1

    print(f"DLT Dataset Name Uniqueness Guard: OK ({len(by_name)} unique datasets found)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
