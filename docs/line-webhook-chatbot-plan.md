# LINE Messaging Webhook 챗봇(초기 버전) 구현 메모

## 구현 범위
- `POST /webhook` 엔드포인트 추가
- LINE 웹훅 시그니처(HMAC-SHA256) 검증
- 텍스트 메시지 키워드 매칭 기반 자동 응답
- Buttons Template로 LIFF 링크(`.../scan`) reply

## 핵심 정책
- 키워드: `셔틀`, `버스`, `탑승`, `노선`, `shuttle`, `bus`, `route`
- 키워드 미매칭 시 무응답
- 이벤트 내부 실패가 있어도 웹훅 응답은 200 유지

## 환경변수
- `MESSAGING_API_CHANNEL_SECRET`
- `MESSAGING_API_CHANNEL_ACCESS_TOKEN`
- `NEXT_PUBLIC_LIFF_ID`
- `NEXT_PUBLIC_APP_URL`

## 구현 파일
- `app/webhook/route.ts`
- `src/server/line-webhook.ts`
- `src/server/line-messaging.ts`

## LIFF URL 조립 우선순위
1. `NEXT_PUBLIC_LIFF_ID` → `https://liff.line.me/{LIFF_ID}/scan`
2. 없으면 `NEXT_PUBLIC_APP_URL/scan`
3. 둘 다 없으면 오류 로그 후 reply 생략
