# LINE 연동 기획서 (PROJECT_PLAN 비교 반영판)

작성일: 2026-03-28  
기준 문서: `PROJECT_PLAN.md` + 현재 서버 스캐폴드(`POST /api/v1/scan-events`)

---

## 1) 결론 (요청사항 반영)

맞습니다. 이번 개편에서 **핵심 도메인/서버 사이드 구조는 유지**하고, 바뀌는 것은 사실상 아래 2가지입니다.

1. **라우팅 단순화**: `/line` 하위 LIFF 전용 화면 중심
2. **엔드포인트 단순화**: LINE Messaging API + LIFF 연동용 API 추가

즉, `PROJECT_PLAN.md`의 서버 파이프라인(스캔 이벤트 → 대상 계산 → 알림 큐)은 유지하며,
채널/전달 계층만 LINE 중심으로 정리하는 것이 이번 기획의 핵심입니다.

---

## 2) PROJECT_PLAN 대비 변경/유지 사항

## 2.1 유지되는 부분 (동일)

- QR 스캔 이벤트를 서버가 수신
- 현재 정류장 기준 다음 2개 정류장 대상자 계산
- 알림 큐(`notification_deliveries`) 생성
- 도메인 중심 백엔드 구조(`scan_events`, `boarding_declarations` 등)

위 항목은 `PROJECT_PLAN.md` 방향과 동일합니다.

## 2.2 변경되는 부분 (차이)

- 알림 전송 채널을 **FCM/APNs + LINE Push** 공존 가능 구조로 확장
- 사용자 접점을 **LINE 채팅 + LIFF `/line`** 중심으로 통합
- API를 LINE 연동 관점으로 단순화(아래 5장 참조)

---

## 3) 서버 사이드 포함 범위 (필수)

요청하신 대로 서버 사이드는 반드시 포함됩니다. 최소 범위는 다음과 같습니다.

### A. Webhook/Bot 서버
- LINE Messaging API webhook 수신
- 자동응답(도움말/정류장 등록 안내/상태 조회)
- 사용자 액션을 내부 API로 전달

### B. 도메인 API 서버 (기존 확장)
- `POST /api/v1/scan-events` 유지
- 정류장 등록/조회 API
- LINE 계정 연동 API

### C. Notification Dispatcher
- `notification_deliveries` 큐 소비
- 채널별 발송기 분기(`LINE`, `FCM`, `APNS`)
- 실패 재시도/멱등 처리

### D. 데이터 계층
- 기존 테이블 유지 + LINE 매핑 필드 추가
- 멱등키(unique)로 중복 발송 방지

---

## 4) 통합 아키텍처 (서버 중심)

1. 스캔 단말/운영 시스템이 `POST /api/v1/scan-events` 호출  
2. 서버가 기존 규칙대로 다음 2개 정류장 대상자 계산  
3. `notification_deliveries`에 채널별 작업 생성  
4. 디스패처가 채널 타입에 따라 발송  
   - `LINE` → Messaging API Push
   - `FCM/APNS` → 기존 모바일 푸시
5. 사용자는 LINE 메시지에서 `/line` LIFF 화면으로 진입해 상세 확인

---

## 5) 라우팅/엔드포인트 단순화안 (차이의 핵심)

## 5.1 프론트 라우팅 (LIFF)

- `/line` : 홈/연동 상태
- `/line/stops` : 탑승 정류장 등록
- `/line/alerts` : 이전/전전 정류장 알림 조건
- `/line/history` : 최근 알림/스캔 이력

## 5.2 백엔드 API (LINE 전용 추가)

### 기존 유지
- `POST /api/v1/scan-events`

### LINE 연동 추가
- `POST /api/v1/line/webhook`
- `POST /api/v1/line/link`
- `GET /api/v1/line/me/stops`
- `POST /api/v1/line/me/stops`

> 핵심은 “새 도메인을 만드는 것”이 아니라, 기존 도메인 API에 LINE 접점을 얇게 추가하는 것입니다.

---

## 6) 데이터 모델 (서버 사이드 반영)

기존 모델은 유지하고 아래만 추가 권장:

- `users.line_user_id`
- `users.line_linked_at`
- `notification_deliveries.channel`
- `notification_deliveries.provider_message_id`
- `notification_deliveries.template_code`

멱등키 예시:
- `(user_id, shuttle_run_id, target_stop_id, trigger_stop_id, channel)`

---

## 7) 구현 순서 (백엔드 우선)

### Phase 1 (서버 확장)

- LINE webhook 엔드포인트 추가
- LINE 사용자 매핑 API 추가
- 디스패처에 LINE Push sender 추가

### Phase 2 (LIFF UI)

- `/line` 라우팅 4개 구현
- 정류장/알림 조건 CRUD
- webhook 자동응답과 화면 진입 연결

### Phase 3 (운영 안정화)

- 전송 실패 재시도/백오프
- DLQ/모니터링/대시보드
- 템플릿 관리 및 감사 로그

---

## 8) 정책/권한 체크리스트

- Messaging API 채널 + LIFF 채널 동일 provider
- LIFF scope: `openid`, `profile`, (필요 시) `chat_message.write`
- QR 사용 시 LIFF Scan QR 사용 가능 설정
- webhook 시그니처 검증 + 재전달 대응

---

## 9) 공식 문서 출처

- Messaging API overview: https://developers.line.biz/en/docs/messaging-api/overview/
- Sending messages: https://developers.line.biz/en/docs/messaging-api/sending-messages/
- Receiving messages (webhook): https://developers.line.biz/en/docs/messaging-api/receiving-messages/
- LIFF overview: https://developers.line.biz/en/docs/liff/overview/
- LIFF developing guide: https://developers.line.biz/en/docs/liff/developing-liff-apps/
- LIFF reference: https://developers.line.biz/en/reference/liff/
- LINE MINI App overview: https://developers.line.biz/en/docs/line-mini-app/develop/develop-overview/

---

## 10) 최종 정리

`PROJECT_PLAN.md`와 비교했을 때, 이번 안의 본질은 다음 한 줄로 요약됩니다.

- **도메인/서버 파이프라인은 유지, 라우팅/엔드포인트만 LINE 연동 관점으로 단순화**.

따라서 “서버 사이드는 필요하다”는 요구사항이 정확하며, 본 문서는 이를 필수 범위로 포함해 재정리했습니다.
