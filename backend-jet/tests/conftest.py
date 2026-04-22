import pytest

from app.config import Settings, get_settings
from app.main import create_app


@pytest.fixture(autouse=True)
def clear_settings_cache() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        APP_ENV="test",
        DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/chefpick_test",
        REDIS_URL="redis://localhost:6379/1",
        CORS_ALLOWED_ORIGINS="http://localhost:5173",
    )


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def app_factory(test_settings: Settings):
    async def _noop(_: object) -> None:
        return None

    def _factory() -> object:
        return create_app(
            settings=test_settings,
            database_healthcheck=_noop,
            redis_healthcheck=_noop,
        )

    return _factory
