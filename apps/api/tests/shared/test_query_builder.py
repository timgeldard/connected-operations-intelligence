from __future__ import annotations

import pytest
from shared_db.query_builder import QueryBuilder


class TestQueryBuilderAggregates:
    def test_allows_safe_aggregate_expression_with_alias(self) -> None:
        builder = QueryBuilder(
            base_table="gold_batch_quality_lot_v",
            columns=["plant_id", "operation_id", "MAX(mic_name) AS mic_name"],
        ).with_group_by("plant_id", "operation_id")

        sql, _ = builder.build()

        assert "MAX(mic_name) AS mic_name" in sql
        assert "GROUP BY plant_id, operation_id" in sql

    def test_rejects_unsafe_parenthesized_expression(self) -> None:
        builder = QueryBuilder(
            base_table="gold_batch_quality_lot_v",
            columns=["SUM(mic_name) /* unsafe */"],
        )

        with pytest.raises(ValueError, match="Invalid column identifier"):
            builder.build()

    def test_mic_guard_ignores_unrelated_mic_substrings(self) -> None:
        builder = QueryBuilder(
            base_table="gold_batch_quality_lot_v",
            columns=["MAX(microbiology_score) AS microbiology_score"],
        )

        sql, _ = builder.build()

        assert "MAX(microbiology_score) AS microbiology_score" in sql

    def test_mic_guard_requires_plant_and_plan_scope(self) -> None:
        builder = QueryBuilder(
            base_table="gold_batch_quality_lot_v",
            columns=["MAX(mic_name) AS mic_name"],
        )

        with pytest.raises(ValueError, match="Plant and Inspection Plan"):
            builder.build()
