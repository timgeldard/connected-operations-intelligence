# ADR-0002: Separate secured, live, and consumption view responsibilities

## Status

Accepted.

## Context

Earlier generation of `_secured` and `_live` views overlapped on date-relative fields, causing duplicate-column failures during compilation.

## Decision

We separate view layers by explicit responsibilities:
1. **`_secured` views**: Own security filtering only. They must be pure pass-through views with optional row-level security (RLS) predicates (e.g. `SELECT * FROM base WHERE EXISTS (...)`).
2. **`_live` views**: Own date-relative and current-state logic (e.g. `current_date()`, aging, risk bands).
3. **`vw_consumption_*` views**: Own contract shape, application-facing aliases, and field naming. They must not re-implement date-relative logic already owned by `_live` views.

## Consequences

* Security logic is easier to audit and reason about.
* Date-relative calculations are centralized in `_live` views, preventing compilation duplication.
* Contract-facing views remain stable for applications.
* Static CI guards are configured to prevent responsibility/ownership drift across SQL files.
