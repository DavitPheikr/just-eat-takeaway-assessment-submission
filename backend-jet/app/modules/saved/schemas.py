from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints, model_validator


NonBlankString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class SavedCreateRequest(BaseModel):
    restaurantId: UUID
    savedFromPostcode: NonBlankString


class SavedUpdateRequest(BaseModel):
    visited: bool | None = None
    reviewText: str | None = None
    userRating: int | None = Field(default=None, ge=1, le=5)

    @model_validator(mode="after")
    def validate_non_empty_patch(self) -> "SavedUpdateRequest":
        if not {"visited", "reviewText", "userRating"} & self.__pydantic_fields_set__:
            raise ValueError("At least one field must be provided.")
        return self


class SavedListItemResponse(BaseModel):
    id: UUID
    restaurantId: UUID
    name: str
    cuisines: list[str]
    rating: float
    addressText: str
    savedFromPostcode: str
    savedAt: datetime
    visited: bool
    visitedAt: datetime | None
    reviewText: str | None
    userRating: int | None


class SavedListResponse(BaseModel):
    items: list[SavedListItemResponse]


class SavedCreateResponseItem(BaseModel):
    id: UUID
    restaurantId: UUID
    savedFromPostcode: str
    visited: bool
    reviewText: str | None
    userRating: int | None


class SavedCreateResponse(BaseModel):
    item: SavedCreateResponseItem


class SavedDeleteResponse(BaseModel):
    deleted: Literal[True]
