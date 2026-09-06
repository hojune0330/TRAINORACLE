# ARCHIVED_ORIGINAL_PLAN_JOURNAL_REVIEW_2026-09-06.md

```yaml
doc_id: trainoracle-archived-original-plan-journal-review-2026-09-06
status: IMPLEMENTED_LOCAL_REVIEW_COMPLETE_WITH_OPEN_WORKFLOW_GATES
base_head: 5e7be884cafbfd2979136417934ea4a024956d37
whole_plan_complete: false
independent_fable_review: NOT_PERFORMED
new_prescription_authority: false
new_cloud_payload: false
canonical_promotion: false
```

## 1. 이번에 실제로 연결한 기능

완료한 계획을 다음 계획으로 넘길 때, 기존 최신 18개 보관 한도 안에서 앞으로
보관하는 계획의 원본을 V5 이력에 함께 저장한다. 기존 V3/V4 요약은 그대로 읽으며
원본을 만들어 넣지 않는다. 수동 보관과 승인된 다음 계획 시작 경로 모두 적용한다.

일지의 `계획한 훈련과 비교하기`를 열면 그 일지에 정확히 연결된 현재 또는 보관
원본을 찾는다. `훈련 방법과 이유 > 주기·기록`은 계획 내용과 직접 입력한 실제
거리·시간·페이스·RPE를 구분한다. 부분 수행·변경 수행·미기록·중복·충돌의 기존
표현을 유지한다. 설명을 닫으면 일지의 진입 버튼으로 돌아온다.

이는 과거 모든 계획의 복구나 평생 보관, 자동 증량, 새 템플릿 활성화가 아니다.
보관 계획 수와 연속 운동 기간은 다르다. 새 반복별 측정이나 회복 측정도 추가하지 않았다.

## 2. 공격 검토에서 수정한 부분

| 문제 | 처리와 확인 |
|---|---|
| 손상된 기존 이력을 빈 목록으로 읽고 덮어쓸 수 있음 | 원본 읽기 실패 시 보관 전체 거부. 현재 계획·기존 이력 보존 및 rollback 확인 |
| 요약만 맞으면 원본 처방 변조를 놓칠 수 있음 | 원본 소유 스키마·후보 정체성 검사 후 요약과 hash를 재계산. hash 자체가 승인 증거는 아님 |
| 다음 프레임의 같은 후보로 과거 일지를 잘못 설명할 수 있음 | 정확한 occurrence/link/date/slot으로 조회. 새 generatedAt의 후보로 대신 연결하지 않음 |
| 계정 또는 표시 일지 변경 후 이전 설명 잔존 | 계정·storage 이벤트와 entry/link 변경에 비교 화면 닫기 및 설명 unmount |
| 현재 계획 읽기 실패를 원본 없음으로 오인 | unavailable과 missing을 분리. 존재하지 않는다고 단정하지 않음 |
| 공용 설명의 돌아가기 라벨이 훈련 일정으로 고정 | 일지 진입 시 `일지로 돌아가기`. 닫은 후 포커스·위치 복귀 확인 |

원본을 추가하면서 수동/다음계획 경로의 기존 진행 요약 규칙은 바꾸지 않았다.
수동 보관은 원래 progress, successor 요약은 표시 프레임의 progress이며 전체
originalPlan은 별도로 보존한다. 원본 hash와 요약 모두 검증하지 않으면 읽지 않는다.

## 3. 현재까지의 실행 증거

- 초기 원본·이력·저장·successor 대상 4파일 69 PASS.
- 초기 UI 시험 4 FAIL은 testing-library cleanup 누락으로 이전 렌더가 남은
  시험 결함이었다. cleanup을 추가한 뒤 원본/UI 2파일 17 PASS.
- 일지 변경 및 current-plan 읽기 실패 반례를 추가한 원본/UI/successor 3파일 35 PASS.
- 원본 요약/hash 검사를 고의로 끈 결함 주입에서 정확히 2건 FAIL을 확인했다.
  요약 변조와 hash 변조를 실제로 잡는 테스트이며, 정상 코드는 즉시 복원했다.
- 1차 전체 앱: 284파일 2472 PASS. 이후 current-plan 읽기 실패 1건 추가 후
  최종 전체 재실행: 284파일 2473 PASS, exit 0.
- 1차 실제 브라우저: desktop/mobile/320px/reduced-motion 4 PASS.
  실제 보관 버튼, 원본 동일성, 새로고침, 일지 진입, 부분/변경/RPE/미기록 표시,
  돌아가기 포커스와 저장 불변을 확인했다. 이후 기존 일지 작성 여정을 포함해
  4프로젝트 8 PASS를 확인했다. 200% 글자 확대·포커스 복귀도 포함한다.
- 확대 캡처에서 제목 잘림이 의심되어 실제 글자 영역 좌표 검사를 추가했다.
  변경 전 빌드의 320px 시험은 1 PASS로 잘림이 재현되지 않았다. 추정으로 넣었던
  레이아웃 변경은 제거하고 회귀 검사만 유지했다. 이 관찰을 확정 결함으로 세지 않는다.
- TypeScript와 production build PASS. 기존 font unresolved/chunk size 경고는 유지된다.

## 4. 남은 경계

- V5 원본은 기존 계정별 기기 저장소에만 추가한다. 계정 서버·공개 공유·워치
  연동에는 전송하지 않는다. 원문 메모나 증상 문장을 새 이력에 넣지 않는다.
- 저장 공간 부족 시 기존 실패/rollback 경로를 사용한다. localStorage 다중 키의
  물리적 원자성을 보장하지 않으며, 동일 잠금을 쓰지 않는 탭까지 직렬화하지 않는다.
- 기존 18개 한도로 축출된 원본과 예전 요약만 있는 기록은 복원하지 않는다.
- 원본을 읽을 수 있다는 사실은 그 처방을 다시 실행하거나 신규 추천 입력으로
  채택할 권한이 아니다. 실제 관찰 기반 추천·반복별 준수 판단은 별도 미완이다.
- 이 변경으로 M11/M12가 진척됐지만, M01~M16 전체 완료나 새 방법·수치 조정·
  여러 MAIN 동시 상세 선택의 공개 제공을 주장하지 않는다.
- 최종 독립 검수·PR 병합·공개 배포는 아직 수행하지 않았다.

## 5. 검토자가 재실행할 명령

`app/`에서 실행한다. Node 24와 기존 설치 의존성을 사용했다.

```powershell
npx vitest run --maxWorkers=4
npm run typecheck
npm run typecheck:e2e
npm run build
$env:PLAYWRIGHT_PORT='4187'
$env:PLAYWRIGHT_EXTERNAL_SERVER='1'
npx playwright test e2e/journal-original-plan.spec.ts e2e/plan-journal-linkage.spec.ts --project=desktop-chromium --project=mobile-chromium --project=touch-narrow --project=reduced-motion --workers=2
```

브라우저 명령은 해당 포트에서 최신 `app/dist` preview가 실행 중일 때 사용한다.
합성 데이터만 별도 브라우저 context에 넣으며 실제 선수 데이터는 사용하지 않았다.

[DRAFT_COMPLETE]
