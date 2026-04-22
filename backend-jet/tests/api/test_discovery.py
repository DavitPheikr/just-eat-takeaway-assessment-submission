import httpx
import pytest

from app.api.discovery import get_discovery_service
from app.main import create_app
from app.modules.discovery.schemas import DiscoveryRestaurantResponse, DiscoverySearchResponse
from app.shared.errors import InvalidPostcodeError, UpstreamUnavailableError


async def _noop(_: object) -> None:
    return None


class FakeDiscoveryService:
    def __init__(self, response=None, error=None) -> None:
        self.response = response
        self.error = error
        self.calls = []

    async def search(self, postcode: str):
        self.calls.append(postcode)
        if self.error is not None:
            raise self.error
        return self.response


def _build_app(fake_service: FakeDiscoveryService):
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

    async def _override_discovery_service() -> FakeDiscoveryService:
        return fake_service

    app.dependency_overrides[get_discovery_service] = _override_discovery_service
    return app


@pytest.mark.anyio
async def test_discovery_route_happy_path() -> None:
    fake_service = FakeDiscoveryService(
        response=DiscoverySearchResponse(
            postcode="EC4M7RF",
            restaurants=[
                DiscoveryRestaurantResponse(
                    id="d66441b1-1220-490c-90fd-aac446b8175c",
                    externalRestaurantId="123",
                    name="Mario's",
                    cuisines=["Italian", "Pizza"],
                    rating=4.7,
                    addressText="123 High Street, London",
                    latitude=51.5,
                    longitude=-0.1,
                    minimumOrderPence=1200,
                    deliveryEtaMinutes=25,
                    openNow=True,
                )
            ],
        )
    )
    app = _build_app(fake_service)

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get(
                "/api/v1/discovery/search",
                params={"postcode": "EC4M7RF"},
            )

    assert response.status_code == 200
    assert response.json()["postcode"] == "EC4M7RF"
    assert response.json()["restaurants"][0]["externalRestaurantId"] == "123"
    assert fake_service.calls == ["EC4M7RF"]


@pytest.mark.anyio
async def test_discovery_route_missing_postcode_returns_422() -> None:
    app = _build_app(FakeDiscoveryService(response=DiscoverySearchResponse(postcode="EC4M7RF", restaurants=[])))

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get("/api/v1/discovery/search")

    assert response.status_code == 422


@pytest.mark.anyio
async def test_discovery_route_blank_postcode_returns_422() -> None:
    app = _build_app(FakeDiscoveryService(response=DiscoverySearchResponse(postcode="EC4M7RF", restaurants=[])))

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get(
                "/api/v1/discovery/search",
                params={"postcode": "   "},
            )

    assert response.status_code == 422


@pytest.mark.anyio
async def test_discovery_route_upstream_rejected_postcode_returns_400() -> None:
    app = _build_app(FakeDiscoveryService(error=InvalidPostcodeError()))

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get(
                "/api/v1/discovery/search",
                params={"postcode": "INVALID"},
            )

    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "INVALID_POSTCODE",
            "message": "Postcode could not be validated by upstream.",
        }
    }


@pytest.mark.anyio
async def test_discovery_route_upstream_failure_returns_502() -> None:
    app = _build_app(FakeDiscoveryService(error=UpstreamUnavailableError()))

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get(
                "/api/v1/discovery/search",
                params={"postcode": "EC4M7RF"},
            )

    assert response.status_code == 502
    assert response.json() == {
        "error": {
            "code": "UPSTREAM_UNAVAILABLE",
            "message": "Upstream restaurant service is unavailable.",
        }
    }
