# App Optimization Review

Reviewed on: 2026-04-18

Implementation progress note:

- 도착 알림 Flex 단순화는 적용됨
- `home/search/stops`용 route/place API 분리는 적용됨
- shell 알림 badge unread-count 경량화는 적용됨
- React Query 기본 refetch 정책 보수화는 적용됨
- 체크인 `run + me` 흐름 1차 통합은 적용됨
- 루트 `force-dynamic` 제거와 정적 페이지 복구는 적용됨
- `admin/runs` full-route 의존 1차 축소는 적용됨
- `admin/runs` handler 분리는 적용됨
- `admin/places` handler 분리는 적용됨
- `admin/routes` handler 분리는 적용됨
- `next.config` 중복 제거와 ESLint Next flat config 연결은 적용됨

## Summary

현재 앱은 기능 완성도는 꽤 올라와 있지만, 구조적으로는 "App Router 위에 큰 클라이언트 SPA를 얹은 형태"에 가깝습니다. 그 결과 Next.js App Router의 장점인 서버 컴포넌트, 정적 최적화, 라우트 단위 캐싱을 거의 활용하지 못하고 있습니다.

이번 리뷰에서 확인한 핵심 신호는 아래와 같습니다.

- `npm run build` 기준 모든 화면이 동적 렌더링(`ƒ`) 경로로 배포됨
- shared first-load JS가 `102 kB`
- 주요 페이지 first-load JS가 `269~288 kB`
- `/admin/routes`가 `288 kB`로 가장 무거운 축에 속함
- `npm run build`는 통과하지만 ESLint에서 Next 플러그인 미감지 경고가 발생함
- `npm run typecheck`는 통과함

지금 단계에서 가장 효과가 큰 최적화는 "미세 조정"이 아니라 다음 3가지입니다.

1. 루트 강제 동적 렌더링 제거와 App Router 구조 정상화
2. `/api/v1/routes` 단일 대형 payload 분리
3. 단순화된 도착 알림 정책을 기준으로 알림/체크인/관리자 흐름의 과도한 네트워크 및 DB fan-out 축소

## Current State

### 1. App Router를 쓰고 있지만 실제로는 클라이언트 SPA에 가깝다

- `app/layout.tsx`에서 `export const dynamic = 'force-dynamic'`를 루트에 선언하고 있음
- 각 페이지가 대부분 `'use client'` wrapper이고 실제 화면 로직은 `src/routes/*`에 있음
- 즉, 페이지 단위 서버 컴포넌트/정적 캐싱 대신 클라이언트 hydration 이후 React Query가 데이터를 가져오는 구조임

근거:

- `app/layout.tsx:20`
- `app/page.tsx:1`
- `app/admin/routes/page.tsx:1`

### 2. 공통 데이터가 너무 큰 단위로 내려온다

`/api/v1/routes`는 모든 활성 노선, 모든 정류장, 캐시된 경로(path), 각종 메타데이터를 한 번에 내려줍니다. 이 데이터를 `home`, `search`, `stops`가 함께 소비하고 있습니다.

이 방식은 초기 개발 속도는 빠르지만, 다음 비용을 만듭니다.

- 첫 진입 payload 과대
- 여러 화면에서 같은 큰 JSON 반복 파싱
- 사실 일부 필드만 필요한 화면도 전체 route graph를 받아야 함
- route/station 수가 늘수록 선형 이상으로 체감 성능 저하

근거:

- `app/api/v1/routes/route.ts:81-152`
- `src/hooks/useRoutes.ts:13-22`

### 3. 서버 쪽 일부 흐름은 DB/외부 호출 fan-out이 크다

도착 알림 전송은 현재 복잡한 route-aware Flex 메시지를 만들면서, 동시에 "다음 정류장들 조회 -> 각 정류장별 대상 유저 조회 -> 각 유저별 notification insert -> 각 유저별 LINE push" 순서로 동작합니다. 유저 수가 늘면 쿼리 수와 외부 호출 수가 빠르게 증가합니다.

근거:

- `src/server/notifications.ts:81-153`

## Priority Roadmap

## P0

### P0-1. 루트 `force-dynamic` 제거와 라우트 구조 정상화

영향도: 매우 큼  
우선순위 이유: 이 항목이 해결되지 않으면 이후 번들 최적화와 캐싱 최적화가 절반만 먹힙니다.

문제:

- `app/layout.tsx` 루트에서 전체 앱을 강제로 동적으로 만듦
- 쿠키를 읽는 레이아웃 + 전역 클라이언트 provider + 클라이언트 페이지 wrapper 조합으로, 거의 모든 페이지가 서버 컴포넌트 이점을 잃음

근거:

