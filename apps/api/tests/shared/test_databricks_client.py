"""Tests for the Databricks query client implementations (ADR-025)."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient
from shared.query_service.databricks_client import (
    DatabricksHttpClientPool,
    StatementApiDatabricksClient,
    _infer_param_type,
    _parse_result,
    databricks_http_client_pool,
)
from shared.query_service.errors import (
    DatabricksAuthRequiredError,
    DatabricksPermissionError,
    DatabricksQueryError,
    DatabricksQueryTimeoutError,
    DatabricksRateLimitError,
    DatabricksWarehouseConfigError,
)


@pytest.fixture(autouse=True)
async def reset_shared_databricks_clients() -> None:
    await StatementApiDatabricksClient.aclose_shared_clients()
    yield
    await StatementApiDatabricksClient.aclose_shared_clients()


# ---------------------------------------------------------------------------
# _infer_param_type
# ---------------------------------------------------------------------------

class TestInferParamType:
    def test_string_value(self) -> None:
        assert _infer_param_type("hello") == "STRING"

    def test_int_value(self) -> None:
        assert _infer_param_type(42) == "INT"

    def test_float_value(self) -> None:
        assert _infer_param_type(3.14) == "DOUBLE"

    def test_bool_true_is_boolean_not_int(self) -> None:
        assert _infer_param_type(True) == "BOOLEAN"

    def test_bool_false_is_boolean_not_int(self) -> None:
        assert _infer_param_type(False) == "BOOLEAN"

    def test_none_raises_value_error(self) -> None:
        with pytest.raises(ValueError, match="None is not a valid"):
            _infer_param_type(None)

    def test_large_int_is_int(self) -> None:
        assert _infer_param_type(10_000) == "INT"


# ---------------------------------------------------------------------------
# _parse_result
# ---------------------------------------------------------------------------

class TestParseResult:
    def test_returns_list_of_dicts(self) -> None:
        data = {
            "manifest": {"schema": {"columns": [{"name": "a"}, {"name": "b"}]}},
            "result": {"data_array": [["v1", "v2"], ["v3", "v4"]]},
        }
        rows = _parse_result(data, "test.query")
        assert rows == [{"a": "v1", "b": "v2"}, {"a": "v3", "b": "v4"}]

    def test_empty_data_array(self) -> None:
        data = {
            "manifest": {"schema": {"columns": [{"name": "col"}]}},
            "result": {"data_array": []},
        }
        assert _parse_result(data, "test") == []

    def test_null_data_array_returns_empty(self) -> None:
        data = {
            "manifest": {"schema": {"columns": [{"name": "col"}]}},
            "result": {},
        }
        assert _parse_result(data, "test") == []

    def test_missing_manifest_raises_query_error(self) -> None:
        with pytest.raises(DatabricksQueryError):
            _parse_result({}, "test.query")

    def test_malformed_columns_raises_query_error(self) -> None:
        data = {"manifest": {"schema": {"columns": "not-a-list"}}, "result": {}}
        with pytest.raises(DatabricksQueryError):
            _parse_result(data, "test.query")


# ---------------------------------------------------------------------------
# StatementApiDatabricksClient helpers
# ---------------------------------------------------------------------------

def _make_statement_response(
    state: str,
    columns: list[str] | None = None,
    data_array: list[list[object]] | None = None,
    error_msg: str | None = None,
    status_code: int = 200,
) -> MagicMock:
    mock = MagicMock()
    mock.status_code = status_code
    mock.is_success = status_code < 400
    mock.text = ""

    body: dict = {"status": {"state": state}}
    if state == "SUCCEEDED":
        body["manifest"] = {"schema": {"columns": [{"name": c} for c in (columns or [])]}}
        body["result"] = {"data_array": data_array or []}
    elif state == "FAILED":
        body["status"]["error"] = {"message": error_msg or "Query failed"}

    mock.json.return_value = body
    return mock


def _make_http_client_mock(response: MagicMock) -> AsyncMock:
    """Return a mock httpx.AsyncClient with a configured post method."""
    http_client = AsyncMock()
    http_client.is_closed = False
    http_client.post = AsyncMock(return_value=response)
    return http_client


# ---------------------------------------------------------------------------
# StatementApiDatabricksClient.execute
# ---------------------------------------------------------------------------

class TestStatementApiDatabricksClient:
    _BASE_KWARGS: dict = {
        "sql": "SELECT col1, col2 FROM t WHERE id = :id",
        "params": {"id": "123", "max_rows": 100},
        "oauth_token": "user-token",
        "warehouse_id": "wh-abc",
        "timeout_seconds": 30,
        "tags": {"query_name": "test.query", "user_id": "u001"},
    }

    async def test_succeeded_state_returns_rows(self) -> None:
        response = _make_statement_response(
            "SUCCEEDED",
            columns=["col1", "col2"],
            data_array=[["v1", "v2"]],
        )
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            rows = await client.execute(**self._BASE_KWARGS)

        assert rows == [{"col1": "v1", "col2": "v2"}]

    async def test_succeeded_with_multiple_rows(self) -> None:
        response = _make_statement_response(
            "SUCCEEDED",
            columns=["a", "b"],
            data_array=[["1", "x"], ["2", "y"]],
        )
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            rows = await client.execute(**self._BASE_KWARGS)

        assert len(rows) == 2
        assert rows[0] == {"a": "1", "b": "x"}
        assert rows[1] == {"a": "2", "b": "y"}

    async def test_succeeded_empty_result(self) -> None:
        response = _make_statement_response(
            "SUCCEEDED", columns=["col"], data_array=[]
        )
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            rows = await client.execute(**self._BASE_KWARGS)

        assert rows == []

    async def test_failed_state_raises_query_error(self) -> None:
        response = _make_statement_response("FAILED", error_msg="Syntax error near SELECT")
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            with pytest.raises(DatabricksQueryError) as exc_info:
                await client.execute(**self._BASE_KWARGS)

        assert "Syntax error" in exc_info.value.detail

    async def test_canceled_state_raises_timeout_error(self) -> None:
        response = _make_statement_response("CANCELED")
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            with pytest.raises(DatabricksQueryTimeoutError):
                await client.execute(**self._BASE_KWARGS)

    async def test_closed_state_raises_timeout_error(self) -> None:
        response = _make_statement_response("CLOSED")
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            with pytest.raises(DatabricksQueryTimeoutError):
                await client.execute(**self._BASE_KWARGS)

    async def test_unexpected_state_raises_query_error(self) -> None:
        response = _make_statement_response("PENDING")
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            with pytest.raises(DatabricksQueryError, match="PENDING"):
                await client.execute(**self._BASE_KWARGS)

    async def test_http_401_raises_auth_required_error(self) -> None:
        response = _make_statement_response("FAILED", status_code=401)
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            with pytest.raises(DatabricksAuthRequiredError):
                await client.execute(**self._BASE_KWARGS)

    async def test_http_500_raises_query_error(self) -> None:
        response = _make_statement_response("FAILED", status_code=500)
        response.text = "Internal server error"
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            with pytest.raises(DatabricksQueryError):
                await client.execute(**self._BASE_KWARGS)

    async def test_sends_bearer_token_in_header(self) -> None:
        """OAuth token must be forwarded via Authorization: Bearer."""
        captured_headers: list[dict] = []
        response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])

        http_client = AsyncMock()
        http_client.post = AsyncMock(return_value=response)

        async def capture_post(url, *, headers, json, **_):
            captured_headers.append(headers)
            return response

        http_client.post = capture_post
        with patch("httpx.AsyncClient", return_value=http_client):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            await client.execute(**self._BASE_KWARGS)

        assert captured_headers[0]["Authorization"] == "Bearer user-token"

    async def test_sends_parameters_in_request_body(self) -> None:
        """Parameters must be forwarded to Statement API as typed list."""
        captured_bodies: list[dict] = []
        response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])

        http_client = AsyncMock()

        async def capture_post(url, *, headers, json, **_):
            captured_bodies.append(json)
            return response

        http_client.post = capture_post
        with patch("httpx.AsyncClient", return_value=http_client):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            await client.execute(
                sql="SELECT 1",
                params={"p_str": "hello", "p_int": 42},
                oauth_token="tok",
                warehouse_id="wh",
                timeout_seconds=30,
                tags={},
            )

        params = captured_bodies[0]["parameters"]
        param_map = {p["name"]: p for p in params}
        assert param_map["p_str"]["type"] == "STRING"
        assert param_map["p_str"]["value"] == "hello"
        assert param_map["p_int"]["type"] == "INT"
        assert param_map["p_int"]["value"] == "42"

    async def test_uses_wait_timeout_from_timeout_seconds(self) -> None:
        captured_bodies: list[dict] = []
        response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])

        http_client = AsyncMock()

        async def capture_post(url, *, headers, json, **_):
            captured_bodies.append(json)
            return response

        http_client.post = capture_post
        with patch("httpx.AsyncClient", return_value=http_client):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            await client.execute(
                sql="SELECT 1", params={}, oauth_token="tok",
                warehouse_id="wh", timeout_seconds=45, tags={},
            )

        assert captured_bodies[0]["wait_timeout"] == "45s"
        assert captured_bodies[0]["on_wait_timeout"] == "CANCEL"

    async def test_host_trailing_slash_stripped(self) -> None:
        captured_urls: list[str] = []
        response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])

        http_client = AsyncMock()

        async def capture_post(url, *, headers, json, **_):
            captured_urls.append(url)
            return response

        http_client.post = capture_post
        with patch("httpx.AsyncClient", return_value=http_client):
            client = StatementApiDatabricksClient(host="test.databricks.com/")
            await client.execute(
                sql="SELECT 1", params={}, oauth_token="tok",
                warehouse_id="wh", timeout_seconds=30, tags={},
            )

        assert captured_urls[0] == "https://test.databricks.com/api/2.0/sql/statements"
        assert "//" not in captured_urls[0].replace("https://", "")

    async def test_no_parameters_key_when_params_empty(self) -> None:
        captured_bodies: list[dict] = []
        response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])

        http_client = AsyncMock()

        async def capture_post(url, *, headers, json, **_):
            captured_bodies.append(json)
            return response

        http_client.post = capture_post
        with patch("httpx.AsyncClient", return_value=http_client):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            await client.execute(
                sql="SELECT 1", params={}, oauth_token="tok",
                warehouse_id="wh", timeout_seconds=30, tags={},
            )

        assert "parameters" not in captured_bodies[0]

    async def test_reuses_shared_http_client_across_instances(self) -> None:
        response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])
        shared_client = _make_http_client_mock(response)

        with patch("httpx.AsyncClient", return_value=shared_client) as factory:
            first = StatementApiDatabricksClient(host="test.databricks.com")
            second = StatementApiDatabricksClient(host="https://test.databricks.com")
            await first.execute(**self._BASE_KWARGS)
            await second.execute(**self._BASE_KWARGS)

        assert factory.call_count == 1
        assert shared_client.post.await_count == 2

    async def test_aclose_shared_clients_closes_cached_clients(self) -> None:
        response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])
        shared_client = _make_http_client_mock(response)

        with patch("httpx.AsyncClient", return_value=shared_client):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            await client.execute(**self._BASE_KWARGS)

        await StatementApiDatabricksClient.aclose_shared_clients()

        shared_client.aclose.assert_awaited_once()

    async def test_pool_returns_same_client_for_same_host_and_timeout(self) -> None:
        first_client = AsyncMock()
        first_client.is_closed = False
        pool = DatabricksHttpClientPool()

        with patch("httpx.AsyncClient", return_value=first_client) as factory:
            first = pool.get_client(host="https://test.databricks.com/", timeout_seconds=30)
            second = pool.get_client(host="test.databricks.com", timeout_seconds=30)

        assert first is second
        assert factory.call_count == 1

    async def test_pool_keys_clients_by_timeout(self) -> None:
        pool = DatabricksHttpClientPool()

        with patch("httpx.AsyncClient", side_effect=[AsyncMock(), AsyncMock()]) as factory:
            first = pool.get_client(host="test.databricks.com", timeout_seconds=30)
            second = pool.get_client(host="test.databricks.com", timeout_seconds=45)

        assert first is not second
        assert factory.call_count == 2

    async def test_pool_closes_all_managed_clients(self) -> None:
        first_client = AsyncMock()
        first_client.is_closed = False
        second_client = AsyncMock()
        second_client.is_closed = False
        pool = DatabricksHttpClientPool()

        with patch("httpx.AsyncClient", side_effect=[first_client, second_client]):
            pool.get_client(host="test.databricks.com", timeout_seconds=30)
            pool.get_client(host="test.databricks.com", timeout_seconds=45)

        await pool.aclose()

        first_client.aclose.assert_awaited_once()
        second_client.aclose.assert_awaited_once()

    async def test_pool_close_is_idempotent(self) -> None:
        client = AsyncMock()
        client.is_closed = False
        pool = DatabricksHttpClientPool()

        with patch("httpx.AsyncClient", return_value=client):
            pool.get_client(host="test.databricks.com", timeout_seconds=30)

        await pool.aclose()
        await pool.aclose()

        client.aclose.assert_awaited_once()

    async def test_pool_recreates_after_closed_client(self) -> None:
        closed_client = AsyncMock()
        closed_client.is_closed = True
        open_client = AsyncMock()
        open_client.is_closed = False
        pool = DatabricksHttpClientPool()

        with patch("httpx.AsyncClient", side_effect=[closed_client, open_client]):
            first = pool.get_client(host="test.databricks.com", timeout_seconds=30)
            first.is_closed = True
            second = pool.get_client(host="test.databricks.com", timeout_seconds=30)

        assert first is closed_client
        assert second is open_client

    async def test_timeout_path_keeps_client_pool_owned_until_close(self) -> None:
        http_client = AsyncMock()
        http_client.is_closed = False
        http_client.post = AsyncMock(side_effect=httpx.TimeoutException("timed out"))
        pool = DatabricksHttpClientPool()

        with patch("httpx.AsyncClient", return_value=http_client):
            client = StatementApiDatabricksClient(host="test.databricks.com", pool=pool)
            with pytest.raises(DatabricksQueryTimeoutError):
                await client.execute(**self._BASE_KWARGS)

        http_client.aclose.assert_not_awaited()

        await pool.aclose()

        http_client.aclose.assert_awaited_once()

    async def test_http_error_path_keeps_client_pool_owned_until_close(self) -> None:
        response = _make_statement_response("FAILED", status_code=500)
        response.text = "Internal server error"
        http_client = _make_http_client_mock(response)
        pool = DatabricksHttpClientPool()

        with patch("httpx.AsyncClient", return_value=http_client):
            client = StatementApiDatabricksClient(host="test.databricks.com", pool=pool)
            with pytest.raises(DatabricksQueryError):
                await client.execute(**self._BASE_KWARGS)

        http_client.aclose.assert_not_awaited()

        await pool.aclose()

        http_client.aclose.assert_awaited_once()

    def test_fastapi_lifespan_closes_databricks_pool(self) -> None:
        from main import app

        with patch.object(databricks_http_client_pool, "aclose", new_callable=AsyncMock) as close:
            with TestClient(app):
                pass

        close.assert_awaited_once()

    # ── Host normalisation ──────────────────────────────────────────────────

    async def test_host_with_https_scheme_normalised(self) -> None:
        captured_urls: list[str] = []
        response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])

        http_client = AsyncMock()

        async def capture_post(url, *, headers, json, **_):
            captured_urls.append(url)
            return response

        http_client.post = capture_post
        with patch("httpx.AsyncClient", return_value=http_client):
            client = StatementApiDatabricksClient(host="https://myworkspace.azuredatabricks.net")
            await client.execute(
                sql="SELECT 1", params={}, oauth_token="tok",
                warehouse_id="wh", timeout_seconds=30, tags={},
            )

        assert captured_urls[0] == "https://myworkspace.azuredatabricks.net/api/2.0/sql/statements"
        assert "https://https://" not in captured_urls[0]

    async def test_host_with_http_scheme_normalised(self) -> None:
        captured_urls: list[str] = []
        response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])

        http_client = AsyncMock()

        async def capture_post(url, *, headers, json, **_):
            captured_urls.append(url)
            return response

        http_client.post = capture_post
        with patch("httpx.AsyncClient", return_value=http_client):
            client = StatementApiDatabricksClient(host="http://myworkspace.azuredatabricks.net")
            await client.execute(
                sql="SELECT 1", params={}, oauth_token="tok",
                warehouse_id="wh", timeout_seconds=30, tags={},
            )

        assert captured_urls[0] == "https://myworkspace.azuredatabricks.net/api/2.0/sql/statements"

    async def test_host_without_scheme_preserved(self) -> None:
        captured_urls: list[str] = []
        response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])

        http_client = AsyncMock()

        async def capture_post(url, *, headers, json, **_):
            captured_urls.append(url)
            return response

        http_client.post = capture_post
        with patch("httpx.AsyncClient", return_value=http_client):
            client = StatementApiDatabricksClient(host="myworkspace.azuredatabricks.net")
            await client.execute(
                sql="SELECT 1", params={}, oauth_token="tok",
                warehouse_id="wh", timeout_seconds=30, tags={},
            )

        assert captured_urls[0] == "https://myworkspace.azuredatabricks.net/api/2.0/sql/statements"

    async def test_host_with_leading_whitespace_normalised(self) -> None:
        """Whitespace in DATABRICKS_HOST env value must not produce an invalid URL."""
        captured_urls: list[str] = []
        response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])

        http_client = AsyncMock()

        async def capture_post(url, *, headers, json, **_):
            captured_urls.append(url)
            return response

        http_client.post = capture_post
        with patch("httpx.AsyncClient", return_value=http_client):
            client = StatementApiDatabricksClient(host="  myworkspace.azuredatabricks.net  ")
            await client.execute(
                sql="SELECT 1", params={}, oauth_token="tok",
                warehouse_id="wh", timeout_seconds=30, tags={},
            )

        assert captured_urls[0] == "https://myworkspace.azuredatabricks.net/api/2.0/sql/statements"

    # ── HTTP error mapping ──────────────────────────────────────────────────

    async def test_http_403_raises_permission_error(self) -> None:
        response = MagicMock()
        response.status_code = 403
        response.is_success = False
        response.text = "Forbidden"

        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            with pytest.raises(DatabricksPermissionError):
                await client.execute(**self._BASE_KWARGS)

    async def test_http_404_raises_warehouse_config_error(self) -> None:
        response = MagicMock()
        response.status_code = 404
        response.is_success = False
        response.text = "Not Found"

        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            with pytest.raises(DatabricksWarehouseConfigError):
                await client.execute(**self._BASE_KWARGS)

    async def test_http_429_raises_rate_limit_error(self) -> None:
        response = MagicMock()
        response.status_code = 429
        response.is_success = False
        response.text = "Too Many Requests"

        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            with pytest.raises(DatabricksRateLimitError):
                await client.execute(**self._BASE_KWARGS)

    # ── Token safety ────────────────────────────────────────────────────────

    async def test_oauth_token_not_present_in_log_records(self) -> None:
        """The raw OAuth token must never appear in log output."""
        import logging

        log_records: list[str] = []

        class CapturingHandler(logging.Handler):
            def emit(self, record: logging.LogRecord) -> None:
                log_records.append(self.format(record))

        handler = CapturingHandler()
        logger = logging.getLogger("shared.query_service.databricks_client")
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)

        try:
            response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])
            with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
                client = StatementApiDatabricksClient(host="test.databricks.com")
                secret_token = "super-secret-oauth-bearer-xyz-abc-123"
                await client.execute(
                    sql="SELECT 1",
                    params={},
                    oauth_token=secret_token,
                    warehouse_id="wh",
                    timeout_seconds=30,
                    tags={"query_name": "test", "user_id": "u1"},
                )
        finally:
            logger.removeHandler(handler)

        for record in log_records:
            assert secret_token not in record, (
                f"OAuth token leaked into log record: {record!r}"
            )
