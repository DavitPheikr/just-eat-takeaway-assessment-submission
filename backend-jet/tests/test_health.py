import httpx
import pytest

from app.config import Settings
from app.main import create_app


async def _noop(_: object) -> None:
    return None


def _test_settings() -> Settings:
    return Settings(
        APP_ENV="test",
        DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/chefpick_test",
        REDIS_URL="redis://localhost:6379/1",
        CORS_ALLOWED_ORIGINS="http://localhost:5173",
    )


@pytest.mark.anyio
async def test_health_endpoint_returns_expected_payload() -> None:
    app = create_app(
        settings=_test_settings(),
        database_healthcheck=_noop,
        redis_healthcheck=_noop,
    )

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
