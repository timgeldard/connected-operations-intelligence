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

VALID_TYPES = {
    "string",
    "double",
    "integer",
    "long",
    "decimal",
    "timestamp",
    "date",
    "boolean",
}

VALID_LIFECYCLES = {
    "draft",
    "pilot",
    "production-candidate",
    "production",
    "deprecated",
}

REQUIRED_MANIFEST_FIELDS = [
    "contract_version",
    "product",
    "owner",
    "consumer",
    "contracts",
]

REQUIRED_CONTRACT_FIELDS = [
    "id",
    "version",
    "domain",
    "owner",
    "lifecycle",
    "description",
    "source_view",
    "grain",
    "primary_key",
    "freshness",
    "access_policy",
    "fields",
]

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

    if not data:
        print("Error: Manifest is empty.")
        sys.exit(1)

    errors = []

    # 1. Validate top-level manifest fields
    for req_field in REQUIRED_MANIFEST_FIELDS:
        if req_field not in data:
            errors.append(f"Manifest is missing required top-level field: '{req_field}'")

    contracts = data.get("contracts", [])
    if not isinstance(contracts, list):
        errors.append("Top-level 'contracts' must be a list.")
        contracts = []

    contract_ids = set()

    for idx, contract in enumerate(contracts):
        c_id = contract.get("id", f"<index {idx}>")
        print(f"Checking contract: {c_id}")

        # Validate unique contract IDs
        if "id" in contract:
            if c_id in contract_ids:
                errors.append(f"Duplicate contract ID found: '{c_id}'")
            contract_ids.add(c_id)

        # Validate required contract fields
        for req_field in REQUIRED_CONTRACT_FIELDS:
            if req_field not in contract:
                errors.append(f"Contract '{c_id}' is missing required field: '{req_field}'")

        # Validate source_view prefix
        source_view = contract.get("source_view")
        if source_view:
            if not (source_view.startswith("vw_consumption_") or source_view.startswith("vw_genie_")):
                errors.append(f"Contract '{c_id}' source_view '{source_view}' must start with 'vw_consumption_' or 'vw_genie_'")

        # Validate lifecycle values
        lifecycle = contract.get("lifecycle")
        if lifecycle and lifecycle not in VALID_LIFECYCLES:
            errors.append(f"Contract '{c_id}' has invalid lifecycle '{lifecycle}'. Valid lifecycles: {sorted(list(VALID_LIFECYCLES))}")

        # Validate primary key is a non-empty list
        pk = contract.get("primary_key")
        if pk is not None:
            if not isinstance(pk, list) or len(pk) == 0:
                errors.append(f"Contract '{c_id}' primary_key must be a non-empty list.")

        # Validate freshness policy
        freshness = contract.get("freshness")
        if freshness is not None:
            if not isinstance(freshness, dict):
                errors.append(f"Contract '{c_id}' freshness must be an object.")
            else:
                for f_req in ["expected_minutes", "warning_minutes", "critical_minutes"]:
                    if f_req not in freshness:
                        errors.append(f"Contract '{c_id}' freshness is missing required field: '{f_req}'")
                    else:
                        val = freshness[f_req]
                        if not isinstance(val, int) or val <= 0:
                            errors.append(f"Contract '{c_id}' freshness '{f_req}' must be a positive integer.")

                expected = freshness.get("expected_minutes")
                warning = freshness.get("warning_minutes")
                critical = freshness.get("critical_minutes")

                if isinstance(expected, int) and isinstance(warning, int):
                    if warning < expected:
                        errors.append(f"Contract '{c_id}' freshness 'warning_minutes' ({warning}) must be >= 'expected_minutes' ({expected}).")
                if isinstance(warning, int) and isinstance(critical, int):
                    if critical < warning:
                        errors.append(f"Contract '{c_id}' freshness 'critical_minutes' ({critical}) must be >= 'warning_minutes' ({warning}).")

        # Validate fields
        fields = contract.get("fields")
        if fields is not None:
            if not isinstance(fields, list) or len(fields) == 0:
                errors.append(f"Contract '{c_id}' fields must be a non-empty list.")
            else:
                field_names = set()
                for f_idx, field in enumerate(fields):
                    f_name = field.get("name", f"<field index {f_idx}>")
                    if "name" not in field:
                        errors.append(f"Contract '{c_id}', field at index {f_idx} is missing 'name'")
                    else:
                        if f_name in field_names:
                            errors.append(f"Contract '{c_id}' has duplicate field name: '{f_name}'")
                        field_names.add(f_name)

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
