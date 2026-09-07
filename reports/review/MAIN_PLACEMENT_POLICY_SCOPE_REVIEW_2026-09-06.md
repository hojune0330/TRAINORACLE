# MAIN_PLACEMENT_POLICY_SCOPE_REVIEW_2026-09-06.md

```yaml
doc_id: trainoracle-main-placement-policy-scope-review-2026-09-06
status: VALIDATION_FOUNDATION_VERIFIED_WORKFLOW_INCOMPLETE
base_head: 15ea2890f7d664aa926e44739b32e02b6a620360
new_runtime_policies: 0
new_template_activations: 0
new_dose_values: 0
whole_plan_complete: false
canonical_promotion: false
```

## 1. 발견과 구현

이전 중앙 배치 검증은 policy ID·검토 참조·종목·목적·경험·최대 상세 횟수·
최소 간격·반복 허용을 검사했지만, 실제 주기 길이와 나머지 훈련 구성·유효기간·
철회 여부를 묶지 않았다. 운영 registry가 비어 있어 현재 공개 처방에 대한
사고를 재현한 것은 아니지만, 향후 정책 등록 전 해소해야 하는 계약 공백이다.

이번 변경은 다음을 검사한다.

- 평가 시각은 caller가 명시한다. 코어 내부에서 현재 시각을 만들어 쓰지 않는다.
- `validFrom <= evaluatedAt < validUntil`과 유효한 ISO 시각·정상 구간을 검사한다.
  철회 마커가 null이 아니거나 필드가 없으면 허용하지 않는다.
- 주기 원본 길이·표시 길이·연속성, 전체 day/AM/PM/역할/목적, 나머지 시간·RPE
  처방을 정렬된 scope fingerprint에 묶는다. 프레임 밖 주소와 중복 주소를 거부한다.
- 상세 슬롯은 placeholder로 표현하고 구성 허용 여부는 기존 독립 allowed set으로
  검사한다. 특정 A/B 짝만 허용하는 모델이 아니다. 개인 pace·anchor·문구는
  이 범위 지문에 넣지 않는다. 개인 처방의 정체성/적격성 검사는 별도로 유지한다.
- 노출·상호작용·안전 검토 참조가 필요하다. 문자열이나 지문을 만드는 것이 실제
  검토나 승인이라는 뜻은 아니며 trusted registry 수용은 별도다.
- 다중 binder가 평가 시각을 전달할 수 있도록 연결했다. 기존 단일 상세와 옛
  구조적 계획 읽기는 새 유효기간 입력을 요구하지 않는다.

## 2. 검증

- 최초 대상 2파일 30 PASS. 새 lifecycle/scope 반례 추가 후 대상 56 PASS.
- 초기 TypeScript 실패 2건은 exactOptionalPropertyTypes에 맞지 않게 undefined를
  필드로 넣은 테스트였다. 누락 필드 시험을 실제 property 제거로 고친 뒤 통과했다.
- 최종 코어 전체 27파일 859 PASS. 28개의 추가 반례와 기존 양성 경로를 포함한다.
- 만료 비교를 제거한 결함 주입: 만료 경계 테스트 1건 FAIL.
- scope 비교를 제거한 결함 주입: 지문 변조·지문 누락·다른 주기 재사용 3건 FAIL.
- 두 변조는 즉시 복원했다. 정상 코드에서 대상 2파일 58 PASS와 코어 전체
  27파일 859 PASS를 다시 확인했다. 코어 타입 검사와 앱 타입 검사/build PASS.
- 새 빌드 실제 브라우저 6 PASS: desktop/320px에서 공유 target·A만·B만 선택,
  기준 기록 확인·정확한 슬롯 저장·새로고침을 검증했다. 새 운영 다중 배치의
  공개 화면 시험은 아니며, 기존 단일 상세 흐름의 회귀 시험이다.
- 앱 build에는 기존 font URL 및 500kB chunk 경고가 남았다. 빌드 실패는 아니다.
- 정상 코드 최종 앱 전체 실행: 284파일 2473 PASS, 실패 0, exit 0.
  FeedbackBoardRoute/ErrorBoundary의 의도적 오류 출력은 테스트 시나리오이며
  실제 실패 결과와 구분했다. 문서 제목·최종 표식·후행 텍스트 및 diff도 검사한다.

합성 정책과 합성 간격/일정은 테스트에만 존재한다. 이 시험으로 청소년에게 특정
횟수·간격이 적절하다거나 새 상세 구성의 과학적 승인이 완료됐다고 판단하지 않는다.

## 3. 남은 실제 연결

M05 전부 완료는 아니다. trusted 운영 registry는 여전히 비어 있다. 실제 허용할
구성·프레임·노출·간격·유효기간·검토 근거를 수용한 뒤 정책 identity와 선택 receipt를
저장하고, 명시적 선택·저장·복원·실행·다음 계획 경계에 실제 평가 문맥을 전달해야 한다.

현재 저장 parser의 legacy 읽기가 새 실행 허용으로 바뀌지 않음을 보존했다.
사용 가능한 단일 상세를 새 사람 승인 대기로 돌리거나, 새 조정 UI를 빈 버튼으로
노출하지 않았다. 이번 코드/시험은 운영 다중 MAIN 제공·독립 Fable 검수·배포의
완료 증거가 아니다.

[DRAFT_COMPLETE]
