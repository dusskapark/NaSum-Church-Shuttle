# superapp-sdk 잔재 제거 분석 및 교체 계획

## 1) 현황 요약

현재 코드는 `src/shims/superapp-sdk.ts`를 통해 과거 superapp-sdk API 형태를 **LIFF/브라우저 API로 에뮬레이션**하고 있습니다.
즉, 실제 외부 superapp-sdk 패키지 의존성은 없지만, 애플리케이션 계층에는 superapp 개념(`ContainerModule`, `ScopeModule` 등)이 그대로 남아 있습니다.

- shim 파일: `src/shims/superapp-sdk.ts` (삭제 대상)
- 방향 1(직접 사용) 기준으로 모든 사용처를 LIFF/브라우저 API 직접 호출로 치환

## 2) 사용처 인벤토리 (우선순위 포함)

### A. 핵심 사용자 흐름 (우선 제거)

1. 인증/프로필
   - `src/hooks/useLineUser.ts`
   - 사용 모듈: `ProfileModule.fetchEmail()`
   - 대안: `getLiff()` + `liff.getDecodedIDToken()` 직접 사용

2. QR 스캔/위치
   - `src/routes/scan/index.tsx`
   - 사용 모듈: `CameraModule.scanQRCode()`, `LocationModule.getCoordinate()`
   - 대안:
     - QR: `liff.isApiAvailable('scanCodeV2')` + `liff.scanCodeV2()`
     - 위치: `navigator.geolocation.getCurrentPosition()` 직접 사용 (이미 shim 내부가 동일)

3. 외부 지도 열기
   - `src/routes/stops/index.tsx`
   - 사용 모듈: `SystemWebViewKitModule.redirectToSystemWebView()`
   - 대안: `liff.openWindow({ external: true })` 우선, fallback `window.open`

### B. UI 컨테이너/환경 동기화 (중요)

4. 레이아웃 컨테이너 제어
   - `src/components/Layout.tsx`, `src/hooks/useContainer.ts`, `src/hooks/useHideLoader.ts`
   - 사용 모듈: `ContainerModule`, `SplashScreenModule`
   - 대안:
     - `document.title`, URLSearchParams, 로컬 state 직접 사용
     - 레이아웃/컨테이너 제어는 제품 기능 영향이 거의 없으므로 제거 우선

5. 로케일 동기화
   - `src/lib/app-settings.tsx`
   - 사용 모듈: `LocaleModule.getLanguageLocaleIdentifier()`
   - 대안: `getLiff()?.getAppLanguage?.()` 우선, 없으면 `getLanguage()`/`navigator.language` fallback

### C. 관리자 보조 기능 (후순위)

6. 파일 다운로드 권한/저장
   - `src/routes/admin/routes-list.tsx`
   - 사용 모듈: `ScopeModule`, `FileModule`
   - 대안:
     - Scope 체크 제거
     - LIFF 환경에서는 `liff.openWindow({ external: true })`로 외부 브라우저 다운로드 위임
     - 비-LIFF 환경은 `a[download]` fallback

## 3) 기술적 정리 방향

### 방향 1: “superapp 네이밍 완전 제거”

- 제거 대상
  - `src/shims/superapp-sdk.ts`
  - `@/shims/superapp-sdk` import 전부
- 대체 방식
  - LIFF 직접 호출은 `src/lib/liff.ts`를 단일 진입점으로 사용
  - 브라우저 API는 hook/유틸에서 직접 호출

## 4) 단계별 교체 계획 (권장)

### Phase 0 — 안전장치 (0.5일)

- shim 사용처를 테스트 기준으로 고정
- 체크리스트 작성:
  - 로그인/로그아웃
  - QR 스캔 성공/취소/권한거부
  - 위치 권한 거부
  - 정류장 지도 외부 열기
  - 관리자 QR 다운로드

### Phase 1 — 저위험 교체 (1일)

- `LocaleModule` → LIFF/navigator 직접 호출
- `SystemWebViewKitModule` → 공용 `openExternalUrl` 유틸로 대체
- `ProfileModule.fetchEmail()` 제거

**산출물**: `src/shims/superapp-sdk.ts` 의존도 1차 축소

### Phase 2 — 핵심 흐름 교체 (1~2일)

- `CameraModule`, `LocationModule`를 scan 페이지에서 직접 처리
- 스캔 에러코드 매핑(취소/미지원/권한거부) 표준화

**산출물**: 체크인 플로우에서 shim 제거

### Phase 3 — 컨테이너/로더 정리 (1일)

- `useContainer`, `Layout`, `useHideLoader`에서 superapp 컨테이너 API 호출 제거
- 실제 동작 없는 no-op 호출 삭제
- 필요 시 `useMiniAppUiBridge` 같은 내부 추상화로 최소화

**산출물**: superapp 용어 제거, 문서화된 fallback만 유지

### Phase 4 — 관리자 다운로드 정리 (0.5~1일)

- `ScopeModule`, `FileModule` 제거
- 다운로드 유틸 단일화 (`downloadBlobFile`/`downloadUrlFile`)

### Phase 5 — 최종 제거 (0.5일)

- `src/shims/superapp-sdk.ts` 삭제 (방향 1 완료 조건)
- dead code / 타입 / import 정리
- 회귀 테스트 및 배포

## 5) 위험요소 및 대응

1. LINE in-client vs 외부 브라우저 동작 차이
   - 대응: `liff.isInClient()` 분기와 사용자 메시지 명확화

2. QR 스캔 API 사용 가능 조건
   - 대응: `liff.isApiAvailable('scanCodeV2')` 사전 검사 + 대체 UX 제공

3. 로더/백버튼 같은 네이티브 컨테이너 기능 상실
   - 대응: 해당 기능을 제품 요구사항에서 제거/완화하고 웹 UI로 재설계

4. 관리자 다운로드 실패율
   - 대응: 서버 토큰 발급 + 브라우저 다운로드 fallback 이중화

## 6) 실행 순서 제안

- 이번 스프린트: Phase 1~2 (사용자 핵심 흐름)
- 다음 스프린트: Phase 3~5 (컨테이너/관리자/최종 제거)

## 7) 완료 정의 (Definition of Done)

- 코드베이스에 `@/shims/superapp-sdk` import가 0건
- `src/shims/superapp-sdk.ts` 삭제 (방향 1 완료 조건)
- 로그인/스캔/체크인/정류장/관리자 다운로드 시나리오 수동 검증 완료
- `docs/verification-checklist.md`, `docs/verification-results.md`에 결과 반영