- `app/layout.tsx:20-37`
- `app/page.tsx:1-10`
- `app/admin/routes/page.tsx:1-6`

개선 방향:

1. 루트 레이아웃에서 `force-dynamic` 제거 가능 여부부터 검증
2. 인증/언어/테마 때문에 동적이어야 하는 구간만 route group 또는 nested layout으로 분리
3. `app/*/page.tsx` wrapper를 점진적으로 server page + client leaf component 구조로 바꾸기
4. React Query를 "모든 화면의 1차 데이터 수집기"가 아니라 "클라이언트 인터랙션/실시간 갱신" 용도로 축소

예상 효과:

- static optimization 및 full-route cache 회복
- hydration 전 사용자에게 보이는 초기 응답 개선
- shared JS/initial JS 최적화 여지 확대

### P0-2. `/api/v1/routes` payload 분해

영향도: 매우 큼  
우선순위 이유: 현재 사용자 핵심 플로우(`home`, `search`, `stops`)가 모두 이 endpoint의 크기와 형태에 묶여 있습니다.

문제:

- 모든 route/stops/cachedPath를 한 번에 전달
- `search`는 정류장 검색 위주인데 route 전체 path까지 받을 필요가 없음
- `stops`는 선택된 place 주변 정보만 있으면 되는데 전체 노선 그래프를 받아서 selector로 걸러냄
- `home`도 처음부터 모든 route의 상세 payload가 꼭 필요한 구조는 아님

근거:

- `app/api/v1/routes/route.ts:82-151`
- `src/hooks/useRoutes.ts:14-22`
- `src/routes/home/index.tsx`
- `src/routes/search/index.tsx`
- `src/routes/stops/index.tsx`

개선 방향:

1. endpoint를 최소 3개로 분리
2. `GET /api/v1/routes/summary`
3. `GET /api/v1/routes/[routeCode]`
4. `GET /api/v1/places/[googlePlaceId]/routes`
5. `cachedPath`는 route detail에서만 내려주기
6. `search`는 place 중심 payload로 전환
7. 서버 컴포넌트에서 route summary prefetch 후 클라이언트로 필요한 slice만 전달

예상 효과:

- 초기 API payload 대폭 감소
- 클라이언트 JSON parse/selector 비용 감소
- 모바일 네트워크 체감 개선

### P0-3. 알림 전송 fan-out 구조 개선

영향도: 매우 큼  
우선순위 이유: 실사용자 수가 늘수록 가장 먼저 서버 비용과 지연을 키울 가능성이 높습니다.

정책 메모:

- 도착 알림 UX는 복잡한 carousel 대신 단일 Flex bubble로 단순화하는 것이 맞습니다.
- 기본 문구는 `{#} 정거장 전에 셔틀 버스가 도착했습니다. 탑승을 준비하세요.` 정책으로 통일합니다.
- 하단 CTA는 `QR스캔`, `루트보기` 2개 버튼만 둡니다.

문제:

- next stop마다 유저 조회를 별도 수행
- 유저마다 insert를 별도 수행
- 외부 push 전송도 개별적으로 흩어져 있음
- 현재 메시지 payload가 크고 구성 로직도 복잡해, 정책 변경이나 테스트 비용이 큼
- 도착 이벤트가 잦아질수록 DB 쿼리 수와 외부 호출 수가 급증

근거:

- `src/server/notifications.ts:81-153`
- `src/server/line-messaging.ts:42-443`

개선 방향:

1. 도착 알림 Flex payload를 "짧은 본문 + QR스캔/루트보기 2버튼" 구조로 단순화
2. 대상 사용자 조회를 정류장별이 아니라 한 번에 set-based query로 가져오기
3. notification insert를 batch insert 또는 `INSERT ... SELECT` 형태로 전환
4. LINE push payload 생성은 메모리에서 묶고, 전송은 concurrency 제한을 둔 병렬 처리로 전환
5. 가능하면 "notification record 생성"과 "외부 push 전송"을 분리해 백그라운드 job 성격으로 이동

예상 효과:

- 정책 변경과 QA 비용 감소
- 도착 이벤트당 DB round-trip 감소
- 알림 지연 감소
- 사용자 증가 시 선형 악화 완화

## P1

### P1-1. 체크인 화면의 query side effect 제거

영향도: 큼  
우선순위 이유: 체크인 흐름은 사용자 핵심 플로우라서 안정성과 예측 가능성이 중요합니다.

문제:

- `useQuery`의 `queryFn` 안에서 추가 API 호출(`/api/v1/checkin/me`)을 수행
- `queryFn` 내부에서 `setCheckinResult`, `setPhase` 같은 React state side effect를 발생시킴
- React Query 재시도/재요청/캐시 정책과 UI 상태 전이가 강하게 결합됨

