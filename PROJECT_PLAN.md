# NaSum Church Shuttle 제품 요구사항 및 실행 계획 문서(PRD + Delivery Plan)

작성일: 2026-03-28  
문서 버전: v2.1.2 (Integrated MVP Execution Plan)  
제품 형태: **LINE LIFF 기반 셔틀 승하차/탑승 관리 웹앱**

---

## 1. 문서 목적

이 문서는 NaSum Church Shuttle의 MVP~v1 범위를 기준으로, 제품/디자인/개발/운영 팀이 동일한 기준으로 실행할 수 있도록 기능, 비기능, 일정, 성공 지표, 배포 전략, 운영 체크리스트를 통합 정의한다.

특히 본 문서는 무료 플랜 중심 운영 전략과 LINE Messaging API P0 보강안을 함께 반영하여, "무엇을 만들 것인가"뿐 아니라 "어떻게 무료 비용 구조 안에서 안정적으로 운영할 것인가"까지 포함한다.

`v2.1.2`는 기존 MVP 실행 계획을 대체하는 별도 문서가 아니라, `v2.1`의 제품/기술/배포 계획 위에 LINE Messaging API 필수 범위를 통합한 실행 버전이다.

핵심 기술 스택:
- Frontend: **Next.js + React + Tailwind CSS + Ant Design 5**
- Backend/API: **Next.js Route Handlers + Supabase Postgres + Prisma**
- Auth/Identity: **LINE LIFF + LINE Login + Supabase Auth(운영자용)**
- Map: **OpenStreetMap**
- Messaging: **LINE LIFF + LINE Messaging API**
- Analytics: **Google Analytics 4 (GA4)**
- Deployment: **Vercel Hobby (Web/API), Supabase Free (DB)**

---

## 2. 제품 비전 및 목표

### 2.1 제품 비전
"LINE 안에서 빠르고 직관적으로 셔틀 탑승 흐름을 완료하고, 운영자는 실시간에 가깝게 승하차 이벤트를 파악할 수 있는 경량 운영 플랫폼"

### 2.2 비즈니스 목표
1. QR 스캔 기반 탑승 체크인 시간을 단축한다.
2. 노선/정류장 기반 탑승 이벤트 누락을 최소화한다.
3. 운영자가 이벤트 실패 원인(중복, 권한, 네트워크)을 즉시 파악하도록 한다.
4. MVP 단계에서 무료 또는 최소 비용 인프라로 빠르게 운영을 시작한다.

### 2.3 제품 목표 (사용자 가치)
1. 사용자는 LINE에서 앱 설치 없이 LIFF로 바로 진입한다.
2. 사용자는 3탭 이내로 "스캔 → 확인 → 완료"를 끝낸다.
3. 사용자는 내 탑승 이력을 확인하고 오류 시 재시도할 수 있다.
4. 운영자는 별도 무거운 백오피스 없이 웹 화면에서 실패 이벤트를 빠르게 추적할 수 있다.

---

## 3. 범위 정의

### 3.1 In Scope (MVP~v1)
- LIFF 로그인/프로필 컨텍스트 기반 사용자 식별
- QR 스캔(정류장/탑승 식별 코드) 및 이벤트 저장
- 노선/정류장 정보 조회
- OpenStreetMap 기반 정류장 위치 표시
- 사용자 탑승 이력 조회
- 운영자용 이벤트 모니터링 페이지(웹)
- LINE Messaging API 채널 구성, webhook 검증, push 발송
- GA4 이벤트 수집(핵심 퍼널 중심)
- Vercel+Supabase 무료 플랜 중심 배포 자동화
- `/api/health`, `/api/ready` 기반 운영 점검
- 환경변수/배포 체크리스트 문서화

### 3.2 Out of Scope (현 단계 제외)
- FCM/APNs 등 OS Push 시스템
- 복수 메신저 플랫폼 연동 (예: 카카오, WhatsApp)
- 고급 배차 최적화 엔진
- 오프라인 완전 동기화 앱(PWA 고도화)
- 대규모 멀티 리전 분산 아키텍처

---

## 4. 핵심 사용자 및 시나리오

### 4.1 사용자 타입
- **일반 사용자(탑승자)**: QR 스캔, 탑승 상태 확인, 이력 조회
- **운영자(관리자)**: 이벤트 모니터링, 오류 확인, 수동 보정
- **시스템 관리자**: 노선/정류장 데이터 관리, 권한 설정, 배포/환경변수 관리

