from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query, Request

from app.modules.saved.schemas import (
    SavedCreateRequest,
    SavedCreateResponse,
    SavedDeleteResponse,
    SavedListItemResponse,
    SavedListResponse,
    SavedUpdateRequest,
)
from app.modules.saved.service import SavedService
from app.modules.saved.service import UNSET
from app.repositories.restaurant_repository import RestaurantRepository
from app.repositories.saved_restaurant_repository import SavedRestaurantRepository

router = APIRouter(prefix="/saved", tags=["saved"])


async def get_saved_service(request: Request) -> SavedService:
    session_factory = request.app.state.db_session_factory
    return SavedService(
        saved_restaurant_repository=SavedRestaurantRepository(session_factory),
        restaurant_repository=RestaurantRepository(session_factory),
    )


@router.get("", response_model=SavedListResponse)
async def list_saved(
    saved_service: Annotated[SavedService, Depends(get_saved_service)],
    savedFromPostcode: Annotated[str | None, Query()] = None,
    visited: Annotated[bool | None, Query()] = None,
    hasUserRating: Annotated[bool | None, Query()] = None,
    hasReviewText: Annotated[bool | None, Query()] = None,
) -> SavedListResponse:
    return await saved_service.list_saved(
        saved_from_postcode=savedFromPostcode,
        visited=visited,
        has_user_rating=hasUserRating,
        has_review_text=hasReviewText,
    )


@router.post("", response_model=SavedCreateResponse)
async def create_saved(
    body: Annotated[SavedCreateRequest, Body()],
    saved_service: Annotated[SavedService, Depends(get_saved_service)],
) -> SavedCreateResponse:
    return await saved_service.save_restaurant(body.restaurantId, body.savedFromPostcode)


@router.patch("/{saved_id}", response_model=SavedListItemResponse)
async def update_saved(
    saved_id: UUID,
    body: Annotated[SavedUpdateRequest, Body()],
    saved_service: Annotated[SavedService, Depends(get_saved_service)],
) -> SavedListItemResponse:
    fields_set = body.model_fields_set
    return await saved_service.update_saved(
        saved_id,
        visited=body.visited if "visited" in fields_set else UNSET,
        review_text=body.reviewText if "reviewText" in fields_set else UNSET,
        user_rating=body.userRating if "userRating" in fields_set else UNSET,
    )


@router.delete("/{saved_id}", response_model=SavedDeleteResponse)
async def delete_saved(
    saved_id: UUID,
    saved_service: Annotated[SavedService, Depends(get_saved_service)],
) -> SavedDeleteResponse:
    return await saved_service.delete_saved(saved_id)
