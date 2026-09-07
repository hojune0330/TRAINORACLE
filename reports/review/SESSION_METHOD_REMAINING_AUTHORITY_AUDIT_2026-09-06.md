# SESSION_METHOD_REMAINING_AUTHORITY_AUDIT_2026-09-06.md

```yaml
doc_id: trainoracle-session-method-remaining-authority-audit-2026-09-06
status: BOUNDED_INDEPENDENT_AUTHORITY_AUDIT_NOT_SIGNOFF
reviewed_branch: codex/method-workflow-completion
reviewed_head: 117d389e43e816e44b6b25d136b65f3ddc14e654
review_date: 2026-09-06
review_mode: LOCAL_DOCUMENT_AND_SOURCE_INSPECTION
owned_output: reports/review/SESSION_METHOD_REMAINING_AUTHORITY_AUDIT_2026-09-06.md
runtime_tests_executed: false
external_source_research_performed: false
code_modified: false
human_or_scientific_signoffs_created: 0
template_activations: 0
commit_push_performed: false
whole_approved_plan_complete: false
```

## 1. 판정

**기존 네 상세 템플릿의 선택과 승인된 엔지니어링 연결을 모두 "새 사람 승인 없음"으로 멈추는 것은 과잉 차단이다. 반면 새로운 같은 조건의 대안, 실제 수치 조정, 한 후보 안의 동시 다중 상세 MAIN 활성화에는 아직 실제 근거가 필요하다.** 전체 계획을 다시 승인받을 필요는 없지만, "ALL remaining approved plan"도 없는 처방값이나 서명을 만드는 권한은 아니다.

다음 구현은 **M06/M07의 기존 단일 상세 MAIN 배치 선택을 후보별 격리 초안과 명시적 적용/취소에 연결하고, 그 상태를 M10 저장 재검사에 결속하는 것**이다. 현재 적격 네 ref만 사용하고 후보당 상세 처방은 최대 하나로 유지한다. 다른 슬롯의 상세 처방을 추가하거나 같은 조건의 두 번째 방법을 발명하지 않는다. M08 조정 콜백의 비활성 통합 기반도 별도로 구현할 수 있으나, 실제 허용 전환이 없는 에디터를 사용자에게 노출해 완료를 가장하지 않는다.

근거: `specs/reconstruct/SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT.md:45-55`는 전체 엔지니어링 승인과 재승인 질문 금지를, `:172-177`은 단일 상세 배치의 선행 구현을, `:378-399`는 초안/적용/취소와 별도 계획 수락을, `:529-534`는 새 독립 검토 부재가 기존 채택을 취소하지 않음을 명시한다. `:196-204` 및 `:658-662`는 새 다중 배치 registry를 비워 둘 의무를 별도로 둔다.

## 2. 범위와 증거 읽기

- 시작 시 `git status --short --branch`는 지정 브랜치에서 clean, `git rev-parse HEAD`는 위 전체 SHA였다. 작성 직전에도 HEAD는 동일했다. 감사 도중 `app/src/domain/session-method-journey.contract.test.ts`가 untracked로 나타났다. 부모의 현재 seven-event journey 작업으로 보존하며 읽기·수정·실행·중복 구현하지 않았다.
- 지정 네 문서, 관련 채택 결정, 매니페스트 및 선택/에디터/배치/저장 소스만 정적으로 대조했다. 기존 연구 보고서는 결정 필드 확인에만 사용했으며 URL 재접근, 동일 출처 재조사, 외부 검토 요청은 하지 않았다.
- 아래 `파일:시작-끝`은 이 HEAD에서 확인한 저장소 상대 경로와 실제 줄 범위다. `C`는 `specs/reconstruct/SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT.md`, `P`는 `reports/implementation/SESSION_METHOD_WORKFLOW_PROGRESS_2026-09-06.md`, `R`은 `reports/research/SESSION_METHOD_SOURCE_GAP_FOLLOWUP_2026-09-06.md`의 약칭이다. 표의 `C:172-177` 등은 이 정확한 파일을 가리킨다.
- `실행 가능`은 **후속 구현 권한**이지 이 감사에서 구현/시험/배포했다는 뜻이 아니다. `차단`은 명시한 행동에만 적용한다. 문서의 기존 PASS 수치는 재실행하지 않았으며 현재 HEAD의 PASS로 재인증하지 않는다.
- 과거 기억은 구조 비교와 활성화 구분을 찾는 단서로만 사용했다. 아래 권한 판정은 이번에 직접 읽은 파일 근거다. 이 보고서는 새 채택 결정, Fable 검수, 코치 또는 과학자 서명이 아니다.