### 4.2 대표 시나리오
1. 탑승자는 LINE 채널 메뉴에서 LIFF 앱 진입
2. 홈에서 오늘 운행 정보 확인
3. "탑승 스캔" 버튼으로 QR 인식
4. 서버 검증 후 "정상 처리" 또는 "오류/중복" 결과 노출
5. 탑승자는 내 이력 탭에서 기록 확인
6. 운영자는 관리자 화면에서 실패 이벤트 확인 및 보정
7. 시스템 관리자는 `/api/health`와 배포 환경을 점검해 운영 상태를 확인

---

## 5. 정보 구조(IA) 및 화면 구성

### 5.1 탑승자용 (LIFF App)
1. **Home**
   - 오늘 운행 요약
   - 최근 스캔 결과 카드
   - CTA: 스캔 시작
2. **Scan Result**
   - 성공/실패 상태
   - 정류장/시각/노선 정보
   - 재시도 버튼
3. **History**
   - 날짜별 이벤트 리스트
   - 상태 필터(성공/실패/중복)
4. **My**
   - LIFF 프로필 기반 정보
   - 동의/약관 링크

### 5.2 운영자용 (Admin Web)
1. **Dashboard**: 성공률/실패율/평균 처리시간
2. **Events**: 실시간 이벤트 목록, 검색/필터
3. **Routes & Stops**: 노선/정류장 CRUD
4. **Audit Log**: 변경 이력
5. **Ops Check**: 배포 버전, 환경 상태, 헬스체크 링크

---

## 6. 기능 요구사항 (Functional Requirements)

### FR-01. LIFF 인증 및 컨텍스트 확보
- 앱은 LIFF SDK 초기화 후 로그인 상태를 확인해야 한다.
- 사용자 식별은 LIFF userId를 기본 키로 매핑한다.
- 최초 진입 시 필수 동의(개인정보/위치 선택)를 받아야 한다.

### FR-02. QR 스캔 처리
- 사용자는 LIFF 내 스캔 기능으로 QR을 읽을 수 있어야 한다.
- QR payload에는 최소 `stopId`, `routeId` 또는 매핑 가능한 토큰이 있어야 한다.
- 스캔 성공 시 서버에 이벤트를 전송하고 처리 결과를 즉시 표시한다.

### FR-03. 이벤트 검증 및 멱등성
- 동일 사용자/동일 run/동일 stop/짧은 시간 창에서 중복 이벤트를 방지해야 한다.
- 서버는 idempotency key를 저장해야 한다.
- 검증 실패 시 사용자 친화적 오류 메시지를 반환해야 한다.

### FR-04. 이력 조회
- 사용자는 최근 N일 탑승 이력을 조회할 수 있어야 한다.
- 실패 이벤트도 히스토리에 남기되 원인 코드를 함께 보여야 한다.

### FR-05. 관리자 모니터링
- 관리자는 이벤트 목록을 실시간(또는 준실시간)으로 확인할 수 있어야 한다.
- 실패 이벤트는 별도 강조 표시되어야 한다.
- 관리자 보정(상태 수정) 시 감사 로그를 남겨야 한다.

### FR-06. 지도 연동 (OpenStreetMap)
- 홈 또는 노선 상세에서 정류장 마커를 시각화해야 한다.
- 현재 정류장/다음 정류장 상태를 구분 표시해야 한다.

### FR-07. 분석 이벤트 수집 (GA4)
- 최소 이벤트: `liff_open`, `scan_start`, `scan_success`, `scan_fail`, `history_view`, `admin_event_fix`
- 이벤트 파라미터: `route_id`, `stop_id`, `result_code`, `latency_ms`, `user_type`

### FR-08. 헬스체크 및 운영 API
- 서비스는 `/api/health`와 `/api/ready` 엔드포인트를 제공해야 한다.
- 헬스체크는 배포 직후 및 장애 대응 시 운영 판단의 기준이 되어야 한다.

### FR-09. 요청 검증 및 에러 표준화
- API 입력값은 스키마 기반으로 검증해야 한다.
- 잘못된 요청은 일관된 JSON 포맷과 상태 코드로 응답해야 한다.
- 서버 내부 오류와 사용자 노출 메시지는 분리 관리해야 한다.

