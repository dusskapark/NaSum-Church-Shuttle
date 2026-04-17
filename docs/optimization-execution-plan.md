# Optimization Execution Plan

Reviewed on: 2026-04-18

## Current Status

- Completed: 도착 알림 Flex 단순화
- Completed: `home/search/stops`용 route/place API 분리
- Completed: app shell 알림 badge를 unread-count 경량 endpoint로 분리
- Completed: React Query 기본 refetch 정책 보수화
- Completed: devtools eager import 제거
- Completed: 체크인 `run` 응답에 기존 체크인 정보 포함
- Completed: `Scan` 화면 query side effect 제거
- Completed: 루트 `force-dynamic` 제거
- Completed: 정적 빌드를 막던 client page wrappers에 Suspense 적용
- Completed: `admin/runs`의 full-route 의존 1차 축소
- Completed: `admin/runs` handler를 `_handlers.ts`에서 분리
- Completed: `admin/places` handler를 `_handlers.ts`에서 분리
- Completed: `admin/routes` handler를 `_handlers.ts`에서 분리
- Completed: legacy `useRoutes` 훅 제거
- Completed: `next.config` 단일화
- Completed: ESLint flat config에 Next core-web-vitals 연결
- In progress: 알림 fan-out 추가 최적화와 App Router 구조 정상화

## Goal

이 문서는 최적화 리뷰를 실제 작업 계획으로 바꾼 실행 문서다.  
목표는 아래 3가지다.

1. 사용자가 느끼는 초기 로딩과 화면 전환을 가볍게 만든다.
2. 운영 중 가장 먼저 병목이 될 서버 fan-out 경로를 줄인다.
3. 이후 리팩터링이 계속 가능한 구조로 정리한다.

## Fixed Decisions

이번 계획에서 이미 결정된 정책은 아래와 같다.

### 1. 도착 알림 정책

- 복잡한 route-aware carousel/flex 조합은 제거한다.
- 도착 알림은 단일 Flex bubble로 단순화한다.
- 기본 문구:
  - `"{#} 정거장 전에 셔틀 버스가 도착했습니다. 탑승을 준비하세요."`
- 하단 CTA는 `QR스캔`, `루트보기` 2개 버튼만 둔다.
- route strip, 현재 정류장/다음 정류장/내 정류장 시각화는 제거한다.

관련 코드:

- [src/server/notifications.ts](/Volumes/Backup/Github/NaSum-Church-Shuttle/src/server/notifications.ts:1)
- [src/server/line-messaging.ts](/Volumes/Backup/Github/NaSum-Church-Shuttle/src/server/line-messaging.ts:1)

### 2. 최적화 작업 원칙

- 먼저 payload와 fan-out을 줄인다.
- 그다음 App Router 구조를 정상화한다.
- 마지막에 설정/로그/드리프트를 정리한다.
- 최적화는 반드시 build 결과와 핵심 플로우 검증으로 닫는다.

## Workstreams

## Workstream A. 도착 알림 단순화

### 목표

- 알림 메시지 정책을 단순화한다.
- 메시지 조립 비용과 QA 비용을 같이 낮춘다.
- 이후 fan-out 최적화 전 단계로 알림 payload를 고정한다.

### 실제 작업

1. `sendLinePushShuttleCarousel`를 단순 Flex 전송 함수로 교체하거나 새 함수로 분리
2. body 문구를 `{stopsAway}` 기반 고정 텍스트로 통일
3. footer 버튼을 `QR스캔`, `루트보기` 2개만 유지
4. altText도 간단한 한 줄 정책으로 정리
5. `notifyApproachingUsers`에서 더 이상 `routeLabel`, `arrivedStopName`, `intermediateStopName`, `targetStopName` 같은 시각화용 조합에 크게 의존하지 않도록 정리

### 산출물

- 단순화된 LINE Flex message 구현
- 알림 정책 문서 반영
- QA 체크리스트 업데이트

### 완료 기준

- LINE에서 알림이 단순화된 Flex 1개로 표시된다.
- 버튼은 `QR스캔`, `루트보기` 2개만 보인다.
- `1정거장 전`, `2정거장 전` 케이스가 모두 올바르게 표시된다.

