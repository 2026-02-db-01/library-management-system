# 디자인 노트

## 방향

OpenDesign의 공식 `linear-app` 시스템에서 정보 우선순위, 선명한 표 계층, 낮은 장식 밀도, 컴팩트한 내비게이션을 참고했습니다. 도서관 서비스에 맞도록 이를 흰색·밝은 중성색과 네이비 중심으로 조정했습니다.

- 참조: [OpenDesign · linear-app](https://github.com/nexu-io/open-design/tree/main/design-systems/linear-app)
- 연동 확인: 현재 작업 환경에는 `od` 명령과 Codex MCP 연결이 설치되어 있지 않았습니다. 공식 사용 문서에서 시스템 구성과 토큰을 확인해 적용했습니다. 유료 모델 호출은 사용하지 않았습니다.
- 초기 화면 설계: `design/opendesign-prototype.html`
- 실제 제품 화면: `src/pages`와 재사용 UI를 React로 구현했습니다.

## 토큰

CSS 사용자 지정 속성은 `src/index.css`에 둡니다.

- 네이비: `--navy`, `--navy-deep`
- 본문/보조 텍스트: `--ink`, `--ink-soft`, `--muted`
- 배경과 표면: `--canvas`, `--canvas-soft`, `--paper`
- 구분선: `--line`, `--line-strong`
- 의미 색상: `--green`, `--amber`, `--red`와 각 pale 배경

## 화면 규칙

- 홈페이지는 도서관 안내에 맞춰 책장 그래픽과 업무 진입 카드를 사용합니다.
- 사서·관리자·DB Console은 좌측 업무 내비게이션과 표 중심의 작업 영역으로 구성합니다.
- DB Console의 DDL, 키, 관계와 인덱스는 읽기 전용 설계 뷰로 표시하고 실 DB 접속 상태와 혼동되지 않도록 안내합니다.
- 상태 색상은 대출 가능·연체·비활성 등 데이터 상태에만 적용합니다.
- 모바일에서 표는 가로 스크롤하고 업무 내비게이션은 수평 이동 목록으로 바뀝니다.
- 애니메이션은 hover 이동과 짧은 색 전환에 한정합니다.
