# Dynamic QuerySpec Sanitizer Specification

This document defines the architectural design, security analysis, and implementation blueprint for the **Dynamic QuerySpec Sanitizer**. 

This platform security utility validates and sanitizes custom SQL sorting (`ORDER BY`) and custom column projections (dynamic selection lists) in the FastAPI Gateway layer before constructing and executing statements on the Databricks SQL Warehouse.

---

## 1. The Problem Statement

The Databricks Statement API execution model relies on parameter binding (e.g. `:material_code`) to pass values safely, preventing traditional SQL injection. However, standard SQL parameters **cannot** be used for structural SQL components:
* **Table/Column Identifiers**: You cannot parameterize columns to select: `SELECT :column_list FROM table` (this returns a literal string constant, not the columns).
* **Sorting Columns**: You cannot parameterize the column in `ORDER BY`: `ORDER BY :order_column ASC` (this sorts by the literal string constant, rendering the sort useless).

To support dynamic sorting and selection in operations dashboards (e.g. allowing operators to sort the *Planning Board* by order state, priority, or start date), developers must resort to dynamic SQL construction:

```python
# HIGHLY VULNERABLE: Direct string interpolation of client input
sql = f"SELECT material_code, batch_number FROM {ss}.gold_stock_summary ORDER BY {user_sort_col} {user_direction}"
```

If an attacker manipulates the `user_sort_col` input to inject malicious payloads:
* `user_sort_col = "material_code; DROP TABLE gold_wm_bin_stock;"`
* `user_sort_col = "material_code, (SELECT case when (1=1) then pg_sleep(5) else 0 end)"`
* `user_sort_col = "material_code UNION SELECT user_id, oauth_token FROM ..."`

This bypasses parameter safeguards, creating high-severity SQL Injection vectors.

---

## 2. The Sanitizer Architecture

The sanitizer acts as a strict, deny-by-default validation gate at the API boundary, validating and cleaning client-provided structural parameters before they reach the repository adapters.

```mermaid
sequenceDiagram
    autonumber
    actor Client as React UI Client
    participant GW as FastAPI API Gateway
    participant San as QuerySpec Sanitizer
    participant Repo as Databricks Repository
    participant DB as Databricks SQL Warehouse

    Client->>GW: POST /api/wm-operations/bin-stock (body: {order_by: "material_code", direction: "ASC"})
    GW->>San: Validate "order_by" & "direction"
    alt Sanitization Fails (e.g., contains ";" or "--")
        San-->>GW: Raise ValueError / HTTPException(400)
        GW-->>Client: Return HTTP 400 Bad Request
    else Sanitization Passes
        San-->>GW: Return Sanitized Strings
        GW->>Repo: Fetch Query (interpolating sanitized strings)
        Repo->>DB: Execute Statement (safe parameter bindings)
        DB-->>Repo: Return Rows
        Repo-->>GW: Return Mapped Objects
        GW-->>Client: Return JSON Data
    end
```

---

## 3. Code Implementation Blueprint

### A. Sanitizer Module ([sanitizer.py](file:///home/timgeldard/github/connected-operations-intelligence/apps/api/shared/query_service/sanitizer.py))

Create this file to house strict, regex-based validation functions for SQL structural elements.

```python
import re
from typing import List

# Regular expression to match a safe, standard SQL identifier (column or table name)
# - Starts with an alphabetic character or underscore
# - Followed by up to 29 alphanumeric characters or underscores
# - Allows optional single-level dot qualification (e.g., "t.material_code")
# - Disallows spaces, semicolons, dashes, quotes, and parenthetical subqueries
IDENTIFIER_REGEX = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]{0,29}(\.[a-zA-Z_][a-zA-Z0-9_]{0,29})?$")


class SQLInjectionAlert(ValueError):
    """Raised when potential SQL Injection characters are detected in dynamic parameters."""
    pass


def sanitize_identifier(value: str) -> str:
    """Validate a single SQL identifier (e.g. column name) against strict alphanumeric boundaries.

    Args:
        value: The identifier string to check.

    Returns:
        The validated string, stripped of leading/trailing whitespace.

    Raises:
        SQLInjectionAlert: If the identifier violates the strict regex pattern.
    """
    clean_val = value.strip()
    if not IDENTIFIER_REGEX.match(clean_val):
        raise SQLInjectionAlert(
            f"Invalid SQL identifier: '{clean_val}'. "
            "Identifiers must be alphanumeric (starting with letters/underscores) and cannot contain spaces, operators, or SQL syntax."
        )
    return clean_val


def sanitize_sort_expression(order_by: str, direction: str) -> str:
    """Validate and clean custom SQL sorting clauses.

    Args:
        order_by: Comma-separated list of columns (e.g., "material_code, plant_code").
        direction: Sort direction (must be "ASC" or "DESC").

    Returns:
        A conformed "ORDER BY" sub-expression string.

    Raises:
        SQLInjectionAlert: If any identifier is invalid or direction is unsafe.
    """
    # 1. Enforce strict sorting direction enum
    clean_direction = direction.strip().upper()
    if clean_direction not in ("ASC", "DESC"):
        raise SQLInjectionAlert(f"Invalid sort direction: '{direction}'. Must be 'ASC' or 'DESC'.")

    # 2. Split multi-column sort expressions and validate each column identifier independently
    parts = order_by.split(",")
    sanitized_parts = []
    for part in parts:
        sanitized_parts.append(sanitize_identifier(part))

    # 3. Join back as a clean SQL fragment
    columns_clause = ", ".join(sanitized_parts)
    return f"ORDER BY {columns_clause} {clean_direction}"


def sanitize_projection(columns: List[str]) -> List[str]:
    """Validate a list of columns for dynamic select projections.

    Args:
        columns: List of columns requested by the client.

    Returns:
        The list of cleaned, validated columns.
    """
    if not columns:
        raise SQLInjectionAlert("Projection list cannot be empty.")
    return [sanitize_identifier(col) for col in columns]
```

