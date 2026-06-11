#!/usr/bin/env python3
"""CI check to verify required migration documents exist and do not make overclaims.

NOTE: the overclaim detection is a deliberately COARSE guard, not a semantic/NLP check. It flags a
fixed set of forbidden phrases unless a negative-context keyword appears within a 60-char window. It is
a cheap tripwire against accidental "governed path is ready / UAT validated / production-ready" claims —
NOT a guarantee of correctness. Known limitations: it is substring/window based, so it can be fooled by
awkward phrasing (e.g. "No, governed_contracts is ready is not yet true" passes because "not yet" is in
the window) and it only knows the phrases in FORBIDDEN_CLAIMS. Treat a pass as "no obvious overclaim",
not "claims verified". Tighten FORBIDDEN_CLAIMS / NEGATIVE_CONTEXTS as new overclaim patterns appear.
"""

import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

REQUIRED_DOCS = [
    "docs/README.md",
    "docs/architecture/warehouse360-governed-path-status.md",
    "docs/contracts/warehouse360-contract-status.md",
    "docs/contracts/warehouse360-route-to-contract-map.md",
    "docs/adr/0008-apps-use-consumption-views-only.md",
    "docs/adr/0009-secured-live-consumption-view-boundaries.md",
    "docs/adr/0010-dev-before-uat-validation.md",
]

# COARSE overclaim heuristic (see module docstring): exact-phrase match, suppressed only when a
# NEGATIVE_CONTEXTS keyword appears within ~60 chars. Not semantic — a cheap tripwire, not proof.
FORBIDDEN_CLAIMS = [
    "governed_contracts is ready",
    "governed-contracts is ready",
    "warehouse360 governed path is live",
    "warehouse360 governed-path is live",
    "uat validated",
    "uat-validated",
    "production ready",
    "production-ready",
    "rls proven",
    "rls-proven",
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
