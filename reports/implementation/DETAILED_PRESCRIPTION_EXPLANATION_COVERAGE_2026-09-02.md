# DETAILED_PRESCRIPTION_EXPLANATION_COVERAGE_2026-09-02.md

| 기준 | 확인 범위 |
|---|---|
| 조사 시점 | 2026-09-02, 17:49 KST 최초 조사 후 부모 구현자가 최종 통합·리뷰 수정 반영 |
| 브랜치 / 체크포인트 | `codex/prescription-rationale-integration` / `e8059168778b169e441fce1842f6c21812460ea9` + 커밋되지 않은 통합 변경 |
| 문서 지위 | 구현 범위 보고 초안. 새 처방 승인, 사람의 과학 검토 수용, 정본 승격, 이슈 종결 아님 |
| 검증 경계 | 아래 활성 수는 저장소의 승인·매니페스트·런타임 허용 목록 기준이다. 배포·브라우저 동작·전체 조합 실행 검증과 구분한다. 이번 작업에서 테스트는 실행하지 않았으며 이전 통과 수를 전재하지 않는다. |

## 1. 활성 상세 템플릿

[매니페스트][manifest]의 `ACTIVE`·`ELIGIBLE` 승인 4건은 [런타임 권한][authority]의 `BASELINE_TEMPLATE_IDENTITIES` 4건과 대응한다. 모두 버전 `1.0.0`, `revokedAt: null`, 만료 시각 `2027-08-17T02:00:00Z`이다. `DELEGATED_RUNTIME_AUTHORITIES`는 빈 배열이므로 추가 위임 활성화는 **0건**이다. [Template Library §16A][library]도 같은 네 정체성만 허용한다.

| 대상 종목 / 입력 그룹 | 활성 수 | 정확한 템플릿 | 허용 의도 | 채택된 MAIN / 반복 회복 | 승인 근거 |
|---|---:|---|---|---|---|
| 800m / `MIDDLE_DISTANCE` | 1 | `MD-800-01@1.0.0` | `GLY_INTENT` | `10×200m @800m RP · r60″ STAND` | [중거리 활성 결정][md-approval] |
| 1500m / `MIDDLE_DISTANCE` | 1 | `MD-1500-01@1.0.0` | `MIXED_INTENT` | `3×500m @1500m RP · r180″ STAND` | [중거리 활성 결정][md-approval] |
| 3000m / `MIDDLE_DISTANCE` | 1 | `MD-3000-01@1.0.0` | `VO2_INTENT` | `4×800m @3000m RP · r180″ WALK` | [중거리 활성 결정][md-approval] |
| 5000m / `FIVE_K` | 1 | `V2-SEED-05@1.0.0` | `VO2_INTENT` | `5×1000m @5000m RP · r150″ JOG` | [5km 오너 채택 결정][5k-approval] |
| 10000m / `TEN_K` | 0 | 없음 | 상세 수치 처방 없음 | 입력·RPE 경로와 상세 채택은 별개 | [입력 파서][inputs], [런타임 권한][authority] |
| 하프 / `GENERAL_ENDURANCE` | 0 | 없음 | 상세 수치 처방 없음 | 현재 내부 입력값 `21097`m | [입력 파서][inputs], [런타임 권한][authority] |
| 마라톤 / `GENERAL_ENDURANCE` | 0 | 없음 | 상세 수치 처방 없음 | 현재 내부 입력값 `42195`m | [입력 파서][inputs], [런타임 권한][authority] |
| 100·200·400m 전문 종목 | 0 | 범위 제외 | 해당 입력·활성화 없음 | 800m 처방 안의 200m 반복과 전문 200m 종목 활성화는 다르다 | [중거리 결정 §4][md-approval], [처방 계약 §12][contract] |

네 템플릿 모두 한 세트의 동일 거리 반복이다. `MD-1500-01`의 `MIXED_INTENT` 라벨은 거리·시간 혼합 시퀀스가 활성화되었다는 뜻이 아니다. 표에 없는 동일 종목의 다른 의도에는 이 상세 템플릿을 전용하지 않는다.

