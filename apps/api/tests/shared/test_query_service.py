"""Tests for the query_service infrastructure (CacheTier, UserIdentity, QuerySpec, QueryExecutor)."""
import pytest
from shared.query_service.cache_policy import CacheTier
from shared.query_service.databricks_client import (
    DatabricksQueryClient,
    NotImplementedDatabricksClient,
)
from shared.query_service.errors import DatabricksAuthRequiredError, QueryExecutionError
from shared.query_service.identity import UserIdentity
from shared.query_service.query_executor import QueryExecutor
from shared.query_service.query_spec import QuerySpec

# ---------------------------------------------------------------------------
# CacheTier
# ---------------------------------------------------------------------------

class TestCacheTier:
    def test_values_are_strings(self) -> None:
        assert CacheTier.GLOBAL_300S == "global_300s"
        assert CacheTier.PER_USER_60S == "per_user_60s"
        assert CacheTier.NONE == "none"

    def test_all_three_tiers_exist(self) -> None:
        members = {t.value for t in CacheTier}
        assert members == {"global_300s", "per_user_60s", "none"}


# ---------------------------------------------------------------------------
# DatabricksAuthRequiredError
# ---------------------------------------------------------------------------

class TestDatabricksAuthRequiredError:
    def test_carries_user_id(self) -> None:
        err = DatabricksAuthRequiredError("u001")
        assert err.user_id == "u001"

    def test_message_contains_user_id(self) -> None:
        err = DatabricksAuthRequiredError("u001")
        assert "u001" in str(err)

    def test_is_exception(self) -> None:
        assert issubclass(DatabricksAuthRequiredError, Exception)

    def test_no_service_principal_hint_in_message(self) -> None:
        err = DatabricksAuthRequiredError("u001")
        assert "service principal" in str(err).lower()


class TestQueryExecutionError:
    def test_is_exception(self) -> None:
        assert issubclass(QueryExecutionError, Exception)

    def test_can_be_raised_with_message(self) -> None:
        with pytest.raises(QueryExecutionError, match="query failed"):
            raise QueryExecutionError("query failed")


# ---------------------------------------------------------------------------
# UserIdentity
# ---------------------------------------------------------------------------

class TestUserIdentity:
    def test_require_user_oauth_returns_token_when_present(self) -> None:
        identity = UserIdentity(user_id="u001", email="u@example.com", raw_oauth_token="tok123")
        assert identity.require_user_oauth() == "tok123"

    def test_require_user_oauth_raises_when_token_is_none(self) -> None:
        identity = UserIdentity(user_id="u001", raw_oauth_token=None)
        with pytest.raises(DatabricksAuthRequiredError) as exc_info:
            identity.require_user_oauth()
        assert exc_info.value.user_id == "u001"

    def test_require_user_oauth_raises_when_token_is_empty_string(self) -> None:
        identity = UserIdentity(user_id="u001", raw_oauth_token="")
        with pytest.raises(DatabricksAuthRequiredError):
            identity.require_user_oauth()

    def test_email_is_optional(self) -> None:
        identity = UserIdentity(user_id="u001")
        assert identity.email is None

    def test_oauth_token_is_optional(self) -> None:
        identity = UserIdentity(user_id="u001")
        assert identity.raw_oauth_token is None


# ---------------------------------------------------------------------------
# QuerySpec
# ---------------------------------------------------------------------------

class TestQuerySpec:
    def test_required_fields(self) -> None:
        spec = QuerySpec(
            name="test.query",
            module="test",
            endpoint="/api/test",
            sql="SELECT 1",
        )
        assert spec.name == "test.query"
        assert spec.module == "test"
        assert spec.endpoint == "/api/test"
        assert spec.sql == "SELECT 1"

    def test_default_cache_policy(self) -> None:
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        assert spec.cache_policy == CacheTier.NONE

    def test_default_source_badge(self) -> None:
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        assert spec.source_badge == "databricks-api"

    def test_default_max_rows(self) -> None:
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        assert spec.max_rows == 10_000

    def test_default_params_is_empty_dict(self) -> None:
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        assert spec.params == {}

    def test_default_tags_is_empty_list(self) -> None:
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        assert spec.tags == []

    def test_params_not_shared_between_instances(self) -> None:
        spec1 = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        spec2 = QuerySpec(name="y", module="y", endpoint="/y", sql="SELECT 2")
        spec1.params["key"] = "value"
        assert "key" not in spec2.params

    def test_custom_cache_policy(self) -> None:
        spec = QuerySpec(
            name="x", module="x", endpoint="/x", sql="SELECT 1",
            cache_policy=CacheTier.PER_USER_60S,
        )
        assert spec.cache_policy == CacheTier.PER_USER_60S

    def test_catalog_override_defaults_to_none(self) -> None:
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        assert spec.catalog_override is None


