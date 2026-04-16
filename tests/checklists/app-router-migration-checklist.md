# App Router Migration Checklist

## Meta

- Date: 2026-04-17
- Target environment: `http://localhost:3000` (local), `https://decorating-bin-mpg-simultaneously.trycloudflare.com` (remote smoke)
- Browser profile: `~/.chrome-debug-profile`
- Scope: Replace `react-router-dom` flow with Next App Router routes

## P0 (Must Pass Before Merge)

### Auto (Codex/CDP)

- [x] `/` renders without crash and route list appears.
- [x] Tab navigation works: `/search`, `/scan`, `/notifications`, `/settings`.
- [x] Home query sync works: `?route=...`, `?route=...&stop=...`.
- [x] `/search` renders stops and navigates to `/stops?placeId=...`.
- [x] `/stops?placeId=...` renders detail page without fatal console error.
- [x] `/notifications` loads and notification deep link moves to expected route/stop query.
- [x] `/settings` loads; language/theme toggles apply without crash.
- [x] `/admin` dashboard renders for admin role.
- [x] `/admin/routes` list loads and opens `/admin/routes/[routeId]`.
- [x] `/admin/runs` loads active/history sections.
- [x] `/admin/users` loads role management view.
- [x] `/admin/registrations` loads and status action UI is functional.
- [x] `/admin/schedules/[scheduleId]` renders.
- [x] `/admin/schedules/[scheduleId]/routes/[routeId]` renders.
- [x] Invalid route renders app `not-found`.
- [x] `/api/health` returns valid JSON success response.
- [x] Browser back/forward keeps URL-state behavior consistent.
- [x] No blocking runtime error in console on covered routes.

### Manual (User, LINE App Required)

- [x] `/scan` in LINE client supports QR scan (`scanCodeV2`) and returns data.
- [x] QR scan success path performs check-in successfully.
- [x] QR scan cancel/failure path shows expected message and remains recoverable.
- [x] LIFF auth/redirect path (`/oauth-callback`) returns user to intended path.

## P1 (Post-Merge / Follow-up)

### Auto (Codex/CDP)

- [ ] Regression run after deployment with same checklist.
- [ ] Capture screenshots for key pages (`/`, `/scan`, `/admin/routes`, `/admin/runs`).
- [ ] Add smoke automation script for top-level route checks.
- [x] Run `npm run test:admin-api-smoke:destructive` on non-production data and attach result.
- [x] Validate admin action-level CDP smoke (`route sync`, `schedule publish`, `run start/end`).

### Manual (User)

- [ ] Secondary device sanity check in LINE app (iOS/Android variation if available).

## Evidence

- Build/typecheck:
  - `npm run build`: pass (Next.js 15.5.15, ESLint `react/display-name` 경고 로그는 여전히 존재)
  - `npm run typecheck`: pass (`next typegen` + `tsc --noEmit`)
