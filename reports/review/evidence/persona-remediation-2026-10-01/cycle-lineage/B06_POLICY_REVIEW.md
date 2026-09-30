# B06 좁은 설계·권한 검토

- 판정: **문맥 복구와 일반 다음 주기 준비는 진행 가능. 변경·카탈로그 계획의 기존 A/B 감량 변환은 별도 정확한 정책이 필요하다.**
- 기준: `codex/workout-choice-runtime-completion`, `bbbd36ade1ce2bcd2c0420607434a0c00ceeebc7`.
- 범위: B06 sidecar 정적 검토. 제품 코드·계약 수정, 테스트 실행, 환경/비밀/사용자 자료 접근, 네트워크 접근 없음. 이 보고서만 작성했다.
- 본 작업자의 동시 변경은 보존했다. 이 보고서는 그 후속 구현의 검수·배포 승인이나 독립적인 훈련 수치/과학 승인서가 아니다. W1 강도·시간 상한 결정은 건드리지 않는다.

## 1. 권고

**본 작업의 exact current-plan 복구는 계속하되, 이를 `PlanAdaptationContext`의 새 A/B 쌍으로 위장하지 않는다.** 정확한 현재 V3 계획과 검증된 원본 계보를 주기 요약/일반 다음 주기 준비에 전달하고, 실제 등록된 변환의 가용성은 따로 판정한다. B06 완료를 문맥 복구만으로 선언하지 않는다.

지시서 [B06 완료 조건 및 사전 조건](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/WORK_ORDER_PERSONA_REVIEW_REMEDIATION_2026-09-30.md:113>)은 현재 문맥 재구성, 옛 pending 무효화, 승인된 변환만 허용을 요구한다. [Formation §19](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md:2032>)는 이전 쌍의 ID 재결속이나 형제 후보 발명을 명시적으로 금지한다.

실행 경로를 다음과 같이 분리하는 것이 가장 좁고 근거가 있다.

| 경로 | 지금 재사용할 수 있는 것 | 경계 |
|---|---|---|
| 현재 계획/원래 문맥 읽기 | 현재 저장 스키마, 정확한 원본 보관, 같은 주기의 영수증 재생 | 읽기·비교 근거이지 새 변환 권한이 아님 |
| 일반 `다음 주기` 준비 | 명시적 현재 predecessor + 기존 생성기 + 선택 시 계보 전진 | 새 계획을 사용자가 검토하는 경로. 변경된 처방을 그대로 유지/감량했다고 설명하면 안 됨 |
| 기존 A/B 다음 주기 감량 | 원래 보관된 정확한 비카탈로그 쌍의 등록된 support-only REDUCE | 현재 base와 쌍이 모두 정확히 일치할 때만. 변경된 계획으로 승계를 추정하지 않음 |
| 실제 수행 후 현재 주기 교정 | 이미 채택된 유지·범위 내 줄이기·저강도 교체·뒤로 이동 | `EXECUTION_REVIEW_CONFIRMED`, 현재 주기 정책. NEXT_FRAME으로 이식하지 않음 |
| 계산형 카탈로그의 다음 주기 감량 | 정확한 구성·입력·지문 읽기와 계산 검증 | 다음 주기용 변환 등록은 없음. 기존 시간 상한 축소 금지는 유지 |

## 2. 확인한 실행 권한

**전체 카탈로그가 미승인인 것은 아니다.** [전체 계산·연결 계약](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/specs/reconstruct/ALL_WORKOUT_CALCULATION_AND_BINDING_CONTRACT.md:28>) 28~38행은 조건부 연결과 같은 목적 슬롯 대체를, 129~163행은 저장 후 미래 미기록 슬롯의 명시적 교체를 채택한다. 그러나 같은 문서 67~70행은 계산형 처방에 기존 `durationMinutes.maximum` 축소를 적용하지 말라고 한다. [선택·조정 계약 §21.59](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/specs/reconstruct/SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT.md:2076>) 2088행도 같은 금지다.

