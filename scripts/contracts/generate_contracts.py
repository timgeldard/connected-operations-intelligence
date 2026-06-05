#!/usr/bin/env python3
import json
import os
import sys

import yaml

MANIFEST_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "../../data-products/io-reporting/contracts/app_contract_manifest.yml"
    )
)

JSON_OUT_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "../../packages/data-contracts/src/generated/io-reporting/contract.json"
    )
)

TS_OUT_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "../../packages/data-contracts/src/generated/io-reporting/contract.ts"
    )
)

TYPE_MAP = {
    "string": "string",
    "double": "number",
    "integer": "number",
    "timestamp": "string",
    "boolean": "boolean"
}

def to_pascal_case(s):
    # Replace dots, hyphens, and underscores with space, then capitalize words and join
    clean = s.replace(".", " ").replace("-", " ").replace("_", " ")
    return "".join(word.capitalize() for word in clean.split())

def generate_contracts():
    print(f"Generating contracts from manifest: {MANIFEST_PATH}")
    if not os.path.exists(MANIFEST_PATH):
        print(f"Error: Manifest file not found at {MANIFEST_PATH}")
        sys.exit(1)

    try:
        with open(MANIFEST_PATH, "r") as f:
            manifest = yaml.safe_load(f)
    except Exception as exc:
        print(f"Error reading manifest: {exc}")
        sys.exit(1)

    # 1. Write JSON representation
    os.makedirs(os.path.dirname(JSON_OUT_PATH), exist_ok=True)
    with open(JSON_OUT_PATH, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"Generated JSON contract at: {JSON_OUT_PATH}")

    # 2. Write TS interfaces representation
    ts_lines = [
        "/**",
        " * This file is auto-generated from app_contract_manifest.yml.",
        " * Do not modify this file manually.",
        " */",
        ""
    ]

    contracts = manifest.get("contracts", [])
    for contract in contracts:
        c_id = contract["id"]
        c_desc = contract.get("description", "")
        interface_name = to_pascal_case(c_id)

        ts_lines.append("/**")
        if c_desc:
            ts_lines.append(f" * {c_desc}")
        ts_lines.append(f" * Source View: {contract.get('source_view')}")
        ts_lines.append(f" * Version: {contract.get('version')}")
        ts_lines.append(" */")
        ts_lines.append(f"export interface {interface_name} {{")

        for field in contract.get("fields", []):
            name = field["name"]
            f_type = field["type"]
            f_desc = field.get("description", "")
            required = field.get("required", True)

            ts_type = TYPE_MAP.get(f_type, "any")
            optional_suffix = "" if required else "?"

            if f_desc:
                ts_lines.append(f"  /** {f_desc} */")
            ts_lines.append(f"  {name}{optional_suffix}: {ts_type};")

        ts_lines.append("}")
        ts_lines.append("")

    os.makedirs(os.path.dirname(TS_OUT_PATH), exist_ok=True)
    with open(TS_OUT_PATH, "w") as f:
        f.write("\n".join(ts_lines))
    print(f"Generated TS contracts at: {TS_OUT_PATH}")

if __name__ == "__main__":
    generate_contracts()
