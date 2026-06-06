"""Tests for the Query Cache mechanism, including CacheStore, key security, and repository integration."""
import time
from unittest.mock import AsyncMock, patch

import pytest
from shared.query_service.cache import InMemoryCacheStore, get_cache_store
from shared.query_service.cache_policy import CacheTier
from shared.query_service.identity import UserIdentity
from shared.query_service.query_executor import DatabricksRepository
from shared.query_service.query_spec import QuerySpec


@pytest.fixture(autouse=True)
async def clear_cache():
    store = get_cache_store()
    await store.clear()
    yield
    await store.clear()


def _spec(policy: CacheTier = CacheTier.PER_USER_60S) -> QuerySpec:
    return QuerySpec(
        name="test.query",
        module="test",
        endpoint="/api/test",
        sql="SELECT 1",
        cache_policy=policy,
        params={"param1": "val1"},
    )


def _identity(user_id: str = "u001", catalog: str = "allowed_catalog") -> UserIdentity:
    return UserIdentity(user_id=user_id, raw_oauth_token="tok", catalog_target=catalog)


class _MockExecutor:
    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows
        self.call_count = 0

    async def execute(self, spec: QuerySpec, identity: UserIdentity) -> list[dict]:
        self.call_count += 1
        return self.rows


@pytest.mark.asyncio
async def test_cache_store_ttl():
    store = InMemoryCacheStore()
    key = "test_key"
    data = [{"col": "val"}]

    # Store with short TTL
    await store.set(key, data, ttl=1)
    entry = await store.get(key)
    assert entry is not None
    assert entry.data == data

    # Wait for expiration
    time.sleep(1.1)
    entry_expired = await store.get(key)
    assert entry_expired is None


@pytest.mark.asyncio
async def test_repository_cache_miss_then_hit(monkeypatch):
    monkeypatch.setenv("ENABLE_QUERY_CACHE", "true")
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog")

    executor = _MockExecutor([{"result": 42}])
    repo = DatabricksRepository(executor=executor, identity=_identity())

    # 1. MISS
    res, spec = await repo.fetch(lambda: _spec(CacheTier.PER_USER_60S), lambda r: r)
    assert res == [{"result": 42}]
    assert executor.call_count == 1
    assert spec.cache_status == "MISS"
    assert spec.cache_age_seconds == 0
    assert spec.cache_ttl_seconds == 60

    # 2. HIT
    res2, spec2 = await repo.fetch(lambda: _spec(CacheTier.PER_USER_60S), lambda r: r)
    assert res2 == [{"result": 42}]
    assert executor.call_count == 1  # Should not increment
    assert spec2.cache_status == "HIT"
    assert spec2.cache_age_seconds >= 0
    assert spec2.cache_ttl_seconds == 60


@pytest.mark.asyncio
async def test_repository_cache_bypass(monkeypatch):
    monkeypatch.setenv("ENABLE_QUERY_CACHE", "true")
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog")

    executor = _MockExecutor([{"result": 42}])
    repo = DatabricksRepository(executor=executor, identity=_identity())

    # NONE policy should bypass cache
    res, spec = await repo.fetch(lambda: _spec(CacheTier.NONE), lambda r: r)
    assert spec.cache_status == "BYPASS"
    assert executor.call_count == 1

    # Second call should still execute
    res2, spec2 = await repo.fetch(lambda: _spec(CacheTier.NONE), lambda r: r)
    assert spec2.cache_status == "BYPASS"
    assert executor.call_count == 2


@pytest.mark.asyncio
async def test_repository_cache_disabled(monkeypatch):
    monkeypatch.setenv("ENABLE_QUERY_CACHE", "false")
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog")

    executor = _MockExecutor([{"result": 42}])
    repo = DatabricksRepository(executor=executor, identity=_identity())

    # Caching disabled via environment variable
    res, spec = await repo.fetch(lambda: _spec(CacheTier.PER_USER_60S), lambda r: r)
    assert spec.cache_status == "DISABLED"
    assert executor.call_count == 1


@pytest.mark.asyncio
async def test_cache_key_isolation_by_user(monkeypatch):
    monkeypatch.setenv("ENABLE_QUERY_CACHE", "true")
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog")

    # User 1 MISS
    executor = _MockExecutor([{"user": "u001"}])
    repo1 = DatabricksRepository(executor=executor, identity=_identity(user_id="u001"))
    _, spec1 = await repo1.fetch(lambda: _spec(CacheTier.PER_USER_60S), lambda r: r)
    assert spec1.cache_status == "MISS"

    # User 2 should MISS (isolated user context)
    repo2 = DatabricksRepository(executor=executor, identity=_identity(user_id="u002"))
    _, spec2 = await repo2.fetch(lambda: _spec(CacheTier.PER_USER_60S), lambda r: r)
    assert spec2.cache_status == "MISS"