**기존 다음 주기 REDUCE는 실제로 채택돼 있다.** [오너 결정](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/reports/review/OWNER_DECISION_PERSONALIZED_PRESCRIPTION_ALGORITHM_V2_2026-08-23.json:58>)은 `BALANCED_TO_CONSERVATIVE_EXISTING_SIBLING_ONLY`를 active baseline으로 기록한다. [현재 레지스트리](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/impl/src/plan-generator/adaptation-transform-registry.ts:36>) 36~74행에는 그 REDUCE와 반대 방향 INCREASE가 있으며, 변경 주소는 보조 시간 `maximum`뿐이다. REDUCE의 트리거는 `EXPLICIT_REQUEST`다. 이 검토는 INCREASE 사용을 권고하거나 W1 상한을 올리는 결정이 아니다.

등록 함수의 [97~115행](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/impl/src/plan-generator/adaptation-transform-registry.ts:97>)은 어느 후보에든 `catalogWorkout`이 있으면 거절한다. [support-only 판정](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/impl/src/plan-generator/support-only-candidate-pair.ts:80>)은 정확한 pair identity, 공통 문맥, 같은 슬롯/역할/목적, MAIN 불변, 회복 동반 세션 불변을 요구한다. 127~143행의 감소는 기존 보조 범위의 최소값으로 상한을 옮기는 것이며 임의 새 용량이 아니다.

**기존 유지·감소 정책은 별도로 사용 가능하다.** [실제 수행 계약 §18](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/specs/reconstruct/PLAN_EXECUTION_DEVIATION_AND_REPLAN_CONTRACT.md:341>) 343~355행에서 오너가 현재 주기 교정을 채택했다. 유지는 새 계획 버전을 만들지 않는다. 줄이기는 변경 가능한 비카탈로그 RPE 시간형의 원래 범위 최소값을 사용하며 강도를 올리지 않는다. [재생 정책](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/execution-replan-policy.ts:25>) 36~43행은 계산형 카탈로그의 REDUCE를 거절하고, 47~77행은 상한을 비교할 수 있는 저강도 교체 및 원본 구성 그대로의 뒤로 이동을 허용한다. 이것은 감소/보존 범위의 기존 권한이지 모든 상세 반복을 깎는 권한이 아니다.

`MAINTAIN`을 기존 NEXT_FRAME 제안으로 넣는 경로는 없다. [제안 생성](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/impl/src/plan-generator/adaptation.ts:310>) 312~319행은 무변경을 `NO_OP`로 거절한다. [Formation의 분리된 트리거](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md:1454>)도 수행 차이를 PB/SB 또는 `EXPLICIT_REQUEST`로 재명명하는 것을 허용하지 않는다.

## 3. 원래 문맥을 복원할 수 있는가

**조건부로 가능하다. 다만 원래 쌍의 복원과 현재 계획의 새 형제 후보 생성은 별개다.**

1. 계정에서는 [V3 보관 패킷](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/account/account-plan-document-schema.ts:19>)에 원래 context가 있을 수 있다. 40~47행은 context의 active ID·pair·sessions를 그 패킷의 당시 state와 대조한다. 최신 현재 패킷에 context가 없어도 원본 유실로 단정할 수 없다. [계정 쓰기](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/account/account-plan-domain.ts:14>) 29~37행의 context는 선택 인자이며, 교체/재계획 store는 이 인자를 전달하지 않는다. 따라서 보관 패킷에는 있고 새 패킷에는 없는 상태가 코드상 가능하다.
2. 먼저 [완전한 계정 이력 읽기](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/account/account-plan-domain.ts:5>)를 기다린다. 현재 전용 응답이나 읽기 실패를 빈 보관함으로 해석하지 않는다. 같은 계정 안에서도 단순 최근 항목을 고르지 않는다.
3. 현재 영수증의 `baseStateFingerprint`/`baseCandidateId`/`baseSessions`를 정확한 보관 원본과 연결하고, 각 hop의 정책 재생·불변 주기 문맥·내용 ID·시간 순서를 확인한다. [기존 같은 주기 resolver](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/execution-replan-source.ts:7>) 7~28행 및 46~63행이 재사용할 검사 패턴이다. 함수 자체는 **변경되지 않은 일지 대상**을 찾으므로 일반 context resolver로 그대로 호출할 수는 없다. 누락 hop·다른 주기·순환·충돌이면 복구 실패로 남긴다.
4. 찾은 원본 context는 원본 state에 대해 검증해 읽기 전용 provenance로 보존한다. 현재 사용 문맥은 현재 state의 sessions/progress/intake/periodization과 정확한 지문에 결속한다. 원본 설명·판정·노출 원장을 변경된 현재 후보의 새 승인 근거로 복사하지 않는다.
5. 게스트의 [원본 보관](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-history-snapshot-content.ts:8>)은 `originalPlan`을 보존하지만 전체 후보 쌍 context는 포함하지 않는다. 별도 기기 context가 남아 정확한 원본과 일치하면 원래 쌍을 읽을 수 있다. 그 값도 없으면 state만으로 미선택 sibling·confidence·rationale 등 원래 후보 전체를 복원했다고 주장할 수 없다. 현재 계획을 읽는 것과 일반 다음 주기 준비까지 모두 막을 이유도 없다.

