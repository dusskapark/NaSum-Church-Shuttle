# Push Frame 무료 배포/운영 가이드 (Vercel + Next.js API + Supabase)

작성일: 2026-03-28

---

## 1) 목표

비용 부담을 최소화하기 위해, Push Frame 서비스를 **무료 플랜 중심**으로 구성한다.

- 프론트엔드 + 백엔드 API: **Next.js (App Router) + Vercel Hobby**
- 데이터베이스: **Supabase Postgres (Free)**
- LINE 연동: **LINE LIFF + LINE Developers Console**

본 문서는 MVP를 빠르게 운영하기 위한 실전 구성과 체크리스트를 정리한다.

---

## 2) 왜 이 구성이 맞는가

`PROJECT_PLAN.md` 기준으로 본 프로젝트는 다음 특성을 가진다.

- FCM/APNs 미사용, 푸시 통합 제외
- LIFF 중심 사용자 경험 + 서버 이벤트 처리
- 핵심 API는 `POST /api/v1/scan-events`와 상태 조회

즉, 대규모 분산 인프라보다 **가볍고 빠른 서버리스 API + Postgres** 조합이 적합하다.

---

## 3) 권장 아키텍처

```text
LINE App
  -> LIFF Web App (Vercel)
    -> Next.js Route Handler (/api/v1/scan-events)
      -> Prisma
        -> Supabase Postgres
```

### 구성 요소

1. **LINE Developers**
   - LINE Login 채널 생성
   - LIFF 앱 생성 (Endpoint URL 등록)
   - 발급값: Channel ID, Channel Secret, LIFF ID

2. **Vercel (Hobby)**
   - Next.js 앱 배포
   - App Router 기반 API 제공
   - 환경변수(시크릿) 주입

3. **Supabase (Free)**
   - Postgres 인스턴스
   - 서버리스 환경을 고려해 pooler(Supavisor) 연결 문자열 사용 권장

---

## 4) 구현 방식 (Next.js API)

### Route Handler로 백엔드 API 제공

- 파일 예시
  - `app/api/health/route.ts`
  - `app/api/v1/scan-events/route.ts`

- 권장 사항
  - 요청 스키마 검증(zod)
  - Prisma Client 재사용 패턴(핫 리로드/서버리스 중복 인스턴스 방지)
  - 에러 응답 코드 표준화

---

## 5) 환경변수 체크리스트

## A. LINE

- `LINE_LOGIN_CHANNEL_ID`
- `LINE_LOGIN_CHANNEL_SECRET`
- `LIFF_ID`
- `LIFF_ENDPOINT_URL`

(선택)
- `MESSAGING_API_CHANNEL_SECRET` (웹훅 시그니처 검증 시)
- `MESSAGING_API_CHANNEL_ACCESS_TOKEN` (메시징 API 호출 시)

## B. 앱/서버

- `DATABASE_URL` (Supabase Postgres pooled URL 권장)
- `PORT` (로컬 개발용)
- `NODE_ENV`
- `API_BASE_URL`
- `WEB_BASE_URL`

---

## 6) 단계별 구축 순서

1. LINE Developers에서 Provider + LINE Login 채널 생성
2. LIFF 앱 생성 후 `LIFF_ID` 발급
3. Next.js 앱에 LIFF 초기화 및 QR 스캔 흐름 구현
4. `app/api/v1/scan-events/route.ts` 구현
5. Supabase 생성 후 `DATABASE_URL` 연결
6. Prisma migration / generate 수행
7. Vercel 배포 + 환경변수 등록
8. LIFF Endpoint URL을 배포 URL로 갱신
9. E2E 테스트 (scan -> API 저장 -> 결과 조회)

---

## 7) 무료 플랜 운영 시 주의점

1. **Vercel 함수 제한 확인**
   - 무료 플랜의 함수 실행/리소스 제한 내에서 동작하도록 설계

2. **DB 커넥션 관리**
   - 서버리스에서 커넥션 폭증 방지 필요
   - Supabase pooler + Prisma 설정 점검

3. **정책 변경 가능성**
   - 무료 플랜 한도는 수시 변경 가능
   - 배포 전 최신 가격/제한 문서 재확인

4. **확장 기준 사전 정의**
   - API latency, 에러율, DB CPU/커넥션 임계치 도달 시 유료 전환

---

## 8) 운영 체크리스트

- [ ] `/api/health` 정상 응답
- [ ] `POST /api/v1/scan-events` 유효성 검증/에러 핸들링 확인
- [ ] Prisma 쿼리 타임아웃/실패 로그 수집
- [ ] 중복 스캔 멱등 처리 확인
- [ ] LIFF 권한/컨텍스트 실패 시 UX 확인

---

## 9) 참고 문서 (공식)

- Next.js Route Handlers: https://nextjs.org/docs/app/api-reference/file-conventions/route
- Vercel Functions limits: https://vercel.com/docs/functions/limitations
- Vercel Hobby plan: https://vercel.com/docs/plans/hobby
- Vercel + Next.js: https://vercel.com/docs/frameworks/full-stack/nextjs
- Supabase Postgres 연결: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase Pricing: https://supabase.com/pricing
- LINE LIFF Getting started: https://developers.line.biz/en/docs/liff/getting-started/
- LINE LIFF Registering apps: https://developers.line.biz/en/docs/liff/registering-liff-apps/
- LINE Login Getting started: https://developers.line.biz/en/docs/line-login/getting-started/

---

## 10) 결론

Push Frame MVP는 **Vercel + Next.js API + Supabase**로 무료 운영이 가능하며,
현재 프로젝트 범위(LIFF 중심 + 스캔 이벤트 처리)와도 일치한다.

트래픽 증가 시점에만 단계적으로 유료 플랜으로 전환한다.
