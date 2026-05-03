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

# Universal Links / Android App Links
IOS_UNIVERSAL_LINK_APP_IDS=ZQC7QNZ4J8.sg.nasumchurch.shuttle
ANDROID_APP_PACKAGE_NAME=sg.nasumchurch.shuttle
ANDROID_SHA256_CERT_FINGERPRINTS=SHA256:FINGERPRINT

# LINE Messaging fallback / webhook
MESSAGING_API_CHANNEL_SECRET=...
MESSAGING_API_CHANNEL_ACCESS_TOKEN=...

# APNS native iOS push
APNS_BUNDLE_ID=sg.nasumchurch.shuttle
APNS_ENVIRONMENT=sandbox # sandbox | production
APNS_TEAM_ID=...
APNS_KEY_ID=...
APNS_PRIVATE_KEY_BASE64=...

# FCM native Android push
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY_BASE64=...
# Optional alternative:
FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=...
```

빠르게 시작하려면:

```bash
cp .env.local.example .env.local
```

현재 운영 방식은 local/Vercel이 같은 Neon production 브랜치를 공유하는 single-branch 구성입니다.

## Universal QR 체크인

- 관리자 QR은 `https://nasum-church-shuttle.vercel.app/scan?routeCode=...` 형식의 HTTPS 링크로 생성합니다.
- iOS 앱은 Associated Domains의 `applinks:nasum-church-shuttle.vercel.app`로 `/scan` Universal Link를 처리합니다.
- Android 앱은 같은 host/path를 `android:autoVerify="true"` App Link로 처리하고, 서버의 `/.well-known/assetlinks.json`에는 Play/App signing SHA-256 fingerprint를 설정합니다.
- 앱이 설치되어 있지 않으면 웹 `/scan`이 열리고, 기존 LINE LIFF 체크인 fallback을 계속 제공합니다.
- LINE 내부 QR 스캔은 여전히 `LIFF scanCodeV2`를 사용하므로 LIFF 콘솔에서 QR scanner capability가 활성화되어 있어야 합니다.

## 알림 전송

- 정류장 접근 알림은 앱 내 `/notifications` 기록을 먼저 생성합니다.
- 사용자가 푸시 알림을 끄면 앱 내 기록은 유지하고 APNS/LINE 외부 발송만 건너뜁니다.
- iOS device token이 있으면 APNS를 먼저 시도하고, Android FCM token이 있으면 FCM을 시도합니다. 네이티브 push가 없거나 실패하면 LINE Messaging API로 fallback합니다.
- LINE fallback 링크는 `NEXT_PUBLIC_LIFF_ID`가 있으면 LIFF URL을, 없으면 `NEXT_PUBLIC_APP_URL`을 사용합니다.
