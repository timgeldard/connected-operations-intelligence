"""Tests for DatabricksRepository retry semantics (total attempts, not ambiguous retries)."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from shared.query_service.errors import (
    DatabricksCatalogTargetError,
    DatabricksConfigError,
    DatabricksPermissionError,
    DatabricksQueryError,
    DatabricksQueryTimeoutError,
    DatabricksRateLimitError,
    DatabricksWarehouseConfigError,
)
from shared.query_service.identity import UserIdentity
from shared.query_service.query_executor import (
    RETRYABLE_ERRORS,
    DatabricksRepository,
)
from shared.query_service.query_spec import QuerySpec


def _spec() -> QuerySpec:
    return QuerySpec(
        name="test.query",
        module="test",
        endpoint="/api/test",
        sql="SELECT 1",
    )


def _identity() -> UserIdentity:
    return UserIdentity(user_id="u001", raw_oauth_token="tok")


class _ScriptedExecutor:
    """QueryExecutor stand-in that returns scripted outcomes per call."""

    def __init__(self, outcomes: list[object]) -> None:
        self._outcomes = outcomes
        self.call_count = 0

    async def execute(self, spec: QuerySpec, identity: UserIdentity) -> list[dict]:
        index = self.call_count
        self.call_count += 1
        if index >= len(self._outcomes):
            raise RuntimeError(f"Unexpected extra execute call (index={index})")
        outcome = self._outcomes[index]
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome  # type: ignore[return-value]


def _repository(
    executor: _ScriptedExecutor,
    *,
    max_attempts: int = 3,
    base_backoff: float = 0.01,
) -> DatabricksRepository:
    return DatabricksRepository(
        executor,  # type: ignore[arg-type]
        _identity(),
        max_attempts=max_attempts,
        base_backoff=base_backoff,
    )


class TestRetryableErrorsTuple:
    def test_includes_timeout_and_rate_limit_only(self) -> None:
        assert DatabricksQueryTimeoutError in RETRYABLE_ERRORS
        assert DatabricksRateLimitError in RETRYABLE_ERRORS
        assert len(RETRYABLE_ERRORS) == 2


class TestDatabricksRepositoryMaxAttempts:
    def test_default_max_attempts_is_three(self) -> None:
        repository = DatabricksRepository(
            _ScriptedExecutor([[]]),  # type: ignore[arg-type]
            _identity(),
        )
        assert repository.max_attempts == 3

    def test_max_attempts_zero_raises_value_error(self) -> None:
        with pytest.raises(ValueError, match="max_attempts must be at least 1"):
            DatabricksRepository(
                _ScriptedExecutor([[]]),  # type: ignore[arg-type]
                _identity(),
                max_attempts=0,
            )


class TestDatabricksRepositoryRetrySemantics:
    async def test_default_three_total_attempts_on_timeout(self) -> None:
        timeout = DatabricksQueryTimeoutError("test.query")
        executor = _ScriptedExecutor([timeout, timeout, timeout])
        repository = _repository(executor)

        with (
            patch("shared.query_service.query_executor.asyncio.sleep", new_callable=AsyncMock) as sleep,
            pytest.raises(DatabricksQueryTimeoutError),
        ):
            await repository.fetch(spec_factory=_spec, mapper=lambda rows: rows)

        assert executor.call_count == 3
        assert sleep.await_count == 2

    async def test_max_attempts_one_makes_single_call_without_sleep(self) -> None:
        timeout = DatabricksQueryTimeoutError("test.query")
        executor = _ScriptedExecutor([timeout])
        repository = _repository(executor, max_attempts=1)

        with (
            patch("shared.query_service.query_executor.asyncio.sleep", new_callable=AsyncMock) as sleep,
            pytest.raises(DatabricksQueryTimeoutError),
        ):
            await repository.fetch(spec_factory=_spec, mapper=lambda rows: rows)

        assert executor.call_count == 1
        sleep.assert_not_awaited()

    async def test_three_failed_attempts_make_three_calls_and_two_sleeps(self) -> None:
        rate_limit = DatabricksRateLimitError("test.query")
        executor = _ScriptedExecutor([rate_limit, rate_limit, rate_limit])
        repository = _repository(executor, max_attempts=3)

        with (
            patch("shared.query_service.query_executor.asyncio.sleep", new_callable=AsyncMock) as sleep,
            pytest.raises(DatabricksRateLimitError),
        ):
            await repository.fetch(spec_factory=_spec, mapper=lambda rows: rows)

        assert executor.call_count == 3
        assert sleep.await_count == 2

    async def test_timeout_then_success_returns_after_two_calls(self) -> None:
        timeout = DatabricksQueryTimeoutError("test.query")
        executor = _ScriptedExecutor([timeout, [{"id": "1"}]])
        repository = _repository(executor)

        with patch(
            "shared.query_service.query_executor.asyncio.sleep",
            new_callable=AsyncMock,
        ) as sleep:
            result, spec = await repository.fetch(spec_factory=_spec, mapper=lambda rows: rows)

        assert executor.call_count == 2
        assert sleep.await_count == 1
        assert result == [{"id": "1"}]
        assert spec.name == "test.query"

    async def test_rate_limit_then_success_returns_after_two_calls(self) -> None:
        rate_limit = DatabricksRateLimitError("test.query")
        executor = _ScriptedExecutor([rate_limit, [{"id": "2"}]])
        repository = _repository(executor)

        with patch(
            "shared.query_service.query_executor.asyncio.sleep",
            new_callable=AsyncMock,
        ):
            result, _ = await repository.fetch(spec_factory=_spec, mapper=lambda rows: rows)

        assert executor.call_count == 2
        assert result == [{"id": "2"}]

    async def test_timeout_then_query_error_stops_on_non_retryable(self) -> None:
        timeout = DatabricksQueryTimeoutError("test.query")
        query_error = DatabricksQueryError("test.query", "syntax error")
        executor = _ScriptedExecutor([timeout, query_error])
        repository = _repository(executor)

        with (
            patch("shared.query_service.query_executor.asyncio.sleep", new_callable=AsyncMock) as sleep,
            pytest.raises(DatabricksQueryError),
        ):
            await repository.fetch(spec_factory=_spec, mapper=lambda rows: rows)

        assert executor.call_count == 2
        assert sleep.await_count == 1

    async def test_last_retryable_error_preserved_when_all_attempts_fail(self) -> None:
        first = DatabricksQueryTimeoutError("first")
        last = DatabricksRateLimitError("last")
        executor = _ScriptedExecutor([first, first, last])
        repository = _repository(executor, max_attempts=3)

        with (
            patch("shared.query_service.query_executor.asyncio.sleep", new_callable=AsyncMock),
            pytest.raises(DatabricksRateLimitError) as exc_info,
        ):
            await repository.fetch(spec_factory=_spec, mapper=lambda rows: rows)

        assert exc_info.value is last


@pytest.mark.parametrize(
    "error",
    [
        DatabricksPermissionError("test.query"),
        DatabricksWarehouseConfigError("wh-1"),
        DatabricksConfigError(["MISSING_CATALOG"]),
        DatabricksCatalogTargetError(),
        DatabricksQueryError("test.query", "failed"),
    ],
)
class TestDatabricksRepositoryNonRetryableErrors:
    async def test_not_retried(self, error: Exception) -> None:
        executor = _ScriptedExecutor([error, [{"id": "should-not-reach"}]])
        repository = _repository(executor)

        with (
            patch("shared.query_service.query_executor.asyncio.sleep", new_callable=AsyncMock) as sleep,
            pytest.raises(type(error)),
        ):
            await repository.fetch(spec_factory=_spec, mapper=lambda rows: rows)

        assert executor.call_count == 1
        sleep.assert_not_awaited()
