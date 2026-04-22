import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine

from app.api.router import api_router
from app.config import Settings, get_settings
from app.db.session import (
    create_engine,
    create_session_factory,
    verify_database_connection,
)
from app.shared.error_handlers import register_exception_handlers
from app.shared.redis import create_redis_client, verify_redis_connection

logger = logging.getLogger(__name__)

DatabaseHealthcheck = Callable[[AsyncEngine], Awaitable[None]]
RedisHealthcheck = Callable[[Redis], Awaitable[None]]


def create_app(
    *,
    settings: Settings | None = None,
    database_healthcheck: DatabaseHealthcheck = verify_database_connection,
    redis_healthcheck: RedisHealthcheck = verify_redis_connection,
) -> FastAPI:
    if settings is None:
        settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = create_engine(settings)
        session_factory = create_session_factory(engine)
        redis_client = create_redis_client(settings)

        app.state.settings = settings
        app.state.db_engine = engine
        app.state.db_session_factory = session_factory
        app.state.redis = redis_client

        try:
            await database_healthcheck(engine)
            await redis_healthcheck(redis_client)
            yield
        except Exception:
            logger.exception(
                "Application startup failed while verifying PostgreSQL and Redis dependencies."
            )
            raise
        finally:
            await redis_client.aclose()
            await engine.dispose()

    app = FastAPI(
        title="ChefPick Backend",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(api_router, prefix="/api/v1")

    return app


app = create_app()
