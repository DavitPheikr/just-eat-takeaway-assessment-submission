from __future__ import annotations

from typing import Any

import httpx

from app.shared.errors import InvalidPostcodeError, UpstreamUnavailableError


class JustEatClient:
    """Adapter for the public Just Eat discovery API."""

    BASE_URL_TEMPLATE = (
        "https://uk.api.just-eat.io/discovery/uk/restaurants/enriched/bypostcode/{postcode}"
    )

    def __init__(self, *, timeout_seconds: float = 10.0) -> None:
        self.timeout_seconds = timeout_seconds

    async def fetch_discovery(self, postcode: str) -> dict[str, Any]:
        url = self.BASE_URL_TEMPLATE.format(postcode=postcode)

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.get(url)
        except httpx.TimeoutException as exc:
            raise UpstreamUnavailableError() from exc
        except httpx.HTTPError as exc:
            raise UpstreamUnavailableError() from exc

        if response.status_code in {400, 404}:
            raise InvalidPostcodeError()
        if response.status_code >= 400:
            raise UpstreamUnavailableError()

        try:
            payload = response.json()
        except ValueError as exc:
            raise UpstreamUnavailableError() from exc

        if not isinstance(payload, dict):
            raise UpstreamUnavailableError()
        if self._is_upstream_invalid_postcode_payload(payload):
            raise InvalidPostcodeError()

        return payload

    @staticmethod
    def _is_upstream_invalid_postcode_payload(payload: dict[str, Any]) -> bool:
        metadata = payload.get("metaData")
        restaurants = payload.get("restaurants")
        if not isinstance(metadata, dict) or not isinstance(restaurants, list):
            return False

        canonical_name = metadata.get("canonicalName")
        location = metadata.get("location")

        return canonical_name is None and location is None and len(restaurants) == 0
