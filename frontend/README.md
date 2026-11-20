# 책담 프론트엔드 V2

React + TypeScript + Vite 기반 도서관 통합 관리 프론트엔드입니다. 최신 GitHub Wiki의 12테이블·5권 대출 정책을 반영하며, 실제 FastAPI·PostgreSQL 16 API와 연동됩니다. 개발에서는 Vite `/api` 프록시, 배포에서는 `VITE_API_BASE_URL`로 백엔드를 지정합니다. 발표용 화면과 DB Console의 시뮬레이션은 실제 API·DB 검증 자료와 별개입니다.

## 실행·검증

```sh
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:e2e:live
```

`npm run test:e2e`는 Mock API Fixture(`e2e/api-fixture.ts`) 기반 19개 테스트로, 설치된 Chrome과 포트 5174를 사용하며 개발 서버를 자동 기동합니다. `npm test`는 Store·업무 규칙·메타데이터 단위 테스트입니다.

`npm run test:e2e:live`는 `e2e/live/`의 실제 Full-stack E2E입니다. 격리된 PostgreSQL 16 컨테이너, 실제 FastAPI(8001), Vite(5175)를 자동으로 띄우고 Mock 없이 실행한 뒤 테스트 스택만 정리합니다. Docker와 Chrome이 필요합니다.

## 화면

- 회원: `/user/books`, `/user/loans`, `/account`, 직접 가입 데모 `/signup`.
- 사서: 기존 대출·반납·연장 이력·연체 경로와 `/librarian/books`, `/librarian/authors`, `/librarian/copies`, `/librarian/corrections`, `/librarian/history`, `/librarian/loans`.
- 관리자: 기존 `/admin/*` 경로 유지. `/admin/members`는 계정 현황/직원 관리, `/admin/history`는 직원 계정 감사 이력. 도서·저자 화면은 관리자에게 읽기 전용이며 사서가 편집합니다.
- DB Console: `/admin/db-console/catalog`, `/tables/:tableName`, `/erd`, `/constraints`, `/dictionary`. 12테이블·81컬럼·19 FK, SQL 예시·Mock 트랜잭션 흐름을 탐색합니다.
- 공개 `/schema/:tableName`은 구조만 표시합니다. DB Console에서는 비밀번호 해시·회원 개인정보·개인 대출 연결을 표시하지 않습니다.

## 구현·미확정 정책

사용자 역할과 권한은 서버 세션(/api/v1/auth/me)과 FastAPI 의존성에서 결정됩니다. 브라우저에 저장되는 것은 세션 쿠키이며 데이터는 실제 API에서 조회합니다. DB Console의 트랜잭션 흐름은 설명용 시뮬레이션이며 실제 SQL 실행 결과와 구분합니다.

[전체 구현·검증·제한 사항](docs/V2-IMPLEMENTATION.md), [디자인](DESIGN.md), [원문 모델](docs/wiki/physical-model.md)을 참고하세요. Wiki 기준 SHA는 `9e698003329b281ef36efea19fe48e2f0c0eaa8e`입니다. `../database/schema.sql`은 구버전이며 수정하거나 실행하지 않았습니다.

분류 목록, 날짜 정정의 세부 운영·증빙, 탈퇴 전 ID 재사용, 실제 비밀번호/초기 인증, 요청 결과 보관·실패 캐싱은 미확정입니다. 안전한 제한과 Mock 표식을 적용했으며 운영 정책을 임의로 확정하지 않았습니다.
