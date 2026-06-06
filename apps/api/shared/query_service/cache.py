"""Cache store interface and in-memory implementation."""
from __future__ import annotations

import asyncio
import time
from abc import ABC, abstractmethod
from typing import Any, NamedTuple


class CacheEntry(NamedTuple):
    data: Any
    cached_at: float
    ttl: int


class CacheStore(ABC):
    """Abstract base class for caching backends (e.g., in-memory, Redis)."""

    @abstractmethod
    async def get(self, key: str) -> CacheEntry | None:
        """Retrieve an entry from the cache."""
        pass

    @abstractmethod
    async def set(self, key: str, data: Any, ttl: int) -> None:
        """Store an entry in the cache with a TTL in seconds."""
        pass

    @abstractmethod
    async def clear(self) -> None:
        """Clear all cache entries."""
        pass


class InMemoryCacheStore(CacheStore):
    """Coroutine-safe, in-memory cache store implementation (asyncio.Lock protected)."""

    def __init__(self) -> None:
        self._store: dict[str, CacheEntry] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> CacheEntry | None:
        async with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None

            # Check expiration
            if time.time() - entry.cached_at > entry.ttl:
                del self._store[key]
                return None

            return entry

    async def set(self, key: str, data: Any, ttl: int) -> None:
        async with self._lock:
            self._store[key] = CacheEntry(data=data, cached_at=time.time(), ttl=ttl)

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()


# Global in-memory cache instance for single-process runtime
_global_cache = InMemoryCacheStore()


def get_cache_store() -> CacheStore:
    """Return the active cache store implementation."""
    return _global_cache