| 공통 권한 경계 | 현재 근거와 의미 |
|---|---|
| 경험·연령 | 네 승인 모두 `EXPERIENCED`, `YOUTH_AND_ADULT`. `NEW_TO_RUNNING`·`DEVELOPING`에 승인된 상세 템플릿은 0개다. 청소년·성인은 같은 적격성 기준과 수치량을 쓰며 나이·성별·학교급만으로 거부·증감하지 않는다. 모든 선수에게 무조건 적합하다는 승인은 아니다. [매니페스트][manifest], [청소년 정책 §1][youth] |
| 셀프서비스 | 승인된 `SYSTEM` 템플릿은 기존 관문을 통과한 뒤 선수가 명시 선택할 수 있다. [정책 §3][youth], [현재 흐름][flow]의 `selectionAuthority: "SELF"`·선택 `actor: "SELF"`가 대응한다. 개인정보·보호자·계정·동기화·공유 권한은 별도이며 코치 전용으로 축소하지 않는다. |
| 정확한 결합 | 종목·의도·ID·버전·내용 지문, 구성요소·근거 지문, 승인 유효기간을 확인한다. 선수가 고른 `CURRENT` 동일 종목 기록이 필요하며 목표 기록 대입·교차 종목 환산은 금지다. 안전 차단 또는 적격 근거 누락 시 상세 결합을 하지 않고 RPE 경로로 원자적으로 돌아간다. [승인 검증][approvals], [권한 해석][authority], [후보 결합][binding] |
| 승인과 과학 수용 분리 | 기존 4건은 오너의 한정 채택이다. 매니페스트의 `independentReviewClaimed`는 모두 `false`. 설명 프로필·근거 URL·영수증·파서 통과는 독립 스포츠과학 심사 서명이 아니다. [5km 결정][5k-approval], [중거리 결정][md-approval] |
| 과거 문서 해석 | [중거리 출처 패킷][md-source]의 활성 0건과 [청소년 정책][youth]의 V2 활성 금지는 당시 단계의 기록이다. 현재 활성 범위는 후속 정확한 채택 결정과 매니페스트로 판단한다. 과거 문서를 고치거나 남은 이슈를 닫은 것으로 읽지 않는다. |

## 2. 생성 역할·의도와 설명 범위

[세션 타입][session-types]의 역할은 **3종**, [생성기][builder]·[입력 파서][inputs]의 의도는 **7종**이다. 아래는 생성 가능한 코드 분기 목록이며, 모든 입력 조합이 안전·가용일·배치 관문을 통과한다는 실행 결과가 아니다. `MAIN`은 여기서 `QUALITY`의 주요 훈련을 뜻하며 별도 세션 역할 enum이 아니다.

| 생성 역할 / 저장 의도 | 현재 처방 표현 | 연결 프로필 | 상세 수치 MAIN 범위 |
|---|---|---|---|
| `REST` / `RECOVERY_INTENT` | `REST` | `REST` (`off`) | 없음. 운동·페이스 비적용 이유를 설명 |
| `EASY` / `RECOVERY_INTENT` | `RPE_TIME_RANGE` | `RECOVERY_INTENT` (`rec`) | 회복 움직임. AM/PM 보조 세션도 이 범주 |
| `EASY` / `BASE_INTENT` | `RPE_TIME_RANGE` | `BASE_INTENT` (`base`) | 없음. 기초 지속 운동 설명 |
| `QUALITY` / `LT_INTENT` | `RPE_TIME_RANGE` | `LT_INTENT` (`lt`) | 없음 |
| `QUALITY` / `VO2_INTENT` | RPE 또는 승인된 `PACE_TARGET` | `VO2_INTENT` (`vo2`) | 3000m·5000m 각 1개 |
| `QUALITY` / `GLY_INTENT` | RPE 또는 승인된 `PACE_TARGET` | `GLY_INTENT` (`gly`) | 800m 1개. 완전 회복을 일괄 단정하지 않음 |
| `QUALITY` / `ATP_PC_INTENT` | `RPE_TIME_RANGE` | `ATP_PC_INTENT` (`atp`) | 없음. 설명 존재가 새 스프린트 수치 처방을 허가하지 않음 |
| `QUALITY` / `MIXED_INTENT` | RPE 또는 승인된 `PACE_TARGET` | `MIXED_INTENT` (`mix`) | 1500m 1개. RPE에 구간·순서가 없으면 조합 목적을 추정하지 않음 |

[프로필][profiles]은 의도 7종 + `REST`·`WARMUP`·`COOLDOWN`·`TECHNICAL`·`STRENGTH`로 **12종**이다. 근거 레코드는 연구 7건·코칭 계약 2건이며 모두 `SOURCE_CHECKED_NOT_DOSE_APPROVAL`이다. 이는 파일의 메타데이터 확인이지 이번 보고서의 연구 원문 재검증 또는 사람의 수용 판정이 아니다. [용어·설명 계약 §10·§12][terms]의 `OI-TTE-SCIENCE-REVIEW-001`은 계속 `OPEN`이다.

## 3. 구성요소 대응