## 3. 권한과 과잉 차단

### A. 네 기준 ref는 이미 별도로 채택됐다

1. `PRODUCT_NORTH_STAR.md:187-198`은 개인 페이스 전체가 결정 대기가 아니며 800/1500/3000/5000m 네 상세 템플릿이 별도 승인 범위라고 명시한다. `AGENTS.md:74-86`은 초안 상태와 좁은 채택 범위를 구분하고, `:257-258`은 RPE 기본 원칙으로 네 상세 템플릿을 다시 막지 말라고 한다.
2. `specs/active/TEMPLATE_LIBRARY_SPEC.md:686-714`는 `V2-SEED-05@1.0.0`, `MD-800-01@1.0.0`, `MD-1500-01@1.0.0`, `MD-3000-01@1.0.0`를 정확한 ID/버전/지문, EXPERIENCED, CURRENT 동일 종목 기록 조건으로 허용한다. 네 개는 동일 조건의 네 가지 선택지가 아니라 종목/목적별 한 가지씩이다.
3. `reports/review/V2_SEED_05_OWNER_ADOPTION_DECISION_2026-08-17.md:18-29`는 단일 오너 채택이며 독립 과학/인구집단 검토를 주장하지 않는다고 명시한다. `:34-45`는 원문이 아닌 TrainOracle 운영 적응으로 정확한 5x1000m/150초 JOG를 채택한다. 원문에 이 숫자가 없다는 이유만으로 이미 채택된 숫자를 다시 막을 수 없다.
4. `reports/review/MIDDLE_DISTANCE_SOURCE_ADOPTION_PACKET_2026-08-17.md:16-23`의 비활성 working-source 상태만 읽으면 잘못된 결론이 된다. 별도 `reports/review/MIDDLE_DISTANCE_RUNTIME_ACTIVATION_DECISION_2026-08-17.md:12-34`가 세 정확한 구성과 청소년/성인 동일 조건의 베타 실행을 승인했다. `:45-52`는 감량 숫자와 종목 간 환산은 승인하지 않되 coach-only로 제한하는 것도 승인하지 않았다고 구분한다.
5. `app/src/domain/detailed-prescription-manifest.json:170-182`, `:326-338`, `:481-493`, `:636-648`는 각 채택 결정, 만료 `2027-08-17T02:00:00.000Z`, 철회 null 및 `independentReviewClaimed: false`를 담는다. 이것은 저장소의 기존 권한 기록 확인이지 실제 인물의 자격을 이 감사가 독립 인증했다는 뜻이 아니다.
6. 결정적인 코드 분기: `app/src/domain/detailed-prescription-runtime-authority.ts:165-171`에 네 정확한 baseline identity와 빈 delegated registry가 따로 있다. `:338-354`는 현재 승인/지문/종목/목적을 확인해 baseline을 `BASELINE_OWNER_APPROVAL`로 반환하고, **그 뒤** `:357-362`에서 신규 delegated 권한을 찾는다. `:284-326`의 서로 다른 코치/과학 검토자 및 유효한 receipt 요구를 baseline에 소급하면 현재 구현과 계약 둘 다 위반한다.

따라서 baseline을 유지하는 데 새 독립 사람 서명은 필요 없다. 단, 현재 기록·명시 선택·실제 경험·만료/철회·D9/hold·처리 권한을 생략할 수도 없다. `specs/active/PLAN_GENERATOR_SPEC.md:1110-1118`과 `C:499-515`는 승인된 SYSTEM 템플릿의 선수 직접 선택을 허용하고 TENANT/COACH 및 민감정보 처리 권한을 별도로 유지한다.

### B. per-MAIN 선택과 동시 다중 상세 배치는 다르다

