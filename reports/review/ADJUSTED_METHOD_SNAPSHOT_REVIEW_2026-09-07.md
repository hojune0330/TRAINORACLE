# ADJUSTED_METHOD_SNAPSHOT_REVIEW_2026-09-07.md

```yaml
doc_id: trainoracle-adjusted-method-snapshot-review-2026-09-07
status: IMPLEMENTED_CODEC_WITH_OPEN_PLAN_INTEGRATION
review_mode: IMPLEMENTER_SELF_REVIEW_AND_RUNTIME_TESTS
base_head: e5a9d3cdaca48f4f4954112fc628327b90ddf284
whole_workflow_complete: false
new_template_activations: 0
new_adjustment_policies: 0
active_plan_schema_changed: false
browser_storage_writes_added: false
scientific_or_fable_approval_claimed: false
```

## 1. 구현 범위

- `app/src/domain/adjusted-method-snapshot.ts`: 원본 상세 처방, 후보/MAIN 식별자,
  원본 정책·기록 내용 문맥, 조정 receipt, 계산된 구간/목표/합계를 버전 1 DTO로 묶는다.
- 조정된 구성의 목적·에너지 공급·운동/회복 이유·주기 역할·기대·한계·관찰·출처를
  독립 공급한 설명과 결속한다. 저장에는 설명 참조·버전·내용 지문만 포함한다.
- 설명이 결속된 후에도 `설명 필요` placeholder가 남는 모순을 자체 검수에서
  발견해 제거했다. `EXACT_CONFIGURATION_EXPLANATION_BOUND`로 명시한다.
- 읽기는 저장 JSON 안의 authority registry를 신뢰하지 않는다. 외부에서 공급한
  신뢰된 보존 버전으로 capture 시점의 전체 내용을 다시 계산한다.
- 과거 읽기는 실행 권한 NONE이다. 현재 후보 사용은 현재 시점으로 다시 검사하며,
  정책이 만료되면 과거 열람 가능 여부와 별개로 현재 적용을 거부한다.

## 2. 공격적 검수

| 반례 | 확인 결과 |
|---|---|
| 목표 초·합계·receipt를 바꾸고 자체 해시도 다시 계산 | 원본 구성에서 다시 계산한 내용과 달라 거부 |
| 같은 설명 버전의 회복 문장만 변경 | 설명 내용 지문 불일치로 거부 |
| 설명의 필수 항목 누락, 다른 구성/문맥, 중복 출처 | 준비 거부. 원본 설명 대체 없음 |
| 다른 후보/오전·오후 슬롯, 기록 내용, revision | 문맥 불일치로 거부 |
| 미래 capture, 다른 버전, 추가 필드 | 읽기 거부 |
| 보존된 정책 또는 카탈로그 공급 없음 | saved refs만으로 복원하지 않음 |
| 만료 정책으로 과거 열람 후 새 후보 사용 | 과거 읽기만 허용, 현재 적용 거부 |
| 추가 memo getter | getter 호출 없이 거부 |

만료 분기를 일부러 반대로 변경한 결함 주입은 목표 시험 **1 FAIL / 26 skipped**로
검출됐다. 테스트 실패 출력의 `candidate_ready` 오응답을 확인했고 즉시 정상 복원했다.
합성 TEST 구성은 처방의 적격성·과학적 채택 또는 운영 활성화 증거가 아니다.

## 3. 실행 증거

- snapshot/resolution 대상 시험: **2파일 / 39 PASS**. snapshot 신규 시험은 27개다.
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS. 기존 font unresolved 및 large chunk 경고는 남아 있다.
- Chromium 임시 초안 회귀: native lock/write, reload/replay, 별도 탭 격리,
  held-lock 거부, explicit discard **5항목 PASS**. 로컬 intercept 시험이며 실제
  사용자 데이터·외부 네트워크·공개 조정 화면을 사용하지 않았다.
- 정상 코드 복원 후 전체 앱 회귀: **289파일 / 2,576 PASS**, 실패 0, exit 0.
  ErrorBoundary/feedback 실패 복구 테스트가 출력한 의도적 stderr는 있었으며,
  최종 테스트 요약과 종료 코드를 기준으로 판정했다.
- 문서 제목·독립된 최종 표식 1개·후행 내용 없음·4 OPEN/0 canonical blocker
  재계수와 `git diff --check`: PASS. 최초 단순 문자열 개수 검사는 기존 YAML의
  `final_marker_required` 선언까지 세어 실패했으며, 선언을 삭제하지 않고 실제
  종료 표식 행과 후행 내용을 검사하도록 바로잡았다.

## 4. 남은 실제 연결

이 DTO는 아직 확정 계획의 새 처방 kind가 아니며 저장·UI·일지 호출부에 연결되지
않았다. 따라서 사용자가 조정한 훈련을 실제로 확정/실행/일지 연결할 수 있다는
완료 주장으로 사용할 수 없다. 기존 flat PACE_TARGET 검증도 약화하지 않았다.

다음은 새 표현을 소유하는 PlanSession 타입·스키마와 화면·archive·일지·실행
consumer를 일관되게 연결하는 작업이다. 현재 계정/기록, 전체 배치와 D9/hold는
최종 선택 lock 안에서 다시 검증해야 한다. codec의 candidate-ready는 그 권한이 아니다.
새 운영 구성/전환/동시 배치 정책은 실제 근거가 있는 항목만 공급한다.

M01~M16 전체 계획은 그대로 유지한다. 지정 독립 검수, PR 병합과 배포는 미완이다.

[DRAFT_COMPLETE]
