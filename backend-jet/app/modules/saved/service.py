from __future__ import annotations

from datetime import UTC, datetime
from typing import Final
from uuid import UUID

from app.modules.discovery.schemas import DiscoveryRestaurantResponse, PersistedRestaurantRecord
from app.modules.saved.schemas import (
    SavedCreateResponse,
    SavedCreateResponseItem,
    SavedDeleteResponse,
    SavedListItemResponse,
    SavedListResponse,
)
from app.repositories.restaurant_repository import RestaurantRepository
from app.repositories.saved_restaurant_repository import SavedRestaurantRepository
from app.shared.errors import (
    InvalidSavedRestaurantError,
    RatingRequiresVisitedError,
    SavedItemNotFoundError,
)

LOCAL_USER_ID: Final = "local"
UNSET: Final = object()


class SavedService:
    """Saved restaurants orchestration and contract shaping."""

    def __init__(
        self,
        *,
        saved_restaurant_repository: SavedRestaurantRepository,
        restaurant_repository: RestaurantRepository,
    ) -> None:
        self._saved_restaurant_repository = saved_restaurant_repository
        self._restaurant_repository = restaurant_repository

    async def list_saved(
        self,
        *,
        saved_from_postcode: str | None = None,
        visited: bool | None = None,
        has_user_rating: bool | None = None,
        has_review_text: bool | None = None,
        user_id: str = LOCAL_USER_ID,
    ) -> SavedListResponse:
        records = await self._saved_restaurant_repository.list_for_user(
            user_id,
            saved_from_postcode=self._normalize_postcode(saved_from_postcode),
            visited=visited,
            has_user_rating=has_user_rating,
            has_review_text=has_review_text,
        )
        return SavedListResponse(
            items=[self._to_list_item(record) for record in records],
        )

    @staticmethod
    def _normalize_postcode(postcode: str | None) -> str | None:
        if postcode is None:
            return None
        normalized = "".join(postcode.strip().upper().split())
        return normalized or None

    async def save_restaurant(
        self,
        restaurant_id: UUID,
        saved_from_postcode: str,
        user_id: str = LOCAL_USER_ID,
    ) -> SavedCreateResponse:
        restaurant = await self._restaurant_repository.get_by_id(restaurant_id)
        if restaurant is None:
            raise InvalidSavedRestaurantError()

        existing = await self._saved_restaurant_repository.get_by_user_and_restaurant(
            user_id,
            restaurant_id,
        )
        if existing is not None:
            return self._to_create_response(existing)

        created = await self._saved_restaurant_repository.create(
            user_id=user_id,
            restaurant_id=restaurant_id,
            saved_from_postcode=saved_from_postcode,
            saved_at=datetime.now(UTC),
            visited=False,
            visited_at=None,
            review_text=None,
            user_rating=None,
            snapshot_payload=self._build_snapshot_payload(restaurant),
        )
        return self._to_create_response(created)

    async def update_saved(
        self,
        saved_id: UUID,
        *,
        visited: bool | object = UNSET,
        review_text: str | None | object = UNSET,
        user_rating: int | None | object = UNSET,
        user_id: str = LOCAL_USER_ID,
    ) -> SavedListItemResponse:
        record = await self._saved_restaurant_repository.get_by_id(saved_id, user_id)
        if record is None:
            raise SavedItemNotFoundError()

        if visited is not UNSET:
            assert isinstance(visited, bool)
            record.visited = visited
            if visited:
                if record.visited_at is None:
                    record.visited_at = datetime.now(UTC)
            else:
                record.visited_at = None

        if review_text is not UNSET:
            assert isinstance(review_text, str) or review_text is None
            record.review_text = review_text

        if user_rating is not UNSET:
            assert isinstance(user_rating, int) or user_rating is None
            if user_rating is not None and not record.visited:
                raise RatingRequiresVisitedError()
            record.user_rating = user_rating

        updated = await self._saved_restaurant_repository.save(record)
        return self._to_list_item(updated)

    async def delete_saved(
        self,
        saved_id: UUID,
        user_id: str = LOCAL_USER_ID,
    ) -> SavedDeleteResponse:
        record = await self._saved_restaurant_repository.get_by_id(saved_id, user_id)
        if record is None:
            raise SavedItemNotFoundError()

        await self._saved_restaurant_repository.delete(record)
        return SavedDeleteResponse(deleted=True)

    @staticmethod
    def _build_snapshot_payload(
        restaurant: PersistedRestaurantRecord,
    ) -> dict[str, object]:
        return DiscoveryRestaurantResponse(
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
        ).model_dump(mode="json")

    @staticmethod
    def _to_list_item(record) -> SavedListItemResponse:
        snapshot = DiscoveryRestaurantResponse.model_validate(record.snapshot_payload)
        return SavedListItemResponse(
            id=record.id,
            restaurantId=record.restaurant_id,
            name=snapshot.name,
            cuisines=snapshot.cuisines,
            rating=snapshot.rating,
            addressText=snapshot.addressText,
            savedFromPostcode=record.saved_from_postcode,
            savedAt=record.saved_at,
            visited=record.visited,
            visitedAt=record.visited_at,
            reviewText=record.review_text,
            userRating=record.user_rating,
        )

    @staticmethod
    def _to_create_response(record) -> SavedCreateResponse:
        return SavedCreateResponse(
            item=SavedCreateResponseItem(
                id=record.id,
                restaurantId=record.restaurant_id,
                savedFromPostcode=record.saved_from_postcode,
                visited=record.visited,
                reviewText=record.review_text,
                userRating=record.user_rating,
            )
        )