@pytest.mark.asyncio
async def test_cache_key_isolation_by_catalog(monkeypatch):
    monkeypatch.setenv("ENABLE_QUERY_CACHE", "true")
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog,other_catalog")

    # Catalog 1 MISS
    executor = _MockExecutor([{"catalog": "allowed_catalog"}])
    repo1 = DatabricksRepository(executor=executor, identity=_identity(catalog="allowed_catalog"))
    _, spec1 = await repo1.fetch(lambda: _spec(CacheTier.PER_USER_60S), lambda r: r)
    assert spec1.cache_status == "MISS"

    # Catalog 2 should MISS (isolated catalog context)
    repo2 = DatabricksRepository(executor=executor, identity=_identity(catalog="other_catalog"))
    _, spec2 = await repo2.fetch(lambda: _spec(CacheTier.PER_USER_60S), lambda r: r)
    assert spec2.cache_status == "MISS"


@pytest.mark.asyncio
async def test_cache_store_graceful_degradation(monkeypatch):
    monkeypatch.setenv("ENABLE_QUERY_CACHE", "true")
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog")

    # Mock CacheStore to throw exceptions
    mock_store = AsyncMock()
    mock_store.get.side_effect = Exception("Redis connection refused")
    mock_store.set.side_effect = Exception("Redis connection refused")

    with patch("shared.query_service.cache.get_cache_store", return_value=mock_store):
        executor = _MockExecutor([{"result": 42}])
        repo = DatabricksRepository(executor=executor, identity=_identity())

        # fetch should still succeed even though CacheStore threw an exception during get
        res, spec = await repo.fetch(lambda: _spec(CacheTier.PER_USER_60S), lambda r: r)
        assert res == [{"result": 42}]
        assert executor.call_count == 1
        assert spec.cache_status == "BYPASS"

        # Now mock get to succeed but set to fail
        mock_store2 = AsyncMock()
        mock_store2.get.return_value = None
        mock_store2.set.side_effect = Exception("Redis write failed")

        with patch("shared.query_service.cache.get_cache_store", return_value=mock_store2):
            executor2 = _MockExecutor([{"result": 100}])
            repo2 = DatabricksRepository(executor=executor2, identity=_identity())

            res2, spec2 = await repo2.fetch(lambda: _spec(CacheTier.PER_USER_60S), lambda r: r)
            assert res2 == [{"result": 100}]
            assert executor2.call_count == 1
            assert spec2.cache_status == "BYPASS"


@pytest.mark.asyncio
async def test_query_spec_default_cache_policy():
    # A test proving a new QuerySpec defaults to CacheTier.NONE.
    spec = QuerySpec(
        name="test.default",
        module="test",
        endpoint="/api/test",
        sql="SELECT 1",
    )
    assert spec.cache_policy == CacheTier.NONE


@pytest.mark.asyncio
async def test_repository_cache_none_default_bypass(monkeypatch):
    # A repository/cache test proving default NONE results in BYPASS when ENABLE_QUERY_CACHE=true.
    monkeypatch.setenv("ENABLE_QUERY_CACHE", "true")
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog")

    executor = _MockExecutor([{"result": 1}])
    repo = DatabricksRepository(executor=executor, identity=_identity())

    def spec_factory():
        return QuerySpec(
            name="test.default_none",
            module="test",
            endpoint="/api/test",
            sql="SELECT 1",
        )
    res, spec = await repo.fetch(spec_factory, lambda r: r)
    assert spec.cache_status == "BYPASS"


@pytest.mark.asyncio
async def test_explicit_global_300s_caching(monkeypatch):
    # A test proving explicitly configured GLOBAL_300S can still MISS then HIT.
    monkeypatch.setenv("ENABLE_QUERY_CACHE", "true")
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog")

    executor = _MockExecutor([{"result": 99}])
    repo = DatabricksRepository(executor=executor, identity=_identity())

    def spec_factory():
        return QuerySpec(
            name="test.explicit_global",
            module="test",
            endpoint="/api/test",
            sql="SELECT 1",
            cache_policy=CacheTier.GLOBAL_300S,
        )
    # MISS
    res1, spec1 = await repo.fetch(spec_factory, lambda r: r)
    assert spec1.cache_status == "MISS"
    assert executor.call_count == 1

    # HIT
    res2, spec2 = await repo.fetch(spec_factory, lambda r: r)
    assert spec2.cache_status == "HIT"
    assert executor.call_count == 1


