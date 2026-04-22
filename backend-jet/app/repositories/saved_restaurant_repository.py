from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.models import SavedRestaurant


class SavedRestaurantRepository:
    """Persistence boundary for saved restaurant records."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def list_for_user(
        self,
        user_id: str,
        *,
        saved_from_postcode: str | None = None,
        visited: bool | None = None,
        has_user_rating: bool | None = None,
        has_review_text: bool | None = None,
    ) -> Sequence[SavedRestaurant]:
        async with self._session_factory() as session:
            stmt = select(SavedRestaurant).where(SavedRestaurant.user_id == user_id)

            if saved_from_postcode is not None:
                stmt = stmt.where(SavedRestaurant.saved_from_postcode == saved_from_postcode)

            if visited is not None:
                stmt = stmt.where(SavedRestaurant.visited.is_(visited))

            if has_user_rating is True:
                stmt = stmt.where(
                    SavedRestaurant.visited.is_(True),
                    SavedRestaurant.user_rating.is_not(None),
                )
            elif has_user_rating is False:
                stmt = stmt.where(
                    or_(
                        SavedRestaurant.visited.is_(False),
                        SavedRestaurant.user_rating.is_(None),
                    )
                )

            if has_review_text is True:
                stmt = stmt.where(
                    SavedRestaurant.visited.is_(True),
                    SavedRestaurant.review_text.is_not(None),
                )
            elif has_review_text is False:
                stmt = stmt.where(
                    or_(
                        SavedRestaurant.visited.is_(False),
                        SavedRestaurant.review_text.is_(None),
                    )
                )

            result = await session.execute(stmt.order_by(SavedRestaurant.saved_at.desc()))
            return result.scalars().all()

    async def get_by_id(self, saved_id: UUID, user_id: str) -> SavedRestaurant | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(SavedRestaurant).where(
                    SavedRestaurant.id == saved_id,
                    SavedRestaurant.user_id == user_id,
                )
            )
            return result.scalar_one_or_none()

    async def get_by_user_and_restaurant(
        self,
        user_id: str,
        restaurant_id: UUID,
    ) -> SavedRestaurant | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(SavedRestaurant).where(
                    SavedRestaurant.user_id == user_id,
                    SavedRestaurant.restaurant_id == restaurant_id,
                )
            )
            return result.scalar_one_or_none()

    async def create(
        self,
        *,
        user_id: str,
        restaurant_id: UUID,
        saved_from_postcode: str,
        saved_at: datetime,
        visited: bool,
        visited_at: datetime | None,
        review_text: str | None,
        user_rating: int | None,
        snapshot_payload: dict[str, Any],
    ) -> SavedRestaurant:
        async with self._session_factory() as session:
            async with session.begin():
                record = SavedRestaurant(
                    user_id=user_id,
                    restaurant_id=restaurant_id,
                    saved_from_postcode=saved_from_postcode,
                    saved_at=saved_at,
                    visited=visited,
                    visited_at=visited_at,
                    review_text=review_text,
                    user_rating=user_rating,
                    snapshot_payload=snapshot_payload,
                )
                session.add(record)
                await session.flush()
                return record

    async def save(self, record: SavedRestaurant) -> SavedRestaurant:
        async with self._session_factory() as session:
            async with session.begin():
                merged = await session.merge(record)
                await session.flush()
                return merged

    async def delete(self, record: SavedRestaurant) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                merged = await session.merge(record)
                await session.delete(merged)
