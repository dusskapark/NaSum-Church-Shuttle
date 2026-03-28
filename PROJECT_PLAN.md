# 셔틀버스 앱 프로젝트 플랜 (최종안)

작성일: 2026-03-28  
기준: 기존 서버 스캐폴드 + LINE Messaging API + LIFF(`/line`) 통합

---

## 1) 프로젝트 목표

기존 도메인 파이프라인(정류장 QR 스캔 → 대상 계산 → 알림 큐)은 유지하고, 사용자 채널을 LINE 중심으로 확장한다.

핵심 목표:
- 사용자가 LINE 채팅/LIFF에서 본인 탑승 정류장을 등록한다.
- 정류장 QR 스캔 이벤트가 발생하면 현재 정류장 기준 다음 2개 정류장 탑승 예정자에게 알림을 보낸다.
- 알림은 채널별로 분기 가능(`LINE`, `FCM`, `APNS`)하도록 서버에서 통합 관리한다.
- `/line` 상세 화면에서 정류장/알림 설정/이력을 확인할 수 있게 한다.

---

## 2) 제품 컨셉 (MVP)

### 사용자 시나리오
1. 사용자가 LINE 채팅에서 메뉴/링크를 눌러 `/line` LIFF 화면에 진입한다.
2. 사용자 계정을 LINE 계정과 연동하고, 탑승 정류장/알림 조건(이전 1개/2개)을 저장한다.
3. 운행 중 QR 스캔 이벤트가 서버로 들어온다.
4. 서버가 기존 규칙으로 대상자를 계산해 알림 큐를 생성한다.
5. 디스패처가 LINE Push(또는 기존 FCM/APNS)로 알림을 발송한다.
6. 사용자는 메시지에서 상세 링크를 눌러 `/line/history`에서 확인한다.

### 핵심 기능(MVP)
- 정류장 QR 스캔 이벤트 수신 (`POST /api/v1/scan-events`)
- 다음 2개 정류장 대상자 계산 로직
- 알림 큐 생성 및 채널별 디스패치
- LINE webhook 자동응답(도움말/정류장 등록 안내/상태조회)
- LIFF `/line` 화면(홈/정류장/알림/이력)

---

## 3) 시스템 아키텍처

### 3.1 서버 컴포넌트
1. **Domain API Server (기존 확장)**
   - 스캔 이벤트 수신
   - 대상자 계산
   - 정류장/알림 설정 CRUD
2. **LINE Webhook/Bot Handler**
   - Messaging API webhook 수신
   - 자동응답 및 LIFF 딥링크 안내
3. **Notification Dispatcher**
   - `notification_deliveries` 큐 소비
   - 채널별 발송기 분기(`LINE`, `FCM`, `APNS`)
4. **DB**
   - 운행/정류장/탑승 선언/스캔/알림 이력 저장

### 3.2 프론트 컴포넌트
- LIFF Web App (`/line`)
  - `/line` : 홈/연동 상태
  - `/line/stops` : 탑승 정류장 등록
  - `/line/alerts` : 알림 조건 설정
  - `/line/history` : 최근 알림/스캔 이력

---

## 4) API 설계 (단순화 버전)

### 4.1 기존 유지 API
- `POST /api/v1/scan-events`

입력 예시:
```json
{
  "shuttleRunId": "run_123",
  "stopId": "stop_001",
  "scannedByUserId": "driver_123",
  "scannedAt": "2026-03-27T08:30:00.000Z"
}
```

처리:
1. 스캔 정류장 유효성 검증
2. 다음 2개 정류장 도출
3. 탑승 선언자 조회
4. 알림 큐 생성

### 4.2 LINE 연동 추가 API
- `POST /api/v1/line/webhook`
- `POST /api/v1/line/link`
- `GET /api/v1/line/me/stops`
- `POST /api/v1/line/me/stops`

---

## 5) 데이터 설계 (확정 초안)

### 기존 핵심 테이블
- `users`
- `routes`, `stops`, `route_stops`, `shuttle_runs`
- `boarding_declarations`
- `scan_events`
- `notification_deliveries`

### 추가 필드 제안 (LINE 연동)
- `users.line_user_id`
- `users.line_linked_at`
- `notification_deliveries.channel`
- `notification_deliveries.provider_message_id`
- `notification_deliveries.template_code`

### 멱등성 키 권장
- `(user_id, shuttle_run_id, target_stop_id, trigger_stop_id, channel)`

---

## 6) 메시징 정책 및 권한 체크리스트

- Messaging API 채널과 LIFF 채널을 동일 provider로 구성
- LIFF scopes: `openid`, `profile`, (필요 시) `chat_message.write`
- QR 사용 시 LIFF Scan QR 사용 가능 설정
- webhook 시그니처 검증 및 redelivery/중복 처리
- 서비스 메시지 사용 시 LINE MINI App 정책/검수 기준 준수

---

## 7) 개발 단계 로드맵

### Phase 1. 서버 확장 (백엔드 우선)
- `POST /api/v1/line/webhook` 구현
- LINE 계정 연동 API 구현
- 디스패처 LINE sender 추가
- 알림 멱등성/재시도 기초 구현

### Phase 2. LIFF 화면 구현
- `/line`, `/line/stops`, `/line/alerts`, `/line/history` 구현
- 정류장/알림 설정 UX 완성
- 메시지 ↔ 화면 딥링크 연결

### Phase 3. 안정화/운영
- 실패 재시도/백오프/DLQ
- 모니터링(전송률/지연/실패 사유)
- 템플릿 버전/감사 로그 관리

---

## 8) 비기능 요구사항

- 모바일 퍼스트
- 개인정보 최소 수집
- 장애 시 graceful degradation (LINE 발송 실패 시 재시도 큐)
- 운영 로그 및 추적성 확보

---

## 9) 리스크 및 대응

1. LINE userId 미연동 사용자
   - 대응: 연동 유도 메시지 + LIFF 진입 가이드
2. 중복 발송
   - 대응: 멱등키 + dispatch 상태 머신
3. 채널별 전송 실패 편차
   - 대응: 채널별 재시도 정책 분리

---

## 10) 즉시 결정 필요 항목

1. 알림 채널 운영정책: LINE only vs LINE+FCM/APNS 병행
2. LIFF 화면 우선순위: `/line/stops` 우선 여부
3. 정류장 등록 UX: 단일 정류장 vs 다중 정류장
4. 자동응답 범위: 1차 명령 세트 확정

---

## 11) 공식 문서 참고

- Messaging API overview: https://developers.line.biz/en/docs/messaging-api/overview/
- Sending messages: https://developers.line.biz/en/docs/messaging-api/sending-messages/
- Receiving messages (webhook): https://developers.line.biz/en/docs/messaging-api/receiving-messages/
- LIFF overview: https://developers.line.biz/en/docs/liff/overview/
- LIFF developing guide: https://developers.line.biz/en/docs/liff/developing-liff-apps/
- LIFF reference: https://developers.line.biz/en/reference/liff/
- LINE MINI App overview: https://developers.line.biz/en/docs/line-mini-app/develop/develop-overview/

---

## 12) 최종 한 줄 요약

**기존 서버 도메인 파이프라인은 유지하고, 라우팅/엔드포인트를 LINE Messaging API + LIFF 중심으로 단순화해 증분 통합한다.**
