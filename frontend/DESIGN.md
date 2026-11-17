# 책담 V2 디자인

기존 흰색·밝은 중성색·네이비와 업무별 탐색을 유지하면서 OpenDesign Cloud의 생성 참조를 실제 React 컴포넌트에 적용했다. 대표 화면은 DB Console과 Interactive ERD다.

## 근거

- 기존 `design/opendesign-prototype.html`, 이전 React UI 및 linear-app 정보 구조.
- OpenDesign Cloud 프로젝트 `chaekdam-frontend-v2-a940`, 생성 참조 `design/opendesign-v2-reference.html`, 토큰·레이아웃 원본 `design/opendesign-v2-notes.md`.
- 생성 참조의 샘플 데이터 모델은 책담 Wiki와 다르므로 제품에는 사용하지 않는다. 제품의 12테이블·19 FK는 Wiki 원문에서 생성한다.

## 토큰과 구성

- 기존 `src/index.css` 의미 토큰을 `src/v2.css`에서 조정: 본문 `#17243B`, 보조 `#596474`, 구분선 `#E0E5EC`, 네이비 `#172E50`, 작업 배경 `#F4F6F8`, 선택 `#EDF2F9`.
- 페이지 제목 28px/모바일 24px, 본문·폼 14px, 표 13px. 식별자와 SQL만 고정폭 글꼴. 제목 tracking -0.025em.
- 안정된 196px 업무 탐색, 28px 영역 간격, 얇은 표 구분선, 섹션 사이 명확한 여백, 기능 중심 선택 강조.
- 카드에 장식용 강조를 추가하지 않는다. 상태 색상은 성공·오류·파손·연체·DB 연산에 의미를 갖는다.
- ERD는 12개 엔터티, 확대/축소/이동, 관계 클릭과 양쪽 참조 컬럼 강조, 전체 컬럼 패널, 키·인덱스·용어 탐색을 제공한다.
- DB Flow는 업무와 연결된 SELECT/INSERT/UPDATE/COMMIT/ROLLBACK, SQL 예시, 전후 값과 실패를 표시한다. 모든 DB 표시는 시뮬레이션이다.

## 반응형과 접근성

767px 이하에서는 업무 메뉴를 수평 이동 목록으로 전환하고 폼·필터를 재배치한다. 긴 데이터 표만 내부 가로스크롤을 사용한다. 모바일 주요 액션은 최소 44px이고 포커스 링·상태 텍스트를 제공한다. 모달은 Escape·Tab 순환·기존 포커스 복원을 지원한다. reduced motion은 이동 효과를 정적 강조로 바꾼다.

실제 버튼·검색·필터·모달·업무 기능은 shared Mock Store에 연결한다. 1440×900, 390×844 화면을 브라우저 테스트와 스크린샷으로 확인한다. 산출물은 정적 시안이 아닌 Vite React 앱이다.
