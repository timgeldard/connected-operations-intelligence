#!/usr/bin/env python3
import os
import re
import sys

# Directories to scan
SCAN_DIRS = ["apps", "packages", "domain-integrations"]

# Patterns that indicate forbidden direct access (case-insensitive)
FORBIDDEN_PATTERNS = [
    r"\.bronze\.",
    r"\.silver\.",
    r"\.sap\.",
    r"\bfrom\s+silver_",
    r"\bfrom\s+bronze_",
    r"\bfrom\s+sap\.",
    r"\bgold_[a-zA-Z0-9_]+"
]

# Files/extensions to ignore
IGNORE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".zip", ".tar", ".gz", ".pyc"}
IGNORE_FILES = {".gitkeep", "package-lock.json", "pnpm-lock.yaml"}

def should_ignore(file_path):
    _, ext = os.path.splitext(file_path)
    if ext.lower() in IGNORE_EXTENSIONS:
        return True
    if os.path.basename(file_path) in IGNORE_FILES:
        return True
    # Ignore generated contract folder to prevent self-triggering
    if "src/generated" in file_path:
        return True
    return False

def check_file(file_path):
    violations = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            for line_no, line in enumerate(f, 1):
                # Skip comments
                clean_line = line.strip()
                if clean_line.startswith("//") or clean_line.startswith("#") or clean_line.startswith("/*") or clean_line.startswith("*"):
                    continue
                for pattern in FORBIDDEN_PATTERNS:
                    match = re.search(pattern, line, re.IGNORECASE)
                    if match:
                        violations.append((line_no, line.strip(), match.group(0)))
    except Exception as exc:
        print(f"Warning: Could not read {file_path}: {exc}")
    return violations

def run_boundary_check():
    print("Running Repository Boundary Check...")
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))

    total_violations = 0
    scanned_count = 0

    for scan_dir in SCAN_DIRS:
        target_path = os.path.join(root_dir, scan_dir)
        if not os.path.exists(target_path):
            continue

        for root, _, files in os.walk(target_path):
            # Skip node_modules or dist folders
            if "node_modules" in root or "dist" in root:
                continue
            for file in files:
                file_path = os.path.join(root, file)
                if should_ignore(file_path):
                    continue

                scanned_count += 1
                violations = check_file(file_path)
                if violations:
                    rel_path = os.path.relpath(file_path, root_dir)
                    print(f"\n[VIOLATION] in file: {rel_path}")
                    for line_no, content, matched in violations:
                        print(f"  Line {line_no}: Matched '{matched}' -> \"{content}\"")
                    total_violations += len(violations)

    print(f"\nScan complete. Scanned {scanned_count} files.")
    if total_violations > 0:
        print(f"Found {total_violations} forbidden direct references to Bronze/Silver/Gold/SAP tables.")
        sys.exit(1)
    else:
        print("Boundary check succeeded: No direct database access violations found!")
        sys.exit(0)

if __name__ == "__main__":
    run_boundary_check()