## Workstream B. 알림 fan-out 최적화

### 목표

- 도착 이벤트당 DB round-trip과 외부 호출 수를 줄인다.

### 실제 작업

1. `notifyApproachingUsers` 대상 유저 조회를 stop별 개별 query에서 set-based query로 전환
2. notification insert를 개별 insert loop에서 batch 처리로 전환
3. LINE push는 concurrency 제한을 둔 병렬 실행으로 전환
4. 중복 알림 방지 키 정책을 다시 확인
5. 향후 job queue로 이동 가능한 인터페이스로 함수 구조 정리

### 선행조건

- Workstream A에서 알림 payload 정책이 먼저 고정되어야 한다.

### 완료 기준

- 현재 구현 대비 query 수가 줄어든다.
- 동일 run/stop에 대한 중복 전송이 없다.
- 알림 정책 변경이 메시지 UI 로직 전체를 다시 건드리는 일이 없어진다.

## Workstream C. 핵심 route payload 분리

### 목표

- `home`, `search`, `stops`가 같은 대형 payload에 묶여 있는 구조를 푼다.

### 실제 작업

1. `routes summary` 응답 정의
2. `route detail` 응답 정의
3. `place -> candidate routes` 응답 정의
4. `cachedPath`는 route detail에서만 내려주도록 이동
5. `search`는 station 중심 데이터만 사용하도록 수정
6. `stops`는 `placeId` 기준 detail fetch로 전환
7. `home`은 summary + 선택 route detail 조합으로 전환

관련 코드:

- [app/api/v1/routes/route.ts](/Volumes/Backup/Github/NaSum-Church-Shuttle/app/api/v1/routes/route.ts:1)
- [src/hooks/useRoutes.ts](/Volumes/Backup/Github/NaSum-Church-Shuttle/src/hooks/useRoutes.ts:1)
- [src/routes/home/index.tsx](/Volumes/Backup/Github/NaSum-Church-Shuttle/src/routes/home/index.tsx:1)
- [src/routes/search/index.tsx](/Volumes/Backup/Github/NaSum-Church-Shuttle/src/routes/search/index.tsx:1)
- [src/routes/stops/index.tsx](/Volumes/Backup/Github/NaSum-Church-Shuttle/src/routes/stops/index.tsx:1)

### 완료 기준

- 초기 공통 route payload 크기가 유의미하게 줄어든다.
- `search` 진입 시 전체 route graph를 받지 않는다.
- `stops` 진입 시 전체 route graph를 받지 않는다.

## Workstream D. 체크인 흐름 정리

### 목표

- 체크인 화면의 상태 전이와 API 호출 구조를 예측 가능하게 만든다.

### 실제 작업

1. `/api/v1/checkin/run` 응답에 "내 기존 체크인 여부" 포함 여부 결정
2. `useQuery` 내부 side effect 제거
3. `phase` 전이를 reducer 또는 명시적 상태 흐름으로 재정리
4. 자동 스캔, routeCode sync, GPS 선택, 기존 체크인 복구 흐름을 분리

관련 코드:

- [src/routes/scan/index.tsx](/Volumes/Backup/Github/NaSum-Church-Shuttle/src/routes/scan/index.tsx:128)
- [app/api/v1/checkin/run/route.ts](/Volumes/Backup/Github/NaSum-Church-Shuttle/app/api/v1/checkin/run/route.ts:1)
- [app/api/v1/checkin/me/route.ts](/Volumes/Backup/Github/NaSum-Church-Shuttle/app/api/v1/checkin/me/route.ts:1)

### 완료 기준

- check-in 초기 진입 시 불필요한 추가 fetch가 줄어든다.
- query 함수가 React state를 직접 변경하지 않는다.
- 스캔 취소/재시도/기체크인 상태가 예측 가능하게 동작한다.

## Workstream E. App Router 구조 정상화

### 목표

- 지금의 "클라이언트 SPA on App Router" 구조를 점진적으로 바로잡는다.

### 실제 작업

1. `app/layout.tsx`의 `force-dynamic` 제거 가능 범위 점검
2. 쿠키/테마/언어 때문에 동적인 부분을 nested layout 또는 route group으로 분리
3. 각 `app/*/page.tsx` wrapper를 server-first 구조로 전환
4. `ClientProviders` 역할을 최소화
5. 공통 hydration 범위를 줄인다

