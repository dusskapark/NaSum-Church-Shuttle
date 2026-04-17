# Optimization Refactor PR Summary

## Summary

이번 브랜치는 셔틀 앱의 1차 구조 최적화와 merge-ready 안정화를 목표로 정리한 변경 묶음이다.

핵심 방향은 아래와 같다.

- 대형 공통 payload 분리
- 체크인/알림 흐름 단순화
- App Router 정적 최적화 복구
- admin API 도메인 분리
- runtime SQL 기준 Prisma schema 정렬
- dead asset / dead route / unused dependency 정리

## User-facing Changes

- 도착 알림 Flex 메시지를 단순화하고 `QR스캔`, `루트보기` 버튼만 유지
- `/search`, `/stops`, `/home`이 더 작은 route/place API를 사용
- 알림 badge는 전체 목록 대신 unread-count 경량 endpoint 사용
- 체크인 화면은 기존 체크인 확인을 별도 endpoint가 아니라 `run` 응답 안에서 처리

## Structural Changes

- `routes summary/detail/place` split endpoint 도입
- `admin` API를 도메인별 handler로 분리
  - runs
  - places
  - routes
  - schedules
- route sync 관련 공용 로직을 `src/server/admin-route-sync.ts`로 이동
- `ClientProviders`에서 전역 효과를 `GlobalClientEffects`로 분리
- 루트 `force-dynamic` 제거 및 정적 페이지 복구

## Data / Schema Changes

- Prisma schema를 runtime SQL과 실제 테이블 구조에 맞게 정렬
- 실제 테이블명 기준 `@@map` 반영
- notifications / schedules / schedule_routes / admin_stop_overrides / auto_run_config 등 운영 테이블 정의 추가
- legacy `checkin/me` route 제거

## Verification

- `npm run build`: pass
- `npm run typecheck`: pass
- `npx prisma validate`: pass
- `BASE_URL=http://localhost:3001 npm run test:admin-api-smoke`: pass

정적 prerender 복구 확인:

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

## Remaining Non-blocking Backlog

- nested layout / route group으로 동적 범위 추가 축소
- server logger 체계 추가 정리
- 나머지 미사용 dependency 추가 점검
- smoke / e2e 체계 고도화