매니페스트의 필수 구성요소 종류는 **4종**, 네 템플릿의 결합 항목은 **16개**, 고유 `componentRef@version`은 **7개**다. 준비 중 점진 가속은 준비의 하위 구성요소이며 추가 MAIN 템플릿으로 세지 않는다. 모든 구성요소 버전은 `1.0.0`이다. [매니페스트][manifest], [기존 상세 화면][detail-view], [설명 조립][explanation-content]

| 구성 | 실제 저장·채택 내용 | 설명·시퀀스 대응 / 한계 |
|---|---|---|
| 준비 | `WU-V2-5K-01`, `WU-MD-01`: 쉬운 15분, RPE 2-3 | `WARMUP` 프로필. 상세는 저장 수치 표시; RPE QUALITY는 일반 준비 안내이며 개별 시간 미지정 |
| 준비 중 점진 가속 | 위 준비 내부의 20초 × 4회, 사이 40초 `WALK_OR_JOG` | `TECHNICAL` 프로필·별도 구성 행. 시퀀스 로컬 모드로 걷기/조깅 선택 범위를 보존. 본운동·별도 고강도 자극으로 중복 산입하지 않음 |
| 본운동·반복/세트 회복 | 표 1의 MAIN. 현재 네 채택본은 세트 사이 회복 비적용 | 의도 프로필 + 실제 처방의 거리·횟수·목표 반복 시간·회복 방식/발생 수. 마지막 추가 반복 휴식 없음. RPE QUALITY의 총 시간은 준비·본운동·회복·정리를 포함하므로 본운동 지속 시간으로 환산하지 않음 |
| 정리 | `CD-V2-5K-01`, `CD-MD-01`: 쉬운 10분, RPE 1-2 | `COOLDOWN` 프로필. 본운동 합계와 분리. 회복 완료·부상 예방 보장 아님 |
| 낮춤 | 공통 `RPE-ONLY-CONTROLLED-01` | 기존 상세 화면의 낮춤 규칙 및 원자적 RPE 폴백. 숫자 반복 축소 변형 승인 없음; 독립 설명 프로필 없음 |
| 중단 | `STOP-V2-5K-01`, `STOP-MD-01` | 새/악화 통증, 어지럼/실신 느낌, 가슴 통증/비정상 호흡, 통제된 자세 상실의 저장 코드 4종을 기존 상세 화면에 표시. 예방적 운영 규칙이며 진단·안전 해제 아님 |
| 별도 기술·근력 | 독립 `TECHNICAL`·`STRENGTH` PlanSession 역할/생성 분기 없음 | 기술은 준비 가속 설명에 사용. `STRENGTH`는 프로필 기반만 있으며 별도 근력 세션 노출·중량/반복 처방은 미구현 |

## 4. 신규 구현과 노출 상태

