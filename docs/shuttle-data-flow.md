# PDF 기준 셔틀 데이터 흐름 정리

## 개요
이 문서는 `SBC 셔틀버스 2025년 260224ver.pdf`를 기준 자료로 삼아, 현재 셔틀 시스템이 노선 정보를 어떤 방식으로 DB에 저장하고 지도에 표시하는지 정리한 운영 문서다.

현재 구현의 핵심 원칙은 다음과 같다.

- PDF는 노선 운영의 기준 문서다.
- 코드에 직접 입력하는 최소 정보는 `노선 이름/구분`과 `Google Maps route URL`이다.
- 실제 정류장, 좌표, `Google Place ID`, route polyline은 Google Maps 기반 sync 결과로 자동 구성된다.
- DB에는 영구 기준 데이터와 Google-derived snapshot/cache를 구분해서 저장한다.

아래 흐름으로 이해하면 된다.

```text
PDF (260224 기준표)
  -> 사람이 route 이름/구분 + Google Maps URL 정리
  -> data/routeCatalog.ts 등록
  -> prisma/seed.ts 실행
  -> lib/googleRouteSync.ts가 Google Maps URL 해석
  -> waypoint / place_id / 좌표 / path(polyline) 계산
  -> Route / Place / RouteStop 저장
  -> /api/v1/routes 응답 구성
  -> 홈 지도 / 검색 지도 / 정류장 상세 화면 렌더링
```

## PDF를 기준으로 삼는 입력 정보
PDF는 노선 운영의 기준표지만, 현재 구현은 PDF의 표를 그대로 seed 하드코딩하지 않는다. 대신 PDF를 보고 사람이 관리하는 최소 입력값만 코드에 넣는다.

현재 사람이 직접 관리하는 값:

- 노선 이름
- 노선 구분
  - 예: `SOUTH LINE (A)`, `EAST LINE (B)`
- revision
  - 현재 구현 기준 `260224`
- direction
  - 현재 route catalog 기준 `to_church`
- Google Maps route URL
  - short URL 또는 canonical URL 모두 가능

현재 이 입력은 [`data/routeCatalog.ts`](/Volumes/Backup/Github/NaSum-Church-Shuttle/data/routeCatalog.ts)에 들어간다.

예시:

- `south-a-260224`
- `east-b-260224`
- `west-coast-b-260224`

즉, PDF는 사람이 “어떤 노선을 운영해야 하는지”를 확인하는 기준이고, 시스템은 그 노선에 대응하는 Google Maps URL을 통해 실제 stop 구조를 다시 구성한다.

## DB에 저장되는 정보
현재 DB 스키마는 [`prisma/schema.prisma`](/Volumes/Backup/Github/NaSum-Church-Shuttle/prisma/schema.prisma)를 기준으로 `Route`, `Place`, `RouteStop`를 중심으로 구성된다.

### 저장 구조 요약
- `Route`: 노선 단위 메타데이터와 sync/cache 상태
- `Place`: 물리 정류장 단위 정보
- `RouteStop`: 특정 노선 안에서의 정차 순서와 pickup 가능 여부
- `UserRegistration`: 사용자가 선택한 노선/정차 지점
- `ScanEvent`: 탑승 체크 이벤트

### DB에 저장되는 정보 표