- 현재 동작: `app/src/domain/plan-session-target.ts:9-19`는 A/B 양쪽의 동일 목적 적격 QUALITY 교집합을 찾는다. `app/src/screens/PlanBeta.tsx:481-497`은 선택한 날짜/AM/PM target으로 재생성하고 기록 재확인을 요구한다. 첫 QUALITY만 선택 가능한 상태가 아니다.
- 실제 단일 허용 분기: `impl/src/plan-generator/main-placement-policy.ts:61-79`는 주소 중복·역할·목적·종목을 검사한 뒤 상세 하나이면 통과시킨다. `:33-35`의 runtime multi-placement registry는 비어 있다. 두 개 이상부터 `:81-102`의 정확한 정책이 필요하다. **상세 하나의 배치 UI를 빈 multi-policy registry 때문에 막는 것은 과잉 차단이다.**
- 반대로 이미 MAIN이 여러 개 있다는 사실만으로 모든 MAIN에 상세 용량을 넣을 수는 없다. 기존 RPE MAIN을 상세로 바꾸는 것도 세부 용량 조합의 확대다. 다른 방법이든 같은 방법 반복이든 `C:179-204`의 정책을 통과해야 한다. 추천 `PREFER_REPEAT`, 같은 날짜의 AM/PM, core 표현 능력은 이 정책을 대신하지 못한다.
- `app/src/domain/plan-main-draft.ts:30-55`의 snapshot은 A/B 전체 scope/layout과 공유 target을 결속하는 저장 guard다. 후보별 독립 choice map은 아니며 `generated.candidates.map(...)` 순서도 scope 입력이다. 이미 있는 guard를 완성된 후보별 불변 slot lineage로 부르면 안 된다. 후보 정렬과 계보별 선택의 독립성은 `C:164-175`, `:213-218`에 맞춰 후속 구현/검증할 엔지니어링 항목이다.

### C. 에디터는 존재하지만 조정 권한은 없다

- `app/src/screens/plan-beta/PrescriptionAdjustmentEditor.tsx:25-36`에 authority/policy/context와 `onApply` 계약이 있다. `:192-232`는 finite configuration 초안을 검사하고 명시 적용 후 콜백을 기다린다. `rg`로 production `.ts/.tsx`의 심볼 참조를 확인했을 때 정의 파일 이외의 에디터 호출부는 발견되지 않았다. 따라서 "에디터 자체 없음"도, "앱 저장까지 완료"도 정확하지 않다.
- `impl/src/prescription/prescription-adjustment.ts:19-35`는 검토된 from/to edge를 요구한다. `:161-165`는 자기 자신으로 향하는 edge를 거부하고, `:181-192`는 정책/내용/문맥/유효기간/허용 전환을 검사한다. 기준 구성 하나를 복제하거나 self-edge를 만들어 Apply를 켜는 것은 허용되지 않는다.
- `C:288-314`는 현재 네 가지를 고정 용량으로 유지한다. 새 finite preset도 구성/전환 검토가 필요하며 scalar보다 먼저 할 수 있다는 말이 무승인이라는 뜻은 아니다. `specs/active/PLAN_GENERATOR_SPEC.md:312-343`의 free numeric editor/percentage/자동 증량 금지는 그대로다.
- **허용:** 기존 선택에 초안/적용/취소 결속, generic editor-host 및 candidate transaction 구현, 합성 정책으로 통합 시험 준비, 정확한 snapshot/설명/합계와 실패 원자성 구현. **차단:** 새 preset/scalar를 실제 선택 목록이나 저장 가능한 조정으로 승격. 단일 상세의 위치/기록 재확인은 조정 engine의 새 dose edge를 요구하는 작업으로 재분류하지 않는다.

### D. 진행표를 전역 선행조건으로 읽지 않는다

`P:207-215`의 출처 결정 -> M04 -> M05 -> M06~M10 순서를 모든 후속 코드의 절대 직렬 선행조건으로 쓰면 과잉 차단이다. 이 순서는 **새 구성의 live 통합**에는 맞지만, `C:519-534`가 승인한 baseline 연결과 generic 기반까지 막지 않는다. `P:80`의 빈 버튼 금지도 실행 가능한 단일 상세 선택을 숨기라는 말이 아니다.

또한 `reports/review/SESSION_METHOD_CATALOG_READINESS_2026-09-05.md:136`의 "per-MAIN-slot wiring not authorized by its adoption"은 **그 템플릿 채택만으로 새 배치 권한이 생기지 않는다**는 좁은 뜻으로 읽어야 한다. 별도 `C:172-177`, `:378-399`의 엔지니어링 승인까지 부정하는 문구로 사용할 수 없다. 이 감사는 원본 진행표나 계약을 수정하지 않는다.

## 4. M01-M16 실행/차단 표