@pytest.mark.asyncio
async def test_cache_key_isolation_by_overrides(monkeypatch):
    # A cache key isolation test proving different catalog_override/schema_override values do not share cache entries.
    monkeypatch.setenv("ENABLE_QUERY_CACHE", "true")
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog")

    executor = _MockExecutor([{"result": 1}])
    repo = DatabricksRepository(executor=executor, identity=_identity())

    # Spec 1: catalog_override="cat1", schema_override="sch1"
    def spec_f1():
        return QuerySpec(
            name="test.override",
            module="test",
            endpoint="/api/test",
            sql="SELECT 1",
            cache_policy=CacheTier.GLOBAL_300S,
            catalog_override="cat1",
            schema_override="sch1",
        )
    _, spec1 = await repo.fetch(spec_f1, lambda r: r)
    assert spec1.cache_status == "MISS"

    # Spec 2: catalog_override="cat2", schema_override="sch1" -> should MISS
    def spec_f2():
        return QuerySpec(
            name="test.override",
            module="test",
            endpoint="/api/test",
            sql="SELECT 1",
            cache_policy=CacheTier.GLOBAL_300S,
            catalog_override="cat2",
            schema_override="sch1",
        )
    _, spec2 = await repo.fetch(spec_f2, lambda r: r)
    assert spec2.cache_status == "MISS"

    # Spec 3: catalog_override="cat1", schema_override="sch2" -> should MISS
    def spec_f3():
        return QuerySpec(
            name="test.override",
            module="test",
            endpoint="/api/test",
            sql="SELECT 1",
            cache_policy=CacheTier.GLOBAL_300S,
            catalog_override="cat1",
            schema_override="sch2",
        )
    _, spec3 = await repo.fetch(spec_f3, lambda r: r)
    assert spec3.cache_status == "MISS"


@pytest.mark.asyncio
async def test_cache_key_isolation_by_sql_fingerprint(monkeypatch):
    # A cache key isolation test proving query SQL/spec fingerprint changes do not share cache entries.
    monkeypatch.setenv("ENABLE_QUERY_CACHE", "true")
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog")

    executor = _MockExecutor([{"result": 1}])
    repo = DatabricksRepository(executor=executor, identity=_identity())

    # SQL 1
    def spec_f1():
        return QuerySpec(
            name="test.fingerprint",
            module="test",
            endpoint="/api/test",
            sql="SELECT 1",
            cache_policy=CacheTier.GLOBAL_300S,
        )
    _, spec1 = await repo.fetch(spec_f1, lambda r: r)
    assert spec1.cache_status == "MISS"

    # SQL 2 (fingerprint changes) -> should MISS
    def spec_f2():
        return QuerySpec(
            name="test.fingerprint",
            module="test",
            endpoint="/api/test",
            sql="SELECT 2",
            cache_policy=CacheTier.GLOBAL_300S,
        )
    _, spec2 = await repo.fetch(spec_f2, lambda r: r)
    assert spec2.cache_status == "MISS"


@pytest.mark.asyncio
async def test_disallowed_catalog_target_not_served_from_cache(monkeypatch):
    """ADR-027 §7 "No Silent Masking": a request with a catalog target that
    is no longer on the allow-list must NOT be answered from cache, even
    if a previously-allowed identical request populated an entry."""
    from shared.query_service.errors import DatabricksCatalogTargetError

    monkeypatch.setenv("ENABLE_QUERY_CACHE", "true")
    # Allow-list starts permissive enough to populate the cache.
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog,other_catalog")

    executor = _MockExecutor([{"result": 42}])
    repo = DatabricksRepository(
        executor=executor,
        identity=_identity(catalog="other_catalog"),
    )
    def spec_factory():
        return _spec(CacheTier.GLOBAL_300S)

    # Populate the cache as `other_catalog`.
    _, spec1 = await repo.fetch(spec_factory, lambda r: r)
    assert spec1.cache_status == "MISS"

    # Tighten the allow-list — `other_catalog` is now rejected.
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog")

    # A subsequent fetch using the now-disallowed catalog MUST raise the
    # catalog-target error rather than answer from the cache that was
    # populated when the policy was looser.
    with pytest.raises(DatabricksCatalogTargetError):
        await repo.fetch(spec_factory, lambda r: r)

    # The executor must not have been invoked a second time — the request
    # was rejected before any work happened.
    assert executor.call_count == 1