| 엔티티 | 주요 필드 | 성격 | 설명 |
| --- | --- | --- | --- |
| `Route` | `route_code` | 영구 기준 데이터 | 공개 노선 식별자 |
| `Route` | `name`, `display_name` | 영구 기준 데이터 | 기본 노선명과 운영 override 이름 |
| `Route` | `line`, `service`, `revision`, `direction` | 영구 기준 데이터 | 노선 분류 메타데이터 |
| `Route` | `google_maps_url` | 영구 기준 데이터 | 사람이 입력한 원본 route URL |
| `Route` | `resolved_google_maps_url` | Google-derived snapshot | redirect 해석 후 실제 Google Maps URL |
| `Route` | `sync_status`, `sync_error`, `last_synced_at` | Google-derived sync 메타데이터 | sync 성공/실패 상태 기록 |
| `Route` | `sync_source_hash`, `stops_snapshot_hash` | Google-derived snapshot 메타데이터 | source/stop 구조 비교용 hash |
| `Route` | `path_json` | Google-derived cache | 지도에 그릴 cached polyline |
| `Route` | `path_cache_status`, `path_cache_updated_at`, `path_cache_expires_at`, `path_cache_error` | Google-derived cache 메타데이터 | path cache 상태 |
| `Place` | `google_place_id` | 영구 기준 데이터 | 물리 정류장의 공식 식별자 |
| `Place` | `name`, `display_name` | 혼합 | `name`은 Google-derived, `display_name`은 운영 override |
| `Place` | `address`, `lat`, `lng`, `place_types` | Google-derived snapshot | geocoding 결과 |
| `Place` | `notes`, `is_terminal` | 운영/해석 데이터 | 정류장 메모, terminal 여부 |
| `RouteStop` | `id` | 영구 기준 데이터 | 노선 내 정차 지점 식별자 |
| `RouteStop` | `route_id`, `place_id`, `sequence` | 영구 기준 데이터 | route 내 정차 구조 |
| `RouteStop` | `pickup_time`, `notes` | 운영 데이터 | 운영상 승차 시간/메모 |
| `RouteStop` | `is_pickup_enabled` | 운영 데이터 | 검색/선택 가능 여부 |
| `UserRegistration` | `route_id`, `route_stop_id` | 영구 운영 데이터 | 사용자가 실제 선택한 route/stop |
| `ScanEvent` | `route_stop_id` | 영구 운영 데이터 | 체크인이 어떤 정차 지점 기준인지 연결 |

### 엔티티 의미
- `Place`는 물리 정류장이다.
- `RouteStop`은 노선 안의 정차 지점이다.
- 같은 `Place`가 여러 노선에 등장할 수 있다.
- 사용자는 `Place`가 아니라 실제로는 `RouteStop`을 선택한다.

즉:

- 물리 정류장 identity: `Place.google_place_id`
- 노선 내 정차 identity: `RouteStop.id`
- 노선 identity: `Route.route_code`

## 실제 동기화 흐름
실제 노선 동기화는 [`seed.ts`](/Volumes/Backup/Github/NaSum-Church-Shuttle/prisma/seed.ts)와 [`googleRouteSync.ts`](/Volumes/Backup/Github/NaSum-Church-Shuttle/prisma/support/googleRouteSync.ts)가 담당한다.

### 1. route catalog 읽기
`seed.ts`는 `ROUTE_CATALOG`를 순회한다.

route catalog에는 다음 정도만 들어 있다.

- `name`
- `routeCode`
- `revision`
- `direction`
- `googleMapsUrl`

즉, seed의 시작점은 PDF에서 정리한 노선명 + Google Maps URL이다.

### 2. Google Maps URL 해석
`syncRouteFromGoogleMapsUrl()`는 입력된 Google Maps URL을 받아 다음 단계를 수행한다.

1. short URL을 canonical URL로 resolve
2. HTML에서 preview directions link 추출
3. preview payload에서 waypoint 좌표와 이름 후보 추출

이 단계의 결과는 다음 정보를 만든다.

- `resolvedGoogleMapsUrl`
- `parsedWaypoints`
- `resolvedWaypointNames`
- `syncSourceHash`

### 3. stop과 place 정보 구성
각 waypoint에 대해 reverse geocoding을 수행해 아래 정보를 얻는다.

- `place_id`
- `formatted_address`
- `lat/lng`
- `types`

그 결과 stop snapshot이 만들어진다.

- `googlePlaceId`
- `name`
- `address`
- `lat/lng`
- `placeTypes`
- `isTerminal`
- `isPickupEnabled`

여기서 마지막 waypoint는 `isTerminal = true`로 해석된다.

### 4. path cache 계산
정차 지점이 2개 이상이면 Google Routes API로 route polyline을 계산한다.

이 결과는:

- `path_json`
- `path_cache_status`
- `path_cache_updated_at`
- `path_cache_expires_at`

로 저장된다.

이 값은 canonical route definition이 아니라 지도 렌더링용 cached snapshot이다.

### 5. DB 저장
seed는 route마다 다음 순서로 저장한다.

