#!/usr/bin/env python3
import os
import sys

import yaml

MANIFEST_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "../../data-products/io-reporting/contracts/app_contract_manifest.yml"
    )
)

VALID_TYPES = {"string", "double", "integer", "timestamp", "boolean"}

def validate_manifest():
    print(f"Validating contract manifest at: {MANIFEST_PATH}")
    if not os.path.exists(MANIFEST_PATH):
        print(f"Error: Manifest file not found at {MANIFEST_PATH}")
        sys.exit(1)

    try:
        with open(MANIFEST_PATH, "r") as f:
            data = yaml.safe_load(f)
    except yaml.YAMLError as exc:
        print(f"Error: Manifest is not a valid YAML file: {exc}")
        sys.exit(1)
    except Exception as exc:
        print(f"Error reading manifest: {exc}")
        sys.exit(1)

    if not data or "contracts" not in data:
        print("Error: Manifest must contain a top-level 'contracts' key.")
        sys.exit(1)

    contracts = data["contracts"]
    if not isinstance(contracts, list):
        print("Error: 'contracts' must be a list.")
        sys.exit(1)

    errors = []
    for idx, contract in enumerate(contracts):
        c_id = contract.get("id", f"<index {idx}>")
        print(f"Checking contract: {c_id}")

        for req_field in ["id", "description", "version", "source_view", "fields"]:
            if req_field not in contract:
                errors.append(f"Contract '{c_id}' is missing required field: '{req_field}'")

        fields = contract.get("fields", [])
        if not isinstance(fields, list):
            errors.append(f"Contract '{c_id}' fields must be a list.")
            continue

        for f_idx, field in enumerate(fields):
            f_name = field.get("name", f"<field index {f_idx}>")
            if "name" not in field:
                errors.append(f"Contract '{c_id}', field at index {f_idx} is missing 'name'")
            if "type" not in field:
                errors.append(f"Contract '{c_id}', field '{f_name}' is missing 'type'")
            else:
                f_type = field["type"]
                if f_type not in VALID_TYPES:
                    errors.append(f"Contract '{c_id}', field '{f_name}' has invalid type '{f_type}'. Valid types are: {sorted(list(VALID_TYPES))}")
            if "required" not in field:
                errors.append(f"Contract '{c_id}', field '{f_name}' is missing 'required'")
            elif not isinstance(field["required"], bool):
                errors.append(f"Contract '{c_id}', field '{f_name}' 'required' must be a boolean")

    if errors:
        print("\nValidation failed with errors:")
        for err in errors:
            print(f" - {err}")
        sys.exit(1)

    print("\nManifest validation succeeded!")
    sys.exit(0)

if __name__ == "__main__":
    validate_manifest()