현재 [context 스키마](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-adaptation-context-schema.ts:4>)는 후보 둘을 요구한다. 새 읽기 문맥이 필요한 경우 단일 현재 base와 검증된 원본 provenance를 나타내는 별도 읽기 타입/결과로 표현해야 한다. **tuple을 채우기 위해 현재 후보를 복제하거나 원래 sibling을 재처방하지 않는다.**

특히 [교체](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/catalog-replacement.ts:37>) 43~49행과 [수행 교정](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/execution-replan.ts:102>) 106~113행은 현재 candidate ID를 바꾸지만 원래 pair ID를 유지한다. 이는 저장된 변경 계획으로서는 유효할 수 있어도 새 A/B 쌍의 증명은 아니다. [쌍 검증](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/impl/src/plan-generator/candidate-identity.ts:250>) 254~261행은 두 후보 ID로 pair digest를 다시 대조한다. 바뀐 base와 옛 sibling을 붙여 ID만 고치는 것은 충분하지 않다.

## 4. 지금 연결할 구현 경로

**기존 일반 다음 주기 흐름을 사용한다.** [진입](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/PlanActiveState.tsx:93>)은 정확한 현재 V3 state·주기 완료·통증 확인 상태를 검사하고, [화면 연결](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/PlanBeta.tsx:726>)은 이 state를 명시적 `nextPredecessor`로 전달한다. 카탈로그/변경 영수증이 있다는 이유만으로 이 경로를 기존 adaptation pair 가용성에 종속시키지 않는다.

[생성](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-beta-flow.ts:137>) 143~152행은 현재 predecessor를 다시 대조한 후 기존 생성기를 호출한다. [전달 문맥](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-beta-store.ts:532>)은 수행 상태 개수이며 처방 증량 근거가 아니다. 새 카탈로그 연결은 같은 생성 파일 349~353행의 기존 신규 계획 binder를 따른다. 현재 강도·시간 상한 및 실제 사용자 확인을 그대로 유지한다.

[최종 선택](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/plan-selection.ts:137>) 137~189행의 predecessor 재검사·계보 전진·보관·계정 CAS/기기 저장을 재사용한다. 준비·취소에는 기존 계획을 유지한다. [기기 commit](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-beta-store.ts:256>)은 새로 **생성된 실제 쌍**을 context에 저장하고 옛 pending을 제거한다. 이 쌍은 현재 변경 계획의 sibling을 추정한 것이 아니라 새 계획 생성 결과다.

이 경로는 이미 채택된 **새 주기의 명시적 생성/선택**이다. 감소 요청의 답으로 자동 대체하거나 `이전 상세 처방 유지`, `수행 결과에 맞춘 감량 완료`라고 표현하지 않는다. 이전 수동 교체를 다음 주기로 자동 이월한 것도 아니다. [옛 pending 검사](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-adaptation-ui.ts:175>)의 candidate ID와 전체 predecessor hash 검사를 유지하고 읽기 복구만으로 pending을 재활성화하지 않는다.

## 5. 카탈로그 NEXT_FRAME 변환에 정확히 부족한 것

새 훈련 전체나 W1 상한의 일괄 재승인을 요구할 문제가 아니다. 다음을 포함한 **현재 변경 계획을 base로 하는 버전 있는 NEXT_FRAME bridge/edge의 정확한 채택**이 없다.