1. `Route` 생성
2. stop마다 `Place`를 `google_place_id` 기준으로 upsert
3. route별 `RouteStop` 생성

실패 시에는 다음 원칙을 따른다.

- `Route`는 생성하되 `sync_status = error`
- `sync_error` 기록
- `path_cache_status = missing`
- stop/path snapshot이 없으면 비워 둠

즉, 운영에서는 “last good snapshot 유지” 사고방식을 가져가되, 현재 seed 코드 자체는 route sync 실패 상태를 DB에 명시적으로 남기는 형태다.

## 지도에 표시되는 정보
현재 지도 렌더링은 [`Maps.tsx`](/Volumes/Backup/Github/NaSum-Church-Shuttle/src/components/Maps.tsx)와 [`routeSelectors.ts`](/Volumes/Backup/Github/NaSum-Church-Shuttle/src/lib/routeSelectors.ts)를 기준으로 동작한다.

### 지도에 표시되는 정보 표

| 화면 | 표시 대상 | 기준 데이터 | 설명 |
| --- | --- | --- | --- |
| 홈 지도 | route polyline | `Route.path_json` | 선택된 route의 cached path |
| 홈 지도 | 교회 고정 마커 | 코드 상수 좌표 | SBC, Korean Church 고정 마커 |
| 홈 지도 | 노선 정류장 마커 | `RouteStop + Place` | pickup 가능한 stop만 표시 |
| 홈 지도 | 선택 stop 강조 마커 | `RouteStop.id` | 내 선택 stop 또는 URL로 선택된 stop 강조 |
| 검색 지도 | 물리 정류장 마커 | `Place` | `google_place_id` 기준 dedupe |
| 정류장 상세 | route 후보 리스트 | `RouteStop` | 같은 `google_place_id`를 공유하는 stop 후보 |
| 정류장 미리보기 지도 | 단일 stop 마커 | `StopCandidate` | 선택 중인 정류장 위치 표시 |

### 홈 지도
홈 지도는 선택된 route를 기준으로 두 가지를 같이 표시한다.

- `cachedPath`
- 해당 route의 visible stops

visible stop은 다음 조건으로 계산된다.

- `is_pickup_enabled = true`
- `place.is_terminal = false`

즉, terminal stop은 route 종점 식별과 path 계산에는 포함될 수 있지만, 사용자가 고르는 정류장 리스트에서는 제외된다.

### 검색 지도
검색 지도는 물리 정류장 중심이다.

검색 화면은 route 전체를 그대로 그리지 않고:

- 모든 route의 visible stop을 모음
- `google_place_id` 기준으로 dedupe
- 하나의 `PlaceSummary` 목록으로 변환
- 그 결과를 지도 마커로 그림

즉, 검색 지도에서 보이는 핀은 “노선 내 정차 지점”이 아니라 “중복 제거된 물리 정류장”이다.

### 정류장 상세
정류장 상세는 `placeId` 기준으로 동작한다.

흐름은 다음과 같다.

1. 선택한 `google_place_id`에 해당하는 source stop을 찾음
2. 전체 route에서 같은 `google_place_id`를 공유하는 `RouteStop` 후보를 모음
3. 사용자는 그중 하나의 `routeStopId`를 선택
4. 등록 시 `/api/v1/user-registration`에 `route_code`, `route_stop_id`를 보냄

즉, 같은 물리 정류장이라도 route마다 다른 `RouteStop`로 취급된다.

## API와 공개 계약
현재 외부 계약 관점에서 중요한 것은 아래 두 API다.

### `/api/v1/routes`
이 API는 활성 route 목록을 내려준다.

응답에는 다음이 포함된다.

- route 메타데이터
- ordered `stops`
- `cachedPath`
- `pathCacheStatus`
- `pathCacheUpdatedAt`
- `pathCacheExpiresAt`
- `pathCacheError`

즉, 지도는 브라우저에서 매번 route를 다시 계산하지 않고, DB에 저장된 cached path를 우선 사용한다.

### `/api/v1/user-registration`
이 API는 사용자 등록 정보를 읽고 저장한다.

입력 기준:

- `route_code`
- `route_stop_id`

