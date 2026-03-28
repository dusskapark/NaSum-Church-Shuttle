# Push Frame LINE Mini App

이 저장소는 **LINE 전용 미니앱**을 개발/운영하기 위한 프로젝트입니다.
이전의 멀티 엔드포인트(``/line``, ``/grab``) 전략은 철회되었으며, 기획과 기술 방향을 LINE 단일 플랫폼 기준으로 재정의합니다.

---

## Product Direction

핵심 방향은 다음과 같습니다.

- 플랫폼 범위: **LINE Mini App only**
- 런타임: 서버 사이드 요구(인증 검증, 세션, API, 로깅)에 맞춰 **Next.js(App Router) 고정**
- 정보 구조: 사용자 진입을 단순화해 **루트(`/`) 중심 단일 앱 경험** 제공

---

## Route Strategy (Revised)

### `GET /`
- LINE 사용자 진입 메인 화면
- LINE SDK 초기화 및 컨텍스트 표시
- 로그인/식별 상태에 맞는 UI 분기

### `GET /api/health`
- 기본 상태 확인용 엔드포인트

### `POST /api/platform/line/verify`
- LINE 컨텍스트/토큰 검증
- 검증 성공 시 세션 생성 또는 갱신

### `POST /api/entry-log`
- 진입 이벤트, 환경 정보, 오류 이벤트 기록

> 참고: Grab 전용 라우트 및 정책은 현재 범위에서 제거함.

---

## Why Next.js

본 프로젝트는 Next.js(App Router)를 다음 이유로 채택합니다.

1. **서버 컴포넌트 + Route Handlers**로 UI/API를 한 저장소에서 일관되게 관리 가능
2. LINE 초기 진입 시 필요한 서버 검증/리다이렉션 제어에 유리
3. Middleware를 통한 요청 사전 검증 및 보안 정책 적용이 쉬움
4. 운영/분석/어드민 요구 확장 시 구조적 이점이 큼

---

## High-level Architecture

- Frontend: Next.js (App Router)
- API/BFF: Next.js Route Handlers
- Data: PostgreSQL + Prisma (권장)
- External: LINE SDK / LINE 인증 컨텍스트
- Observability: 진입 로그, 오류 로그, 인증 실패 모니터링

---

## MVP Scope

1. 루트(`/`) LINE 미니앱 기본 진입 화면
2. LINE SDK 초기화 + 사용자 상태 표시
3. `POST /api/platform/line/verify` 검증 플로우
4. `POST /api/entry-log` 진입/오류 이벤트 적재
5. 인증 실패/재시도 UX

---

## Notes

- 기존 Figma Plugin 템플릿 문서는 본 프로젝트 방향과 맞지 않아 대체되었습니다.
- 현재 기준 계획 문서는 `Plan.md`이며, 세부 실행은 해당 문서를 단일 기준으로 따릅니다.
