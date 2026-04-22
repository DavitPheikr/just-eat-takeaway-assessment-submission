import logging
from uuid import uuid4

import pytest
from redis.exceptions import RedisError

from app.modules.discovery.schemas import DiscoverySearchResponse, PersistedRestaurantRecord
from app.modules.discovery.service import CACHE_TTL_SECONDS, DiscoveryService
from app.shared.errors import DiscoveryDependencyError


_DEFAULT_NAME = object()


def _upstream_entry(
    identifier: str,
    *,
    name: str | None | object = _DEFAULT_NAME,
    **overrides,
) -> dict:
    entry = {
        "id": identifier,
        "name": f"Restaurant {identifier}" if name is _DEFAULT_NAME else name,
        "cuisines": [{"name": "Italian"}, {"name": "Pizza"}],
        "rating": {"starRating": 4.5},
        "address": {
            "firstLine": "123 High Street",
            "city": "London",
            "location": {"coordinates": [-0.1, 51.5]},
        },
        "minimumDeliveryValue": 12.0,
        "deliveryEtaMinutes": {"approximate": 25},
        "isOpenNowForDelivery": True,
    }
    entry.update(overrides)
    return entry


class FakeRedis:
    def __init__(self, *, initial: dict[str, str] | None = None, fail_on: str | None = None) -> None:
        self.store = initial or {}
        self.fail_on = fail_on
        self.set_calls: list[tuple[str, int, str]] = []

    async def get(self, key: str) -> str | None:
        if self.fail_on == "get":
            raise RedisError("redis get failed")
        return self.store.get(key)

    async def setex(self, key: str, ttl: int, value: str) -> None:
        if self.fail_on == "setex":
            raise RedisError("redis setex failed")
        self.store[key] = value
        self.set_calls.append((key, ttl, value))


class FakeJustEatClient:
    def __init__(self, payload: dict) -> None:
        self.payload = payload
        self.calls: list[str] = []

    async def fetch_discovery(self, postcode: str) -> dict:
        self.calls.append(postcode)
        return self.payload


class FakeRestaurantRepository:
    def __init__(self) -> None:
        self.calls = []

    async def upsert_many(self, restaurants, *, last_seen_at):
        self.calls.append((restaurants, last_seen_at))
        return [
            PersistedRestaurantRecord(
                id=uuid4(),
                external_restaurant_id=restaurant.external_restaurant_id,
                name=restaurant.name,
                cuisines=restaurant.cuisines,
                rating=restaurant.rating,
                address_text=restaurant.address_text,
                latitude=restaurant.latitude,
                longitude=restaurant.longitude,
                minimum_order_pence=restaurant.minimum_order_pence,
                delivery_eta_minutes=restaurant.delivery_eta_minutes,
                open_now=restaurant.open_now,
                raw_payload=restaurant.raw_payload,
                last_seen_at=last_seen_at,
            )
            for restaurant in restaurants
        ]


@pytest.mark.anyio
async def test_discovery_service_cache_miss_calls_upstream_repository_and_cache() -> None:
    redis_client = FakeRedis()
    upstream_payload = {"restaurants": [_upstream_entry("1"), _upstream_entry("2")]}
    just_eat_client = FakeJustEatClient(upstream_payload)
    repository = FakeRestaurantRepository()
    service = DiscoveryService(
        redis_client=redis_client,
        just_eat_client=just_eat_client,
        restaurant_repository=repository,
    )

    response = await service.search(" ec4m 7rf ")

    assert response.postcode == "EC4M7RF"
    assert len(response.restaurants) == 2
    assert just_eat_client.calls == ["EC4M7RF"]
    assert len(repository.calls) == 1
    assert redis_client.set_calls[0][0] == "discovery:postcode:EC4M7RF"
    assert redis_client.set_calls[0][1] == CACHE_TTL_SECONDS


@pytest.mark.anyio
async def test_discovery_service_cache_hit_skips_upstream_and_repository() -> None:
    cached_response = DiscoverySearchResponse(
        postcode="EC4M7RF",
        restaurants=[],
    )
    redis_client = FakeRedis(
        initial={"discovery:postcode:EC4M7RF": cached_response.model_dump_json()}
    )
    just_eat_client = FakeJustEatClient({"restaurants": [_upstream_entry("1")]})
    repository = FakeRestaurantRepository()
    service = DiscoveryService(
        redis_client=redis_client,
        just_eat_client=just_eat_client,
        restaurant_repository=repository,
    )

    response = await service.search("EC4M7RF")

    assert response == cached_response
    assert just_eat_client.calls == []
    assert repository.calls == []


@pytest.mark.anyio
async def test_discovery_service_trims_to_first_ten_valid_restaurants() -> None:
    upstream_payload = {
        "restaurants": [_upstream_entry(str(index)) for index in range(12)]
    }
    redis_client = FakeRedis()
    just_eat_client = FakeJustEatClient(upstream_payload)
    repository = FakeRestaurantRepository()
    service = DiscoveryService(
        redis_client=redis_client,
        just_eat_client=just_eat_client,
        restaurant_repository=repository,
    )

    response = await service.search("EC4M7RF")

    assert len(response.restaurants) == 10
    assert len(repository.calls[0][0]) == 10


@pytest.mark.anyio
async def test_discovery_service_drops_malformed_entries_without_failing(
    caplog: pytest.LogCaptureFixture,
) -> None:
    upstream_payload = {
        "restaurants": [
            _upstream_entry("1"),
            _upstream_entry("2", cuisines=[]),
            _upstream_entry("3"),
        ]
    }
    redis_client = FakeRedis()
    just_eat_client = FakeJustEatClient(upstream_payload)
    repository = FakeRestaurantRepository()
    service = DiscoveryService(
        redis_client=redis_client,
        just_eat_client=just_eat_client,
        restaurant_repository=repository,
    )

    with caplog.at_level(logging.WARNING):
        response = await service.search("EC4M7RF")

    assert len(response.restaurants) == 2
    assert "Dropping malformed upstream restaurant entry" in caplog.text


@pytest.mark.anyio
async def test_discovery_service_raises_shaped_error_when_redis_fails() -> None:
    redis_client = FakeRedis(fail_on="get")
    just_eat_client = FakeJustEatClient({"restaurants": [_upstream_entry("1")]})
    repository = FakeRestaurantRepository()
    service = DiscoveryService(
        redis_client=redis_client,
        just_eat_client=just_eat_client,
        restaurant_repository=repository,
    )

    with pytest.raises(DiscoveryDependencyError):
        await service.search("EC4M7RF")