| 계층 / 현재 파일·기호 | 구현 확인 | 현재 노출·권한 한계 |
|---|---|---|
| [프로필][profiles] `TRAINING_EXPLANATION_PROFILES`, `EXPLANATION_SOURCES` | 목적·에너지 공급·운동/회복 이유·기대 변화/한계·관찰·대상/출처 범위를 버전 `1.0.0`으로 분리 | 일반 기전·코칭 의도. 실제 선택 이유나 선수별 수치를 독립 생성하지 않음 |
| [템플릿별 설명][template-explanations] | 현재 네 상세 처방의 ID·버전·내용 지문·종목·반복·거리·반복/세트 회복이 모두 일치할 때만 개별 구성 이유와 실제 채택 문서 연결 | 1500m MIX는 동일한 500m 세 번임을 명시. 채택 문서에 기록된 출처 범위와 운영 선택을 구분하며 새 수치량·템플릿을 활성화하지 않음 |
| [순수 설명 조립][explanation-content] `session-explanation-content.ts` / `buildSessionExplanationContent` | REST/RPE/PACE 분기, 실제 처방 수치와 선택 기록, 주기 목적·앞뒤 일정·연결 입력을 조립 | 일지 문맥의 존재를 수치량 계산 근거로 과장하지 않음. 화면과 영수증이 같은 조립 결과를 사용하며 이 함수는 영수증 일치 여부를 판정하지 않음 |
| [공개 설명 래퍼][explanation] `session-explanation.ts` / `explainSession` | 순수 조립 결과에 `originalExplanationAvailable`·`availability`를 더함 | 일치하는 후보 문맥 또는 저장 영수증으로 원래 설명 가용성을 판정. 세션/계획 불일치 또는 과거 영수증 부재·불일치 시 과거 선택 이유를 복원하지 않았다고 표시 |
| [설명 영수증][receipt] `createExplanationReceipt`, `hasMatchingExplanationReceipt` | 계획/세션 내용(상세 템플릿·근거 포함), 설명 버전, 생성 시각을 대조. `contentFingerprint`는 프로필·출처 카탈로그 지문뿐 아니라 공통 `CANDIDATE` 문맥으로 조립한 **세션별 설명 출력 전체**도 해시함 | 조립 문장 변경도 기존 영수증 불일치에 반영. 현재 장기 주기 순번은 별도 현재 연결 정보로 표시하며 과거 설명 일치 보장에서 제외한다. 사후 일지·과학·채택 승인도 봉인하지 않는다. [선택 저장][flow]·[후속 활성화][successor]에서 생성; [스키마][schema]는 없는/손상된 설명 메타데이터 때문에 유효 처방을 폐기하지 않음. 옛 설명 본문 아카이브가 아니라 일치 확인 장치 |
| [화면][ui] `SessionExplanationEntry` | 방법 / 이유·근거 / 주기·기록 탭, 전문 보기, 실제 상세 처방·근거·연결 RPE 기록 표시 | [후보 화면][candidate-ui]·[현재 계획][active-ui] → [일정 미리보기][preview]에 문맥 연결. [개별 상세][session-detail]의 문맥 없는 진입은 공통 설명/문맥 미확인 경로. 코드 연결 확인이며 공개 배포·실기기 QA 증거는 아님 |
| [시퀀스 코어][sequence] | 버전 1, 거리/시간 작업·중첩/순서·반복·명시적 회복·세 목표 종류, strict 파싱·미지 값 `null`·합계·MAIN 비교. `WALK_OR_JOG`는 시퀀스 로컬 확장 | 기술적 직렬화 한계만 적용. 수치 처방 작성·단위 추정·템플릿 채택·안전 관문 대체 없음 |
| [어댑터][adapter] `sessionPrescriptionSequence` | 기존 PACE의 준비/반복/정리를 구조로 투영. REST와 RPE는 `null` | 최종 통합에서 `SessionExplanation`이 실제 소비하며 [순서도 렌더러][structure-ui]가 동일 코어의 합계를 표시한다. RPE 총 시간 범위를 1회 작업·0초 회복 구조로 바꾸지 않는다. 저장 PlanSession에 일반 시퀀스 처방 종류가 추가된 것은 아님 |
| 시퀀스와 현재 화면의 관계 | `SessionExplanation`의 방법 탭에서 `PrescriptionStructure`가 작업·그룹·반복/세트 회복을 재귀 표시. REST/RPE에는 일반 구성 설명을 사용 | 거리와 시간을 억지로 환산하지 않고 미지 수행시간을 명시한다. 범용 시퀀스 편집·저장·실행과 새 시간/혼합 수치 MAIN 활성화는 별도 미완료 범위 |
| [일지 범위][session-evidence] | 불변 계획·세션 식별자로 일지를 조회하고, 열린 설명 창의 계획·회차·세션이 바뀌면 다시 조회한다 | 조회 불가와 조회 결과 0개를 구분한다. 현재 RPE 비교이며 반복별 실측 전체·주기 간 인과 추정 기능은 아님 |

## 5. 남은 수치 처방·방법 공백

| 항목 | 현재 사실 | 완료에 필요한 경계 |
|---|---|---|
| 같은 목적의 서로 다른 MAIN 2방법 | **승인된 쌍 0개**. 상세가 있는 네 종목·의도도 각 1개뿐이다. [후보 결합][binding]은 BALANCED/CONSERVATIVE 양쪽에 같은 처방을 넣고, [생성기][candidates]는 각 후보의 첫 QUALITY 하나만 `PACE_TARGET`으로 교체한다. 나머지 QUALITY는 RPE일 수 있다. | [계획 계약 §26][generator-spec]에 따라 정확한 두 번째 템플릿·적용성 채택과 검토된 쌍 설명이 필요. 지원 시간·이름·ID·횟수·준비운동 차이 또는 RPE/상세 표현 차이로 두 방법을 채우지 않음. 비교 함수의 `different`도 승인 아님 |
| 800m~마라톤 전체 조합 | 입력은 7종목·7의도이나 상세 승인된 `(종목, 의도)`는 표 1의 4조합뿐이다. 10km·하프·마라톤은 0개이며 현 상세 권한 파서도 800/1500/3000/5000만 받는다. | 입력 지원을 모든 종목·의도·경험·거리/시간 조합의 숫자량 승인으로 확대하지 않음. 특히 BASE/RECOVERY는 주요 고강도 MAIN과 구분. 종목·목적·경험·주기 역할별 정확한 출처/수치량/회복/구성요소·적격성 승인 후 허용 목록·권한 경로 확장이 필요 |
| 짧은 시간·거리 / 순서 있는 혼합 MAIN | [처방 계약 §12][contract]의 구현 방향은 승인되었지만 이 확장으로 활성화된 새 수치 템플릿은 0개 | 기존 준비 가속 중복, 빈도·양 자동 증가, 100~400m 전문 활성화 금지. 시퀀스 표현 가능성과 사용자에게 선택 가능한 상세 처방을 구분 |
| 수치의 과학적 해석 | 5km의 정확한 5회·150초·준비/정리와 중거리의 고정 횟수·현재 동일 종목 기준·STAND/WALK 선택은 원자료와 구분된 운영 채택이다. 원자료가 보편적/청소년별 최적 수치량을 입증하지 않는다. [5km 결정][5k-approval], [중거리 패킷][md-source] | 설명 근거는 기전/훈련 관찰/코칭 설계를 구분한다. 독립 과학 수용·효과 동등성·개인 생리 상태·의학적 안전을 선언하지 않음. 추가 위임 경로의 코칭/과학 양측 검토 스키마가 있다는 사실도 실제 서명 수령을 뜻하지 않음 |

