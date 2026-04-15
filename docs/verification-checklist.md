# Verification Checklist

## Goal
Bring the migrated app to a state where:
- the app starts in local dev with `.env.local`
- LIFF-only flows have a development bypass
- Neon DB can be reset and seeded from the latest local dataset
- core rider/admin pages render with real seeded data
- no blocking runtime errors remain in browser console for covered paths

## Environment Under Test
- Frontend/runtime: local `next dev`
- Database: Neon Postgres (`DATABASE_URL`/`DIRECT_URL`)
- Auth mode: development bypass when LIFF is unavailable
- Browser validation: CDP/Chrome DevTools

## Pass Criteria
1. Neon target DB is reachable via `DIRECT_URL`.
2. Latest dataset import into Neon completes without fatal SQL errors.
3. `next dev` starts successfully with local env values.
4. `/` renders route list/map shell without crashing.
5. `/search` renders stations from seeded DB.
6. `/stops?placeId=...` renders stop detail from seeded DB.
7. `/scan?routeCode=...` renders run/check-in UI without fatal errors.
8. `/notifications` and `/settings` render without fatal errors.
9. Admin entry and at least these admin pages load data:
   - `/admin/routes`
   - `/admin/runs`
   - `/admin/users`
10. Browser console has no unhandled blocking error on the covered paths.

## Iteration Rule
- If any step fails, fix the code/config and rerun the affected checks.
- Record meaningful milestones as commits under the Codex branch.