### FR-10. LINE Messaging API 연동
- 서비스는 `POST /api/webhooks/line` 엔드포인트에서 `x-line-signature` 검증을 수행해야 한다.
- 서비스는 내부용 `POST /api/internal/notifications/line/push` 경로 또는 동등한 서버 계층에서 LINE push 발송을 수행할 수 있어야 한다.
- `MESSAGING_API_CHANNEL_ID`, `MESSAGING_API_CHANNEL_SECRET`, `MESSAGING_API_CHANNEL_ACCESS_TOKEN`은 P0 필수 환경변수다.
- LINE push 발송 실패는 추적 가능한 로그로 남겨야 한다.

---

## 7. 비기능 요구사항 (NFR)

### NFR-01. 성능
- 첫 화면 LCP: 모바일 2.5초 이내 목표
- 스캔 후 결과 표시: p95 1.5초 이내 목표

### NFR-02. 가용성
- 핵심 API 월간 가용성 목표: 99.9%
- 장애 시 운영자 공지 배너/대체 흐름 제공

### NFR-03. 보안/개인정보
- 개인정보 최소 수집 원칙
- Supabase RLS(Row Level Security) 적용
- 관리자 화면은 역할 기반 접근제어(RBAC) 적용

### NFR-04. 운영/관측성
- 서버 로그에 `request_id`, `user_id(hash)`, `result_code`를 남겨야 한다.
- 오류율 임계치 초과 시 알림(예: Slack Webhook) 연동 가능 구조 확보
- Prisma 쿼리 실패/타임아웃을 추적할 수 있어야 한다.
- LINE webhook 검증 실패 및 LINE push 발송 실패를 추적할 수 있어야 한다.

### NFR-05. 접근성/UX
- 모바일 한 손 조작 기준 버튼 크기/간격 확보
- 색상 외 텍스트/아이콘으로 상태 전달

### NFR-06. 서버리스 적합성
- 무료 플랜의 함수 실행/리소스 제한 내에서 동작하도록 설계해야 한다.
- 데이터베이스 연결은 서버리스 환경의 커넥션 폭증을 방지하도록 구성해야 한다.

---

## 8. 기술 설계 기준

### 8.1 Frontend (Next.js + React)
- App Router 기준으로 페이지/레이아웃 구성
- 서버 컴포넌트 + 클라이언트 컴포넌트 혼합
- 데이터 패칭은 서버 우선, 사용자 상호작용은 클라이언트 핸들링

### 8.2 UI (Tailwind + Ant Design 5)
- 레이아웃/간격/반응형: Tailwind
- 고급 컴포넌트(Table, Form, Modal, DatePicker): Ant Design 5
- 디자인 토큰(색상, radius, shadow)은 공통 테마로 통합

### 8.3 Backend (Next.js API + Supabase + Prisma)
- Next.js Route Handler를 기본 API 레이어로 사용한다.
- Postgres는 Supabase에서 운영한다.
- Prisma를 DB 접근 계층으로 사용해 타입 안정성과 마이그레이션 일관성을 확보한다.
- 운영자 인증은 Supabase Auth를 우선 검토한다.
- RLS 정책은 사용자 자기 데이터 접근만 허용하도록 설계한다.

### 8.4 지도 (OpenStreetMap)
- OSM 타일 + Leaflet 또는 MapLibre 계열 라이브러리 사용
- 정류장 밀집 구간에서 클러스터링 지원 고려

### 8.5 무료 배포 아키텍처

권장 아키텍처:

```text
LINE App
  -> LIFF Web App (Vercel)
    -> Next.js Route Handler (/api/v1/scan-events)
      -> Prisma
        -> Supabase Postgres
```

선정 이유:
- LIFF 중심 사용자 경험과 서버 이벤트 처리 구조에 적합하다.
- 별도 백엔드 서버 없이 웹앱과 API를 한 배포 단위로 운영할 수 있다.
- MVP 단계에서 무료 플랜으로 빠르게 시작하기 쉽다.
- 트래픽 증가 전까지 복잡한 인프라를 피할 수 있다.

### 8.6 배포/인프라
- Vercel Hobby: Next.js 배포 (preview/prod)
- Supabase Free: DB/API/스토리지
- CI: PR마다 lint/test/build 실행
- 배포 후 LIFF Endpoint URL을 최신 프로덕션 URL로 유지
- LINE Console의 LIFF Endpoint URL / Webhook URL / Use webhook 설정을 배포 상태와 동기화

