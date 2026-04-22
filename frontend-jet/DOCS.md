# ChefPick — Frontend

Mobile-first restaurant discovery app.

## Stack

- React 18 + TypeScript 5
- Vite 5
- Tailwind CSS 3
- TanStack Query 5
- React Router 6
- Leaflet (map)
- Vitest + Testing Library

## Prerequisites

- Docker + Docker Compose plugin (`docker compose`)
- Optional for local hot reload mode: Node 18+ and npm

## Docker-first run

From repo root:

```bash
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

Open:

- Frontend: `http://localhost:8080`
- Frontend -> backend health proxy: `http://localhost:8080/api/v1/health`

## Scripts

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build
npm run build:dev    # build with development mode
npm run preview      # serve the built output
npm run lint
npm test             # vitest run
npm run test:watch
```

## Backend connection

The frontend talks to `/api/v1/...`. Two modes:

1. **Docker runtime mode.** Nginx inside the `frontend` container proxies `/api/*`
   to `backend:8000`.
2. **Local Vite mode.** `vite.config.ts` proxies `/api/*` to
   `VITE_API_PROXY_TARGET` (default `http://127.0.0.1:8000`).
3. **Direct mode.** Set `VITE_API_BASE_URL` in `.env` to call the backend
   directly (bypasses the proxy):

   ```
   VITE_API_BASE_URL=http://localhost:8000
   ```

See `.env.example`.

## API contract

Single source of truth: `src/lib/api/types.ts` and `src/lib/api/endpoints.ts`.
Do not drift from the documented `/api/v1` contract. Errors are normalized to
`ApiErrorKind` in `src/lib/api/client.ts` and mapped to user-facing strings in
`src/lib/errors.ts`.

## Project layout

```
src/
  components/         UI (shell, discovery, saved, onboarding, ui/)
  hooks/              Reusable hooks
  lib/
    api/              client, endpoints, types, query hooks
    errors.ts         ApiErrorKind → user message
    format.ts         display formatters
    savedFilters.ts   saved-list filter state (URL/localStorage)
    lastPostcode.ts   last-used postcode persistence
  pages/              route-level components
  test/               vitest setup
  index.css           design tokens (HSL semantic)
tailwind.config.ts    token → utility mapping
```

## Design system

All colors are HSL semantic tokens defined in `src/index.css` and mapped in
`tailwind.config.ts`. Components must use semantic classes (`bg-brand`,
`text-ink`, etc.) — never raw colors.

## Testing

Vitest with jsdom + Testing Library. Setup file: `src/test/setup.ts`.
Run a single file: `npm test -- src/path/to/file.test.tsx`.

Docker test command (from repo root):

```bash
docker compose --profile test run --rm frontend-test npm test
```

## Path alias

`@/*` → `src/*` (configured in `tsconfig.json` and `vite.config.ts`).
