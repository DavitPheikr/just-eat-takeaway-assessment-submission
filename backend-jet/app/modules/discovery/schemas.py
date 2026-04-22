from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DiscoveryRestaurantMapped(BaseModel):
    external_restaurant_id: str
    name: str
    cuisines: list[str]
    rating: float
    address_text: str
    latitude: float | None = None
    longitude: float | None = None
    minimum_order_pence: int | None = None
    delivery_eta_minutes: int | None = None
    open_now: bool | None = None
    raw_payload: dict[str, Any]


class PersistedRestaurantRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    external_restaurant_id: str
    name: str
    cuisines: list[str]
    rating: float
    address_text: str
    latitude: float | None = None
    longitude: float | None = None
    minimum_order_pence: int | None = None
    delivery_eta_minutes: int | None = None
    open_now: bool | None = None
    raw_payload: dict[str, Any]
    last_seen_at: datetime


class DiscoveryRestaurantResponse(BaseModel):
    id: UUID
    externalRestaurantId: str
    name: str
    cuisines: list[str]
    rating: float
    addressText: str
    latitude: float | None = None
    longitude: float | None = None
    minimumOrderPence: int | None = None
    deliveryEtaMinutes: int | None = None
    openNow: bool | None = None


class DiscoverySearchResponse(BaseModel):
    postcode: str
    restaurants: list[DiscoveryRestaurantResponse]
