# NaSum Church Shuttle (Frontend Reboot)

기존 프론트엔드를 걷어내고 [`YKizou/Uber-Clone`](https://github.com/YKizou/Uber-Clone) 흐름을 기준으로 다시 시작한 버전입니다.

## 변경 포인트

- 페이지 구조를 Uber-Clone 스타일(`index → search → confirm`)로 재구성
- `Mapbox` 대신 `Google Maps JavaScript API` 기반 지도 컴포넌트로 교체
- 요금/도착시간 계산은 외부 라우팅 API 의존 없이 프론트에서 거리 기반 추정으로 단순화

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## 환경 변수

`.env.local`에 아래 값을 설정하세요.

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

## Google Maps 비용 메모

- Maps JavaScript API는 `Dynamic Maps` SKU로 과금됩니다.
- 현재 가격표 기준 `Dynamic Maps`는 월 `10,000`건까지 free cap이 있고, 그 이후부터 사용량 기반 과금입니다.
- 즉 **앱 트래픽이 매우 낮은 초기 단계**라면 실비가 거의 0원일 가능성이 높지만, **과금 계정 연결은 필수**입니다.
