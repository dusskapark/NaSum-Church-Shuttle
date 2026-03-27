# 셔틀버스 지도 중심 앱 기획서 (초안)

## 1) 프로젝트 목표
기존 저장소를 완전히 정리(리셋)한 뒤, **Next.js + Ant Design 5 + Vite + OpenStreetMap** 기반으로
우버/그랩 스타일의 **지도 중심 셔틀버스 앱**을 새로 시작한다.

핵심 목표는 다음과 같다.
- 사용자가 앱 최초 진입 시, **신청한 지역 위치가 핀으로 표시**된다.
- 해당 사용자가 탑승해야 할 **셔틀버스 노선이 지도 위에 하이라이트**된다.
- 하단 **바텀 액션 시트(Bottom Action Sheet)**에서 구글맵/그랩 스타일의 노선 요약 정보를 제공한다.
- 보유한 엑셀 데이터(노선 정보 + 노선별 신청 인원)를 기반으로 운영/시각화한다.

---

## 2) 제품 컨셉 (MVP)
### 사용자 시나리오
1. 사용자가 앱을 실행한다.
2. 로그인/식별된 사용자 기준으로 신청 지역이 자동 매핑된다.
3. 지도에서 신청 지역 핀 + 본인 대상 노선 하이라이트가 표시된다.
4. 하단 액션 시트에 노선명, 정류장, 예상 소요시간, 신청 인원 등 핵심 정보가 표시된다.
5. 사용자는 경로를 확인하고 탑승 준비를 한다.

### 핵심 기능(MVP)
- 지도 렌더링 (OpenStreetMap)
- 사용자 신청 지역 핀 표시
- 셔틀 노선 Polyline 하이라이트
- 엑셀 데이터 업로드/파싱/정규화
- 노선별 신청 인원 표시
- 바텀 액션 시트 UI (노선 요약 카드)
- 정류장 QR 스캔 기반 탑승 흐름 추적
- 현재 정류장 스캔 시, **다음 2개 정류장 탑승 예정자 푸시 알림 큐잉**

---

## 3) 기술 스택 제안
> 참고: **Next.js와 Vite는 일반적으로 동시에 메인 런타임으로 쓰지 않는다.**
> 실무적으로는 아래 2안 중 하나를 선택하는 것을 권장한다.

### A안 (권장): Next.js + Ant Design 5 + OpenStreetMap
- Next.js (App Router)
- Ant Design 5
- 지도: Leaflet 또는 MapLibre GL + OSM 타일
- 장점: SSR/SEO/라우팅/배포 생태계가 안정적

### B안: Vite + React + Ant Design 5 + OpenStreetMap
- Vite(React)
- Ant Design 5
- 지도: Leaflet 또는 MapLibre GL + OSM 타일
- 장점: 빠른 개발 서버/단순 구성

### 결론
- 제품 확장(인증, 운영 대시보드, 다국어, 서버 연동)까지 고려하면 **A안(Next.js)**이 유리.
- "Vite" 요구가 강하면 별도 관리 콘솔을 Vite로 분리하는 하이브리드 구조도 가능.

---

## 4) 정보 구조(IA) 및 화면 구성

## 4.1 메인 화면
- 전체 화면 지도
- 상단: 검색/현재 위치/알림(선택)
- 지도 오버레이:
  - 신청 지역 핀 (사용자 기준)
  - 셔틀 노선 하이라이트 (선택 노선)
  - 정류장 마커(선택)
- 하단: 바텀 액션 시트(드래그 가능한 스냅 포인트)

## 4.2 바텀 액션 시트 구성
- 노선명, 운행 시간대, 방향
- 주요 정류장 목록(상위 N개)
- 신청 인원(현재 집계)
- 예상 소요 시간/거리
- CTA 버튼 예시:
  - "정류장 상세"
  - "탑승 안내"
  - "문제 신고"

## 4.3 관리자/운영(추후)
- 엑셀 업로드
- 데이터 검증 에러 리포트
- 노선별 신청 인원 대시보드

---

## 5) 데이터 설계(초안)

### 입력 데이터(엑셀)
- route_id
- route_name
- stop_name
- stop_lat
- stop_lng
- applicant_count
- region_name
- user_id(있다면)

