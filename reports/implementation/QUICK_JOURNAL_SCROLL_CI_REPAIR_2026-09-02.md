# QUICK_JOURNAL_SCROLL_CI_REPAIR_2026-09-02.md

## 상태

- 범위: PR #314의 훈련 후 일지 여백 회귀 수정. 상세 처방 PR #315에도 같은 선행 결함이 있음.
- 검증 기준 소스: `b7d24eda5679a1aeb074bd34057c5ad0e03f4b1c` + 이 변경.
- 로컬 검증 완료. 원격 CI 재실행과 병합 전 독립 검수는 별도 상태다. 배포 완료 주장이 아니다.

## 실제 실패와 수정

GitHub Actions #33615908893과 #33616178203의 모바일 브라우저 작업에서 같은 두 검사가 실패했다. 계약 검사와 앱 품질 검사는 성공했다.

| 조건 | CI 실패 실측 | 수정 후 실측 | 기존 상한 |
| --- | ---: | ---: | ---: |
| mobile-chromium 빈 훈련 후 일지 | 1,382px | 1,278px | 1,300px |
| mobile-chromium RPE 입력 후 다음 구획 | 1,266px | 1,166px | 1,200px |
| touch-narrow 빈 훈련 후 일지 | 해당 CI 단계 미실행 | 1,278px | 1,350px |
| touch-narrow RPE 입력 후 다음 구획 | 해당 CI 단계 미실행 | 1,166px | 1,220px |

새 몸 상태 확인 구획이 들어왔는데 기존 구획 간 여백을 그대로 유지한 것이 원인이다. `FormSec`에 선택적 `compact` 간격을 추가하고 `PostSessionForm`에만 적용했다. 기본 간격, 입력 항목, 통증 경로, 터치 영역, 입력값 저장, RPE 자동 접기 시점은 바꾸지 않았다. 스크롤 검사 상한도 수정하지 않았다.

## 실행 증거

Node 24.11.1, Windows, 실제 브라우저 실행:

- `npm run build`: PASS (타입 검사 포함).
- FormSec / AutoCollapse / PostSessionForm.energy / PostSessionForm.plan-link: 4파일, 31/31 PASS.
- `scroll-depth.spec.ts`, mobile-chromium + touch-narrow: 18/18 PASS.
- touch-targets / intensity-assessment / quick-progressive-journal, 같은 2프로젝트: 26/26 PASS.
- 320px와 375px 추가 화면 캡처: 가로 넘침 없음. RPE, 몸 상태 확인, 저장 버튼의 배치 육안 확인.
- [새 화면 증거](../evidence/quick-journal-scroll-2026-09-02/): 원본 역사 증거를 덮어쓰지 않고 이번 실행 별도 경로로 보관.

`RPE` 답을 누르는 순간에는 접히지 않고 다음 구획으로 이동해야 접히며, 사람이 다시 펼친 상태를 코드가 빼앗지 않는 기존 검증을 유지한다. 몸 상태 미응답을 통증 없음으로 채우지 않는다.

## 남은 검수

PR #314 원격 CI가 통과하는지 확인하고, 상세 처방 PR #315로 선행 변경을 병합해야 한다. 이 보고서는 전체 테스트나 공개 배포가 완료됐다는 근거가 아니다.

[DRAFT_COMPLETE]
