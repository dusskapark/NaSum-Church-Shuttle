# Verification Results

Date: 2026-04-15

## Environment
- Dev server: `next dev`
- Auth mode: localhost development bypass
- Database: Neon Postgres (`DIRECT_URL`)
- Seed source: latest local dataset exported and imported to Neon

## Verified
- `GET /api/v1/routes` returns seeded route data from Neon
- `/` renders route list and Google Map with seeded route data
- `/search` renders seeded stop catalog
- `/stops?placeId=...` renders stop detail and route choices
- `/notifications` renders without runtime errors
- `/settings` renders with dev-bypass profile and preference controls
- `/admin/routes` renders seeded admin route list
- `/admin/runs` renders active/history tabs and start-run actions
- `/admin/users` renders role management view
- `/scan?routeCode=east-a-260224`
  - empty-state works when no active run exists
  - `Start Run` creates an active run
  - active-run check-in screen renders afterwards
- `npm run typecheck` passes
- `npm run build` passes

## Notes
- App Router migration is active; React Router warnings are no longer relevant.
- Localhost intentionally bypasses LIFF login and uses a local dev token.
- Server DB access uses `DATABASE_URL` only.

---

Date: 2026-04-17

## Additional Verification (App Router Migration Follow-up)
- `npm run typecheck`: pass
- `npm run build`: pass
- Deep-link query sync:
  - valid query (`/?route=east-a-260224&stop=...`) remains on URL and renders route
  - invalid query (`/?route=L1&stop=rs-l1-04`) auto-normalizes to `/`
- API split smoke checks:
  - `GET /api/v1/routes` => `200`
  - `GET /api/v1/user-registration?...` => `200`
  - `POST /api/v1/line-auth/session` with empty body => `400` (expected)
  - `GET /api/v1/checkin/run-status?routeCode=east-a-260224` => `200`
  - `GET /api/v1/checkin/run?routeCode=east-a-260224` => `404` (no active run, expected in current dataset state)
  - `GET /api/v1/checkin/me?run_id=test` => `401` (historical snapshot; route removed later in optimization refactor)
  - `POST /api/v1/checkin` with empty body => `401` (auth required)
  - `GET /api/v1/admin/run-schedule` => `401` (admin auth required)
- Search accessibility follow-up:
  - `/search` `Nearby` tab now triggers geolocation request immediately on tab switch.
  - App route DOM no longer has form fields missing both `id` and `name` on checked pages (`/search`, `/settings`).
  - Remaining console a11y issue in dev is from Next.js dev overlay-injected controls (non-app DOM).

---

Date: 2026-04-18

## Additional Verification (Optimization Refactor)
- `npm run build`: pass
- `npm run typecheck`: pass
- `npx prisma validate`: pass
- `BASE_URL=http://localhost:3001 npm run test:admin-api-smoke`: pass
- Static prerender recovery confirmed for:
  - `/`
  - `/search`
  - `/scan`
  - `/stops`
  - `/notifications`
  - `/settings`
  - `/admin`
  - `/admin/runs`
  - `/admin/users`
  - `/admin/registrations`
  - `/admin/routes`
- Route data split confirmed:
  - `GET /api/v1/routes/summary` available
  - `GET /api/v1/routes/[routeCode]` available
  - `GET /api/v1/places` available
  - `GET /api/v1/places/[googlePlaceId]/routes` available
- Notification optimization confirmed:
  - unread badge uses `GET /api/v1/notifications/unread-count`
  - arrival push payload reduced to simplified Flex with `QR스캔` and `루트보기`
- Admin API split confirmed:
  - runs, places, routes, schedules handlers are no longer centralized in a single `_handlers.ts`
- Legacy cleanup confirmed:
  - `app/api/v1/checkin/me/route.ts` removed
  - dead `styles/globals.css` removed
  - unused `maplibre-gl` package removed
- Client shell cleanup confirmed:
  - `ClientProviders` now delegates global effects to `src/spa/GlobalClientEffects.tsx`
- Admin API split confirmed:
  - `admin/runs`, `admin/places`, `admin/routes`, `admin/schedules` all use dedicated handler modules
- Smoke coverage refreshed on 2026-04-18 03:24 +08:
  - `GET /api/v1/admin/routes` => `200`
  - `GET /api/v1/admin/routes/{id}` => `200`
  - `GET /api/v1/admin/routes/{id}/stops` => `200`
  - `GET /api/v1/admin/schedules` => `200`
  - `GET /api/v1/admin/schedules/{id}` => `200`
  - `GET /api/v1/admin/runs?status=active` => `200`
  - `POST /api/v1/admin/download-tokens/blob` => `200`
  - `GET /api/v1/downloads/{token}` => `200`
