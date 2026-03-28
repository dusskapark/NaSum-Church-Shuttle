# Push Frame 제품 요구사항 문서(PRD)

작성일: 2026-03-28  
문서 버전: v2.0 (Detailed PRD)  
제품 형태: **LINE LIFF 기반 셔틀 승하차/탑승 관리 웹앱**

---

## 1. 문서 목적

이 문서는 Push Frame의 MVP~v1 범위를 기준으로, 제품/디자인/개발/운영 팀이 동일한 기준으로 실행할 수 있도록 기능, 비기능, 일정, 성공 지표를 정의한다.

핵심 기술 스택:
- Frontend: **Next.js + React + Tailwind CSS + Ant Design 5**
- Backend: **Supabase (Postgres + Auth + Realtime + Edge Functions 선택 적용)**
- Map: **OpenStreetMap**
- Messaging Container: **LINE LIFF**
- Analytics: **Google Analytics 4 (GA4)**
- Deployment: **Vercel (Web), Supabase (DB/API)**

---

## 2. 제품 비전 및 목표

### 2.1 제품 비전
“LINE 안에서 빠르고 직관적으로 셔틀 탑승 흐름을 완료하고, 운영자는 실시간에 가깝게 승하차 이벤트를 파악할 수 있는 경량 운영 플랫폼”

### 2.2 비즈니스 목표
1. QR 스캔 기반 탑승 체크인 시간을 단축한다.
2. 노선/정류장 기반 탑승 이벤트 누락을 최소화한다.
3. 운영자가 이벤트 실패 원인(중복, 권한, 네트워크)을 즉시 파악하도록 한다.

### 2.3 제품 목표 (사용자 가치)
1. 사용자는 LINE에서 앱 설치 없이 LIFF로 바로 진입한다.
2. 사용자는 3탭 이내로 “스캔 → 확인 → 완료”를 끝낸다.
3. 사용자는 내 탑승 이력을 확인하고 오류 시 재시도할 수 있다.

---

## 3. 범위 정의

### 3.1 In Scope (MVP~v1)
- LIFF 로그인/프로필 컨텍스트 기반 사용자 식별
- QR 스캔(정류장/탑승 식별 코드) 및 이벤트 저장
- 노선/정류장 정보 조회
- OpenStreetMap 기반 정류장 위치 표시
- 사용자 탑승 이력 조회
- 운영자용 이벤트 모니터링 페이지(웹)
- GA4 이벤트 수집(핵심 퍼널 중심)
- Vercel+Supabase 배포 자동화

### 3.2 Out of Scope (현 단계 제외)
- FCM/APNs 등 OS Push 시스템
- 복수 메신저 플랫폼 연동 (예: 카카오, WhatsApp)
- 고급 배차 최적화 엔진
- 오프라인 완전 동기화 앱(PWA 고도화)

---

## 4. 핵심 사용자 및 시나리오

### 4.1 사용자 타입
- **일반 사용자(탑승자)**: QR 스캔, 탑승 상태 확인, 이력 조회
- **운영자(관리자)**: 이벤트 모니터링, 오류 확인, 수동 보정
- **시스템 관리자**: 노선/정류장 데이터 관리, 권한 설정

### 4.2 대표 시나리오
1. 탑승자는 LINE 채널 메뉴에서 LIFF 앱 진입
2. 홈에서 오늘 운행 정보 확인
3. “탑승 스캔” 버튼으로 QR 인식
4. 서버 검증 후 “정상 처리” 또는 “오류/중복” 결과 노출
5. 탑승자는 내 이력 탭에서 기록 확인
6. 운영자는 관리자 화면에서 실패 이벤트 확인 및 보정

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

### NFR-05. 접근성/UX
- 모바일 한 손 조작 기준 버튼 크기/간격 확보
- 색상 외 텍스트/아이콘으로 상태 전달

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

### 8.3 Backend (Supabase)
- Postgres: 핵심 도메인 데이터 저장
- Auth: 운영자 인증(이메일/SSO 옵션)
- RLS 정책: 사용자 자기 데이터 접근만 허용
- Edge Functions: 외부 웹훅/추가 검증 로직에 선택 적용

### 8.4 지도 (OpenStreetMap)
- OSM 타일 + Leaflet 또는 MapLibre 계열 라이브러리 사용
- 정류장 밀집 구간에서 클러스터링 지원 고려

### 8.5 배포/인프라
- Vercel: Next.js 배포 (preview/prod)
- Supabase: DB/API/스토리지
- CI: PR마다 lint/test/build 실행