### 8.7 구현 파일 기준
- `app/api/health/route.ts`
- `app/api/ready/route.ts`
- `app/api/v1/scan-events/route.ts`

권장 구현 원칙:
- 요청 스키마 검증은 zod 사용
- Prisma Client 재사용 패턴 적용
- 에러 응답 코드 표준화

### 8.8 분석 (GA4)
- 환경별 Measurement ID 분리(dev/stage/prod)
- 개인정보 직접 식별값 전송 금지

---

## 9. 환경변수 체크리스트

### 9.1 LINE
- `LINE_LOGIN_CHANNEL_ID`
- `LINE_LOGIN_CHANNEL_SECRET`
- `LIFF_ID`
- `MESSAGING_API_CHANNEL_ID`
- `MESSAGING_API_CHANNEL_SECRET`
- `MESSAGING_API_CHANNEL_ACCESS_TOKEN`
- `LIFF_ENDPOINT_URL`

### 9.2 앱/서버
- `DATABASE_URL` (Supabase Postgres pooled URL 권장)
- `DIRECT_DATABASE_URL` (Prisma migrate / direct connection 용도)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORT` (로컬 개발용)
- `NODE_ENV`
- `API_BASE_URL`
- `WEB_BASE_URL`

### 9.3 운영 원칙
- 프로덕션 환경변수는 Vercel과 Supabase에 분리 저장한다.
- 로컬/개발/프로덕션 값을 혼용하지 않는다.
- LIFF Endpoint와 `WEB_BASE_URL`은 배포 직후 즉시 동기화한다.

---

## 10. 데이터 모델(초안)

### 10.1 주요 엔티티
- `users` (id, liff_user_id, name, role, created_at)
- `routes` (id, name, direction, active)
- `stops` (id, route_id, name, lat, lng, sequence)
- `shuttle_runs` (id, route_id, service_date, status)
- `scan_events` (id, user_id, run_id, stop_id, scanned_at, result_code, idempotency_key)
- `event_audit_logs` (id, event_id, action, actor_id, reason, created_at)

### 10.2 인덱스/제약
- `scan_events(idempotency_key)` unique
- `stops(route_id, sequence)` unique
- `scan_events(user_id, scanned_at)` index

---

## 11. API 요구사항 (초안)

### 11.1 사용자 API
- `POST /api/v1/scan-events`
  - 입력: `runId`, `stopId`, `scannedAt`, `idempotencyKey`
  - 출력: `resultCode`, `message`, `eventId`
- `GET /api/v1/me/history?from=&to=&status=`
  - 입력 기간 기반 이력 조회

### 11.2 관리자 API
- `GET /api/v1/admin/events`
- `PATCH /api/v1/admin/events/:id`
- `GET /api/v1/admin/metrics`

### 11.3 운영 API
- `GET /api/health`
- `GET /api/ready`

### 11.4 API 품질 기준
- 모든 쓰기 API는 멱등성 고려
- 입력값 검증 실패 시 4xx 반환
- 시스템 오류 시 추적 가능한 로그를 남기고 5xx 반환

---

## 12. 이벤트/상태 코드 표준

- `SUCCESS`: 정상 처리
- `DUPLICATE`: 중복 스캔
- `INVALID_QR`: 잘못된 QR 포맷
- `OUT_OF_ROUTE`: 노선 불일치
- `AUTH_REQUIRED`: 인증 필요
- `SYSTEM_ERROR`: 서버/외부 시스템 오류

사용자 메시지와 내부 로그 코드는 분리 운영한다.

---

## 13. 측정 지표 (KPI)

### 13.1 핵심 KPI
1. 스캔 성공률 = 성공 이벤트 / 전체 스캔 시도
2. p95 처리시간
3. 탑승 완료율(스캔 시작 대비 성공)
4. 일간/주간 활성 사용자(DAU/WAU)

### 13.2 운영 KPI
1. 오류 코드별 발생량
2. 운영자 보정 건수
3. 중복 스캔 비율
4. 헬스체크 실패 횟수
5. DB 연결/쿼리 실패율

---

## 14. 무료 플랜 운영 기준

### 14.1 무료 플랜 운영 원칙
1. 프론트엔드와 API는 단일 Next.js 프로젝트로 운영한다.
2. 데이터베이스는 Supabase Free를 사용하되 pooled connection을 우선 검토한다.
3. 비용이 증가하는 요소는 알림/관측 지표로 먼저 감지하고, 임계치 도달 전 유료 전환을 판단한다.

### 14.2 주의사항
1. **Vercel 함수 제한**
   - 무료 플랜의 함수 실행/리소스 제한을 넘지 않도록 API 로직을 가볍게 유지한다.
2. **DB 커넥션 관리**
   - 서버리스에서 커넥션 폭증 방지가 필요하다.
   - Supabase pooler와 Prisma 설정을 함께 점검한다.
3. **정책 변경 가능성**
   - 무료 플랜 한도는 변경될 수 있으므로 배포 시점에 최신 공식 문서를 재확인한다.
4. **확장 기준 사전 정의**
   - API latency, 에러율, DB CPU/커넥션 임계치 도달 시 유료 전환 여부를 검토한다.

### 14.3 유료 전환 트리거
- p95 API latency가 목표치를 반복 초과할 때
- DB 연결 실패가 반복 발생할 때
- Vercel 함수 제한으로 운영 안정성이 저하될 때
- 운영자 모니터링/로그 보관 요구가 무료 플랜 범위를 넘어설 때

---

## 15. 릴리즈 계획

### 15.1 실제 구현 워크스트림
1. **채널/자격증명 워크스트림**
   - LINE Login 채널, LIFF 앱, Messaging API 채널, Supabase 프로젝트를 생성한다.
   - `.env`에는 LIFF/Messaging API/Supabase/DB 연결 문자열을 루트 기준으로 등록한다.
   - webhook 보안은 `x-line-signature` 검증을 기준으로 구현한다.
2. **서버/API 워크스트림**
   - 스캔 이벤트 API, health/ready API, LINE webhook API, 내부용 LINE push API를 구현한다.
   - 요청 검증은 zod, DB 접근은 Prisma, 운영 검증은 `/api/ready`로 통일한다.
3. **데이터/인프라 워크스트림**
   - Supabase pooled connection과 direct connection을 분리해 관리한다.
   - Prisma migration은 direct connection을 사용하고, 런타임 API는 pooled connection을 기본으로 사용한다.
4. **프론트/LIFF 워크스트림**
   - LIFF 초기화, QR 스캔, 스캔 결과, 이력 조회, 운영자 화면을 단계적으로 연결한다.
   - LIFF와 Messaging API는 같은 LINE 생태계 채널 운영 기준에서 관리한다.
5. **배포/운영 워크스트림**
   - Vercel 배포 후 LIFF Endpoint와 LINE Webhook URL을 실제 배포 URL로 갱신한다.
   - LINE Console Verify, 테스트 push 메시지, `/api/ready`, GA4 이벤트를 운영 시작 전 최종 검증한다.

### Phase 0 (1주): 기획/설계 확정
- PRD, IA, 데이터 모델, KPI 사인오프
- LINE Login / LIFF / Messaging API 채널 준비
- Supabase / Vercel 계정 및 프로젝트 준비
- 필수 환경변수 등록 및 webhook URL 전략 확정
- Express 기준 임시 P0 서버와 최종 Next.js 목표 구조 간 이행 순서 확정

### Phase 1 (2주): 사용자 핵심 플로우
- LIFF 진입/인증
- 스캔/결과/이력 기본 구현
- `POST /api/v1/scan-events` 구현
- `POST /api/webhooks/line` 구현
- `POST /api/internal/notifications/line/push` 구현
- 스캔 이벤트와 LINE push 발송 이벤트의 로그 기준 정리

### Phase 2 (2주): 운영 기능 + 지도
- 관리자 이벤트 모니터링
- OSM 정류장 시각화
- `/api/health`, `/api/ready` 구현
- LINE 발송 상태/실패 사유 모니터링 기초 구현

### Phase 3 (1주): 배포/안정화/분석
- Supabase 연결 및 Prisma migration / generate
- Vercel 배포 + 환경변수 등록
- LIFF Endpoint URL 갱신
- LINE Webhook URL 갱신 + Verify + Use webhook 활성화
- GA4 대시보드 검증
- 성능 최적화 및 버그 픽스

### Phase 4 (운영 시작 직전): 운영 검증
- E2E 테스트 (scan -> API 저장 -> 결과 조회)
- LINE Console Verify 요청 점검
- 개발자 계정 대상 LINE push 메시지 발송 점검
- 무료 플랜 제한 점검
- 장애 대응 체크리스트 점검

---

## 16. 운영 체크리스트

- [ ] `/api/health` 정상 응답
- [ ] `/api/ready` 정상 응답
- [ ] `POST /api/v1/scan-events` 유효성 검증/에러 핸들링 확인
- [ ] `POST /api/webhooks/line` 서명 검증 확인
- [ ] `POST /api/internal/notifications/line/push` 발송 확인
- [ ] 중복 스캔 멱등 처리 확인
- [ ] Prisma 쿼리 타임아웃/실패 로그 수집 확인
- [ ] LIFF 권한/컨텍스트 실패 시 UX 확인
- [ ] Vercel 환경변수 누락 여부 확인
- [ ] Supabase 연결 문자열이 pooled URL인지 확인
- [ ] LIFF Endpoint URL이 최신 배포 URL과 일치하는지 확인
- [ ] Messaging API access token이 유효한지 확인

---

## 17. 리스크 및 대응 전략

1. **LIFF/브라우저 호환 이슈**
   - 대응: 주요 단말 사전 검증 매트릭스 운영
2. **모바일 네트워크 불안정**
   - 대응: 재시도 UX, 타임아웃/오류 문구 표준화
3. **잘못된 QR 배포**
   - 대응: QR 서명/버전 필드, 운영자 즉시 폐기 기능
4. **운영자 권한 오남용**
   - 대응: 변경 로그 + 승인 워크플로우(차기)
5. **서버리스 DB 커넥션 급증**
   - 대응: pooled connection 사용, Prisma 재사용 패턴 적용
6. **무료 플랜 정책 변경**
   - 대응: 배포 전 공식 문서 재검토, 유료 전환 기준 사전 수립

---

## 18. 수용 기준 (Acceptance Criteria)

- 사용자는 LINE에서 LIFF 앱을 열고 60초 내 첫 스캔 완료 가능해야 한다.
- 중복 스캔은 100% `DUPLICATE`로 분류되어야 한다.
- 관리자 페이지에서 실패 이벤트를 필터링하고 사유를 확인할 수 있어야 한다.
- GA4에서 핵심 퍼널(진입→스캔시작→성공)을 일 단위로 확인 가능해야 한다.
- `/api/health`와 `/api/ready`가 프로덕션에서 정상 응답해야 한다.
- LINE Console Verify 요청이 `POST /api/webhooks/line`에서 200으로 통과해야 한다.
- 친구 추가된 테스트 계정에 LINE push 메시지 1건 발송이 성공해야 한다.
- 프로덕션 배포 후 치명 장애 없이 7일 연속 운영 가능해야 한다.

---

## 19. 오픈 이슈 (결정 필요)

1. 운영자 인증 수단: Supabase Auth 단독 vs 사내 SSO
2. 지도 라이브러리: Leaflet vs MapLibre 최종 선택
3. 스캔 실패 자동 재시도 정책(클라이언트/서버)
4. 개인정보 보존 기간 및 삭제 정책
5. 무료 플랜 유지 기간과 유료 전환 판단 지표의 구체 임계값

---

## 20. 참고 문서 (공식)

- Next.js Route Handlers: https://nextjs.org/docs/app/api-reference/file-conventions/route
- Vercel Functions limits: https://vercel.com/docs/functions/limitations
- Vercel Hobby plan: https://vercel.com/docs/plans/hobby
- Vercel + Next.js: https://vercel.com/docs/frameworks/full-stack/nextjs
- Supabase Postgres 연결: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase Pricing: https://supabase.com/pricing
- LINE LIFF Getting started: https://developers.line.biz/en/docs/liff/getting-started/
- LINE LIFF Registering apps: https://developers.line.biz/en/docs/liff/registering-liff-apps/
- LINE Login Getting started: https://developers.line.biz/en/docs/line-login/getting-started/

---

## 21. 한 줄 결론

NaSum Church Shuttle v1은 **LIFF 기반 스캔 경험을 중심으로 Next.js/React UI, Next.js API, Supabase Postgres, Prisma, OSM 지도, LINE Messaging API, GA4 분석, Vercel Hobby 배포 체계를 결합**해 "빠른 탑승 처리 + 운영 가시성 + LINE 기반 알림 + 무료 플랜 기반 빠른 MVP 운영"을 달성하는 것을 목표로 한다.
