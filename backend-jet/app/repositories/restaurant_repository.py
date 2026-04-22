from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.models import Restaurant
from app.modules.discovery.schemas import DiscoveryRestaurantMapped, PersistedRestaurantRecord


class RestaurantRepository:
    """Persistence boundary for restaurant records."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def get_by_id(self, restaurant_id: UUID) -> PersistedRestaurantRecord | None:
        async with self._session_factory() as session:
            restaurant = await session.get(Restaurant, restaurant_id)
            if restaurant is None:
                return None
            return PersistedRestaurantRecord.model_validate(restaurant)

    async def upsert_many(
        self,
        restaurants: Sequence[DiscoveryRestaurantMapped],
        *,
        last_seen_at: datetime,
    ) -> list[PersistedRestaurantRecord]:
        if not restaurants:
            return []

        external_ids = [restaurant.external_restaurant_id for restaurant in restaurants]

        async with self._session_factory() as session:
            async with session.begin():
                result = await session.execute(
                    select(Restaurant).where(Restaurant.external_restaurant_id.in_(external_ids))
                )
                existing_restaurants = {
                    restaurant.external_restaurant_id: restaurant
                    for restaurant in result.scalars().all()
                }

                ordered_restaurants: list[Restaurant] = []
                for restaurant in restaurants:
                    existing = existing_restaurants.get(restaurant.external_restaurant_id)
                    if existing is None:
                        existing = Restaurant(
                            external_restaurant_id=restaurant.external_restaurant_id,
                        )
                        self._apply_restaurant_snapshot(
                            existing,
                            restaurant,
                            last_seen_at=last_seen_at,
                        )
                        session.add(existing)
                        existing_restaurants[restaurant.external_restaurant_id] = existing
                    else:
                        self._apply_restaurant_snapshot(
                            existing,
                            restaurant,
                            last_seen_at=last_seen_at,
                        )

                    ordered_restaurants.append(existing)

                await session.flush()

                return [
                    PersistedRestaurantRecord.model_validate(restaurant)
                    for restaurant in ordered_restaurants
                ]

    @staticmethod
    def _apply_restaurant_snapshot(
        record: Restaurant,
        restaurant: DiscoveryRestaurantMapped,
        *,
        last_seen_at: datetime,
    ) -> None:
        record.name = restaurant.name
        record.cuisines = restaurant.cuisines
        record.rating = restaurant.rating
        record.address_text = restaurant.address_text
        record.latitude = restaurant.latitude
        record.longitude = restaurant.longitude
        record.minimum_order_pence = restaurant.minimum_order_pence
        record.delivery_eta_minutes = restaurant.delivery_eta_minutes
        record.open_now = restaurant.open_now
        record.raw_payload = restaurant.raw_payload
        record.last_seen_at = last_seen_at
