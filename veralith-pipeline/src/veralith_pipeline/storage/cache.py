"""
Cache client — Redis (production) ou MemoryCache (tests).

Cle TTL pour eviter de re-fetch les memes events sources.
"""
from __future__ import annotations
import time
from typing import Any, Protocol


class CacheClient(Protocol):
    def get(self, key: str) -> Any | None: ...
    def set(self, key: str, value: Any, ttl_seconds: int = 3600) -> None: ...
    def delete(self, key: str) -> None: ...


class MemoryCache:
    """In-process TTL cache. Thread-safe? Non. Use only in tests / single-worker."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if expires_at < time.time():
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any, ttl_seconds: int = 3600) -> None:
        self._store[key] = (time.time() + ttl_seconds, value)

    def delete(self, key: str) -> None:
        self._store.pop(key, None)

    def clear(self) -> None:
        self._store.clear()