# ---------------------------------------------------------------------------
# NotImplementedDatabricksClient
# ---------------------------------------------------------------------------

class TestNotImplementedDatabricksClient:
    async def test_raises_not_implemented(self) -> None:
        client = NotImplementedDatabricksClient()
        with pytest.raises(NotImplementedError, match="ADR-025"):
            await client.execute(
                sql="SELECT 1",
                params={},
                oauth_token="tok",
                warehouse_id="wh",
                timeout_seconds=30,
                tags={},
            )

    def test_is_databricks_query_client_subclass(self) -> None:
        assert issubclass(NotImplementedDatabricksClient, DatabricksQueryClient)


# ---------------------------------------------------------------------------
# QueryExecutor
# ---------------------------------------------------------------------------

class TestQueryExecutor:
    async def test_raises_auth_error_when_token_absent(self) -> None:
        executor = QueryExecutor()
        identity = UserIdentity(user_id="u001", raw_oauth_token=None)
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        with pytest.raises(DatabricksAuthRequiredError):
            await executor.execute(spec, identity)

    async def test_calls_require_user_oauth_before_client(self) -> None:
        """The identity check must run before the client — not after."""
        calls: list[str] = []

        class SpyClient(DatabricksQueryClient):
            async def execute(self, *, sql, params, oauth_token, warehouse_id, timeout_seconds, tags):
                calls.append("client.execute")
                return []

        executor = QueryExecutor(client=SpyClient())
        identity = UserIdentity(user_id="u001", raw_oauth_token=None)
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")

        with pytest.raises(DatabricksAuthRequiredError):
            await executor.execute(spec, identity)

        assert "client.execute" not in calls

    async def test_passes_token_to_client(self) -> None:
        received: list[str] = []

        class CapturingClient(DatabricksQueryClient):
            async def execute(self, *, sql, params, oauth_token, warehouse_id, timeout_seconds, tags):
                received.append(oauth_token)
                return [{"col": "val"}]

        executor = QueryExecutor(client=CapturingClient())
        identity = UserIdentity(user_id="u001", raw_oauth_token="bearer-xyz")
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")

        result = await executor.execute(spec, identity)

        assert received == ["bearer-xyz"]
        assert result == [{"col": "val"}]

    async def test_default_client_is_not_implemented(self) -> None:
        executor = QueryExecutor()
        identity = UserIdentity(user_id="u001", raw_oauth_token="tok")
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        with pytest.raises(NotImplementedError):
            await executor.execute(spec, identity)

    async def test_merges_max_rows_into_params(self) -> None:
        received_params: list[dict] = []

        class CapturingClient(DatabricksQueryClient):
            async def execute(self, *, sql, params, oauth_token, warehouse_id, timeout_seconds, tags):
                received_params.append(params)
                return []

        spec = QuerySpec(
            name="x", module="x", endpoint="/x", sql="SELECT 1 LIMIT :max_rows",
            params={"process_order_id": "100"},
            max_rows=500,
        )
        executor = QueryExecutor(client=CapturingClient())
        identity = UserIdentity(user_id="u001", raw_oauth_token="tok")

        await executor.execute(spec, identity)

        assert received_params[0]["max_rows"] == 500
        assert received_params[0]["process_order_id"] == "100"

    async def test_passes_warehouse_id_to_client(self) -> None:
        received: list[str] = []

        class CapturingClient(DatabricksQueryClient):
            async def execute(self, *, sql, params, oauth_token, warehouse_id, timeout_seconds, tags):
                received.append(warehouse_id)
                return []

        executor = QueryExecutor(client=CapturingClient(), warehouse_id="wh-abc123")
        identity = UserIdentity(user_id="u001", raw_oauth_token="tok")
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")

        await executor.execute(spec, identity)

        assert received == ["wh-abc123"]

    async def test_builds_tags_with_query_metadata(self) -> None:
        received: list[dict] = []

        class CapturingClient(DatabricksQueryClient):
            async def execute(self, *, sql, params, oauth_token, warehouse_id, timeout_seconds, tags):
                received.append(tags)
                return []

        spec = QuerySpec(
            name="poh.get_header", module="poh", endpoint="/api/por/order-header",
            sql="SELECT 1", tags=["poh", "header"],
        )
        executor = QueryExecutor(client=CapturingClient())
        identity = UserIdentity(user_id="user42", raw_oauth_token="tok")

        await executor.execute(spec, identity)

        tags = received[0]
        assert tags["query_name"] == "poh.get_header"
        assert tags["module"] == "poh"
        assert tags["user_id"] == "user42"
        assert tags["poh"] == "true"
        assert tags["header"] == "true"
        assert tags["cache_policy"] == "none"
        assert tags["source_badge"] == "databricks-api"

    async def test_does_not_read_service_principal_env_vars(self, monkeypatch) -> None:
        """Executor must not use DATABRICKS_CLIENT_ID / DATABRICKS_CLIENT_SECRET."""
        monkeypatch.setenv("DATABRICKS_CLIENT_ID", "spn-id")
        monkeypatch.setenv("DATABRICKS_CLIENT_SECRET", "spn-secret")

        received: list[str] = []

        class CapturingClient(DatabricksQueryClient):
            async def execute(self, *, sql, params, oauth_token, warehouse_id, timeout_seconds, tags):
                received.append(oauth_token)
                return []

        executor = QueryExecutor(client=CapturingClient())
        identity = UserIdentity(user_id="u001", raw_oauth_token="user-token")
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")

        await executor.execute(spec, identity)

        assert received == ["user-token"]
        assert "spn-id" not in received[0]
        assert "spn-secret" not in received[0]

    async def test_does_not_mutate_spec_params(self) -> None:
        """max_rows merge must not modify the original spec.params dict."""

        class NoopClient(DatabricksQueryClient):
            async def execute(self, *, sql, params, oauth_token, warehouse_id, timeout_seconds, tags):
                return []

        spec = QuerySpec(
            name="x", module="x", endpoint="/x", sql="SELECT 1",
            params={"process_order_id": "100"},
        )
        original_params = dict(spec.params)
        executor = QueryExecutor(client=NoopClient())
        identity = UserIdentity(user_id="u001", raw_oauth_token="tok")

        await executor.execute(spec, identity)

        assert spec.params == original_params


