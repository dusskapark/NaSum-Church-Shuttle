# Push Frame

Push Frame은 **LINE LIFF 전용 앱**과 **셔틀 스캔 이벤트 서버**로 구성된 프로젝트입니다.

본 프로젝트는 다음 원칙을 따릅니다.

- Firebase/APNs 등 외부 푸시 노티피케이션 서비스 **미사용**
- LINE LIFF 기능(사용자 컨텍스트, QR 스캔) 중심 구현
- 서버는 스캔 이벤트 처리 및 이력 관리를 담당

---

## 문서 구조

- 프로젝트 최종 기획/범위: `PROJECT_PLAN.md`
- 서버 실행/구현 세부: `server/README.md`

중복되던 계획 문서는 정리했으며, 앞으로 기획 변경은 `PROJECT_PLAN.md`를 단일 기준으로 관리합니다.
