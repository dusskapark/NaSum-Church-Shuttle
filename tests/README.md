# Migration Test Checklists

This folder stores markdown checklists used during major migrations.

## Rules

- Create one checklist file per migration.
- Keep all test items as unchecked (`[ ]`) before execution.
- Mark results inline (`[x]`, notes, links to evidence) during testing.
- Split items into:
  - `Auto` (CDP/browser automation by Codex)
  - `Manual` (human validation, e.g. LINE in-app QR flow)
- Reuse the template in `tests/checklists/migration-template.md`.

## Naming

- `tests/checklists/<topic>-migration-checklist.md`
- Example: `app-router-migration-checklist.md`

## Executable Smoke

- `tests/e2e/admin-api-smoke.mjs` provides an executable admin API smoke test.
- Run non-destructive mode: `npm run test:admin-api-smoke`
- Run destructive mode: `npm run test:admin-api-smoke:destructive`
- Disable destructive cleanup: `node tests/e2e/admin-api-smoke.mjs --destructive --no-cleanup`

## Playwright UI Smoke

- `tests/e2e/app-smoke.spec.ts` provides top-level UI smoke coverage with Playwright.
- Run: `npm run test:e2e`
- Headed run: `npm run test:e2e:headed`
- Default web server target: `http://localhost:3100`
- The Playwright config starts `next dev -- --port 3100` automatically unless an existing server is already available.

### Destructive Safety Guard

- Destructive mode is allowed by default only for local `BASE_URL` (`localhost`/`127.0.0.1`).
- For non-local targets, set `ALLOW_DESTRUCTIVE_ADMIN_SMOKE=true` explicitly.