모든 행을 하나의 DONE/BLOCKED로 압축하지 않는다. 원래 남은 작업 정의는 `P:59-80`이며, 아래는 그 범위 안의 실행 가능 부분과 실제 enablement 차단 부분이다. `E`는 후속 구현/준비 실행 가능, `B`는 명시한 신규 동작의 활성화 차단, `V`는 실제 검증/지정 검수 증거 미완이다.

| ID / 원래 항목 | 현재 실행 가능한 부분 | 차단되는 부분과 최소 해제 조건 | 정확한 증거 |
|---|---|---|---|
| M01 / 두 번째 5000m VO2 | E: 확보된 I 세 묶음을 target/종료/구성/대상 필드로 정리하고 미결정 출력은 null로 유지. 동일 출처를 다시 조사할 필요 없음. | B: 현재 5K RP를 I로 바꿔 부르거나 새 selectable preset 등록. 아래 D1-I의 실제 결정/모델/적용 근거가 필요. | `P:61`; `R:60-86`, `:146-149`; `C:48-55`, `:355-375` |
| M02 / roll-on 후보 | E: 12회와 15회, 마지막 100m roll-on, 거리/시간 미확정을 보존한 구성 준비 및 비활성 표현/산술 연결. | B: 현행 VO2 대안 또는 선수용 새 dose로 등록. D1-NIT의 목적·목표 의미·대상·구성 채택 필요. 마지막 roll-on 존재 자체는 이미 확인된 값이므로 다시 미확정으로 만들지 않음. | `P:62`; `R:88-110`, `:150-152`; `C:369-375` |
| M03 / 전체 출처 공백 | E: 기존 30행과 별도 MD refs를 G-SOURCE/TARGET/STRUCTURE/SCOPE/ADJUST/BINDING별로 대조하고 미해소 필드 유지. 불용 항목은 제외 상태 유지가 올바른 처리이며 모두 활성화할 의무는 없음. | B: 확보하지 못한 원문/회복/대상/주기를 채워 넣거나 30행 전체 채택·조사 완료 선언. 필요한 행에만 D1의 정확한 근거/운영 선택. 이 감사에서 재조사하지 않음. | `P:63`, `:78-79`; `reports/review/SESSION_METHOD_CATALOG_READINESS_2026-09-05.md:219-236`; `R:27-30`, `:199-200` |
| M04 / family/configuration | E: 기존 네 ref의 명시적 versioned mapping이 이미 있음. 이를 선택/초안/설명/저장에 연결하는 잔여 작업. 비활성 신규 registry 입력과 검증 경계 준비 가능. | B: 새로운 selectable identity나 새 승인 digest 생성. 해당 새 구성에 D1이 필요. 기존 네 ref를 다시 검토받거나 네 family로 부풀릴 필요 없음. | `P:34`, `:64`; `app/src/domain/plan-method-registry.ts:12-35`; `C:147-162`, `:529-534` |
| M05 / 프레임 배치 | E: 공통 gate와 빈 runtime registry 유지, 검증된 실제 문맥 전달·정책 receipt/만료/철회/프레임 결속 등 계약상 빠진 엔지니어링 준비. synthetic 정책으로만 시험 가능. | B: 한 후보에 두 번째 상세를 넣는 live 정책. D2의 정확한 구성 집합·frame/slot·노출·상호작용·반복/간격 판단 필요. 임의 최소 슬롯/시간 값을 정책에 넣지 않음. | `P:65`; `C:179-204`; `impl/src/plan-generator/main-placement-policy.ts:19-35`, `:78-102` |
| M06 / MAIN별 독립 초안 | E: 현재 적격 target과 한 상세 선택을 후보/계보별 격리 초안으로 연결. 적용/취소/선택 유지/재확인 구현. generic 다중 choice map도 비활성 경계 안에서 준비 가능. | B: 같은 조건의 두 방법을 강제하거나 여러 상세를 동시에 적용. 다른 대안은 D1, 동시 배치는 D2 필요. 하나뿐이면 하나를 정직하게 제시. | `P:66`, `:80`; `C:164-204`, `:269-272`, `:378-399`; `app/src/screens/PlanBeta.tsx:481-497` |
| M07 / anchor·snapshot | E: 기존 권한/anchor를 candidate-scoped mainSlotId·draft revision·내용과 결속하고 새로고침/과거 형식/명시 재확인 경로 통합. 현재 메모리 snapshot을 영속 snapshot 완료로 보지 않음. | B: 미승인 다중 상세나 임의 교차 종목 anchor 저장. 새 값의 저장은 D1/D2/D3 중 해당 조건 후. 구형 원본을 새 schema로 추정 backfill하지 않음. | `P:38-43`, `:67`; `C:421-460`; `app/src/domain/plan-main-draft.ts:14-55`; `app/src/screens/plan-beta/plan-selection.ts:53-60`, `:87-120` |
| M08 / 실제 조정 editor | E: 기존 컴포넌트의 onApply를 후보 전용 host/transaction에 연결하고 capability를 확인하는 기반. 합성 reviewed edge를 쓰는 비운영 통합 검증은 새 사람 승인을 기다릴 이유 없음. | B: 실제 사용자의 finite 전환 및 scalar 편집. 현재 같은 조건에 대안이 없고 D3의 실제 허용 edge가 없음. no-op 구성/self-edge/빈 조작으로 완료 처리 금지. | `P:68`, `:80`; `C:282-314`, `:378-399`; `app/src/screens/plan-beta/PrescriptionAdjustmentEditor.tsx:25-36`, `:224-236`; `impl/src/prescription/prescription-adjustment.ts:161-192` |
| M09 / 구조·합계·설명 | E: authoritative sequence에서 work/rep/set/terminal 합계, 거리·시간·unknown 및 설명 버전 재계산 연결. 산술은 이미 있는 core를 재사용. | B: 실제 set 분할/회복 추가를 새 처방으로 저장. 구조는 D1, 허용 변경은 D3, 동시 배치면 D2가 필요. 산술 PASS가 채택을 대신하지 않음. | `P:69`; `C:316-375`; `impl/src/prescription/prescription-adjustment.ts:205-226`; `R:27-30` |
| M10 / 저장·경쟁 | E: baseline과 비활성 editor-host의 stale/cancel/idempotency/같은 잠금 사용/실패 보존을 완성. 별도 과학 승인 사유가 아닌 순수 엔지니어링 잔여 작업. | V/B: 다중 key 물리적 원자성, 잠금을 쓰지 않는 타 탭, editor end-to-end를 이미 보장한다고 선언 불가. 실제 다중 조정 양성 사례만 D2/D3 후. 구체 storage 설계·반례 실행이 먼저이며 사람 서명으로 고칠 문제가 아님. | `P:70`, `:156-164`; `C:390-399`; `app/src/screens/plan-beta/plan-selection.ts:76-149` |
| M11 / 실제 수행 연결 | E: 현재 직접 입력/정확한 original-plan 링크/조회 불가 구분을 유지하고, 실제로 보유한 원본의 read-only projection 연결을 확장. 신규 template 승인 불필요. | B/V: 없는 과거 원본 복원, split/recovery/준수 추정, 측정값의 추천/자동 증량 소비. 실제 원본/적격 측정과 별도 비교·추천 계약 필요. 새 장기 저장은 D4 경계. | `P:71`, `:168-174`, `:221-227`; `C:464-492`; `app/src/domain/plan-method-observations.ts:8-15`, `:74-110`, `:127-153` |
| M12 / 범위·장기 원장 | E: 기존 latest-18 요약과 같은 snapshot 기반 coverage를 유지. 정확히 연결되고 허용된 실제 일지 날짜가 있으면 출처별로 구분하는 projection/새 versioned ledger 통합 설계 가능. | B/V: archivedAt를 운동일로 바꾸거나 24주/평생 관측으로 주장, 기존 archive 확대/추정 backfill 금지. 장기 보관의 정확한 소유 정책이 없으면 D4만 좁게 확정; 이것이 기존 coverage 작업의 승인 차단은 아님. | `P:72`, `:127-134`; `C:446-460`; `app/src/domain/plan-beta-store.ts:290-304`, `:320`; `app/src/domain/plan-method-coverage.ts:32-37` |
| M13 / 종목별 범위 | E: 800/1500/3000/5000 기존 상세와 10K/하프/마라톤 기존 RPE 경로의 정확한 조건/제외 설명 및 누락 연결 개선. 부모의 seven-event 시험은 중복하지 않음. | B: 미채택 목적 조합·10K/하프/마라톤 새 상세, 초보자 수치 변형. 해당 구성 D1과 필요한 D2/D3만 요구. 기존 중거리·청소년·자율 사용을 새 승인 대기로 되돌리지 않음. | `P:73`; `TRAINING_PLAN_CURRENT_SCOPE.md:34-47`; `C:499-508`; `specs/active/TEMPLATE_LIBRARY_SPEC.md:693-709` |
| M14 / 실제 사용자 여정 | E: **부모 소유, 중복 금지.** 현재 승인된 seven-event 경로의 실제 시험/결함 수정은 진행 가능. 결과 artifact/SHA를 이후 인수. | V/B: 아직 비활성인 조정·동시 상세 단계까지 full journey PASS로 확대 불가. 그 양성 경로는 실제 D1/D2/D3 및 구현 이후. 없는 동작의 명시적 차단도 현재 여정의 정당한 결과. | `P:74`, `:98-100`, `:200-203`; `C:536-572`; 현재 사용자 위임 및 관측된 부모 untracked 파일 |
| M15 / UX·Fable | E: 320/375px·200% 글자·키보드·reduced motion·복귀 위치 검수 준비 및 발견 결함 수정. 기존 기능의 검증에 새 과학 승인 불필요. | V: 실제 지정 Fable 독립 UX 리뷰 결과가 없으면 그 완료를 주장하지 않음. 이 AI 감사나 브라우저 PASS를 Fable/사람 과학 승인으로 서명하지 않음. 새 editor UX 최종 양성 검수는 실행 가능한 구성과 연결 후. | `P:75`, `:215`; `docs/UX_UI_VISUAL_STANDARD.md:149-181`; `C:527-534` |
| M16 / PR·출시 | E: 정확한 diff/HEAD 기준 로컬 검수·출시 증거 목록 준비는 가능. | B/V: 이 위임은 commit/push/병합/배포를 금지. 부모의 별도 전달 권한과 각 PR의 검수·CI·실제 공개 화면 증거가 필요. 과거 head CI나 이 보고서로 완료 처리 금지. | `P:76`, `:189`, `:193-203`; `PRODUCT_NORTH_STAR.md:104-108`; 현재 사용자 위임 |

