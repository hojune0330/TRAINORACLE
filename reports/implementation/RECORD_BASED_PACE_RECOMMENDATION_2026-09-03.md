# RECORD_BASED_PACE_RECOMMENDATION_2026-09-03.md

```yaml
doc_id: trainoracle-implementation-record-based-pace-recommendation-20260903
status: LOCAL_IMPLEMENTATION_AND_SELF_REVIEW_COMPLETE_NOT_DEPLOYED
owner: COACH_HOJUNE
version: "1.0"
base_commit: 7caaa911e8c2ce54c2896826d95547848b3e83b0
branch: codex/prescription-rationale-integration
remote_pr: 315
changes_committed_or_pushed: false
new_numeric_templates: 0
new_calculation_models: 0
canonical_promotion_allowed: false
```

## 1. 적용한 내용

[오너 결정과 공식 조사](../review/RECORD_BASED_PACE_RECOMMENDATION_DECISION_2026-09-03.md)를
처방 계약 §12.4에 반영했다. 새로운 공식 연구·적용 방향을 승인된 것으로
기록하되, 12 x 400 m 신규 훈련까지 승인된 것으로 처리하지 않았다.

기존 800/1500/3000/5000 m 상세 처방의 본운동에 `약 N초 기준`을 표시한다.
바로 다음에 틸색 물음표 아이콘과 `추천 기준 / 개인 기록 기반`을 둔다.
닫혀 있어도 컨디션·날씨 제한은 보이며 반복 사이/세트 사이 회복은 기존 실제
처방에서 읽어 계속 표시한다. 열면 기록 종류·날짜·검증 상태, 수치가 대입된
계산식, 계산값과 화면 반올림, 고정 회복 기준, 미반영 요인을 읽을 수 있다.

후보 일정·저장된 일정·전체 화면 훈련 상세가 같은 `DetailedPrescriptionView`
컴포넌트를 사용한다. 추천 설명은 전달된 처방을 직접 읽고 별도 상태에 캐시하지
않으므로 다른 기록이나 템플릿으로 바꾸면 설명도 바뀐다. 저장 스키마·원시 숫자·
계산 엔진·안전 게이트·템플릿 매니페스트는 바꾸지 않았다.

## 2. 직접 실행한 검사

Node v24.11.1, 2026-09-03 로컬 실행 결과다. 전체 앱/전체 CI 통과로 확대하지 않는다.

| 검사 | 실행 결과 |
|---|---|
| PaceRecommendation / PlanBeta pace / SessionExplanation / visual-system 유닛·계약 | UTC 25/25, KST 25/25 |
| 앱 타입 검사·프로덕션 빌드 | 통과 |
| e2e 타입 검사 | 통과 |
| plan-method-switch + multi-event-personalized-prescription | 16/16: 데스크톱·375px·320px·줄인 모션 |
| 추천 글자 자체 두 배 확대 후 최종 method-switch 재실행 | 4/4: 실제 computed font 크기·가로 넘침·계산식 viewport 진입·키보드·저장/재로드 |
| 결함 주입 | 2/2 검출, 각 exit 1과 실패 테스트 이름 확인 후 원복 |

결함 주입 두 건 모두 `shows the actual fractional calculation, input date and
fixed-recovery limitation`에서 실패했다. 첫 건은 근거 창의 222.2초를 잘못
반올림해 222초로 바꿨고, 두 번째는 고정 휴식 시간을 개인 기록에서 계산한
최적값이라고 거짓 설명했다. 원복 전후 컴포넌트 SHA-256은 아래와 같다.

`D107D370D926C1030CA13A1B474A9F02F9D3D70B43E81167CA464263D1F9C417`

재현 명령:

```text
npm run test:unit -- src/screens/plan-beta/PaceRecommendation.contract.test.tsx src/screens/plan-beta/PlanBeta.pace-prescription.contract.test.tsx src/screens/plan-beta/SessionExplanation.contract.test.tsx src/styles/visual-system.contract.test.ts
npm run test:unit:kst -- (위와 같은 4개 파일)
npm run build
npm run typecheck:e2e
node node_modules/@playwright/test/cli.js test e2e/plan-method-switch.spec.ts e2e/multi-event-personalized-prescription.spec.ts --workers=2
```

e2e는 `PLAYWRIGHT_EXTERNAL_SERVER=1`, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4187`로
이번 빌드의 미리보기를 사용했다. 캡처는 `app/test-results/` 및 최종 보강분
`app/test-results/pace-recommendation-final/`에 있으며 Git 추적하지 않는다.

## 3. 자체 검수에서 고친 점

- 설명이 추가되어 같은 기록이 두 곳에 나타나자 기존 테스트의 넓은 텍스트
  검색이 중복 일치로 실패했다. 기존 접힘 구간을 고유 문구로 찾아 검증하도록
  좁혔다. 숫자 검증 자체는 삭제하지 않았다.
- 본운동의 `목표로`를 `약 N초 기준으로`로 바꾸면서 그 문구를 쓰던 중거리
  브라우저 테스트 3건의 기대값도 바꾸고 해당 파일 전체를 재실행했다.
- `html`의 글자 크기만 바꾸면 px 기반 토큰 글자가 커지지 않는 검사 사각지대를
  발견했다. 추천 설명의 본문·캡션 토큰도 두 배로 키우고 computed style을
  직접 검증했다. 확대 상태 계산식까지 스크롤하여 viewport 진입을 확인한다.
- 모바일/확대 상태 한글 줄바꿈에 keep-all과 긴 단어 넘침 대응을 적용했다.
- 개인 ID/sourceRef와 메모는 근거 창에 노출하지 않는다. 원격 계산 API 호출은 없다.

## 4. 남은 범위와 다음 작업

1. 새 모델 엔진은 아직 없다. 동일 종목 경기 평균 속도 계산은 그대로 사용한다.
   VDOT 강도 페이스와 Riegel 경기 예측을 서로 바꾸어 쓰지 않으며, 새 모델은
   계수·버전·독립 계산 예시를 갖춘 별도 모듈로 구현한다. 공식 연구·적용 방향을
   다시 미승인으로 되돌리지 않는다.
2. 거리 회복의 초 추정은 아직 없다. 회복 속도 근거 없이 100 m를 본운동 속도로
   나누어 휴식 시간을 만들지 않는다. 현행 고정 회복은 개인별 최적화가 아니다.
3. 첫 두 번째 MAIN의 정확한 구성과 대상 범위는 별도 후속이다. 이번 답변은
   그 결정을 포함하지 않았다. 기존 청소년·셀프서비스 승인은 유지한다.
4. 실제 iPhone Safari·스크린리더 검수, 전체 앱 유닛·브라우저 CI, Fable의 독립
   UX 검수는 이번 실행에 포함하지 않았다. 빌드의 기존 폰트 경로 경고는 남아 있다.
5. 이 변경은 로컬만 반영했다. 시작 시 PR #315 head는 base_commit과 일치했고
   draft/open, base는 #314의 `codex/quick-progressive-journal-v1`이었다.
   기존 #315 전체 브라우저 CI 실패를 이번 선별 통과로 해소됐다고 하지 않는다.
   #314 병합 후 #315 base를 main으로 바꾸고, 전체 CI·리뷰 후 병합/배포한다.

[DRAFT_COMPLETE]
