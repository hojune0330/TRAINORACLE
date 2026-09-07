# ADJUSTED_PLAN_CANDIDATE_REVIEW_2026-09-07.md

```yaml
doc_id: trainoracle-adjusted-plan-candidate-review-2026-09-07
status: STAGED_CANDIDATE_ASSEMBLY_WITH_OPEN_SELECTION_GATE
base_head: 6bea4761c4305f9e9de4b5bf221309ba9246fc45
whole_workflow_complete: false
active_plan_mutation: false
new_template_or_policy_activation: false
independent_scientific_or_fable_signoff: false
```

## 1. 후보 연결

`app/src/domain/adjusted-plan-candidate.ts`에서 조정 snapshot을 한 MAIN에 연결한다.
원본 후보는 기존 소유 스키마와 지문으로 검증한다. snapshot의 원본 처방이 해당
세션과 같아야 하며, 다른 날·다른 슬롯·다른 후보에 재사용하지 않는다.

새 결과는 `ADJUSTED_PLAN_CANDIDATE`, `NOT_ACCEPTED`, 선택 권한 `NONE`이다.
기존 활성 계획이나 기존 flat 후보 객체를 변경하지 않는다. 선택한 MAIN의 처방만
`ADJUSTED_METHOD`로 대체하고 다른 세션·프레임·주기 연결은 그대로 보존한다.
기존 후보 ID를 새 내용의 ID로 재사용하지 않고 새 내용 지문을 생성한다.

## 2. 자체 검수

- 800/1500/3000/5000m 합성 경로에서 원본 불변·한 MAIN 교체·다른 세션 보존 확인.
- 다른 처방 snapshot을 현재 슬롯 ID에 다시 결속하는 공격도 원본 처방 대조로 거부.
- 원본 비교 분기를 반전한 결함 주입: **1 FAIL / 10 skipped**로 검출, 정상 복원.
- malformed 후보, 존재하지 않는/보조 슬롯, 만료 정책, memo getter, 저장 쓰기 검사.
- 초기 대상 실행의 1 FAIL은 두 합성 경기 기록을 만들 때 시험 헬퍼의 `total: 1`
  단언과 충돌한 fixture 격리 문제였다. 두 번째 합성 입력 전 저장소 초기화 후
  대상 **3파일 / 50 PASS**를 확인했다. 제품 데이터 삭제 코드를 추가한 것이 아니다.
- 자체 검수에서 시작 날짜가 scope에 빠진 것을 발견했다. 날짜를 필수 결속하고,
  같은 후보라도 시작일 변경 시 이전 snapshot을 재사용하지 못하도록 보완했다.
  날짜 결속을 제거한 변조는 **1 FAIL / 2 PASS / 11 skipped**로 검출됐다.
  정상 복원 후 대상 **3파일 / 53 PASS**, candidate 신규 시험은 14개다.

## 3. 실행 증거

- 날짜 결속 보완 전 전체 앱: 290파일 / 2,587 PASS, TypeScript/build PASS.
- 최종 날짜 결속 후 전체 앱: **290파일 / 2,590 PASS**, 실패 0, exit 0.
- 최종 TypeScript/build PASS. 기존 font unresolved/large chunk 경고는 유지된다.
- 의도적 ErrorBoundary/feedback 실패 복구 시험 stderr는 있었으며 최종 요약과
  exit 0으로 판정했다. 공개 UI/배포 검증으로 확대하지 않는다.
- 문서 제목·종료 표식 행 1개·후행 내용 없음, 계약 4 OPEN/0 canonical blocker
  재계수 및 `git diff --check` PASS. 이슈 종결 및 정본 승격 없음.

## 4. 남은 연결

이 결과는 기존 저장/활성화 parser가 받아들이는 PlanCandidate가 아니다.
`FULL_PLAN_SELECTION_REVALIDATION`이 다음 필수 관문이며, 실제 적용 범위·배치·
조정 정책, 현재 기록/계정/D9/hold, 전체 노출 계산을 최종 선택 lock에서 확인해야 한다.
후보 조립 자체를 그 관문이나 실행 허가로 사용하지 않는다.

새 표현을 실제 화면·선택·확정 저장·설명·archive·일지에서 소비하는 연결과
운영 구성 공급은 미완이다. 기존 M01~M16 및 새 구성의 근거 요구를 유지한다.
별도 후보 표현을 마련한 것이 사용자가 여러 방법을 고를 수 있다는 증거는 아니다.

[DRAFT_COMPLETE]
