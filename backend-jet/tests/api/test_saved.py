from datetime import UTC, datetime
from uuid import uuid4

import httpx
import pytest

from app.api.saved import get_saved_service
from app.main import create_app
from app.modules.saved.schemas import (
    SavedCreateResponse,
    SavedCreateResponseItem,
    SavedDeleteResponse,
    SavedListItemResponse,
    SavedListResponse,
)
from app.shared.errors import (
    InvalidSavedRestaurantError,
    RatingRequiresVisitedError,
    SavedItemNotFoundError,
)


async def _noop(_: object) -> None:
    return None


class FakeSavedService:
    def __init__(self, *, response=None, error=None) -> None:
        self.response = response
        self.error = error
        self.calls: list[tuple[str, tuple, dict]] = []

    async def list_saved(self, **kwargs):
        self.calls.append(("list_saved", (), kwargs))
        if self.error is not None:
            raise self.error
        return self.response

    async def save_restaurant(self, restaurant_id, saved_from_postcode):
        self.calls.append(
            ("save_restaurant", (restaurant_id, saved_from_postcode), {})
        )
        if self.error is not None:
            raise self.error
        return self.response

    async def update_saved(self, saved_id, **kwargs):
        self.calls.append(("update_saved", (saved_id,), kwargs))
        if self.error is not None:
            raise self.error
        return self.response

    async def delete_saved(self, saved_id):
        self.calls.append(("delete_saved", (saved_id,), {}))
        if self.error is not None:
            raise self.error
        return self.response


def _build_app(fake_service: FakeSavedService):
    from app.config import Settings

    app = create_app(
        settings=Settings(
            APP_ENV="test",
            DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/chefpick_test",
            REDIS_URL="redis://localhost:6379/1",
            CORS_ALLOWED_ORIGINS="http://localhost:5173",
        ),
        database_healthcheck=_noop,
        redis_healthcheck=_noop,
    )

    async def _override_saved_service() -> FakeSavedService:
        return fake_service

    app.dependency_overrides[get_saved_service] = _override_saved_service
    return app


@pytest.mark.anyio
async def test_saved_list_route_happy_path() -> None:
    fake_service = FakeSavedService(
        response=SavedListResponse(
            items=[
                SavedListItemResponse(
                    id=uuid4(),
                    restaurantId=uuid4(),
                    name="Mario's",
                    cuisines=["Italian", "Pizza"],
                    rating=4.7,
                    addressText="123 High Street, London",
                    savedFromPostcode="EC4M7RF",
                    savedAt=datetime.now(UTC),
                    visited=False,
                    visitedAt=None,
                    reviewText=None,
                    userRating=None,
                )
            ]
        )
    )
    app = _build_app(fake_service)

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get("/api/v1/saved")

    assert response.status_code == 200
    assert response.json()["items"][0]["name"] == "Mario's"
    assert fake_service.calls == [(
        "list_saved",
        (),
        {
            "saved_from_postcode": None,
            "visited": None,
            "has_user_rating": None,
            "has_review_text": None,
        },
    )]


@pytest.mark.anyio
async def test_saved_list_route_forwards_all_filters() -> None:
    fake_service = FakeSavedService(response=SavedListResponse(items=[]))
    app = _build_app(fake_service)

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get(
                "/api/v1/saved",
                params={
                    "savedFromPostcode": "EC4M7RF",
                    "visited": "true",
                    "hasUserRating": "false",
                    "hasReviewText": "true",
                },
            )

    assert response.status_code == 200
    assert fake_service.calls == [(
        "list_saved",
        (),
        {
            "saved_from_postcode": "EC4M7RF",
            "visited": True,
            "has_user_rating": False,
            "has_review_text": True,
        },
    )]


@pytest.mark.anyio
async def test_saved_list_route_rejects_non_boolean_filter() -> None:
    fake_service = FakeSavedService(response=SavedListResponse(items=[]))
    app = _build_app(fake_service)

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get("/api/v1/saved", params={"visited": "maybe"})

    assert response.status_code == 422


