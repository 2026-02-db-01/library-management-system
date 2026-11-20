# 책담 도서관 통합 관리 시스템

최신 Wiki의 12테이블 모델과 업무 규칙에 대응하는 React 프론트엔드 V2입니다.

- [프론트엔드 실행·검증](frontend/README.md)
- [V2 구현·검증·미확정 정책](frontend/docs/V2-IMPLEMENTATION.md)
- [디자인 기준](frontend/DESIGN.md)
- [GitHub Wiki](https://github.com/2026-02-db-01/library-management-system/wiki)

현재 프론트엔드는 실제 FastAPI·PostgreSQL 16과 연동됩니다. 개발 환경에서는 Vite의 `/api` 프록시가 로컬 FastAPI(`127.0.0.1:8000`)로 요청을 전달하고, 배포 환경에서는 `VITE_API_BASE_URL`로 백엔드 주소를 지정합니다(별도 백엔드 호스팅 필요). 발표용 화면과 DB Console의 시뮬레이션은 실제 API·DB 검증 자료와 별개로 유지됩니다.

실제 Full-stack E2E는 `cd frontend && npm run test:e2e:live`로 실행합니다. 격리된 PostgreSQL 16 컨테이너·FastAPI·Vite를 자동으로 띄우고, Mock fixture를 사용하지 않습니다. 기존 `npm run test:e2e`는 Mock API 기반입니다.
