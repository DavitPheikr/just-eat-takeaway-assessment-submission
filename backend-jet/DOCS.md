# ChefPick Backend Documentation

## Overview

FastAPI backend providing restaurant discovery and saved list management for the ChefPick application.

**Scope:**

- Restaurant discovery by UK postcode
- Saved restaurants CRUD with visit tracking and user ratings
- Health liveness endpoint
- PostgreSQL persistence + Redis caching
- Async request handling

---

## System Design

### Architecture Style

Layered modular monolith:

- **API layer (`app/api`)** handles HTTP routing, request validation, and response models.
- **Service layer (`app/modules`)** contains business rules and orchestration.
- **Repository layer (`app/repositories`)** owns database reads/writes.
- **Infrastructure layer (`app/db`, `app/shared`)** provides PostgreSQL sessions, Redis client, settings, and shared error handling.

### Runtime Components

- **FastAPI app**: single backend process exposing `/api/v1/*` routes.
- **PostgreSQL**: source of truth for `restaurants` and `saved_restaurants`.
- **Redis**: read-through cache for discovery searches by normalized postcode.
- **Just Eat discovery API**: upstream provider for restaurant discovery data.

### Request Flow

`Frontend -> FastAPI route -> Service -> (Redis/PostgreSQL/Upstream) -> Service -> JSON response`

- Discovery flow checks Redis first, then calls upstream on cache miss, upserts restaurant rows, and caches shaped response.
- Saved flow is database-backed and uses snapshot payloads to preserve data shown at save time.

### Design Decisions

- **Fail-fast startup**: app checks PostgreSQL and Redis on startup; process does not run with broken core dependencies.
- **Server-side normalization**: postcodes are normalized in backend to keep filtering/cache keys deterministic.
- **Snapshot consistency**: saved items return stored snapshot fields instead of live restaurant rows to avoid drift.
- **Clear boundary**: no auth in current backend scope.

---

## Project Structure

```
app/
├── main.py              # FastAPI app initialization, dependency checks
├── config.py            # Environment configuration
├── api/
│   ├── router.py        # Route mounting
│   ├── health.py        # Health endpoint
│   ├── discovery.py     # Discovery endpoints
│   └── saved.py         # Saved restaurants endpoints
├── db/
│   ├── models.py        # SQLAlchemy ORM models (Restaurants, SavedRestaurants)
│   ├── base.py          # Declarative base
│   └── session.py       # Database and Redis session factories
├── repositories/        # Data access layer
│   ├── restaurant_repository.py
│   └── saved_restaurant_repository.py
├── modules/             # Business logic
│   ├── discovery/       # Discovery service
│   └── saved/           # Saved restaurants service
└── shared/
    ├── redis.py         # Redis client
    ├── errors.py        # Custom exceptions
    └── error_handlers.py # Error middleware
```

---

## Setup & Running

### Prerequisites

- Docker
- Docker Compose plugin (`docker compose`)

### Running with Docker

```bash
# From repo root
docker compose up -d --build

# Run migrations
docker compose exec backend alembic upgrade head

# Check health
curl http://127.0.0.1:8000/api/v1/health

# Stop
docker compose down
```

### Testing with Docker

```bash
# From repo root
docker compose --profile test run --rm backend-test
```

---

## Environment Variables

| Variable               | Required | Description                                                  |
| ---------------------- | -------- | ------------------------------------------------------------ |
| `APP_ENV`              | Yes      | Runtime environment (`development`, `test`, `production`)    |
| `DATABASE_URL`         | Yes      | Async SQLAlchemy PostgreSQL URL (`postgresql+asyncpg://...`) |
| `REDIS_URL`            | Yes      | Redis connection URL                                         |
| `CORS_ALLOWED_ORIGINS` | No       | Comma-separated allowed frontend origins                     |

---

## API Endpoints

All endpoints return JSON. Base URL: `/api/v1`

### Health Check

```
GET /api/v1/health
```

**Response 200:**

```json
{ "status": "ok" }
```