표의 원칙: M01~M03을 준비/검토 작업으로 계속하는 권한은 이미 있다. 현재 지시는 **이 감사에서 그것을 다시 연구하지 말라**는 제한이다. 반대로 `SOURCE_REVIEW_READY`는 activation-ready가 아니다. M04의 기존 mapping, M09의 산술 core, M10/M11/M12의 부분 구현은 재작성 대상이 아니라 재사용/통합 대상이다. 어떤 행도 이 감사만으로 CLOSED로 바꾸지 않는다.

## 5. 정확한 다음 구현 패킷

### 첫 패킷: baseline 단일 상세 선택의 candidate draft 통합

**진입 결정: 추가 사람/과학 승인 필요 없음.** `C:172-177`, `:378-399`, `:529-534`가 이미 허용했다. M01~M05 전체 완료를 기다리지 않는다. 소유 범위는 M06/M07 및 그 저장 경계 M10이며, 부모 M14 시험 파일은 제외한다.

1. `app/src/screens/PlanBeta.tsx:131`, `:481-513`의 단일 target/선택 흐름과 `app/src/domain/plan-main-draft.ts:30-55`를 기준으로, 후보 계보별 `mainSlotId`와 isolated editor draft를 도입한다. 기존 A/B 공유 target picker를 이미 완성된 모든 MAIN selector로 부르지 않는다. 처음 공개되는 범위는 현재 적격 공유 target/한 상세 배치에 한정한다. 후보 정렬만 바뀌면 identity를 잃지 않고, 날짜/프레임/종목/목적 변화는 명시 crosswalk 또는 재확인을 요구한다.
2. 열기/변경은 초안만 수정한다. 적용은 현재 four-ref/경험/목적/선택 record와 원본 anchor를 재검사하고 candidate revision을 새로 만든다. 취소는 적용 전 candidate를 정확히 보존한다. 이미 수락된 active plan은 건드리지 않는다. 명시한 단일 배치 변경은 기존 target 선택 동작의 범위이며 동시에 두 상세를 남기지 않는다.
3. baseline 세션 선택에는 `app/src/domain/plan-method-selection.ts:25-64`와 `app/src/screens/plan-beta/plan-template-options.ts:43-75`의 실제 권한 필터를 재사용한다. four-ref 매핑을 과학 승인으로 만들거나 여러 종목을 한 선수의 대안 목록으로 모으지 않는다. 같은 조건에서 한 방법이면 한 방법만 보여준다. 기존 RPE 선택은 유지하되 두 번째 상세 방법으로 세지 않는다.
4. `app/src/screens/plan-beta/plan-selection.ts:53-60`, `:76-120`의 lock 내 재검사를 유지하면서 새 draft/revision/cancel token과 결속한다. candidate Apply와 plan Save를 분리한다. 현재 성공 응답 재생 idempotency가 없다는 `P:162-164`의 한계를 남기지 않으려면 이를 구현/검증해야 하며, 단순 중복 거부로 완료를 대신하지 않는다.
5. 이 패킷의 인수 기준은 선택/취소 전후 다른 MAIN·support·노출·기존 active plan 불변, fresh record 확인, pending Apply/Save 무효화, 과거 형식 보존, 실패 시 부분 저장 없음이다. `C:550-570`에 해당하는 양성/반례 및 결함주입을 정확한 이름과 artifact로 검증한다. 부모의 현재 seven-event coverage와 중복되지 않는 새 draft transaction 반례를 부모와 소유 경계로 분리한다.