이 보고서는 소스·JSON 항목·호출 연결의 읽기 전용 확인 결과다. 실행 테스트 수, 인간 심사 수용 수, 배포 완료 또는 이슈 종결을 새로 주장하지 않는다. 위 공백을 채우기 위한 임의 숫자·새 템플릿도 작성하지 않았다.

[manifest]: ../../app/src/domain/detailed-prescription-manifest.json
[approvals]: ../../app/src/domain/detailed-prescription-approvals.ts
[authority]: ../../app/src/domain/detailed-prescription-runtime-authority.ts
[5k-approval]: ../review/V2_SEED_05_OWNER_ADOPTION_DECISION_2026-08-17.md
[md-approval]: ../review/MIDDLE_DISTANCE_RUNTIME_ACTIVATION_DECISION_2026-08-17.md
[md-source]: ../review/MIDDLE_DISTANCE_SOURCE_ADOPTION_PACKET_2026-08-17.md
[youth]: ../review/PERSONALIZED_AUTO_PRESCRIPTION_YOUTH_TRAINING_DECISION_2026-08-17.md
[library]: ../../specs/active/TEMPLATE_LIBRARY_SPEC.md
[contract]: ../../specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md
[generator-spec]: ../../specs/active/PLAN_GENERATOR_SPEC.md
[terms]: ../../specs/reconstruct/TRAINING_TERMINOLOGY_AND_EXPLANATION_SPEC.md
[inputs]: ../../impl/src/plan-generator/input-values.ts
[session-types]: ../../impl/src/plan-generator/session-types.ts
[builder]: ../../impl/src/plan-generator/session-builder.ts
[candidates]: ../../impl/src/plan-generator/candidates.ts
[binding]: ../../app/src/domain/plan-candidate-prescription.ts
[profiles]: ../../app/src/domain/training-explanation-profiles.ts
[template-explanations]: ../../app/src/domain/training-template-explanations.ts
[session-evidence]: ../../app/src/domain/session-explanation-evidence.ts
[explanation-content]: ../../app/src/domain/session-explanation-content.ts
[explanation]: ../../app/src/domain/session-explanation.ts
[receipt]: ../../app/src/domain/training-explanation-receipt.ts
[flow]: ../../app/src/domain/plan-beta-flow.ts
[successor]: ../../app/src/domain/plan-successor-activation.ts
[schema]: ../../app/src/domain/plan-beta-schema.ts
[ui]: ../../app/src/screens/plan-beta/SessionExplanation.tsx
[detail-view]: ../../app/src/screens/plan-beta/DetailedPrescriptionView.tsx
[candidate-ui]: ../../app/src/screens/plan-beta/CandidateSection.tsx
[active-ui]: ../../app/src/screens/plan-beta/ActivePlan.tsx
[preview]: ../../app/src/screens/plan-beta/PlanSchedulePreview.tsx
[session-detail]: ../../app/src/screens/plan-beta/PlanSessionDetails.tsx
[sequence]: ../../impl/src/prescription/sequence.ts
[adapter]: ../../app/src/domain/session-prescription-sequence.ts
[structure-ui]: ../../app/src/screens/plan-beta/PrescriptionStructure.tsx
[integration-test]: ../../app/src/domain/session-explanation.contract.test.ts

[DRAFT_COMPLETE]
