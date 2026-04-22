from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.config import Settings


def create_redis_client(settings: Settings) -> Redis:
    return Redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
    )


async def verify_redis_connection(redis_client: Redis) -> None:
    try:
        await redis_client.ping()
    except RedisError as exc:
        raise RuntimeError("Redis dependency check failed.") from exc
