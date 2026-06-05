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
    "long": "number",
    "decimal": "number",
    "timestamp": "string",
    "date": "string",
    "boolean": "boolean"
}

def to_pascal_case(s):
    clean = s.replace(".", " ").replace("-", " ").replace("_", " ")
    return "".join(word.capitalize() for word in clean.split())

def to_camel_case(s):
    pascal = to_pascal_case(s)
    if not pascal:
        return ""
    return pascal[0].lower() + pascal[1:]

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
    registry_entries = []

    for contract in contracts:
        c_id = contract["id"]
        c_desc = contract.get("description", "")
        c_version = contract.get("version", "0.1.0")
        c_domain = contract.get("domain", "")
        c_owner = contract.get("owner", "")
        c_lifecycle = contract.get("lifecycle", "")
        c_source_view = contract.get("source_view", "")
        c_grain = contract.get("grain", "")
        c_pk = contract.get("primary_key", [])
        c_freshness = contract.get("freshness", {})
        c_access = contract.get("access_policy", {})

        interface_name = to_pascal_case(c_id)
        const_name = f"{interface_name}Contract"
        registry_entries.append((c_id, const_name))

        # Generate TS Interface
        ts_lines.append("/**")
        if c_desc:
            ts_lines.append(f" * {c_desc}")
        ts_lines.append(f" * Source View: {c_source_view}")
        ts_lines.append(f" * Version: {c_version}")
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

        # Generate TS Metadata Constant
        ts_lines.append(f"export const {const_name} = {{")
        ts_lines.append(f"  id: {json.dumps(c_id)},")
        ts_lines.append(f"  version: {json.dumps(c_version)},")
        ts_lines.append(f"  domain: {json.dumps(c_domain)},")
        ts_lines.append(f"  owner: {json.dumps(c_owner)},")
        ts_lines.append(f"  lifecycle: {json.dumps(c_lifecycle)},")
        ts_lines.append(f"  sourceView: {json.dumps(c_source_view)},")
        ts_lines.append(f"  grain: {json.dumps(c_grain)},")
        ts_lines.append(f"  primaryKey: {json.dumps(c_pk)},")

        # Freshness camelCase conversion
        ts_lines.append("  freshness: {")
        ts_lines.append(f"    expectedMinutes: {c_freshness.get('expected_minutes', 0)},")
        ts_lines.append(f"    warningMinutes: {c_freshness.get('warning_minutes', 0)},")
        ts_lines.append(f"    criticalMinutes: {c_freshness.get('critical_minutes', 0)},")
        ts_lines.append("  },")

        # Access policy camelCase conversion
        ts_lines.append("  accessPolicy: {")
        ts_lines.append(f"    rowLevelKey: {json.dumps(c_access.get('row_level_key', ''))},")
        ts_lines.append(f"    entitlementSource: {json.dumps(c_access.get('entitlement_source', ''))},")
        ts_lines.append("  },")

        ts_lines.append("} as const;")
        ts_lines.append("")

    # Generate Top-Level registry
    m_ver = manifest.get("contract_version", "0.1.0")
    m_prod = manifest.get("product", "connected-operations-intelligence")
    ts_lines.append("export const ioReportingContracts = {")
    ts_lines.append(f"  contractVersion: {json.dumps(m_ver)},")
    ts_lines.append(f"  product: {json.dumps(m_prod)},")
    ts_lines.append("  contracts: {")
    for c_id, const_name in registry_entries:
        ts_lines.append(f"    {json.dumps(c_id)}: {const_name},")
    ts_lines.append("  },")
    ts_lines.append("} as const;")
    ts_lines.append("")

    os.makedirs(os.path.dirname(TS_OUT_PATH), exist_ok=True)
    with open(TS_OUT_PATH, "w") as f:
        f.write("\n".join(ts_lines))
    print(f"Generated TS contracts at: {TS_OUT_PATH}")

if __name__ == "__main__":
    generate_contracts()
