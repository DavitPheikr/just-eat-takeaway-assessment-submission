from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.models import Restaurant, SavedRestaurant
from app.repositories.saved_restaurant_repository import SavedRestaurantRepository


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


@pytest.fixture
async def repository_session_factory():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    yield session_factory
    await engine.dispose()


async def _create_restaurant(session_factory, *, name: str = "Mario's") -> Restaurant:
    restaurant = Restaurant(
        external_restaurant_id=f"jet-{uuid4()}",
        name=name,
        cuisines=["Italian", "Pizza"],
        rating=4.7,
        address_text="123 High Street, London",
        latitude=51.5,
        longitude=-0.1,
        minimum_order_pence=1200,
        delivery_eta_minutes=25,
        open_now=True,
        raw_payload={"name": name},
        last_seen_at=datetime.now(UTC),
    )
    async with session_factory() as session:
        async with session.begin():
            session.add(restaurant)
            await session.flush()
            return restaurant


@pytest.mark.anyio
async def test_saved_restaurant_repository_create_get_list_and_delete(
    repository_session_factory,
) -> None:
    repository = SavedRestaurantRepository(repository_session_factory)
    first_restaurant = await _create_restaurant(repository_session_factory, name="Mario's")
    second_restaurant = await _create_restaurant(repository_session_factory, name="Pippo Pizza")

    first = await repository.create(
        user_id="local",
        restaurant_id=first_restaurant.id,
        saved_from_postcode="EC4M7RF",
        saved_at=datetime(2026, 4, 20, tzinfo=UTC),
        visited=False,
        visited_at=None,
        review_text=None,
        user_rating=None,
        snapshot_payload={"name": "Mario's", "addressText": "123 High Street, London"},
    )
    second = await repository.create(
        user_id="local",
        restaurant_id=second_restaurant.id,
        saved_from_postcode="N1C4AB",
        saved_at=datetime(2026, 4, 21, tzinfo=UTC),
        visited=False,
        visited_at=None,
        review_text=None,
        user_rating=5,
        snapshot_payload={"name": "Pippo Pizza", "addressText": "123 High Street, London"},
    )

    listed = await repository.list_for_user("local")
    fetched = await repository.get_by_id(first.id, "local")
    by_restaurant = await repository.get_by_user_and_restaurant("local", second_restaurant.id)

    assert [record.id for record in listed] == [second.id, first.id]
    assert listed[0].user_rating == 5
    assert fetched is not None and fetched.id == first.id
    assert by_restaurant is not None and by_restaurant.id == second.id

    await repository.delete(first)

    remaining = await repository.list_for_user("local")
    assert [record.id for record in remaining] == [second.id]


@pytest.mark.anyio
async def test_saved_restaurant_repository_save_persists_updates(
    repository_session_factory,
) -> None:
    repository = SavedRestaurantRepository(repository_session_factory)
    restaurant = await _create_restaurant(repository_session_factory)
    created = await repository.create(
        user_id="local",
        restaurant_id=restaurant.id,
        saved_from_postcode="EC4M7RF",
        saved_at=datetime.now(UTC),
        visited=False,
        visited_at=None,
        review_text=None,
        user_rating=None,
        snapshot_payload={"name": "Mario's", "addressText": "123 High Street, London"},
    )

    visited_at = datetime.now(UTC)
    created.visited = True
    created.visited_at = visited_at
    created.review_text = "Great pizza."
    created.user_rating = 3
    updated = await repository.save(created)

    assert updated.visited is True
    assert updated.review_text == "Great pizza."
    assert updated.user_rating == 3

    async with repository_session_factory() as session:
        count = await session.scalar(select(func.count()).select_from(SavedRestaurant))
        stored = await session.scalar(select(SavedRestaurant))

    assert count == 1
    assert stored is not None
    assert stored.visited is True
    assert _as_utc(stored.visited_at) == visited_at
    assert stored.review_text == "Great pizza."
    assert stored.user_rating == 3
