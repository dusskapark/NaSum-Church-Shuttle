# Admin UI CDP Smoke Checklist

## Meta

- Date: 2026-04-17
- Last run: 2026-04-17 01:40 +08
- Target: `https://decorating-bin-mpg-simultaneously.trycloudflare.com`
- Tool: Chrome DevTools MCP (CDP)

## Checklist

- [x] `/admin/routes` loads and shows route management UI.
- [x] `/admin/runs` loads and shows Active/History/Schedule tabs.
- [x] `/admin/schedules/{valid-id}` loads and shows schedule routes list.
- [x] `/api/v1/admin/routes` returns `200` in authenticated browser context.
- [x] `/api/v1/admin/runs?status=active` returns `200` in authenticated browser context.
- [x] `/api/v1/admin/schedules/{valid-id}` returns `200` in authenticated browser context.
- [x] Route detail sync action (`/admin/routes/[routeId]` -> `Sync from Google Maps`) returns `200`.
- [x] Run lifecycle action (`Start Run` -> `End Run`) returns success codes (`201`/`200`).
- [x] Schedule publish flow (`Save & Deploy`) executes and returns `200`.
- [x] `/admin/registrations` delete confirm modal open/cancel path works without unintended delete request.
- [x] No blocking runtime console error on admin routes.

## Evidence

- `/admin/routes` snapshot: "No schedule yet", "New Schedule" rendered.
- `/admin/runs` snapshot: `Active | History | Schedule` tabs rendered.
- `/admin/schedules/1017a95a-23d7-41c1-81b7-60fe95d1ed6c` snapshot: route list rendered (`WEST LINE (B)` synced 등).
- Network on `/admin/routes`:
  - `GET /api/v1/admin/routes` => `200`
  - `GET /api/v1/admin/schedules` => `200`
- Network on `/admin/runs`:
  - `GET /api/v1/admin/runs?status=active` => `200`
- Network on `/admin/schedules/{id}`:
  - `GET /api/v1/admin/schedules/{id}` => `200`
- 2026-04-17 01:17 SGT: route sync 액션에서 `POST /api/v1/admin/routes/{routeId}/sync` => `500`
  - response: `duplicate key value violates unique constraint \"route_stops_route_id_sequence_key\"`
- 2026-04-17 01:17 SGT: 코드 수정 후 로컬 재검증
  - `POST /api/v1/admin/routes/cmndeq9jr00207q8ok1itcnou/sync` => `200`
  - response: `{\"diff\":{\"added\":5,\"updated\":0,\"removed\":5},\"unresolved\":0}`
- 2026-04-17 01:24~01:29 SGT: CDP 액션 재검증
  - `POST /api/v1/admin/routes/cmndeq9jr00207q8ok1itcnou/sync` => `200` (브라우저 클릭 기준)
  - `POST /api/v1/admin/runs` => `201`, 이어서 `POST /api/v1/admin/runs/{runId}/end` => `200`
  - `POST /api/v1/admin/schedules` => `201` (draft 생성)
  - `POST /api/v1/admin/schedules/c68e9087-82c2-4cdd-9131-a63d23cc0420/publish` => `200`
  - publish 응답: `{\"success\":true,\"name\":\"2026-04-16\",\"published_at\":\"2026-04-16T17:28:34.871Z\"}`
  - console (`error`, `warn`) 조회 결과: 없음
- 2026-04-17 01:38~01:40 SGT: registrations 액션 경로 검증
  - `/admin/registrations`에서 `Delete` 클릭 시 확인 모달 노출 확인
  - `Cancel` 클릭 후 목록 복귀 확인
  - 네트워크에 `DELETE /api/v1/admin/registrations/...` 요청 미발생(데이터 변경 없음)
- 2026-04-17 01:31~01:35 SGT: 데이터 롤백 시도 중 발견
  - archived schedule(`1017...`)를 draft로 전환 후 publish 호출 시 `POST /api/v1/admin/schedules/1017.../publish` => `500`
  - 이후 상태 원복: `1017...` archived, `c68e...` published

## Known Non-Blocking Issues

- Dev-mode Next/HMR noise exists (`webpack.hot-update ... ERR_ABORTED`).
- Accessibility issue remains from dev overlay container: `A form field element should have an id or name attribute`.
- Schedule rollback path gap: archived schedule re-publish is not supported and forced workaround에서 `500` 가능성 확인.

## Next Iteration

- Add explicit rollback API/UX for schedule smoke data (safe restore to previous published snapshot).
- Investigate and fix `POST /api/v1/admin/schedules/{archivedId}/publish` 500 failure path (guard or supported flow).
