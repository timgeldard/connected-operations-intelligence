"""Shared HTTP client for V1 proxy calls.

One persistent AsyncClient per process. Reuses TLS connections across requests.
OAuth tokens are passed per-request in request headers — never stored in the client.
"""
import httpx

_proxy_client: httpx.AsyncClient | None = None


def get_proxy_client() -> httpx.AsyncClient:
    global _proxy_client
    if _proxy_client is None or _proxy_client.is_closed:
        _proxy_client = httpx.AsyncClient(
            timeout=30.0,
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
        )
    return _proxy_client


async def close_proxy_client() -> None:
    global _proxy_client
    if _proxy_client is not None:
        await _proxy_client.aclose()
        _proxy_client = None
