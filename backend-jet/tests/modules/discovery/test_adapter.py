from __future__ import annotations

import httpx
import pytest

from app.modules.discovery.adapter import JustEatClient
from app.shared.errors import InvalidPostcodeError, UpstreamUnavailableError


class FakeAsyncClient:
    def __init__(self, response=None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def get(self, url: str):
        if self.error is not None:
            raise self.error
        return self.response


class FakeResponse:
    def __init__(self, status_code: int, payload) -> None:
        self.status_code = status_code
        self._payload = payload

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


@pytest.mark.anyio
async def test_just_eat_client_raises_invalid_postcode_for_null_metadata_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = FakeResponse(
        200,
        {
            "metaData": {
                "canonicalName": None,
                "location": None,
            },
            "restaurants": [],
        },
    )
    monkeypatch.setattr(httpx, "AsyncClient", lambda **_: FakeAsyncClient(response=response))

    client = JustEatClient()

    with pytest.raises(InvalidPostcodeError):
        await client.fetch_discovery("INVALID")


@pytest.mark.anyio
async def test_just_eat_client_raises_upstream_unavailable_on_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **_: FakeAsyncClient(error=httpx.TimeoutException("timeout")),
    )

    client = JustEatClient()

    with pytest.raises(UpstreamUnavailableError):
        await client.fetch_discovery("EC4M7RF")


@pytest.mark.anyio
async def test_just_eat_client_raises_upstream_unavailable_for_non_dict_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = FakeResponse(200, ["not", "a", "dict"])
    monkeypatch.setattr(httpx, "AsyncClient", lambda **_: FakeAsyncClient(response=response))

    client = JustEatClient()

    with pytest.raises(UpstreamUnavailableError):
        await client.fetch_discovery("EC4M7RF")
