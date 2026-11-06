# 책담 · 도서관 통합 관리 시스템

React + TypeScript + Vite로 만든 프론트엔드 데모입니다. 모든 대출·회원·도서 변경은 브라우저의 Mock Store에만 반영되며 서버 요청을 보내지 않습니다.

## 실행

```bash
npm install
npm run dev
```

검증 명령:

```bash
npm run typecheck
npm run lint
npm run build
```

## 화면

- `/` 공통 홈페이지, 시스템 아키텍처, 7개 테이블 데이터 카탈로그
- `/user/books`, `/user/loans` 도서 검색과 데모 회원 대출 현황
- `/librarian`, `/librarian/checkout`, `/librarian/returns`, `/librarian/renewals`, `/librarian/overdue` 사서 업무
- `/admin`, `/admin/members`, `/admin/books`, `/admin/statistics` 관리자 업무
- `/admin/db-console/catalog`, `/admin/db-console/tables/:tableName`, `/admin/db-console/erd`, `/admin/db-console/constraints`, `/admin/db-console/dictionary` 설계 카탈로그와 DB Console

상단의 데모 초기화 버튼으로 공유 상태를 원래 목업으로 되돌릴 수 있습니다. 상태는 `localStorage`에 임시 보존됩니다.

## 구조 메모

- `src/data/metadata/schema.ts`: `database/schema.sql`을 반영한 읽기 전용 스키마 메타데이터
- `src/data/mock/seed.ts`: 업무 데모 시작 데이터
- `src/store/libraryStore.ts`: 프론트엔드 Mock Service와 Zustand 상태
- `src/services/library.ts`: 대출 가능 수량, 연체, 통계용 파생 함수
- `src/services/tablePreview.ts`: 콘솔 미리보기 행 매핑. `password_hash`는 제외
- `design/opendesign-prototype.html`: 초기 홈페이지·아키텍처·카탈로그 프로토타입
- `DESIGN.md`: 토큰, 정보 구조, OpenDesign 참고 내용

FastAPI, PostgreSQL, 인증, API, SQL 실행은 구현하지 않았습니다. 향후 서버 연동은 `src/store/libraryStore.ts`의 액션과 데이터 선택 로직을 별도 서비스 계층 구현으로 교체하면 됩니다. 스키마 메타데이터는 서버 응답 모델로 대체하지 말고 설계 문서 기준 자료로 유지합니다.