- 결과 정책: 현재 계산형 구성의 그대로 이월인지, 정확한 검토 구성으로의 전이인지, 카탈로그를 완전히 고정하고 비카탈로그 보조 세션만 기존 최소 상한으로 줄이는지 구분해야 한다. 현재 어떤 선택지도 기존 등록 edge로 자동 승인되지 않는다.
- after-value 출처: 당시 저장된 구성/입력과 현재 유효한 채택 자료, 또는 별도 채택된 정확한 전이. 원래 sibling에 사용자 교체 영수증을 복사하거나 catalog range의 최소값을 새 처방으로 택하는 것은 출처가 아니다.
- 변경 주소와 불변식: 허용 세션·필드, 실제 운동/회복/세트/마지막 회복/지원 구간, 강도·빈도·MAIN/간격·환경·대상·총시간 결속. 계산형 `maximum`은 페이스 불확실성일 수 있어 제거 가능한 운동량으로 볼 수 없다.
- 정체성과 적용: 변경된 predecessor와 원래 pair provenance의 분리, sibling 없이 가능한 제안/저장 형식 또는 명시적으로 채택된 새 쌍 형성 규칙, 재계산/재검증·revocation·pending 무효화·최종 CAS. 기존 쌍 재결속 helper의 존재만으로 권한이 생기지 않는다.

등록 요건의 기존 근거는 [실제 수행 계약 §11](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/specs/reconstruct/PLAN_EXECUTION_DEVIATION_AND_REPLAN_CONTRACT.md:235>) 237~249행 및 [유한 구성·조절 규칙](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/specs/reconstruct/SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT.md:308>) 314~334행이다. 이것을 작업자가 신규 numeric policy나 독립 과학 승인으로 채우지 않는다.

## 6. 좁은 반례와 완료 관문

아래는 코드/계약에서 도출한 반례 및 후속 검증 권고다. **이번 검토에서 실행하지 않았다.**

1. 변경 없는 정확한 비카탈로그 A/B 성공 대조군은 유지한다. 읽기 복구를 넣고 모든 정상 REDUCE까지 막으면 안 된다.
2. 미래 카탈로그 하나만 교체한 경우: 원래 계정 패킷 context를 복원해도 최신 sessions와 다르다. 옛 쌍을 현재 쌍으로 승인하면 안 된다.
3. 비카탈로그 지원 세션만 REDUCE한 경우에도 현재 ID와 옛 pair digest가 달라질 수 있다. `catalogWorkout` 검사가 없다는 이유만으로 기존 sibling edge를 허용하지 않는다.
4. 카탈로그 총시간 범위의 상한만 최소값으로 바꾸면 계산 지문/입력/실제 totals가 어긋난다. [binding 검증](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/impl/src/prescription/catalog-session-binding.ts:18>) 29~34행 및 47~61행의 재계산 일치와 계약의 축소 금지를 모두 유지한다.
5. `REPLACE`로 MAIN이 저강도가 되거나 `MOVE_LATER`로 날짜가 바뀌면 옛 후보의 노출/배치 metadata를 현재 승인 근거로 무검증 복사하지 않는다. 원래 일지 해석용 보존과 새 변환용 권한은 다르다.
6. 같은 내용으로 복귀한 변경 체인, 누락 중간 원본, 같은 계정의 다른 주기, 읽기 오류/부분 이력, 다른 계정/탭 변경을 각각 구분한다. 최신 보관본 추정으로 복구하지 않는다.
7. 옛 pending은 복구 후에도 무쓰기 거절한다. 준비·취소·실패는 현재 계획/보관/계보를 바꾸지 않고 최종 확정만 한 번 전진한다. 계정 응답 불명은 기존 영수증 확인으로 처리한다.
8. 일반 다음 주기 시작 성공과 카탈로그 감량 변환 성공을 따로 기록한다. 후자를 시험/채택하지 않은 상태에서는 B06의 **연결 수리**와 **카탈로그 변환 미완**을 함께 명시한다.

결론: 본 작업자는 문맥과 next-frame 연결을 진행할 수 있다. 기존 감소/유지 권한도 존재한다. 그러나 정확한 원본 복원만으로 변경된 계획의 sibling 또는 계산형 카탈로그 NEXT_FRAME 변환 권한이 생기지는 않는다. 부족한 것은 위의 구체적인 bridge/edge 채택이며, 제품 전체를 `catalog unsupported`로 묶을 이유는 없다.
