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

## Apple / Google 로그인

- Apple 로그인은 `AuthenticationServices`와 `SignInWithAppleButton`을 사용합니다.
- Google 로그인은 Swift Package `GoogleSignIn`을 사용합니다.
- `Secrets.xcconfig`에 `GOOGLE_IOS_CLIENT_ID`와 `GOOGLE_REVERSED_CLIENT_ID`를 채워야 합니다.
- 실제 인증 테스트는 계정이 설정된 iPhone에서 iPhone Mirroring으로 진행합니다.
