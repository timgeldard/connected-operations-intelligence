import subprocess
import sys
from pathlib import Path


def _read_existing_timestamp(output_path: Path) -> str | None:
    if not output_path.exists():
        return None

    for line in output_path.read_text().splitlines():
        if line.startswith("#   timestamp:"):
            return line

    return None


def _preserve_existing_timestamp(output_path: Path, timestamp_line: str | None) -> None:
    if timestamp_line is None:
        return

    lines = output_path.read_text().splitlines(keepends=True)
    output_path.write_text(
        "".join(
            f"{timestamp_line}\n" if line.startswith("#   timestamp:") else line
            for line in lines
        )
    )


def main():
    repo_root = Path(__file__).parent.parent.parent.parent
    json_schema_path = repo_root / "packages" / "data-contracts" / "dist-schema" / "contracts.json"
    output_path = repo_root / "apps" / "api" / "contracts" / "generated.py"

    if not json_schema_path.exists():
        print(f"Error: {json_schema_path} does not exist. Run the TS export script first.")
        sys.exit(1)

    print(f"Generating Pydantic models from {json_schema_path}...")
    existing_timestamp = _read_existing_timestamp(output_path)

    cmd = [
        sys.executable, "-m", "datamodel_code_generator",
        "--input", str(json_schema_path),
        "--input-file-type", "jsonschema",
        "--output", str(output_path),
        "--output-model-type", "pydantic_v2.BaseModel",
        "--use-schema-description",
        "--use-field-description",
        "--snake-case-field",
        "--enum-field-as-literal", "all",
        "--field-constraints",
        "--target-python-version", "3.11",
        "--allow-population-by-field-name",
        "--use-standard-primitive-types",
        "--no-use-union-operator",
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print("Error generating models:")
        print(result.stderr)
        sys.exit(1)

    _preserve_existing_timestamp(output_path, existing_timestamp)

    print(f"Successfully generated Pydantic models at {output_path}")


if __name__ == "__main__":
    main()
