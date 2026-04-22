# ChefPick Backend

FastAPI backend: restaurant discovery by postcode + saved list management with visit tracking.

**See [DOCS.md](DOCS.md) for backend details and `../README.md` for full-stack Docker setup.**

## Quick Start

### Run with Docker

```bash
docker compose up -d --build
docker compose exec backend alembic upgrade head
curl http://127.0.0.1:8000/api/v1/health
docker compose down
```