관련 코드:

- [app/layout.tsx](/Volumes/Backup/Github/NaSum-Church-Shuttle/app/layout.tsx:1)
- [src/spa/ClientProviders.tsx](/Volumes/Backup/Github/NaSum-Church-Shuttle/src/spa/ClientProviders.tsx:1)

### 완료 기준

- build 결과에서 정적 최적화 가능한 페이지가 생긴다.
- shared first-load JS가 감소한다.
- client-only wrapper 수가 줄어든다.

## Workstream F. Query/cache 정책 재정의

### 목표

- React Query를 실시간/상호작용이 필요한 곳에만 무겁게 쓰고, 나머지는 조용하게 만든다.

### 실제 작업

1. query별 staleTime 표준 정의
2. `refetchOnWindowFocus` 기본값 재검토
3. notifications badge용 lightweight endpoint 필요성 판단
4. polling이 필요한 query만 interval 유지

관련 코드:

- [src/lib/queryClient.ts](/Volumes/Backup/Github/NaSum-Church-Shuttle/src/lib/queryClient.ts:1)
- [src/components/Layout.tsx](/Volumes/Backup/Github/NaSum-Church-Shuttle/src/components/Layout.tsx:68)
- [src/hooks/useRoutes.ts](/Volumes/Backup/Github/NaSum-Church-Shuttle/src/hooks/useRoutes.ts:13)
- [src/hooks/useRunStatus.ts](/Volumes/Backup/Github/NaSum-Church-Shuttle/src/hooks/useRunStatus.ts:1)

### 완료 기준

- 포커스 복귀 시 불필요한 refetch가 줄어든다.
- 같은 데이터가 여러 화면에서 중복으로 갱신되는 빈도가 줄어든다.

## Workstream G. 관리자/DB/설정 정리

### 목표

- 유지보수 비용을 줄이고 최적화가 계속 유지되게 만든다.

### 실제 작업

1. `app/api/v1/admin/_handlers.ts`를 도메인별로 분리
2. 실제 DB schema와 Prisma schema drift 정리
3. `next.config.ts` / `next.config.js` 통합
4. `eslint.config.mjs`에 Next 규칙 연결
5. verbose log와 dev-only 잔여 코드 정리

관련 코드:

- [app/api/v1/admin/_handlers.ts](/Volumes/Backup/Github/NaSum-Church-Shuttle/app/api/v1/admin/_handlers.ts:1)
- [prisma/schema.prisma](/Volumes/Backup/Github/NaSum-Church-Shuttle/prisma/schema.prisma:1)
- [next.config.ts](/Volumes/Backup/Github/NaSum-Church-Shuttle/next.config.ts:1)
- [next.config.js](/Volumes/Backup/Github/NaSum-Church-Shuttle/next.config.js:1)
- [eslint.config.mjs](/Volumes/Backup/Github/NaSum-Church-Shuttle/eslint.config.mjs:1)

### 완료 기준

- 설정 파일 중복이 없어진다.
- build 시 ESLint 경고가 사라진다.
- admin API 수정 범위가 도메인 단위로 제한된다.

## Execution Order

### Phase 1. Quick Wins

- Workstream A: 도착 알림 단순화
- Workstream G 일부: 설정 파일 통합, ESLint 연결, verbose log 정리

이 단계는 비교적 작고, 위험이 낮고, 정책이 바로 드러나는 작업이다.

### Phase 2. Runtime Cost Reduction

- Workstream B: 알림 fan-out 최적화
- Workstream C: route payload 분리
- Workstream D: 체크인 흐름 정리
- Workstream F 일부: query 정책 재정의

이 단계가 실제 성능 체감과 서버 비용 개선의 핵심이다.

### Phase 3. Structural Refactor

- Workstream E: App Router 구조 정상화
- Workstream G 나머지: admin API 분리, schema drift 정리

이 단계는 효과가 크지만 영향 범위가 넓기 때문에 앞선 단계 이후 진행한다.

## Suggested Task Breakdown

## Task Backlog

### Done

