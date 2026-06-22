# TRAINORACLE App — UI Kit

데스크톱 + 모바일 통합 UI 키트. **v2 정본 스타일** (Tufte × Linear, 직각, hairline).

## 구성
- `index.html` — 클릭 가능한 통합 미리보기 (탭 전환: Dashboard / Session / AI Chat / Calendar / Inbox)
- `App.jsx` — 최상위 라우터, 사이드바, 탭 상태
- `Sidebar.jsx`, `TopBar.jsx` — 데스크톱 chrome
- `Dashboard.jsx`, `SessionDetail.jsx`, `AIChat.jsx`, `Calendar.jsx`, `Inbox.jsx` — 5 메인 화면
- `Primitives.jsx` — `EnergyTag`, `Verdict`, `MainMark`, `MetricCell`, `Button` 등 재사용 컴포넌트

모든 스타일은 `../../colors_and_type.css` 한 곳에서 옴.

## v2 정본 규칙
- `border-radius: 0` 기본, 인터랙티브만 `4px`까지
- 그림자 X, hairline border만
- 그라데이션 X, 채도 높은 컬러 배경 박스 X
- 에너지 시스템 — 도트 + 코드 + underline (배경 X)
- 모든 숫자 모노 + tabular-nums
- AI 발언에는 verdict + confidence + alternative view 의무

이 키트는 storybook이 아니라 **실제 사용처럼** 클릭 흐름을 보여줍니다.
