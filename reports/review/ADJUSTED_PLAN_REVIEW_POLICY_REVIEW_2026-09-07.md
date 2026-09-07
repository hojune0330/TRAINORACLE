# ADJUSTED_PLAN_REVIEW_POLICY_REVIEW_2026-09-07.md

```yaml
doc_id: trainoracle-adjusted-plan-review-policy-review-2026-09-07
status: ADJUSTED_FRAME_REVIEW_SCOPE_WITH_OPEN_SELECTION_INTEGRATION
base_head: ea2e532e1f7be08db8580c4c96d26bf05be62b94
runtime_policy_entries: 0
whole_workflow_complete: false
new_template_activations: 0
storage_or_ui_changed: false
independent_scientific_or_fable_signoff: false
```

## 1. 구현 이유와 범위

기존 `main-placement-policy.ts`는 PACE_TARGET을 상세 세션으로 센다. 새 조정 표현을
단순히 그 함수에 넘기면 상세 카운트에서 빠질 수 있으므로, 새 표현의 전체 프레임
검토 범위를 별도로 만든다. 기존 동작을 수정하거나 새 처방을 기존 타입으로 위장하지 않는다.

`app/src/domain/adjusted-plan-review-policy.ts`는 다음을 검토 scope에 결속한다.

- 종목·목적·원본 범위와 일치하는 실제 경험·인구집단·선택 주체
- 후보 종류·프레임·주기 연결·노출 원장
- 모든 날짜/AM/PM의 역할·목적과 주변 RPE/시간 처방
- 변경 MAIN의 원본/목표 구성·조정 정책 참조와 유지되는 준비/정리 등의 구성 참조

개인 기록 ID나 계산된 목표 초는 검토 scope에 넣지 않는다. 개인 snapshot과
현재 기록 확인에서 따로 검증한다. 정확한 시작일은 앞 단계 후보 결속이 담당한다.

## 2. 검수와 한계

- 정확한 scope 및 구성·노출·상호작용·안전 검토 참조가 모두 있는 정책 하나만 선택.
- 시작 전/만료/철회/잘못된 기간·필수 참조 누락·중복 ID/version은 거부.
  철회된 중복과 유효한 동일 ID/version이 함께 있어도 임의로 하나를 고르지 않는다.
- source의 경험 범위와 현재 경험이 다르면 scope를 만들어 우회하지 않고 거부.
- getter/추가 데이터가 있는 registry는 읽지 않고 거부. 저장 쓰기 없음.
- 주변 세션을 해시에서 제외하는 변조는 **1 FAIL / 14 skipped**로 검출됐다.
  정상 코드를 즉시 복원했다. 이것은 테스트가 해당 누락을 잡는 증거다.

운영 registry는 **0건**이다. 합성 정책 1건을 주입하는 테스트는 실제 처방 적용
범위의 과학적 승인이나 등록이 아니다. `reviewed_scope`도 실행 권한 NONE이다.
참조 문자열의 형식과 scope를 확인할 뿐, 실존 검토자의 서명을 인증하지 않는다.

## 3. 실행 증거

- 초기 대상 2파일 / 29 PASS. 신규 policy 시험 15개.
- 정상 복원 후 전체 앱 **291파일 / 2,605 PASS**, 실패 0, exit 0.
- TypeScript/build PASS. 기존 font unresolved/large chunk 경고가 남아 있다.
  ErrorBoundary/feedback 복구 시험의 의도적 stderr는 최종 실패와 구분했다.
- 제목·최종 표식 행·후행 내용·4 OPEN/0 canonical blocker 재계수와 diff check PASS.

## 4. 다음 실제 연결

현재 조정 후보와 이 scope 검사는 아직 최종 선택 lock에 연결되지 않았다.
새 표현을 사용하는 전체 계획 선택·저장·실행 스키마, 현재 D9/hold·계정·기록 확인,
화면·설명·archive·일지 소비자 통합이 남아 있다. 이 검사를 그 작업들의 완료로
대체하지 않는다. 실제 운영 정책은 정확한 구성·프레임 적용 근거가 있어야 공급한다.

M01~M16 전체 범위 및 네 OPEN 계약 이슈를 유지한다. 병합·배포 미완이다.

[DRAFT_COMPLETE]