### 8.6 분석 (GA4)
- 환경별 Measurement ID 분리(dev/stage/prod)
- 개인정보 직접 식별값 전송 금지

---

## 9. 데이터 모델(초안)

### 9.1 주요 엔티티
- `users` (id, liff_user_id, name, role, created_at)
- `routes` (id, name, direction, active)
- `stops` (id, route_id, name, lat, lng, sequence)
- `shuttle_runs` (id, route_id, service_date, status)
- `scan_events` (id, user_id, run_id, stop_id, scanned_at, result_code, idempotency_key)
- `event_audit_logs` (id, event_id, action, actor_id, reason, created_at)

### 9.2 인덱스/제약
- `scan_events(idempotency_key)` unique
- `stops(route_id, sequence)` unique
- `scan_events(user_id, scanned_at)` index

---

## 10. API 요구사항 (초안)

### 10.1 사용자 API
- `POST /api/v1/scan-events`
  - 입력: runId, stopId, scannedAt, idempotencyKey
  - 출력: resultCode, message, eventId
- `GET /api/v1/me/history?from=&to=&status=`
  - 입력 기간 기반 이력 조회

### 10.2 관리자 API
- `GET /api/v1/admin/events`
- `PATCH /api/v1/admin/events/:id`
- `GET /api/v1/admin/metrics`

### 10.3 운영 API
- `GET /api/health`
- `GET /api/ready`

---

## 11. 이벤트/상태 코드 표준

- `SUCCESS`: 정상 처리
- `DUPLICATE`: 중복 스캔
- `INVALID_QR`: 잘못된 QR 포맷
- `OUT_OF_ROUTE`: 노선 불일치
- `AUTH_REQUIRED`: 인증 필요
- `SYSTEM_ERROR`: 서버/외부 시스템 오류

사용자 메시지와 내부 로그 코드는 분리 운영한다.

---

## 12. 측정 지표 (KPI)

### 12.1 핵심 KPI
1. 스캔 성공률 = 성공 이벤트 / 전체 스캔 시도
2. p95 처리시간
3. 탑승 완료율(스캔 시작 대비 성공)
4. 일간/주간 활성 사용자(DAU/WAU)

### 12.2 운영 KPI
1. 오류 코드별 발생량
2. 운영자 보정 건수
3. 중복 스캔 비율

---

## 13. 릴리즈 계획

### Phase 0 (1주): 기획/설계 확정
- PRD, IA, 데이터 모델, KPI 사인오프

### Phase 1 (2주): 사용자 핵심 플로우
- LIFF 진입/인증
- 스캔/결과/이력 기본 구현

### Phase 2 (2주): 운영 기능 + 지도
- 관리자 이벤트 모니터링
- OSM 정류장 시각화

### Phase 3 (1주): 안정화/분석
- GA4 대시보드 검증
- 성능 최적화 및 버그 픽스

---

## 14. 리스크 및 대응 전략

1. **LIFF/브라우저 호환 이슈**
   - 대응: 주요 단말 사전 검증 매트릭스 운영
2. **모바일 네트워크 불안정**
   - 대응: 재시도 UX, 타임아웃/오류 문구 표준화
3. **잘못된 QR 배포**
   - 대응: QR 서명/버전 필드, 운영자 즉시 폐기 기능
4. **운영자 권한 오남용**
   - 대응: 변경 로그 + 승인 워크플로우(차기)

---

## 15. 수용 기준 (Acceptance Criteria)

- 사용자는 LINE에서 LIFF 앱을 열고 60초 내 첫 스캔 완료 가능해야 한다.
- 중복 스캔은 100% `DUPLICATE`로 분류되어야 한다.
- 관리자 페이지에서 실패 이벤트를 필터링하고 사유를 확인할 수 있어야 한다.
- GA4에서 핵심 퍼널(진입→스캔시작→성공)을 일 단위로 확인 가능해야 한다.
- 프로덕션 배포 후 치명 장애 없이 7일 연속 운영 가능해야 한다.

---

## 16. 오픈 이슈 (결정 필요)

1. 운영자 인증 수단: Supabase Auth 단독 vs 사내 SSO
2. 지도 라이브러리: Leaflet vs MapLibre 최종 선택
3. 스캔 실패 자동 재시도 정책(클라이언트/서버)
4. 개인정보 보존 기간 및 삭제 정책

---

## 17. 한 줄 결론

Push Frame v1은 **LIFF 기반 스캔 경험을 중심으로 Next.js/React UI, Supabase 백엔드, OSM 지도, GA4 분석, Vercel 배포 체계를 결합**해 “빠른 탑승 처리 + 운영 가시성”을 달성하는 것을 목표로 한다.