---

### Discovery Search

```
GET /api/v1/discovery/search?postcode={postcode}
```

Returns top 10 restaurants for a UK postcode.

**Query Parameters:**

- `postcode` (required, string) — UK postcode. Normalized server-side (trimmed, uppercased, spaces removed).

**Behavior:**

- Checks Redis cache first; fetches from Just Eat API on miss and caches result
- Upserts restaurant records into PostgreSQL
- Returns max 10 results; empty list is valid if postcode has no restaurants
- Null coordinates are valid (restaurants not plotted on map if coordinates missing)
- `minimumOrderPence`, `deliveryEtaMinutes`, `openNow` may be null

**Response 200:**

```json
{
  "postcode": "EC4M7RF",
  "restaurants": [
    {
      "id": "internal-uuid",
      "externalRestaurantId": "je-123",
      "name": "Mario's",
      "cuisines": ["Italian", "Pizza"],
      "rating": 4.7,
      "addressText": "123 High Street, London",
      "latitude": 51.0,
      "longitude": -0.1,
      "minimumOrderPence": 1200,
      "deliveryEtaMinutes": 25,
      "openNow": true
    }
  ]
}
```

**Error Responses:**

- `422` — postcode missing or invalid format
- `400` — postcode structurally valid but rejected by Just Eat as invalid
- `502` — Just Eat API unreachable or non-parsable response
- `500` — unhandled backend error

---

### List Saved Restaurants

```
GET /api/v1/saved
```

Returns saved restaurants in reverse chronological order (newest first).

**Query Parameters (all optional):**

| Name                | Type    | Behavior                                                    |
| ------------------- | ------- | ----------------------------------------------------------- |
| `savedFromPostcode` | string  | Filter by normalized postcode                               |
| `visited`           | boolean | Filter by visited state (`true` or `false`)                 |
| `hasUserRating`     | boolean | Only matches if `visited=true` AND `userRating IS NOT NULL` |
| `hasReviewText`     | boolean | Only matches if `visited=true` AND `reviewText IS NOT NULL` |

**Notes:**

- Ratings and reviews are only "present" for filtering when `visited=true`, but stored values persist across visited toggling
- Filters combine with AND logic
- Contradictory combinations (e.g., `visited=false&hasUserRating=true`) return empty list

**Examples:**

```
GET /api/v1/saved?visited=true
GET /api/v1/saved?savedFromPostcode=EC4M7RF
GET /api/v1/saved?visited=true&hasUserRating=true
GET /api/v1/saved?hasReviewText=true&savedFromPostcode=ec4m%207rf
```

**Response 200:**

```json
{
  "items": [
    {
      "id": "saved-uuid",
      "restaurantId": "restaurant-uuid",
      "name": "Mario's",
      "cuisines": ["Italian", "Pizza"],
      "rating": 4.7,
      "addressText": "123 High Street, London",
      "savedFromPostcode": "EC4M7RF",
      "savedAt": "2026-04-20T12:00:00Z",
      "visited": false,
      "visitedAt": null,
      "reviewText": null,
      "userRating": null
    }
  ]
}
```

**Snapshot Note:** Restaurant details (`name`, `cuisines`, `rating`, `addressText`) are stored snapshots captured when saved, not live data. This preserves what the user saw at save time.

---

### Save Restaurant

```
POST /api/v1/saved
```

Saves a restaurant (idempotent). If already saved, returns the existing record without modification.

**Request Body:**

```json
{
  "restaurantId": "restaurant-uuid",
  "savedFromPostcode": "EC4M7RF"
}
```

- `restaurantId` (required, string) — Must exist in `restaurants` table (from prior discovery search)
- `savedFromPostcode` (required, string) — Will be normalized server-side

**Response 201:**

