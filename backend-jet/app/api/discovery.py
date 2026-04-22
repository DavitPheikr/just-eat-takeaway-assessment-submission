from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from app.modules.discovery.adapter import JustEatClient
from app.modules.discovery.schemas import DiscoverySearchResponse
from app.modules.discovery.service import DiscoveryService
from app.repositories.restaurant_repository import RestaurantRepository

router = APIRouter(prefix="/discovery", tags=["discovery"])


async def get_discovery_service(request: Request) -> DiscoveryService:
    return DiscoveryService(
        redis_client=request.app.state.redis,
        just_eat_client=JustEatClient(),
        restaurant_repository=RestaurantRepository(
            request.app.state.db_session_factory
        ),
    )


@router.get("/search", response_model=DiscoverySearchResponse)
async def discovery_search(
    postcode: Annotated[str, Query(min_length=1, pattern=r".*\S.*")],
    discovery_service: Annotated[DiscoveryService, Depends(get_discovery_service)],
) -> DiscoverySearchResponse:
    return await discovery_service.search(postcode)
