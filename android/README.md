# NaSum Shuttle Android

Android Studio에서 `android/` 폴더를 직접 열 수 있는 Kotlin + Jetpack Compose 네이티브 클라이언트입니다.

## 열기

1. Android Studio에서 `android/` 폴더를 엽니다.
2. JDK 17을 선택합니다.
3. 필요하면 `local.properties`에 개발용 값을 추가합니다.

```properties
NASUM_API_BASE_URL=https://nasum-church-shuttle.vercel.app
LINE_LOGIN_CHANNEL_ID=YOUR_LINE_LOGIN_CHANNEL_ID
GOOGLE_ANDROID_CLIENT_ID=YOUR_GOOGLE_ANDROID_CLIENT_ID
```

Firebase Cloud Messaging을 실제 기기에서 테스트하려면 Firebase 콘솔에서 `sg.nasumchurch.shuttle` 앱을 만들고 `google-services.json`을 `android/app/`에 둔 뒤 Google Services Gradle plugin을 적용합니다. 현재 프로젝트는 `google-services.json`이 없어도 Android Studio sync와 Compose preview가 가능하도록 플러그인을 기본 적용하지 않습니다.

## 주요 구성

- `app`: 앱 엔트리, 상태 모델, App Link 처리
- `auth`: 세션 저장소와 LINE/Google/Email 로그인 연결 지점
- `network`: 기존 Next.js API 호출
- `push`: FCM 토큰/알림 수신
- `rider`: 홈, 정류장 검색, QR 체크인, 알림, 설정
- `admin`: role 기반 관리자 표면
- `sharedmodel`: kotlinx.serialization DTO
- `preview`: Compose preview fixture

## 현재 범위

- 라이더와 관리자 화면을 Compose 네이티브 표면으로 제공
- 이메일/비밀번호 로그인은 서버 `/api/v1/auth/session`에 직접 연결
- LINE/Google 로그인은 Android 프로젝트별 SDK/콘솔 설정을 연결할 수 있는 진입점을 포함
- Android App Links는 `https://nasum-church-shuttle.vercel.app/scan?routeCode=...`를 처리
- FCM token은 로그인 세션이 있으면 `/api/v1/push-tokens`에 `platform=android`로 등록

## 명령

```bash
./gradlew test
./gradlew assembleDebug
```