**정지 조건:** 기존 숫자와 승인 범위를 늘리지 않은 실제 단일 상세 candidate draft 흐름 및 그 저장 guard가 동작하고 검증된다. 이것은 M06/M07의 bounded slice 완료이며 multi-MAIN 또는 M08 수치 조정 전체 완료가 아니다. 이번 감사는 이 코드를 실행하지 않는다.

### 이어서 가능한 독립 엔지니어링

- M08/M09: 기존 `PrescriptionAdjustmentEditor`의 host/callback adapter를 만들어 정확한 policy/receipt/sequence/총량/설명과 candidate 변경을 한 경계로 검증한다. live policy provider는 근거가 없으면 비활성/빈 상태를 반환한다. 합성 authority는 시험 전용으로만 주입한다. public 버튼은 실제로 적격인 non-self 전환이 있을 때만 노출한다. 이 준비를 위해 신규 scientist 서명을 요구할 이유는 없고, 이 준비가 서명을 대신하지도 않는다.
- M10: 같은 mutation lock을 사용하는 모든 관련 쓰기 경로와 replay/cancel/rollback 실패 경계를 보완한다. 실제 원자성의 설계/실행 증거와 타 탭 협력 범위를 명시한다. 신규 처방 권한 부재와 무관한 작업이다.
- M11/M12: 정확한 기존 원본을 소비하는 read-only projection과 미래 snapshot schema 연결을 준비한다. 없는 과거 데이터는 계속 없음으로 둔다. 실제 보존 범위 변경은 아래 D4의 소유 경계를 확인한 뒤 진행한다.
- M15: 부모의 실제 UI artifact로 접근성/복귀/긴 설명 검수를 준비한다. 지정 Fable 인수는 실제 검수자에게 남긴다. 이 감사에서는 요청/서명을 생성하지 않는다.