- CDP execution logs:
  - `/settings` previously showed `window is not defined` (fixed)
  - `/settings` previously showed antd-mobile global px tester warning (not reproduced after fix)
  - 2026-04-16 23:43~23:48 SGT: `/`, `/search`, `/notifications`, `/settings`, `/admin` route render pass
  - 2026-04-16 23:48~23:53 SGT: `/admin/routes`, `/admin/routes/[routeId]`, `/admin/runs`, `/admin/users`, `/admin/registrations`, `/admin/schedules/[scheduleId]`, `/admin/schedules/[scheduleId]/routes/[routeId]` render pass
  - `not-found` page route verified with `/this-route-should-not-exist`
  - back/forward verified between `/search?q=tan&view=list` and `/stops?placeId=...`
  - 2026-04-17 00:20~00:26 SGT (localhost): valid deep link (`?route=east-a-260224&stop=...`) keeps query, invalid deep link (`?route=L1&stop=rs-l1-04`) auto-normalizes to `/`
  - 2026-04-17 00:26 SGT (localhost): new split endpoints smoke check
    - `GET /api/v1/routes` => `200`
    - `GET /api/v1/user-registration?...` => `200`
    - `POST /api/v1/line-auth/session` without token => `400` (expected validation)
  - 2026-04-17 00:33 SGT (remote, mobile viewport): `/search` `Nearby` tab switch now triggers geolocation call immediately (`getCurrentPosition` call count +1 on tab click)
  - 2026-04-17 00:42 SGT (remote): app DOM 기준 `input/select/textarea` missing `id/name` = `0` (`/search`, `/settings`)
  - Remaining a11y issue source: Next.js dev overlay container (`document>div[...]`) injected controls in dev mode, not app route DOM
  - 2026-04-17 00:37 SGT: `admin/users`, `admin/registrations`, `admin/registrations/[registrationId]`를 catch-all에서 분리 완료
  - 2026-04-17 00:45 SGT: `admin/download-tokens/blob`, `downloads/[token]`를 catch-all에서 분리 완료
  - 2026-04-17 00:52 SGT: `admin/{routes,schedules,runs}`를 전용 Route Handler로 분리하고 `app/api/v1/[[...slug]]`의 admin 디스패치 제거
  - 2026-04-17 01:01 SGT: `app/api/v1/[[...slug]]`에서 admin dead code(`handleAdmin*`, sync/schedule helper) 제거 완료
  - 2026-04-17 01:10 SGT: `tests/e2e/admin-api-smoke.mjs` 추가 및 `npm run test:admin-api-smoke` pass
  - 2026-04-17 01:14 SGT: `npm run test:admin-api-smoke:destructive` pass (run create + end lifecycle 포함)
  - 2026-04-17 01:22 SGT: CDP admin UI smoke 결과 문서 추가 (`tests/checklists/admin-ui-cdp-smoke-checklist.md`)
  - 2026-04-17 01:24~01:29 SGT (CDP): admin action-level 재검증 완료
    - `/admin/routes/[routeId]` sync click -> `POST .../sync` `200`
    - `/admin/runs` start/end click -> `POST /admin/runs` `201`, `POST /admin/runs/{id}/end` `200`
    - `/admin/schedules/[scheduleId]` publish click -> `POST .../publish` `200`
  - 2026-04-17 01:31~01:35 SGT: 테스트 데이터 롤백 실험
    - `1017...`(archived) -> draft 전환 후 publish 시도 결과 `POST /api/v1/admin/schedules/1017.../publish` `500`
    - 상태는 재원복(`c68e...` published, `1017...` archived) 완료
  - 2026-04-17 01:38~01:40 SGT (CDP): `/admin/registrations` delete confirm modal open/cancel 경로 확인, 실제 delete 요청은 없음
  - 2026-04-17 01:55 SGT: download token 경로를 DB 기반으로 완전 분리
    - `POST /api/v1/admin/download-tokens/blob` -> 전용 Route Handler로 이동
    - `GET /api/v1/downloads/{token}` -> 전용 Route Handler로 이동
    - `app/api/v1/[[...slug]]/route.ts` 제거(legacy catch-all 제거)
    - `node tests/e2e/admin-api-smoke.mjs` PASS (download token flow 200/200)
  - 2026-04-17 01:17 SGT: `/admin/routes/{routeId}/sync` `500`(`route_stops_route_id_sequence_key`) 이슈 수정 후 로컬 API 재검증 `200`
  - 2026-04-17 01:10 SGT: download token 경로 분리 회귀(POST 200 후 GET 404) 확인 후 `download-tokens/blob` + `downloads/[token]`를 catch-all로 복구
  - 2026-04-17 00:37 SGT: `npm run typecheck` pass
  - 2026-04-17 00:53 SGT (CDP): `/admin`, `/admin/routes`, `/admin/runs` 화면 렌더 확인
  - 2026-04-17 00:53 SGT (CDP/API): `/api/v1/admin/routes|schedules|runs` 및 `/api/v1/admin/download-tokens/blob` 응답 확인 (`401` without auth, authenticated flow에서 `200` 확인)
  - 2026-04-17 00:53 SGT (CDP): `/api/v1/downloads/not-exists`는 `404` 정상 응답
  - 2026-04-17 00:55 SGT: `npm run build` pass (App Router admin pages/API routes 생성 확인)
  - Current console: dev overlay a11y issue + dev HMR `hot-update ... ERR_ABORTED` occasionally
- Manual LINE test notes:

## Next Migration (Immediate Handoff)

- Trigger condition (when to start): P0 checklist all pass
- Next migration topic: API decomposition migration (`app/api/v1/[[...slug]]` split by domain)
- First step: Extract notifications + line-auth/session + routes + user-registration + me/preferences into dedicated route handlers (done)
- Next step: Split `checkin/*` and `admin/run-schedule` from catch-all (done), `admin/{users,registrations,routes,schedules,runs}` 분리 완료 + catch-all dead code 정리 완료. (`download-tokens/blob`, `downloads/[token]`는 shared in-memory store 특성으로 catch-all 유지) 다음은 admin API 세부 E2E 보강
- Owner/date: Codex + 2026-04-17

## Backlog

- [ ] Accessibility: resolve console issue `A form field element should have an id or name attribute` across all pages/components.
- [ ] Accessibility: run a11y sweep for mobile navigation controls and form labels after App Router migration stabilization.

## Issues Found

- [ ] None
- [x] Yes (list below)

1. Resolved: dev fallback notification IDs (`d1`, `d2`, ...) no longer trigger `PATCH /api/v1/notifications/:id/read`; deep link navigation still works.
2. CDP interaction with some list row wrappers is flaky (static text nodes are exposed instead of clickable parent), so route-detail open was validated by direct URL with known id from API response.
3. `npm run typecheck` can intermittently fail while `next dev` is active due `.next/types` generation race; resolved by regenerating with `rm -rf .next/types && npx next typegen && npx tsc --noEmit`.
4. Schedule rollback path currently missing: archived schedule를 직접 재배포할 수 없고, 우회(draft 전환 후 publish) 시 `500`이 발생할 수 있음.
