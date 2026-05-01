# NaSum Church Shuttle

나섬교회 셔틀 탑승, 노선 확인, QR 스캔, 관리자 운영을 위한 Next.js/LIFF 기반 앱입니다.

## 변경 포인트

- 탑승자용 노선/정류장 확인 화면 제공
- LIFF 기반 QR 스캔 및 LINE 사용자 인증 흐름 제공
- 관리자용 노선, 운행, 탑승 등록 관리 화면 제공

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
# Optional alias for local Neon serverless usage
NEON_DATABASE_URL=postgresql://...
# Optional: only needed for Prisma schema changes or migrations
DIRECT_URL=postgresql://...
NEXT_PUBLIC_LIFF_ID=...
# Optional: localhost development LIFF ID override
NEXT_PUBLIC_LIFF_ID_DEV=...
```

빠르게 시작하려면:

```bash
cp .env.local.example .env.local
```

현재 운영 방식은 local/Vercel이 같은 Neon production 브랜치를 공유하는 single-branch 구성입니다.

## LIFF QR 스캔

- `/scan` 페이지는 `LIFF scanCodeV2`를 사용합니다.
- QR 스캔은 LINE 앱 내부에서만 동작합니다.
- LIFF 콘솔에서 해당 앱의 QR scanner capability가 활성화되어 있어야 합니다.