## 6. 정말 필요한 결정만

아래는 새 승인 양식을 만드는 것이 아니라 **차단 행동을 해제하는 데 빠진 내용**이다. 이 보고서의 모든 새 결정은 미결정이며 검토자/서명/자격/시각/승인 해시는 부여하지 않는다. 결정 권한 없는 AI는 수치 대안을 선택하지 않는다. 이미 있는 문서로 해소된 값은 다시 질문하지 않는다.

### D1. 새 selectable 구성별 한 묶음의 채택

- **I:** `R:146-149`의 target 입력 모델/단위/버전 또는 명시 코치 입력, 종료 회복·준비/정리 경계, 유한 구성 subset, 종목/목적/경험/주기/대상 적용을 정확히 결정한다. scalar는 LOCKED로 둘 수 있으므로 전 범위 slider 검토까지 기다릴 필요는 없다. 원문의 8% 기준을 사용하려면 `R:82-86`의 주간거리/예시 불일치를 먼저 해소한다. 미해소 원문을 새 적격성 정책으로 몰래 넣지 않는다.
- **NIT:** `R:150-152`의 VO2 호환 또는 별도 목적, 체감 리듬 대 현행기록 참조 의미, 적용 대상/운영 구성과 component를 결정한다. 12x400m의 마지막 100m roll-on은 다시 "있음/없음"을 임의 선택할 필드가 아니다. 15회 및 3x2/2x3 예시는 각각 별도 구성이다.
- **그 외 행:** `reports/review/SESSION_METHOD_CATALOG_READINESS_2026-09-05.md:221-228`의 해당 빈 필드만 채운다. 사용할 수 없는 항목은 제외로 남겨도 된다. 각각의 독립 구성 채택이면 충분하고 A/B 고정 짝이나 모든 쌍의 효과 동등성 승인은 요구하지 않는다(`C:157-162`).
- 기존 delegated 활성화 경로를 쓸 때에는 `app/src/domain/detailed-prescription-runtime-authority.ts:284-326`의 실제 코치/과학 receipt 요건과 신뢰 매니페스트 결속을 만족해야 한다. 이 검토는 그 요건을 삭제하거나 baseline 목록에 새 ref를 끼워 넣는 우회를 허가하지 않는다. 별도 권한 방식의 변경은 명시적 새 소유 결정이지 이번 엔지니어링 감사의 권한이 아니다.