### 내부 표준 스키마(예시)
- `users`
  - `id`, `name`, `region_id`, `applied_route_id`
- `regions`
  - `id`, `name`, `center_lat`, `center_lng`
- `routes`
  - `id`, `name`, `color`, `direction`, `summary`
- `route_stops`
  - `id`, `route_id`, `name`, `lat`, `lng`, `seq`
- `route_stats`
  - `route_id`, `applicant_count`, `updated_at`
- `boarding_declarations`
  - `user_id`, `route_id`, `stop_id`, `service_day`, `status`
- `scan_events`
  - `shuttle_run_id`, `stop_id`, `scanned_by_user_id`, `scanned_at`
- `notification_deliveries`
  - `user_id`, `shuttle_run_id`, `target_stop_id`, `trigger_stop_id`, `status`, `sent_at`

### 좌표 정책
- WGS84(lat/lng) 통일
- 엑셀 파싱 단계에서 위/경도 유효성 검증

---

## 6) UX 상세 요구사항
- 앱 진입 시 기본 카메라는 사용자 신청 지역 중심으로 이동
- 신청 노선은 강조 색상(굵은 polyline + 높은 z-index)
- 비선택 노선은 흐리게 처리(필요 시)
- 바텀 시트는 기본 `collapsed` → 사용자가 드래그하면 `expanded`
- 빈 데이터/오류 상태 처리:
  - 신청 정보 없음
  - 좌표 누락
  - 노선 미배정

---

## 7) 개발 단계 로드맵

### Phase 0. 저장소 리셋 & 프로젝트 재구성
- 기존 파일 정리
- 새 프로젝트명 확정
- Next.js 기반 초기화
- Ant Design 5 세팅
- 지도 라이브러리 설치/초기 렌더

### Phase 1. 데이터 파이프라인
- 샘플 엑셀 수집
- 파싱 스크립트 작성
- JSON/DB 적재 포맷 확정
- 데이터 검증 로직 추가

### Phase 1.5. 서버/API + 푸시 알림 기반 구축
- Node.js + TypeScript 서버 구축
- DB 스키마(노선/정류장/탑승선언/스캔이벤트/알림전송) 적용
- `POST /api/v1/scan-events` 구현
  - 입력: `shuttleRunId`, `stopId`, `scannedByUserId`, `scannedAt`
  - 처리: 현재 정류장 기준 다음 2개 정류장 계산
  - 결과: 해당 정류장 탑승 선언자에게 푸시 알림 큐 등록
- 푸시 공급자(FCM/APNs) 연동 인터페이스 정의

### Phase 2. 지도 + 노선 시각화
- 지역 핀 렌더링
- 노선 하이라이트 렌더링
- 정류장 마커 표시

### Phase 3. 바텀 액션 시트
- 노선 요약 카드 컴포넌트
- 신청 인원/정류장/예상시간 노출
- 상호작용(선택 노선 변경 시 동기화)

### Phase 4. 안정화
- 에러 처리
- 로딩 상태
- 반응형 최적화(모바일 우선)

---

## 8) 비기능 요구사항
- 모바일 퍼스트 UI
- 초기 로딩 최적화(지도 타일/데이터)
- 개인정보 최소 수집
- 운영 로그(노선 조회 이벤트)

---

## 9) 보안 및 저장소 운영
- GitHub 저장소는 **Private**로 전환 권장
- 브랜치 전략: `main` + 기능 브랜치
- `.env`/민감정보 커밋 금지
- 업로드 엑셀 파일 원본 접근 권한 제한

---

## 10) 즉시 결정이 필요한 항목
1. 최종 프론트엔드 런타임 선택: **Next.js 단일** vs Next.js+Vite 분리
2. 지도 라이브러리 선택: **Leaflet** vs **MapLibre GL**
3. 사용자 식별 방식: 로그인/사번/전화번호 기반 여부
4. 엑셀 입력 컬럼의 실제 스키마 확정
5. 프로젝트 새 저장소명 확정

---

## 11) 다음 액션(제안)
1. 이 기획서 확정
2. 프로젝트명 확정 및 저장소 리셋 진행
3. Next.js + Ant Design 5 + OSM 기본 골격 생성
4. 샘플 엑셀 1개 기준으로 데이터 파이프라인 구현
5. 메인 지도 + 바텀 시트 MVP 완성