근거:

- `src/routes/scan/index.tsx:202-231`

개선 방향:

1. `/api/v1/checkin/run` 응답에 "이미 체크인 여부"를 합쳐서 한 번에 내려주기
2. `queryFn`은 순수 데이터 fetch만 하고, UI 상태 전이는 `useEffect` 또는 mutation success handler로 이동
3. 스캔 상태 머신을 reducer 또는 명시적 state machine으로 정리

예상 효과:

- 중복 요청 감소
- 디버깅 난이도 하락
- 체크인 화면 재진입/포커스 복귀 시 예측 가능성 향상

### P1-2. 전역 refetch 정책과 공통 notification query 정리

영향도: 중간 이상  
우선순위 이유: 페이지가 늘어나면 "작은 refetch 여러 개"가 누적 비용으로 바뀝니다.

문제:

- 전역 query 기본값이 `refetchOnWindowFocus: true`
- `Layout`가 탭 화면마다 notification query를 보유
- `useRoutes`는 5분 주기 polling
- 일부 화면은 실제로 실시간성이 필요하지 않은데도 재검증이 자주 일어날 여지가 있음

근거:

- `src/lib/queryClient.ts:3-10`
- `src/components/Layout.tsx:78-82`
- `src/hooks/useRoutes.ts:13-22`

개선 방향:

1. query별 freshness를 다시 정의
2. notifications badge는 별도 경량 unread-count endpoint 고려
3. `routes`는 ETag 기반 재검증을 하더라도 화면별 staleTime을 더 길게 설정
4. 정말 polling이 필요한 화면만 interval 유지

예상 효과:

- 불필요한 포커스 refetch 감소
- 배터리/네트워크 사용량 절감
- 탭 이동 시 체감 안정성 개선

### P1-3. 관리자 API monolith 분해

영향도: 중간 이상  
우선순위 이유: 지금은 기능 추가마다 `_handlers.ts`가 더 비대해질 가능성이 큽니다.

문제:

- `app/api/v1/admin/_handlers.ts`가 `2254`줄
- parsing/cold start 비용뿐 아니라, 한 파일에 너무 많은 책임이 몰려 있어 최적화 실험이 어려움
- 작은 수정도 회귀 위험이 큼

근거:

- `app/api/v1/admin/_handlers.ts` (`wc -l` 기준 2254 lines)

개선 방향:

1. `routes`, `schedules`, `runs`, `places`, `registrations`, `users` 단위로 분리
2. SQL helper와 request handler를 분리
3. schedule publish/restore 같은 무거운 트랜잭션은 service 계층으로 격리

예상 효과:

- 변경 영향도 축소
- 병목 프로파일링 단위 분리
- 회귀 테스트 작성 쉬워짐

### P1-4. DB schema/실제 SQL drift 정리

영향도: 중간 이상  
우선순위 이유: 직접 성능 수치에는 바로 안 보이지만, 최적화 리팩터링을 시작할 때 가장 시간을 잡아먹는 부류입니다.

문제:

- Prisma schema에는 없는 컬럼들을 SQL이 광범위하게 사용하고 있음
- 예: `formatted_address`, `active`, `updated_at`, `additional_passengers`, `preferred_language`, `push_notifications_enabled`
- 현재는 raw SQL이라 런타임까지 가야만 drift를 발견하기 쉬움

근거:

- `prisma/schema.prisma:61-133`
- `app/api/v1/routes/route.ts:69-76`
- `app/api/v1/user-registration/route.ts:224-239`
- `app/api/v1/checkin/route.ts:83-105`
- `app/api/v1/me/preferences/route.ts:20-59`

개선 방향:

1. 실제 production schema 기준으로 Prisma schema 재정렬 또는 Prisma 제거 결정
2. DB 타입 정의를 단일 출처로 정리
3. 최적화 전에 최소한 핵심 테이블 schema 문서화

예상 효과:

- 최적화 작업 중 예상치 못한 런타임 오류 감소
- SQL/index 개선 작업의 안전성 향상

## P2

### P2-1. 개발용 로그와 잔여 번들 비용 정리

영향도: 중간  
우선순위 이유: 단독으로는 치명적이지 않지만, 지금처럼 전역 클라이언트 shell이 큰 구조에서는 누적 효과가 있습니다.

문제:

- Google Places 처리 경로에 `console.log`가 다수 남아 있음
- 관리자 route list의 clipboard 처리에 verbose log가 많음
- `ClientProviders`에서 `ReactQueryDevtools`를 top-level import
- 루트 레이아웃이 `maplibre-gl` CSS를 전역 import 하지만 실제 지도는 Google Maps 기반임
- 의존성에 `maplibre-gl`, `@prisma/*` 등 현재 런타임 사용도가 낮아 보이는 패키지가 남아 있음

