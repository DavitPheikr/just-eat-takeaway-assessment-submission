from __future__ import annotations

import logging
from datetime import UTC, datetime
from json import JSONDecodeError

from pydantic import ValidationError
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.modules.discovery.adapter import JustEatClient
from app.modules.discovery.mapper import map_discovery_payload
from app.modules.discovery.schemas import (
    DiscoveryRestaurantResponse,
    DiscoverySearchResponse,
)
from app.repositories.restaurant_repository import RestaurantRepository
from app.shared.errors import DiscoveryDependencyError

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 900


class DiscoveryService:
    """Discovery orchestration for postcode-based restaurant search."""

    def __init__(
        self,
        *,
        redis_client: Redis,
        just_eat_client: JustEatClient,
        restaurant_repository: RestaurantRepository,
    ) -> None:
        self._redis_client = redis_client
        self._just_eat_client = just_eat_client
        self._restaurant_repository = restaurant_repository

    async def search(self, postcode: str) -> DiscoverySearchResponse:
        normalized_postcode = self.normalize_postcode(postcode)
        cache_key = f"discovery:postcode:{normalized_postcode}"

        cached_response = await self._read_from_cache(cache_key)
        if cached_response is not None:
            logger.info("Discovery cache hit for postcode %s", normalized_postcode)
            return cached_response

        logger.info("Discovery cache miss for postcode %s", normalized_postcode)
        upstream_payload = await self._just_eat_client.fetch_discovery(normalized_postcode)
        mapped_restaurants = map_discovery_payload(upstream_payload)
        top_ten_restaurants = mapped_restaurants[:10]

        if top_ten_restaurants:
            persisted_restaurants = await self._restaurant_repository.upsert_many(
                top_ten_restaurants,
                last_seen_at=datetime.now(UTC),
            )
            restaurants = [
                DiscoveryRestaurantResponse(
                    id=restaurant.id,
                    externalRestaurantId=restaurant.external_restaurant_id,
                    name=restaurant.name,
                    cuisines=restaurant.cuisines,
                    rating=restaurant.rating,
                    addressText=restaurant.address_text,
                    latitude=restaurant.latitude,
                    longitude=restaurant.longitude,
                    minimumOrderPence=restaurant.minimum_order_pence,
                    deliveryEtaMinutes=restaurant.delivery_eta_minutes,
                    openNow=restaurant.open_now,
                )
                for restaurant in persisted_restaurants
            ]
        else:
            restaurants = []

        response = DiscoverySearchResponse(
            postcode=normalized_postcode,
            restaurants=restaurants,
        )

        await self._write_to_cache(cache_key, response)
        return response

    @staticmethod
    def normalize_postcode(postcode: str) -> str:
        return "".join(postcode.strip().upper().split())

    async def _read_from_cache(self, cache_key: str) -> DiscoverySearchResponse | None:
        try:
            cached_payload = await self._redis_client.get(cache_key)
        except RedisError as exc:
            raise DiscoveryDependencyError() from exc

        if not cached_payload:
            return None

        try:
            return DiscoverySearchResponse.model_validate_json(cached_payload)
        except (ValidationError, JSONDecodeError):
            logger.warning("Ignoring corrupt discovery cache payload for key %s", cache_key)
            return None

    async def _write_to_cache(
        self,
        cache_key: str,
        response: DiscoverySearchResponse,
    ) -> None:
        try:
            await self._redis_client.setex(
                cache_key,
                CACHE_TTL_SECONDS,
                response.model_dump_json(),
            )
        except RedisError as exc:
            raise DiscoveryDependencyError() from exc