- Task 1. 도착 알림 Flex 단순화
- Task 2. 알림 insert/query fan-out 1차 축소
- Task 3. `home/search/stops`용 route/place API 분리
- Task 4. shell 알림 badge를 unread-count endpoint로 경량화
- Task 5. React Query 기본 `refetchOnWindowFocus` 보수화
- Task 6. React Query devtools eager import 제거
- Task 7. `next.config` 중복 제거
- Task 8. ESLint flat config에 Next 설정 연결
- Task 9. 체크인 `run` 응답에 기존 체크인 정보 포함
- Task 10. `Scan` 화면 query side effect 제거
- Task 11. 루트 `force-dynamic` 제거
- Task 12. 정적 빌드를 막던 client page wrappers에 Suspense 적용
- Task 13. `admin/runs` full-route 의존 1차 축소
- Task 14. legacy `useRoutes` 훅 제거
- Task 15. `admin/runs` handler를 `_handlers.ts`에서 분리
- Task 16. `admin/places` handler를 `_handlers.ts`에서 분리
- Task 17. `admin/routes` handler를 `_handlers.ts`에서 분리

### Next

- Task 18. `/api/v1/routes` legacy endpoint를 더 작은 응답 또는 compatibility wrapper로 재정리
- Task 19. `/api/v1/checkin/me` legacy endpoint 정리 여부 결정
- Task 20. nested layout / route group으로 동적 범위 추가 축소
- Task 21. `ClientProviders` 책임 축소
- Task 22. admin `_handlers.ts`의 schedules 분리
- Task 23. DB schema와 raw SQL drift 정리
- Task 24. server logger 정리 및 verbose log 축소
- Task 25. 미사용 의존성/전역 CSS 정리
- Task 26. 핵심 플로우 smoke test 문서 갱신

### Ticket 1. Simplify arrival LINE notification

- Status: completed
- 메시지 사양 고정
- 단순화된 Flex 구현
- `QR스캔`, `루트보기` 2버튼 유지
- 알림 QA

### Ticket 2. Reduce notification query fan-out

- Status: partially completed
- 대상 유저 조회 set query로 변경
- notification insert batch 처리
- push 전송 concurrency 제어

### Ticket 3. Split route API

- Status: completed for `home/search/stops`
- summary/detail/place endpoints 추가
- `useRoutes` 소비 코드 단계별 전환

### Ticket 4. Refactor scan flow

- `/checkin/run` + `/checkin/me` 흐름 통합 또는 재조정
- side-effect free query 구조로 변경

### Ticket 5. Normalize app shell

- route group / nested layout 설계
- root dynamic 범위 축소
- client wrapper 제거 시작

### Ticket 6. Fix configuration drift

- Status: mostly completed
- Next config 통합
- ESLint flat config 정리
- build 경고 제거

## Validation Checklist

각 phase 종료 시 아래를 확인한다.

### Build

- `npm run build`
- shared first-load JS 수치 기록
- 주요 페이지 first-load JS 수치 기록

### Core flows

- 홈 진입
- 검색 진입 및 정류장 탐색
- 정류장 상세에서 노선 선택
- QR 스캔 진입
- 체크인 성공/중복 체크인
- 알림 수신 후 `QR스캔`, `루트보기` 버튼 이동

### Admin flows

- route list
- run start/end
- 결과 조회
- schedule route detail 편집

## Success Metrics

- shared first-load JS: `102 kB -> 80 kB 이하`
- `/admin/routes` first-load JS: `288 kB -> 250 kB 이하`
- 초기 route payload: 현재 대비 `50% 이상 축소`
- check-in 초기 요청 수: 현재 대비 `1회 이상 감소`
- 도착 알림 1회당 DB round-trip: 현재 대비 유의미하게 감소

## Immediate Next Step

가장 먼저 착수할 작업은 아래 2개다.

1. 도착 알림을 단순화된 Flex + `QR스캔`/`루트보기` 2버튼 정책으로 변경
2. `/api/v1/routes`를 summary/detail 기반으로 어떻게 쪼갤지 API shape를 먼저 확정

이 2개가 고정되면 나머지 최적화는 훨씬 빠르고 안전하게 진행할 수 있다.
