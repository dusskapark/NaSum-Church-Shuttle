# NaSum Church Shuttle (Frontend Reboot)

기존 프론트엔드를 걷어내고 [`YKizou/Uber-Clone`](https://github.com/YKizou/Uber-Clone) 흐름을 기준으로 다시 시작한 버전입니다.

## 변경 포인트

- 페이지 구조를 Uber-Clone 스타일(`index → search → confirm`)로 재구성
- 지도/지오코딩/경로 시간 계산은 **원본 프로젝트 기준(Mapbox)** 으로 유지
- Mapbox Directions API 응답 기반으로 예상 소요시간/요금을 계산

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## 환경 변수

`.env.local`에 아래 값을 설정하세요.

```bash
DATABASE_URL=postgresql://...
# Optional: only needed for Prisma schema changes or migrations
DIRECT_URL=postgresql://...
NEXT_PUBLIC_LIFF_ID=...
# Optional: localhost development LIFF ID override
NEXT_PUBLIC_LIFF_ID_DEV=...
```

현재 운영 방식은 local/Vercel이 같은 Neon production 브랜치를 공유하는 single-branch 구성입니다.

## LIFF QR 스캔

- `/scan` 페이지는 `LIFF scanCodeV2`를 사용합니다.
- QR 스캔은 LINE 앱 내부에서만 동작합니다.
- LIFF 콘솔에서 해당 앱의 QR scanner capability가 활성화되어 있어야 합니다.