여기서 중요한 계약은:

- `route_code`는 노선 식별자
- `route_stop_id`는 사용자가 실제 타는 정차 지점 식별자
- `station_id` 같은 예전 route-scoped station 개념은 더 이상 공개 계약이 아니다

## 운영 원칙
현재 구현과 앞으로의 운영 방향을 같이 보면 아래 원칙으로 정리할 수 있다.

### 운영 체크리스트
- [x] 사람이 직접 넣는 핵심 값은 route name, display name, Google Maps URL 중심으로 제한한다.
- [x] 정류장의 공식 식별자는 `Google Place ID`로 본다.
- [x] route polyline과 geocode-derived 표현 정보는 canonical source가 아니라 snapshot/cache로 본다.
- [x] route URL이 바뀌면 save와 sync를 분리해서 운영하는 것이 바람직하다.
- [x] 이름 표시 예외는 `display_name`으로만 처리한다.
- [x] 검색/정류장 선택은 물리 정류장(`Place`)과 노선 내 정차 지점(`RouteStop`)을 구분해서 다룬다.

### 실무적으로 해석하면
- 관리자는 노선 자체를 새로 만들 때 route 이름과 Google Maps URL만 정확히 넣으면 된다.
- 정류장 좌표, 주소, `place_id`, path는 Google sync가 다시 구성한다.
- 다만 Google이 돌려주는 이름이 운영상 어색하면 `display_name`으로만 보정한다.
- path cache는 지도 성능과 호출량 절감을 위한 캐시이며, 장기 원본 데이터처럼 취급하지 않는다.

## 예시 시나리오
### 새 노선을 추가할 때
입력:

- PDF를 보고 새 노선의 이름/구분 확인
- 해당 노선 Google Maps URL 확보
- `data/routeCatalog.ts`에 새 route entry 추가

동기화:

- seed 또는 sync 실행
- Google Maps URL에서 waypoint 추출
- reverse geocoding으로 `Place` 구성
- `Route`, `Place`, `RouteStop` 저장
- polyline을 `path_json`으로 캐시

결과:

- 홈에서 route 선택 가능
- 검색 지도에 해당 route의 물리 정류장 반영
- 정류장 상세에서 route 후보로 표시

### 기존 노선의 Google Maps URL이 바뀔 때
입력:

- route의 `google_maps_url` 변경

동기화:

- 새 URL 기준으로 canonical URL 재해석
- waypoint와 stop snapshot 재생성
- `sync_source_hash`, `stops_snapshot_hash` 변경 가능
- 새 polyline cache 생성

결과:

- 같은 route code를 유지하면서 stop 구성과 지도 path가 갱신됨
- 사용자 선택은 `route_stop_id` 단위라 stop 구조가 바뀌면 재검토가 필요할 수 있음
- 운영상으로는 save와 sync를 분리하는 admin 흐름이 적합함

## 현재 구현 기준 요약
- route 공개 식별자: `Route.route_code`
- 물리 정류장 식별자: `Place.google_place_id`
- 노선 내 정차 지점 식별자: `RouteStop.id`
- route path: `Route.path_json`
- path 상태: `path_cache_status`, `path_cache_updated_at`, `path_cache_expires_at`
- 검색 dedupe 기준: `google_place_id`
- route detail 렌더링 기준: `RouteStop`

## 참고 코드
- [`data/routeCatalog.ts`](/Volumes/Backup/Github/NaSum-Church-Shuttle/data/routeCatalog.ts)
- [`prisma/schema.prisma`](/Volumes/Backup/Github/NaSum-Church-Shuttle/prisma/schema.prisma)
- [`prisma/seed.ts`](/Volumes/Backup/Github/NaSum-Church-Shuttle/prisma/seed.ts)
- [`googleRouteSync.ts`](/Volumes/Backup/Github/NaSum-Church-Shuttle/prisma/support/googleRouteSync.ts)
- [`routeSelectors.ts`](/Volumes/Backup/Github/NaSum-Church-Shuttle/src/lib/routeSelectors.ts)
- [`Maps.tsx`](/Volumes/Backup/Github/NaSum-Church-Shuttle/src/components/Maps.tsx)