@pytest.mark.anyio
async def test_saved_create_route_happy_path() -> None:
    saved_id = uuid4()
    restaurant_id = uuid4()
    fake_service = FakeSavedService(
        response=SavedCreateResponse(
            item=SavedCreateResponseItem(
                id=saved_id,
                restaurantId=restaurant_id,
                savedFromPostcode="EC4M7RF",
                visited=False,
                reviewText=None,
                userRating=None,
            )
        )
    )
    app = _build_app(fake_service)

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/api/v1/saved",
                json={
                    "restaurantId": str(restaurant_id),
                    "savedFromPostcode": "EC4M7RF",
                },
            )

    assert response.status_code == 200
    assert response.json() == {
        "item": {
            "id": str(saved_id),
            "restaurantId": str(restaurant_id),
            "savedFromPostcode": "EC4M7RF",
            "visited": False,
            "reviewText": None,
            "userRating": None,
        }
    }
    assert fake_service.calls[0][0] == "save_restaurant"


@pytest.mark.anyio
async def test_saved_update_route_happy_path() -> None:
    saved_id = uuid4()
    fake_service = FakeSavedService(
        response=SavedListItemResponse(
            id=saved_id,
            restaurantId=uuid4(),
            name="Mario's",
            cuisines=["Italian", "Pizza"],
            rating=4.7,
            addressText="123 High Street, London",
            savedFromPostcode="EC4M7RF",
            savedAt=datetime.now(UTC),
            visited=True,
            visitedAt=datetime.now(UTC),
            reviewText="Great pizza.",
            userRating=4,
        )
    )
    app = _build_app(fake_service)

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.patch(
                f"/api/v1/saved/{saved_id}",
                json={"visited": True, "reviewText": "Great pizza.", "userRating": 4},
            )

    assert response.status_code == 200
    assert response.json()["visited"] is True
    assert response.json()["reviewText"] == "Great pizza."
    assert response.json()["userRating"] == 4
    assert fake_service.calls[0][0] == "update_saved"


@pytest.mark.anyio
async def test_saved_delete_route_happy_path() -> None:
    saved_id = uuid4()
    fake_service = FakeSavedService(response=SavedDeleteResponse(deleted=True))
    app = _build_app(fake_service)

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.delete(f"/api/v1/saved/{saved_id}")

    assert response.status_code == 200
    assert response.json() == {"deleted": True}
    assert fake_service.calls == [("delete_saved", (saved_id,), {})]


@pytest.mark.anyio
async def test_saved_create_unknown_restaurant_returns_400() -> None:
    app = _build_app(FakeSavedService(error=InvalidSavedRestaurantError()))

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/api/v1/saved",
                json={
                    "restaurantId": str(uuid4()),
                    "savedFromPostcode": "EC4M7RF",
                },
            )

    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "INVALID_REQUEST",
            "message": "Restaurant could not be saved because it does not exist.",
        }
    }


@pytest.mark.anyio
async def test_saved_update_unknown_saved_id_returns_404() -> None:
    app = _build_app(FakeSavedService(error=SavedItemNotFoundError()))

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.patch(
                f"/api/v1/saved/{uuid4()}",
                json={"visited": True},
            )

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "NOT_FOUND",
            "message": "Saved item not found.",
        }
    }


@pytest.mark.anyio
async def test_saved_delete_unknown_saved_id_returns_404() -> None:
    app = _build_app(FakeSavedService(error=SavedItemNotFoundError()))

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.delete(f"/api/v1/saved/{uuid4()}")

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "NOT_FOUND",
            "message": "Saved item not found.",
        }
    }


@pytest.mark.anyio
async def test_saved_create_invalid_body_returns_422() -> None:
    app = _build_app(FakeSavedService(response=SavedDeleteResponse(deleted=True)))

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/api/v1/saved",
                json={"restaurantId": str(uuid4()), "savedFromPostcode": "   "},
            )

    assert response.status_code == 422


@pytest.mark.anyio
async def test_saved_update_empty_body_returns_422() -> None:
    app = _build_app(FakeSavedService(response=SavedDeleteResponse(deleted=True)))

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.patch(f"/api/v1/saved/{uuid4()}", json={})

    assert response.status_code == 422


@pytest.mark.anyio
async def test_saved_update_rating_without_visited_returns_409() -> None:
    app = _build_app(FakeSavedService(error=RatingRequiresVisitedError()))

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.patch(
                f"/api/v1/saved/{uuid4()}",
                json={"userRating": 4},
            )

    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "RATING_REQUIRES_VISITED",
            "message": "A saved restaurant can only be rated once it has been marked as visited.",
        }
    }


@pytest.mark.anyio
async def test_saved_update_user_rating_out_of_range_returns_422() -> None:
    app = _build_app(FakeSavedService(response=SavedDeleteResponse(deleted=True)))

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.patch(
                f"/api/v1/saved/{uuid4()}",
                json={"userRating": 0},
            )

    assert response.status_code == 422