근거:

- `src/server/google-places.ts:86-178`
- `src/routes/admin/routes-list.tsx:62-123`
- `src/spa/ClientProviders.tsx:3-4`
- `src/spa/ClientProviders.tsx:89-92`
- `app/layout.tsx:4`
- `package.json:17-32`

개선 방향:

1. 서버 로그는 `logger` 경유 + level 제어
2. devtools는 개발 환경에서만 dynamic import
3. 미사용 CSS/패키지 제거
4. admin clipboard 로그는 debug 플래그 아래로 이동

예상 효과:

- 불필요한 번들/로그 비용 감소
- 운영 로그 노이즈 감소

### P2-2. Next/ESLint 설정 drift 정리

영향도: 중간  
우선순위 이유: 성능 최적화 자체보다 "최적화가 계속 유지되게 하는 장치"에 가깝습니다.

문제:

- `next.config.ts`와 `next.config.js`가 공존
- 실제로 어떤 설정이 우선되는지 혼동 여지 큼
- ESLint 설정이 ignore만 있고 Next 규칙이 연결되지 않아 build 시 경고 발생

근거:

- `next.config.ts:1-13`
- `next.config.js:1-8`
- `eslint.config.mjs:1-11`

개선 방향:

1. Next config를 한 파일로 통합
2. `eslint-config-next`를 flat config에 연결
3. 성능 관련 lint rule을 추가해서 재발 방지

예상 효과:

- 설정 혼선 제거
- 이후 최적화 작업의 guardrail 확보

## Recommended Execution Order

### Sprint 1

- 루트 `force-dynamic` 제거 가능 범위 확인
- `app/*` wrapper 중 홈/검색/정류장 화면부터 server-first 구조 설계
- `/api/v1/routes` 분리 설계
- notification fan-out 개선 설계

### Sprint 2

- `routes summary/detail/place` endpoint 분리
- `home`, `search`, `stops`를 분리 endpoint에 맞게 조정
- 체크인 query side effect 제거
- query staleTime/refetch 정책 재조정

### Sprint 3

- 관리자 API 분해
- 운영 로그 정리
- unused dependency/CSS 제거
- config/lint 정비

## Quick Wins

큰 구조 개편 전에 비교적 빨리 처리 가능한 항목입니다.

- 도착 알림 Flex를 단순화하고 하단 CTA를 `QR스캔`, `루트보기` 2버튼으로 통일
- `app/layout.tsx`의 `maplibre-gl` 전역 CSS import 제거 검토
- `src/server/google-places.ts` 운영 로그 정리
- `src/routes/admin/routes-list.tsx` clipboard verbose log 제거
- `ClientProviders`의 devtools import를 dev-only dynamic import로 변경
- `next.config.ts` / `next.config.js` 통합
- `eslint.config.mjs`에 Next 규칙 연결

## Metrics To Track

최적화 작업은 수치로 닫는 것이 좋습니다. 아래 지표를 배포 전후로 비교하는 것을 권장합니다.

- build 기준 shared first-load JS
- `/`, `/search`, `/stops`, `/scan`, `/admin/routes` first-load JS
- `/api/v1/routes` 응답 크기와 응답 시간
- check-in 완료까지의 네트워크 요청 수
- 도착 알림 1회 발생 시 DB query 수와 외부 push 전송 시간
- Vercel function duration / cold start

초기 목표 예시:

- shared first-load JS: `102 kB -> 80 kB 이하`
- `/admin/routes` first-load JS: `288 kB -> 250 kB 이하`
- 핵심 사용자 플로우의 초기 route payload: 현재 대비 `50% 이상 축소`
- check-in 초기 진입 시 네트워크 왕복 횟수: 현재 대비 `1회 이상 감소`

## Final Recommendation

지금 이 앱은 "이미 잘 돌아가는 기능"을 해치지 않으면서 최적화해야 하므로, 한 번에 전면 재작성하기보다 아래 원칙으로 가는 것이 가장 안전합니다.

1. 사용자 핵심 플로우부터 payload를 줄인다
2. App Router를 실제 App Router답게 되돌린다
3. 서버 fan-out이 큰 경로부터 batch화한다
4. 마지막에 번들/로그/설정을 정리한다

즉, 가장 먼저 손댈 것은 CSS 미세 조정보다 구조입니다.  
루트 동적 렌더링과 대형 `/api/v1/routes` 의존성만 정리해도 체감 성능은 꽤 크게 좋아질 가능성이 높습니다.