```json
{
  "id": "saved-uuid",
  "restaurantId": "restaurant-uuid",
  "name": "Mario's",
  "cuisines": ["Italian", "Pizza"],
  "rating": 4.7,
  "addressText": "123 High Street, London",
  "savedFromPostcode": "EC4M7RF",
  "savedAt": "2026-04-20T12:00:00Z",
  "visited": false,
  "visitedAt": null,
  "reviewText": null,
  "userRating": null
}
```

(Response 200 if record already existed)

**Error Responses:**

- `422` — missing or invalid fields
- `404` — restaurantId does not exist
- `400` — postcode invalid

---

### Update Saved Restaurant

```
PATCH /api/v1/saved/{savedId}
```

Updates visited state, review text, and/or user rating.

**Path Parameters:**

- `savedId` (required, string) — UUID of saved restaurant record

**Request Body (all optional):**

```json
{
  "visited": true,
  "reviewText": "Great pizza.",
  "userRating": 4
}
```

**Behavior:**

- `visited` — toggle to `true` or `false`; changes are idempotent
- `visitedAt` — automatically set to now when `visited` transitions to `true`; does not clear when toggled back to `false`
- `userRating` — integer 1-5, or `null` to clear; requires `visited=true` to set non-null value
- `reviewText` — free text; requires `visited=true` to set non-null value
- Stored ratings/reviews persist when toggling `visited=false`; they reappear when toggling `visited=true` again

**Response 200:**

```json
{
  "id": "saved-uuid",
  "restaurantId": "restaurant-uuid",
  "name": "Mario's",
  "cuisines": ["Italian", "Pizza"],
  "rating": 4.7,
  "addressText": "123 High Street, London",
  "savedFromPostcode": "EC4M7RF",
  "savedAt": "2026-04-20T12:00:00Z",
  "visited": true,
  "visitedAt": "2026-04-21T10:30:00Z",
  "reviewText": "Great pizza.",
  "userRating": 4
}
```

**Error Responses:**

- `422` — invalid field types or values
- `404` — savedId does not exist
- `409 RATING_REQUIRES_VISITED` — attempted to set non-null `userRating` without `visited=true`

---

### Delete Saved Restaurant

```
DELETE /api/v1/saved/{savedId}
```

Removes a saved restaurant record.

**Response 204** — no content (success)

**Error Responses:**

- `404` — savedId does not exist

---

## Database Schema

### Restaurants Table

Stores restaurant records upserted from Just Eat discovery API.

```sql
CREATE TABLE restaurants (
  id UUID PRIMARY KEY,
  external_restaurant_id VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  cuisines TEXT[],
  rating NUMERIC,
  address_text VARCHAR(255),
  latitude NUMERIC,
  longitude NUMERIC,
  minimum_order_pence INTEGER,
  delivery_eta_minutes INTEGER,
  open_now BOOLEAN,
  updated_at TIMESTAMP
);
```

### Saved Restaurants Table

Stores user-saved restaurants with visit tracking and ratings.

```sql
CREATE TABLE saved_restaurants (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants,
  saved_from_postcode VARCHAR(10),
  saved_at TIMESTAMP,
  visited BOOLEAN DEFAULT FALSE,
  visited_at TIMESTAMP,
  review_text TEXT,
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5 OR user_rating IS NULL),
  snapshot_payload JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**snapshot_payload** stores the restaurant details (`name`, `cuisines`, `rating`, `addressText`) at save time.

---

## Migrations

Migrations are managed with Alembic.

```bash
# Apply pending migrations
docker compose exec backend alembic upgrade head

# Create a new migration inside backend container
docker compose exec backend alembic revision --autogenerate -m "description"

# View migration history
docker compose exec backend alembic current
```

---

## Error Handling

Validation errors return `422` with FastAPI's standard Pydantic error body.

Domain errors return `400` with a shaped response:

```json
{
  "detail": "Error message"
}
```

---

## Development Notes

- All database queries use async SQLAlchemy (`asyncpg` driver)
- Redis is used only for discovery postcode caching
- No authentication in current scope
- CORS is configured per `CORS_ALLOWED_ORIGINS` environment variable
- Request validation is enforced at Pydantic schema level