### D2. 동시 다중 상세 배치의 정확한 정책

구성 ref/지문 집합, 적용 frame/slot 범위, 실제 경험/대상, 상세 노출 회계와 기존 부담, 반복 허용 및 상호작용/간격 기준, safety 제약, policy ID/version/유효기간/철회/검토 근거의 내용을 확정해야 한다(`C:179-204`, `:584`). **무조건 서로 다른 방법이어야 한다거나, 같은 방법은 언제든 반복해도 된다는 양쪽 추정 모두 금지**다. 최소 간격 숫자는 현재 code type의 필드가 있다고 정할 수 없다.

코드의 `ReviewedMainPlacementPolicy`는 현재 `reviewRef`, 최대 수, 최소 슬롯 등만 가지므로(`impl/src/plan-generator/main-placement-policy.ts:19-31`) 계약상 요구하는 정확한 frame 결속과 유효/철회 검증까지 완성됐다고 볼 수 없다. 필요한 구조 확장은 지금 구현할 엔지니어링이고, 실제 정책 내용/유효성을 증명하는 것은 별도 결정이다. registry는 그때까지 빈 상태를 유지한다.

### D3. 실제 조정 전환

가장 작은 해제 단위는 **이미 채택된 동일 적격 scope의 두 완전한 구성 사이의 정확한 from/to 전환 하나**다. 구성 자체의 채택(D1), 전환 context, target/회복/volume 등 결합 제약과 허용 방향, 적용/취소/저장 내용 결속이 필요하다(`C:297-314`, `:401-414`; `impl/src/prescription/prescription-adjustment.ts:19-35`). scalar 전부를 승인받아야만 finite 구성 전환을 만들 수 있는 것은 아니다. 다만 현재 baseline은 각 scope에 하나이므로 네 개라는 전체 개수만으로 그런 edge가 존재하지 않는다.

### D4. 신규 장기 보존 및 관측 소비 경계

신규 snapshot/원장 엔지니어링 자체는 `C:421-460`의 승인 범위다. 기존 latest-18 summary를 그대로 두면서 versioned integration을 만드는 데 과학 서명은 필요 없다. 다만 실제로 보관 항목/기간/계정·기기 scope/삭제·복구·민감정보 처리 범위를 확대하려면, 그 정확한 소유 정책을 먼저 찾아 적용하고 없으면 그 차이만 오너/데이터 책임자가 확정해야 한다. 이 감사는 추가 보존 숫자나 수집 동의를 발명하지 않는다.

실제 수행의 추천 소비 또는 측정 준수 판정은 retention 결정과 별개다. 적격 측정/원본 occurrence 연결과 검토된 비교/추천 규칙이 필요하다(`C:470-492`). 단순 조회·missing 표시를 위해 이 후속 결정을 기다릴 이유는 없다. Fable UX 검수와 M16 전달 권한도 이 네 도메인 결정과 별도의 실제 인수/작업 경계다.

## 7. 마감

**실행 방향은 "모든 사람 승인까지 정지"도 "모든 계획을 승인으로 간주해 활성화"도 아니다. 기존 네 ref·단일 상세 경로의 사용자 흐름과 공통 저장/초안 기반을 먼저 완성하고, 새로운 처방·전환·동시 배치만 정확한 미결정 근거로 차단한다.**

기존 이슈 네 개의 OPEN 상태와 canonical blocker 0은 그대로다(`C:574-592`). 그 0은 신규 활성화 허가가 아니며, 이번 보고서도 전체 계획 완료나 공개 동작을 인증하지 않는다. 이 위임의 산출물은 본 파일 하나이며 코드·테스트·원본 계약·진행표·매니페스트·승인 원장·부모 여정 테스트를 수정하지 않았다. commit/push/병합/배포 없이 이 보고서에서 정지한다.

[DRAFT_COMPLETE]
