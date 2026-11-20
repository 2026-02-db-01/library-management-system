# 책담 도서관 통합 관리 시스템

최신 Wiki의 12테이블 모델과 업무 규칙에 대응하는 React 프론트엔드 V2입니다.

- [프론트엔드 실행·검증](frontend/README.md)
- [V2 구현·검증·미확정 정책](frontend/docs/V2-IMPLEMENTATION.md)
- [디자인 기준](frontend/DESIGN.md)
- [GitHub Wiki](https://github.com/2026-02-db-01/library-management-system/wiki)

현재 프론트엔드는 실제 FastAPI·PostgreSQL 16과 연동됩니다. 개발 환경에서는 Vite의 `/api` 프록시가 로컬 FastAPI(`127.0.0.1:8000`)로 요청을 전달합니다. 발표용 화면과 DB Console의 시뮬레이션은 실제 API·DB 검증 자료와 별개로 유지됩니다.

## 배포

운영 주소는 **https://library.misakachan.moe** (OCI 서버)입니다. 같은 도메인에서 nginx가 정적 프론트를 서빙하고 `/api`를 FastAPI로 넘기므로 `VITE_API_BASE_URL`은 비워 둡니다. DB는 OCI가 아니라 N100의 PostgreSQL 16이며, 역방향 SSH 터널(SSL 필수)로 연결됩니다. 구성·배포 절차는 [deploy/oci/README.md](deploy/oci/README.md)를 참고하세요.

GitHub Pages(`deploy-pages.yml`)는 백엔드 없는 정적 미리보기라 로그인·데이터 조회가 동작하지 않습니다.

실제 Full-stack E2E는 `cd frontend && npm run test:e2e:live`로 실행합니다. 격리된 PostgreSQL 16 컨테이너·FastAPI·Vite를 자동으로 띄우고, Mock fixture를 사용하지 않습니다. 기존 `npm run test:e2e`는 Mock API 기반입니다.