# ---------------------------------------------------------------------------
# Contract Resolver & Contract Validation
# ---------------------------------------------------------------------------

class TestContractResolver:
    def test_load_manifest_succeeds(self) -> None:
        from shared.query_service.contract_resolver import load_manifest
        manifest = load_manifest()
        assert manifest is not None
        assert "contracts" in manifest

    def test_resolve_contract_view_succeeds(self) -> None:
        from shared.query_service.contract_resolver import resolve_contract_view
        view = resolve_contract_view("warehouse360.inbound_backlog")
        assert view == "vw_consumption_warehouse360_inbound_backlog"

    def test_resolve_contract_view_raises_for_missing(self) -> None:
        from shared.query_service.contract_resolver import resolve_contract_view
        with pytest.raises(ValueError, match="not found in manifest"):
            resolve_contract_view("warehouse360.non_existent_contract")

    def test_resolve_contract_object_resolves_correctly(self, monkeypatch) -> None:
        from shared.query_service.contract_resolver import resolve_contract_object
        monkeypatch.setenv("WH360_CATALOG", "my_catalog")
        monkeypatch.setenv("WH360_SCHEMA", "my_schema")

        obj = resolve_contract_object("warehouse360.inbound_backlog", "wh360")
        assert obj == "`my_catalog`.`my_schema`.`vw_consumption_warehouse360_inbound_backlog`"


class TestQuerySpecContractId:
    def test_init_with_valid_contract_id(self) -> None:
        spec = QuerySpec(
            name="test.query",
            module="wh360",
            endpoint="/api/test",
            sql="SELECT 1",
            contract_id="warehouse360.inbound_backlog",
        )
        assert spec.contract_id == "warehouse360.inbound_backlog"

    def test_init_raises_for_invalid_contract_id(self) -> None:
        with pytest.raises(ValueError, match="not found in manifest"):
            QuerySpec(
                name="test.query",
                module="wh360",
                endpoint="/api/test",
                sql="SELECT 1",
                contract_id="warehouse360.non_existent_contract",
            )

