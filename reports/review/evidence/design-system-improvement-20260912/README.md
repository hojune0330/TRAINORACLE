# 디자인 개선 검증 증거

기준 main: `00ca7c5e2e7f70d7c0f18e3e351c2392c51af23f`.

## 증거 구분

- `DS01_MUTATION_EVIDENCE.md`: 수정 전 코드에 새 검사를 적용한 격리 검증.
- `pass-01`: 중간 캡처. 서랍 전환 애니메이션이 끝나기 전 좌표를 검사하여 중단했다. 완료 증거가 아니다.
- `pass-02`: 중간 빌드의 45개 화면. 글자 확대 탭 배치 보완 전이다.
- `pass-03`: b278d5f 빌드의 45개 화면. 실제 UI 조작, 320/375/768/1440px, 균일 글자 확대 스트레스 및 줄인 모션을 포함한다.
- `toast-scroll-before-fix-320.png`, `comparison-before-fix-280.png`: 수정 전 실패 재현 화면. 최종 상태로 제시하지 않는다.
- `account-final/`: 실제 앱 계정 CSS와 폰트를 불러오는 격리 fixture의 합성 데이터 화면. 외부 계정 로그인 완료 증거가 아니다.

## 재현 및 해석

`app/scripts/capture-design-system-improvement.mjs`는 지정한 새 폴더에 화면과 `observations.json`을 기록한다. 로컬 주소 이외의 요청을 차단하고 합성 기록만 사용한다. 문서 가로 넘침, 브라우저 오류, 등록 폰트 로드와 조작 가능한 도구를 확인한다. 캡처 성공만으로 전체 기능 또는 모든 브라우저 검수를 대신하지 않는다.

`app/scripts/audit-design-preservation.mjs`는 기준 커밋 이후 보호 영역과 한글 문자열 변화를 확인한다. 계산·행동의 동일성을 증명하는 도구는 아니므로 별도 기능 검사가 필요하다.

최종 검사 결과와 수정 커밋은 [실행 보고서](../../../implementation/TRAINORACLE_DESIGN_SYSTEM_IMPROVEMENT_EXECUTION_2026-09-12.md)에 구분해 기록한다. 과거 화면은 후속 수정 결과로 덮어쓰지 않는다.

[DRAFT_COMPLETE]
