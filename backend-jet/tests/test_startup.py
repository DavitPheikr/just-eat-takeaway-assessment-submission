import pytest
from starlette.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.main import create_app


def _test_settings(
    *,
    cors_allowed_origins: str = "http://localhost:5173",
) -> Settings:
    return Settings(
        APP_ENV="test",
        DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/chefpick_test",
        REDIS_URL="redis://localhost:6379/1",
        CORS_ALLOWED_ORIGINS=cors_allowed_origins,
    )


def test_settings_load_and_parse_cors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/chefpick_test",
    )
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/1")
    monkeypatch.setenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5173, http://localhost:4173",
    )

    settings = get_settings()

    assert settings.app_env == "test"
    assert (
        settings.database_url
        == "postgresql+asyncpg://postgres:postgres@localhost:5432/chefpick_test"
    )
    assert settings.redis_url == "redis://localhost:6379/1"
    assert settings.cors_allowed_origins == [
        "http://localhost:5173",
        "http://localhost:4173",
    ]


def test_settings_default_cors_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)

    settings = Settings()

    assert settings.cors_allowed_origins == ["http://localhost:5173"]


def test_app_applies_cors_origins_from_settings() -> None:
    app = create_app(
        settings=_test_settings(
            cors_allowed_origins="http://localhost:5173, http://localhost:4173"
        ),
    )

    cors_middleware = next(
        middleware for middleware in app.user_middleware if middleware.cls is CORSMiddleware
    )

    assert cors_middleware.kwargs["allow_origins"] == [
        "http://localhost:5173",
        "http://localhost:4173",
    ]


@pytest.mark.anyio
async def test_startup_runs_database_and_redis_healthchecks() -> None:
    calls = {"database": 0, "redis": 0}

    async def database_healthcheck(_: object) -> None:
        calls["database"] += 1

    async def redis_healthcheck(_: object) -> None:
        calls["redis"] += 1

    app = create_app(
        settings=_test_settings(),
        database_healthcheck=database_healthcheck,
        redis_healthcheck=redis_healthcheck,
    )

    async with app.router.lifespan_context(app):
        pass

    assert calls == {"database": 1, "redis": 1}


@pytest.mark.anyio
async def test_startup_fails_fast_when_database_check_fails() -> None:
    async def failing_database_healthcheck(_: object) -> None:
        raise RuntimeError("database unavailable")

    async def redis_healthcheck(_: object) -> None:
        return None

    app = create_app(
        settings=_test_settings(),
        database_healthcheck=failing_database_healthcheck,
        redis_healthcheck=redis_healthcheck,
    )

    with pytest.raises(RuntimeError, match="database unavailable"):
        async with app.router.lifespan_context(app):
            pass


@pytest.mark.anyio
async def test_startup_fails_fast_when_redis_check_fails() -> None:
    async def database_healthcheck(_: object) -> None:
        return None

    async def failing_redis_healthcheck(_: object) -> None:
        raise RuntimeError("redis unavailable")

    app = create_app(
        settings=_test_settings(),
        database_healthcheck=database_healthcheck,
        redis_healthcheck=failing_redis_healthcheck,
    )

    with pytest.raises(RuntimeError, match="redis unavailable"):
        async with app.router.lifespan_context(app):
            pass
