# DETAILED_PRESCRIPTION_PR_RECONCILIATION_RESULT.md

```yaml
document_metadata:
  doc_id: trainoracle-review-detailed-prescription-pr-reconciliation
  status: DRAFT_FOR_HUMAN_REVIEW
  owner: COACH_HOJUNE
  prepared_by: gpt-5.6-terra
  base_commit: 0d5dc6548f920ca882f2d555b92b37f3c91ab6c7
  related_work_order: PR_122_TERRA_WO_018
  runtime_authority: false
  numeric_template_activation_authorized: false
  automatic_prescription_authorized: false
```

## 결론

세 PR은 같은 일을 중복하지 않는다. `#115`는 선수가 이해할 상세 처방의 표현과
카드 구조, `#120`은 현재 공개 베타가 아직 제공하지 않는 값을 정직하게 보이는 경계,
`#121`은 훈련을 마친 뒤의 코치 범위 비교를 맡는다. 이 문서는 세 계층을 합치지 않고
상세 처방 계약과 `DRAFT` 카탈로그로 연결한다.

| PR | 수용할 내용 | 수정할 내용 | 대체하지 않는 계층 | 후속 대상 |
|---|---|---|---|---|
| [#115](https://github.com/hojune0330/TRAINORACLE/pull/115) | 축약 처방 표기, 3층 UX, 스프린트와 해당계 시드, 쉬운 한국어 풀이 | 출처 URL·대상 집단·전이 한계, 최신 `r60″ · R3′` 의미, 용량/청소년 경계, 앵커·파생 합계 | `#120`의 현재 런타임 진실과 `#121`의 수행 후 비교 | 세션 처방 계약, `DRAFT` 카탈로그, 이후 Plan Beta 표시 |
| [#120](https://github.com/hojune0330/TRAINORACLE/pull/120) | 시간/RPE까지만 제공한다는 현재 표시, 상세값 `미지정`의 정직한 경계 | 활성 템플릿과 계산기가 별도 승인된 뒤에만 상세 상태를 전환 | `#115`의 라이브러리 기획과 `#121`의 비교 레코드 | PR #120 병합 뒤 UI/파서/계산기 구현 |
| [#121](https://github.com/hojune0330/TRAINORACLE/pull/121) | 관찰값·코치 범위·비교 결과 분리, 결측 시 `UNAVAILABLE`, 복합 세션 중복 방지 | 9.5일/2~3 MAIN 재결정 질문 제거, 자기 주도 계획을 막는 듯한 표현 제거 | 상세 처방 생성, 템플릿 활성화, 실제 계획 변경 | 코치 범위 단위·등록 권한·그림자 기간의 사람 결정 및 calibration |

## 최신 책임자 결정으로 고정되는 부분

`FORMATION_LATEST_OWNER_DECISION_BASELINE.md`가 우선한다.

```yaml
formation_default: 9_5_DAY_FORMATION
main_exposure_default: 2_TO_3
self_service_plan_allowed: true
coach_connected_plan_allowed: true
coach_forced_review_when_configured: true
scientific_superiority_claim: forbidden
whole_architecture_safety_claim: forbidden
```

따라서 `#121`의 “9.5일/2~3 MAIN을 다시 채택할지”는 미결정 질문이 아니다. 남는
사람 결정은 다음 세 가지뿐이다.

1. 코치 범위에 허용할 차원과 단위, 등록 권한, 버전 관리 방식
2. 그림자 비교의 기간, 중단 조건, 검토 주기
3. 비교 결과를 후보 설명에 붙일 수 있는 별도 승인 조건

## 이번 문서 작업의 경계

- `#115` 또는 `#121`을 검토 없이 병합하거나 정본으로 승격하지 않는다.
- `#121`의 `BELOW/WITHIN/ABOVE` 비교는 다음 훈련, 용량, 안전 상태를 자동 변경하지 않는다.
- PR #120이 병합되기 전에는 현재 앱의 `미지정` 문구를 삭제하거나 Plan Beta UI를 수정하지 않는다.
- `DRAFT` 템플릿은 Template Library 조회 결과에 들어가지 않으며, 선수에게 실제 처방으로 표시되지 않는다.
- 원문 메모, 증상 자유서술, 개인 메모의 존재 여부는 처방 수치·앵커·비교값에 사용하지 않는다.

## 다음 구현 순서

1. 이 정합성 기록과 처방 계약, 카탈로그를 사람 검토한다.
2. PR #120이 `main`에 병합된 뒤에만 파서·같은 종목 RP 계산기·UI 표시를 별도 커밋으로 만든다.
3. `DRAFT` 템플릿을 `ACTIVE`로 바꾸려면 코치, 스포츠과학, 청소년 전이 검토와 별도 승인 기록이 필요하다.
4. 안전 게이트·D9 런타임 증거 없이 Plan Generator 또는 Template Library 관련 이슈를 닫지 않는다.

[DRAFT_COMPLETE]
