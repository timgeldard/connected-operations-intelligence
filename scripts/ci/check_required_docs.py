#!/usr/bin/env python3
"""CI check to verify required migration documents exist and do not make overclaims."""

import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

REQUIRED_DOCS = [
    "docs/README.md",
    "docs/architecture/warehouse360-governed-path-status.md",
    "docs/contracts/warehouse360-contract-status.md",
    "docs/contracts/warehouse360-route-to-contract-map.md",
    "docs/decisions/ADR-0001-apps-use-consumption-views-only.md",
    "docs/decisions/ADR-0002-secured-live-consumption-view-boundaries.md",
    "docs/decisions/ADR-0003-dev-before-uat-validation.md",
]

FORBIDDEN_CLAIMS = [
    "governed_contracts is ready",
    "warehouse360 governed path is live",
    "uat validated",
    "production ready",
    "rls proven",
]

NEGATIVE_CONTEXTS = [
    "not yet",
    "not proven",
    "not validated",
    "do not",
    "pending",
    "tbd",
    "candidate",
]


def check_docs() -> list[str]:
    errors = []
    for doc in REQUIRED_DOCS:
        path = os.path.join(REPO_ROOT, doc)
        if not os.path.exists(path):
            errors.append(f"Missing required documentation file: {doc}")
            continue

        with open(path, "r", encoding="utf-8") as f:
            content = f.read().lower()

        # Check for forbidden claims unless nested in negative context
        for claim in FORBIDDEN_CLAIMS:
            idx = 0
            while True:
                idx = content.find(claim, idx)
                if idx == -1:
                    break

                # Inspect 60 chars before and after for a negative context keyword
                window_start = max(0, idx - 60)
                window_end = min(len(content), idx + len(claim) + 60)
                window = content[window_start:window_end]

                if not any(neg in window for neg in NEGATIVE_CONTEXTS):
                    errors.append(
                        f"[{doc}] Violation: Unqualified claim '{claim}' found. "
                        f"Must be qualified with negative context (e.g. 'not yet', 'not proven', 'do not')."
                    )

                idx += len(claim)

    return errors


def main() -> int:
    errors = check_docs()
    if errors:
        print("Documentation check failed:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    print("Documentation check: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