### B. Route Integration Blueprint ([wm_operations.py](file:///home/timgeldard/github/connected-operations-intelligence/apps/api/routes/wm_operations.py))

Integrate the sanitizer directly into the FastAPI request validation lifecycle using Pydantic schema decorators:

```python
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, field_validator
from shared.query_service.sanitizer import sanitize_identifier, SQLInjectionAlert

router = APIRouter()

class BinStockQueryRequest(BaseModel):
    plant_code: str
    limit: int = 100
    # Client-controlled sort columns
    sort_column: str = "material_code"
    sort_direction: str = "ASC"

    @field_validator("sort_column")
    @classmethod
    def validate_sort_column(cls, v: str) -> str:
        try:
            return sanitize_identifier(v)
        except SQLInjectionAlert as e:
            raise ValueError(str(e))

    @field_validator("sort_direction")
    @classmethod
    def validate_sort_direction(cls, v: str) -> str:
        upper_val = v.strip().upper()
        if upper_val not in ("ASC", "DESC"):
            raise ValueError("Sort direction must be either 'ASC' or 'DESC'")
        return upper_val

@router.post("/wm-operations/bin-stock")
async def get_bin_stock(
    body: BinStockQueryRequest,
    x_forwarded_access_token: str | None = Header(default=None),
):
    # Safe interpolation because columns and directions have been sanitized by Pydantic
    sql_template = f"""
        SELECT 
            material_code, 
            storage_bin_code, 
            quantity 
        FROM {{ss}}.gold_wm_bin_stock 
        WHERE plant_code = :plant_code
        ORDER BY {body.sort_column} {body.sort_direction}
        LIMIT :max_rows
    """
    # Execute query spec safely...
```

---

## 4. Test Strategy and Test Cases

Unit tests must explicitly verify safety against injection vectors.

### Test Specification ([test_sanitizer.py](file:///home/timgeldard/github/connected-operations-intelligence/apps/api/tests/shared/test_sanitizer.py))

```python
import pytest
from shared.query_service.sanitizer import (
    sanitize_identifier,
    sanitize_sort_expression,
    SQLInjectionAlert,
)

def test_safe_identifiers():
    """Verify that valid columns and qualified aliases pass cleanly."""
    assert sanitize_identifier("material_code") == "material_code"
    assert sanitize_identifier("t.plant_code") == "t.plant_code"
    assert sanitize_identifier("_replicated_at") == "_replicated_at"


def test_malicious_identifiers():
    """Verify that SQL injection attempts trigger SQLInjectionAlert."""
    dangerous_inputs = [
        "material_code; DROP TABLE gold_wm_bin_stock;",  # Stacked query
        "material_code --",                              # Comment injection
        "material_code UNION SELECT",                    # UNION operator
        "material_code, (SELECT sleep(5))",              # Subquery time injection
        "1 OR 1=1",                                      # Logical bypass
        "material code",                                 # Whitespace separators
        "material'code",                                 # Single quote escape
        "material\"code",                                # Double quote escape
        "material_code/*",                               # Block comment
    ]
    for bad_input in dangerous_inputs:
        with pytest.raises(SQLInjectionAlert):
            sanitize_identifier(bad_input)


def test_sanitize_sort_expression_valid():
    """Verify clean sorting clauses are constructed."""
    expr = sanitize_sort_expression("material_code, plant_code", "DESC")
    assert expr == "ORDER BY material_code, plant_code DESC"


def test_sanitize_sort_expression_invalid():
    """Verify invalid parameters in sort expression are rejected."""
    # Invalid direction
    with pytest.raises(SQLInjectionAlert):
        sanitize_sort_expression("material_code", "INJECT")
    
    # Invalid column in multi-column list
    with pytest.raises(SQLInjectionAlert):
        sanitize_sort_expression("material_code, drop table x;", "ASC")
```

---

## 5. Defense in Depth Policy

The Gateway validator is the first line of defense. Security policy demands additional containment:
1. **Read-Only Session Privileges**: All FastAPI gateway warehouse statements must run using database connections/tokens limited strictly to read-only access (`SELECT`) over conformed serving views.
2. **Unity Catalog Authorization**: Enforce active Row-Level Security (RLS) and Column-Level Security (CLS) on all serving views. Attackers trying to scan tables they are unauthorized to see will be blocked by Databricks, even if a sanitization bypass is discovered.
3. **No Direct Execution**: The `QueryExecutor` is strictly prohibited from running multi-statement blocks (stacked queries containing `;`). The Databricks Statement API naturally rejects stacked commands in a single query payload, providing architectural immunity against stacked query dropping.
