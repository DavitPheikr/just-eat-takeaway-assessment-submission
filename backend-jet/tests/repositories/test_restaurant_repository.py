from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.models import Restaurant
from app.modules.discovery.schemas import DiscoveryRestaurantMapped
from app.repositories.restaurant_repository import RestaurantRepository


def _mapped_restaurant(*, external_restaurant_id: str, name: str) -> DiscoveryRestaurantMapped:
    return DiscoveryRestaurantMapped(
        external_restaurant_id=external_restaurant_id,
        name=name,
        cuisines=["Italian", "Pizza"],
        rating=4.5,
        address_text="123 High Street, London",
        latitude=51.5,
        longitude=-0.1,
        minimum_order_pence=1200,
        delivery_eta_minutes=25,
        open_now=True,
        raw_payload={"id": external_restaurant_id, "name": name},
    )


@pytest.fixture
async def repository_session_factory():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    yield session_factory
    await engine.dispose()


@pytest.mark.anyio
async def test_restaurant_repository_upsert_inserts_and_updates_stable_ids(
    repository_session_factory,
) -> None:
    repository = RestaurantRepository(repository_session_factory)
    first_seen = datetime.now(UTC)
    second_seen = datetime.now(UTC)

    created = await repository.upsert_many(
        [_mapped_restaurant(external_restaurant_id="123", name="Mario's")],
        last_seen_at=first_seen,
    )
    updated = await repository.upsert_many(
        [_mapped_restaurant(external_restaurant_id="123", name="Mario's Updated")],
        last_seen_at=second_seen,
    )

    assert len(created) == 1
    assert len(updated) == 1
    assert created[0].id == updated[0].id
    assert updated[0].name == "Mario's Updated"

    async with repository_session_factory() as session:
        count = await session.scalar(select(func.count()).select_from(Restaurant))
        restaurant = await session.scalar(select(Restaurant))

    assert count == 1
    assert restaurant is not None
    assert restaurant.name == "Mario's Updated"


@pytest.mark.anyio
async def test_restaurant_repository_preserves_return_order(repository_session_factory) -> None:
    repository = RestaurantRepository(repository_session_factory)

    restaurants = await repository.upsert_many(
        [
            _mapped_restaurant(external_restaurant_id="b", name="Second"),
            _mapped_restaurant(external_restaurant_id="a", name="First"),
        ],
        last_seen_at=datetime.now(UTC),
    )

    assert [restaurant.external_restaurant_id for restaurant in restaurants] == ["b", "a"]
