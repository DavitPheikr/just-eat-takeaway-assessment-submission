from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON, Uuid

from app.db.base import Base

JSON_VARIANT = JSON().with_variant(JSONB, "postgresql")


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    external_restaurant_id: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    cuisines: Mapped[list[str]] = mapped_column(JSON_VARIANT, nullable=False)
    rating: Mapped[float] = mapped_column(Numeric(2, 1), nullable=False)
    address_text: Mapped[str] = mapped_column(Text, nullable=False)
    latitude: Mapped[float | None] = mapped_column(nullable=True)
    longitude: Mapped[float | None] = mapped_column(nullable=True)
    minimum_order_pence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    delivery_eta_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    open_now: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSON_VARIANT, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SavedRestaurant(Base):
    __tablename__ = "saved_restaurants"
    __table_args__ = (
        UniqueConstraint("user_id", "restaurant_id"),
        Index("ix_saved_restaurants_user_id_saved_at", "user_id", "saved_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[str] = mapped_column(Text, nullable=False, default="local")
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("restaurants.id"),
        nullable=False,
    )
    saved_from_postcode: Mapped[str] = mapped_column(Text, nullable=False)
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    visited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    visited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    snapshot_payload: Mapped[dict[str, Any]] = mapped_column(JSON_VARIANT, nullable=False)
