"""Read-only SQL query builder for gold-layer views."""

from __future__ import annotations

__all__ = ["QueryBuilder"]

import re
from dataclasses import dataclass, field
from typing import Any, Optional

from shared_db.core import sql_param

_IDENTIFIER_SEGMENT_RE = re.compile(r"^[A-Za-z0-9_]+$")
_AGGREGATE_EXPR_RE = re.compile(
    r"^(?P<func>AVG|COUNT|MAX|MIN|SUM)\(\s*(?P<arg>[^()]+?)\s*\)"
    r"(?:\s+AS\s+(?P<alias>[A-Za-z_][A-Za-z0-9_]*))?$",
    re.IGNORECASE,
)
_MIC_IDENTIFIER_RE = re.compile(r"\b(mic|mic_id|mic_name|unified_mic_key)\b", re.IGNORECASE)
_PLANT_IDENTIFIER_RE = re.compile(r"\bplant_id\b", re.IGNORECASE)
_PLAN_IDENTIFIER_RE = re.compile(
    r"\b(operation_id|inspection_lot_id|inspection_plan)\b",
    re.IGNORECASE,
)


def _is_safe_identifier(identifier: str, *, allow_qualified: bool = True) -> bool:
    """Return whether an identifier is safely usable in generated SQL.

    Args:
        identifier: Identifier text to validate.
        allow_qualified: Whether ``.``-qualified names are accepted.

    Returns:
        True when the identifier is composed only of safe bare or backtick-quoted
        segments; otherwise False.
    """
    if not identifier or identifier.strip() != identifier:
        return False
    if not allow_qualified and "." in identifier:
        return False
    parts = identifier.split(".")
    for part in parts:
        if not part:
            return False
        if part.startswith("`") or part.endswith("`"):
            if not (part.startswith("`") and part.endswith("`") and part.count("`") == 2):
                return False
            part = part[1:-1]
        if not _IDENTIFIER_SEGMENT_RE.fullmatch(part):
            return False
    return True


def _is_allowed_aggregate_expression(expression: str) -> bool:
    """Return whether *expression* is a supported aggregate select item."""
    match = _AGGREGATE_EXPR_RE.fullmatch(expression)
    if not match:
        return False

    arg = match.group("arg").strip()
    if arg.upper().startswith("DISTINCT "):
        arg = arg[9:].strip()

    if arg != "*" and not _is_safe_identifier(arg):
        return False

    alias = match.group("alias")
    return alias is None or _is_safe_identifier(alias, allow_qualified=False)


@dataclass
class QueryBuilder:
    """Standardized query builder for Databricks SQL cockpits.

    Handles plant filtering, pagination, and Liquid Clustering hints.
    All identifiers (table, columns, order-by) are validated before use to
    prevent SQL injection from programmer errors.
    """

    base_table: str
    columns: list[str] = field(default_factory=lambda: ["*"])
    filters: list[str] = field(default_factory=list)
    params: list[dict[str, Any]] = field(default_factory=list)
    order_by: Optional[str] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    group_by_columns: list[str] = field(default_factory=list)
    clustering_columns: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        """Validate base_table on construction."""
        if not _is_safe_identifier(self.base_table):
            raise ValueError(f"Invalid base table identifier: {self.base_table!r}")

    def with_plant_filter(self, plant_id: Optional[str]) -> "QueryBuilder":
        """Add a PLANT_ID filter if plant_id is provided.

        Args:
            plant_id: Plant identifier to filter on, or ``None`` to skip.

        Returns:
            Self, for method chaining.
        """
        if plant_id:
            self.filters.append("PLANT_ID = :plant_id")
            self.params.append(sql_param("plant_id", plant_id))
        return self

    def with_pagination(self, limit: int, offset: int = 0) -> "QueryBuilder":
        """Set LIMIT and OFFSET.

        Args:
            limit: Maximum rows to return.
            offset: Number of rows to skip before returning results.

        Returns:
            Self, for method chaining.
        """
        self.limit = limit
        self.offset = offset
        return self

    def with_order_by(self, order_by: str) -> "QueryBuilder":
        """Set ORDER BY clause.

        Args:
            order_by: Column identifier to order by.  Must be a valid identifier
                (letters, digits, underscores, dots).

        Returns:
            Self, for method chaining.

        Raises:
            ValueError: When ``order_by`` contains unsafe characters.
        """
        if not _is_safe_identifier(order_by):
            raise ValueError(f"Invalid ORDER BY identifier: {order_by!r}")
        self.order_by = order_by
        return self

    def with_group_by(self, *columns: str) -> "QueryBuilder":
        """Set GROUP BY clause.

        Args:
            *columns: Column identifiers to group by.

        Returns:
            Self, for method chaining.

        Raises:
            ValueError: When any column contains unsafe characters.
        """
        for col in columns:
            if not _is_safe_identifier(col):
                raise ValueError(f"Invalid GROUP BY identifier: {col!r}")
        self.group_by_columns.extend(columns)
        return self

    def with_clustering_hint(self, *columns: str) -> "QueryBuilder":
        """Add optimizer-hint column names.

        Args:
            *columns: Column names to embed in a clustering comment.  Each must
                be a safe identifier.

        Returns:
            Self, for method chaining.

        Raises:
            ValueError: When any column contains unsafe characters.
        """
        for col in columns:
            if not _is_safe_identifier(col):
                raise ValueError(f"Invalid clustering column identifier: {col!r}")
        self.clustering_columns.extend(columns)
        return self

    def build(self) -> tuple[str, list[dict[str, Any]]]:
        """Return the SQL statement and bound parameters.

        Returns:
            Tuple of ``(sql_statement, params_list)``.

        Raises:
            ValueError: When any column in ``self.columns`` is unsafe, or when
                        aggregations violate data grouping rules.
        """
        for col in self.columns:
            if col != "*" and not _is_safe_identifier(col):
                if not _is_allowed_aggregate_expression(col):
                    raise ValueError(f"Invalid column identifier: {col!r}")
        cols = ", ".join(self.columns)

        # Enforce MIC grouping rule if aggregations or GROUP BY are used
        is_aggregated = bool(self.group_by_columns) or any(
            _is_allowed_aggregate_expression(c) for c in self.columns
        )
        if is_aggregated:
            query_text = cols + " " + " ".join(self.filters) + " " + " ".join(self.group_by_columns)
            if _MIC_IDENTIFIER_RE.search(query_text):
                has_plant = _PLANT_IDENTIFIER_RE.search(query_text) is not None
                has_plan = _PLAN_IDENTIFIER_RE.search(query_text) is not None
                if not (has_plant and has_plan):
                    raise ValueError(
                        "Severe cross-plant contamination risk: Aggregations on MICs MUST be scoped to a local "
                        "Plant and Inspection Plan. Please include plant_id AND operation_id/inspection_lot_id "
                        "in your grouping or filters."
                    )

        hints = ""
        if self.clustering_columns:
            hints = f"/* clustering_hint: {', '.join(self.clustering_columns)} */\n"

        sql = f"{hints}SELECT {cols}\nFROM {self.base_table}"

        if self.filters:
            sql += "\nWHERE " + " AND ".join(self.filters)

        if self.group_by_columns:
            sql += f"\nGROUP BY {', '.join(self.group_by_columns)}"

        if self.order_by:
            sql += f"\nORDER BY {self.order_by}"

        if self.limit is not None:
            sql += f"\nLIMIT {self.limit}"
            if self.offset is not None and self.offset > 0:
                sql += f" OFFSET {self.offset}"

        return sql, self.params
