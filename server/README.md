# Shuttle Server (초기 스캐폴드)

정류장 QR 스캔 이벤트를 수신하고, 현재 정류장 기준 **다음 2개 정류장 탑승 예정자**를 계산/기록하는 API 서버입니다.

> 참고: 본 프로젝트 범위에서는 FCM/APNs 기반 푸시 발송을 사용하지 않습니다.

## 실행

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run dev
```

## 핵심 엔드포인트

### `POST /api/v1/scan-events`
정류장 QR 코드 스캔 이벤트를 등록하고 후속 처리 레코드를 생성합니다.

요청 예시:

```json
{
  "shuttleRunId": "run_123",
  "stopId": "stop_001",
  "scannedByUserId": "driver_123",
  "scannedAt": "2026-03-27T08:30:00.000Z"
}
```

처리 흐름:
1. 스캔한 정류장이 해당 운행(route)에 속하는지 검증
2. 현재 정류장 이후 **다음 2개 정류장** 도출
3. 해당 정류장에 `DECLARED` 상태로 탑승 선언한 사용자 조회
4. `notification_deliveries` 레코드 생성(이벤트 처리/후속 액션 추적 목적)

## 데이터 모델 요약
- `users`, `device_tokens`
- `routes`, `stops`, `route_stops`, `shuttle_runs`
- `boarding_declarations`
- `scan_events`
- `notification_deliveries`

상세는 `prisma/schema.prisma`를 참고하세요.
