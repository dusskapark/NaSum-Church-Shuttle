# Verification Results

Date: 2026-04-15

## Environment
- Dev server: `next dev`
- Auth mode: localhost development bypass
- Database: local Docker Postgres on `127.0.0.1:5434`
- Seed source: `reference/check-in-shuttle-buses-api/dump.sql` + `db/reference/migrations/*.sql`

## Verified
- `GET /api/v1/routes` returns seeded route data from local Postgres
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
- React Router still emits a future-flag warning in development. This is non-blocking and does not affect runtime correctness.
- Localhost intentionally bypasses LIFF login and uses a local dev token.
- Server DB access in development intentionally prefers the local Docker Postgres database over `.env.local` Neon settings.
