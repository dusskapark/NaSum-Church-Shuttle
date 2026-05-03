# NaSum Shuttle iOS

Xcode에서 바로 열 수 있는 SwiftUI iOS 클라이언트입니다.

## 열기

1. `ios/NaSumShuttle.xcodeproj`를 Xcode로 엽니다.
2. `ios/NaSumShuttle/Config/Secrets.xcconfig.example`을 복사해 `Secrets.xcconfig`를 만들고 실제 값을 채웁니다.
3. Swift Package dependencies가 자동으로 resolve되지 않으면 Xcode에서 `File > Packages > Resolve Package Versions`를 실행합니다.

## 주요 구성

- `AppShell`: 앱 엔트리, 세션/상태 관리
- `Auth`: LINE, Apple, Google 로그인 및 Keychain 세션 저장
- `Networking`: 기존 Next.js API 호출
- `Push`: APNS 권한 및 device token 등록
- `RiderFeatures`: 홈, 정류장 검색, 체크인, 알림, 설정
- `SharedModels`: Codable DTO와 preview fixture

## 현재 범위

- 라이더 앱 1차 기능 구현
- 관리자 탭은 2차 확장용 placeholder 포함
- 서버 세션 교환 `/api/v1/auth/session` 사용
- APNS token 등록 `/api/v1/push-tokens` 연동
- Debug build는 `APNS_ENVIRONMENT=sandbox`, Release build는 `APNS_ENVIRONMENT=production`을 서버에 전송합니다.

## Apple / Google 로그인

- Apple 로그인은 `AuthenticationServices`와 `SignInWithAppleButton`을 사용합니다.
- Google 로그인은 Swift Package `GoogleSignIn`을 사용합니다.
- `Secrets.xcconfig`에 `GOOGLE_IOS_CLIENT_ID`와 `GOOGLE_REVERSED_CLIENT_ID`를 채워야 합니다.
- 실제 인증 테스트는 계정이 설정된 iPhone에서 iPhone Mirroring으로 진행합니다.

## APNS / LINE 알림

- `Secrets.xcconfig`에는 `APNS_BUNDLE_ID`, `APNS_TEAM_ID`, 필요 시 `APNS_ENVIRONMENT`를 설정합니다.
- 서버에는 `APNS_BUNDLE_ID`, `APNS_ENVIRONMENT`, `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY_BASE64`가 필요합니다.
- APNS가 없거나 실패한 사용자는 서버에서 LINE Messaging API fallback을 사용하므로 `MESSAGING_API_CHANNEL_ACCESS_TOKEN`과 `NEXT_PUBLIC_LIFF_ID` 또는 `NEXT_PUBLIC_APP_URL`도 필요합니다.
- APNS payload의 `notificationId`, `routeCode`, `userRouteStopId`, `deepLinkPath`는 알림 탭 후 앱 내 노선/정류장 이동에 사용됩니다.

## Universal Links

- 앱은 `applinks:nasum-church-shuttle.vercel.app` Associated Domain으로 `/scan?routeCode=...` 링크를 처리합니다.
- 서버의 `/.well-known/apple-app-site-association`에는 기본 appID `ZQC7QNZ4J8.sg.nasumchurch.shuttle`가 포함됩니다.
- Universal Link로 앱이 열리면 로그인 전이라도 routeCode를 보존하고, 로그인/부트스트랩 후 체크인 화면을 엽니다.
