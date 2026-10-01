# 조건-only 첫 MAIN 발견/수동 편집 진입: 독립 최종 리뷰

기준 HEAD: `872d841b651b9bb0efcb5cc205461b7c4a953f1b`, `codex/workout-choice-runtime-completion`의 이후 미커밋 diff. 최종 축소안: 순수 발견 helper → 공간 확인/상세 보기 CTA → 기존 CatalogWorkoutPicker의 실제 응답/명시 적용 → 기존 최종 Start. 새 직접 적용·저장된 조건 토큰·숫자 입력·자동 저장 정책은 없다.

증거 범위: 관련 7파일 정적 검토와 독립 로컬 검사. 앱/스펙은 수정하지 않았고 이 scratch의 리뷰/실행 증거만 작성했다. 네트워크/비밀정보/실제 계정/저장 계획에 접근하지 않았다.

## 최종 발견

**새 런타임 차단 결함은 발견하지 않았다.** 아래 검사 범위 내에서 최종 축소안의 경계가 유지된다. 초기 F01/F02는 수정된 코드와 독립 검사로 범위 내 해소를 확인했다. 전체 W1, 실제 저장 성공, 배포 또는 사용자 환경 안전 승인으로 확대하지 않는다.

후속 상태: 아래 당시 P2 검증 사각은 문서 끝의 `P2 후속 해결`에 기록한 추가 반례와 결함 주입 증거 검토로 해소됐다. 기존 날짜 결속 한계와 partial W1 판정은 유지한다.

- **[P2 / 검증 사각] B 상한 반례 두 개는 상한 비교문 자체를 단독 증명하지 않는다.** [catalog-condition-review.test.ts:41][cap-test]는 B의 QUALITY RPE 또는 duration만 바꾼다. 이 경우 A/B QUALITY 내용이 달라 [isInitialCandidatePair:61][pair-equality]에서 먼저 거절되며, helper도 [27행][helper-pair]에서 이 검사를 수행한다. 따라서 이 반례의 통과만으로 [44행][helper-cap]의 별도 RPE/시간 비교문을 검증했다고 표시하면 안 된다. 그 비교문의 제거에도 이름으로 실패하는 반례/대조군 또는 부모의 별도 결함 주입 증거가 필요하다. 독립 검수자는 소스 주입을 중복 실행하지 않았다.
- **기존 한계, 이번 변경의 신규 결함 아님:** 적용한 manual binding은 [inputs:11][binding-inputs]에 조건을 저장하지만 날짜를 저장하지 않는다. 이후 시작일 변경에 대한 재확인까지 이 helper가 보장하지 않는다. 요청의 날짜 재검사와 이미 적용한 조건의 날짜 결속은 다르다. 부모가 이 한계를 기록하고 새 저장 정책을 만들지 않는 최종 범위는 유지한다. 원래 요구했던 날짜별 동의 보장까지 필요하면 별도 좁은 수리가 남는다.

## 최종 diff에서 확인한 것

1. helper는 검증된 최초 후보 쌍의 미연결 QUALITY만 발견하며 조건은 정확히 `ACCELERATION_AND_DECELERATION_SPACE` 하나다. 가정 확인값은 함수 밖으로 반환하지 않는다. 개인 기록/숫자 override 없이 완전한 계산, BOTH 현재 RPE/준비·회복·정리 포함 시간 상한, hold/종목/경험/기존 교체 검증을 통과해야 한다.
2. 진입 요청에는 정확한 pair/day/AM·PM/catalog ID·fingerprint와 클릭 당시 시작일/계정 scope가 있다. [picker:58][request-check]는 소비 직전에 다시 대조하고 pending 편집/disabled 상태의 요청을 거절한다. 이것은 일회성 이동 문맥이며 조건 응답 권한이나 새 저장 필드가 아니다.
3. 정확한 entry로 기존 editor를 열되 공간 확인은 unchecked다. 열기/체크 자체로 후보 변경·최종 Start·저장을 호출하지 않는다. 사용자 실제 체크 후 기존 적용 버튼만 후보를 바꾼다. 원본 노출/다른 슬롯은 보존한다.
4. 적용 뒤 [intake/date/account 화면 문맥:163][no-cascade]으로 다음 질문을 억제한다. 단순 pair ID 갱신으로 다음 슬롯의 질문이 이어지지 않는다. 새로운 날짜/문맥에서 새 미연결 대상을 발견하는 것을 기존 답변 재사용과 혼동하지 않는다.
5. 질문을 건너뛰어 원래 계획을 시작할 수 있고, 미적용 초안은 적용/취소 전 Start를 막는다. 기존 수동 편집의 시간 확인 철회·구성 변경·취소 경계도 가까운 기존 회귀 검사로 확인했다.

## 독립 실행 결과

| 검사 | UTC | KST |
|---|---:|---:|
| catalog-condition-review.test.ts | 4/4 | 4/4 |
| CatalogConditionReview.contract.test.tsx | 10/10 | 10/10 |
| CatalogWorkoutPicker.contract.test.tsx | 11/11 | 11/11 |
| 합계 | 25/25 | 25/25 |

- 같은 25개를 두 시간대로 실행했다. 50개 고유 사례 또는 새 페르소나로 합산하지 않는다.
- 로컬 TypeScript `tsc --noEmit`: exit 0. `git diff --check`: exit 0(줄바꿈 경고만).
- [UTC JSON][utc-report], [KST JSON][kst-report]에 원본 실행 결과를 보존했다. 기존 설치된 도구만 사용했으며 의존성 설치/외부 통신은 하지 않았다.
- UI 검사는 실제 컴포넌트+합성 브라우저 환경이다. 최종 Start는 콜백 호출, 활성화 계산/스키마 검사까지이며 실제 기기/계정 저장 성공의 증거가 아니다.
- 부모의 실제 UI 런타임/결함 주입 작업을 중복하지 않았다. 전체 100명 재실행·전체 테스트·빌드·배포·운영 검사는 실행하지 않았다.

## 정책 판정

최종 방향을 전면 금지하는 조항은 찾지 못했다. [전체 연결 계약 §3:30][scope]은 원본 조건과 미충족 입력 안내를 요구하고 [§3.1:54][caps]는 기존 RPE/시간 상한과 적격 구성 없음의 원래 처방 보존을 요구한다. [W1:25][w1]의 확인값 발명/상한 자동 상향 금지와 충돌하지 않는다.

정확한 제한은 [UX §7:238-239][manual]의 ‘즉시 적격 구성만 추첨, 추가 입력 구성은 수동 목록에서 확인’이다. 발견을 자동 배정하지 않고 기존 수동 편집기로 보내는 최종안은 이 제한 안에 있다. requirement를 미리 체크하거나 helper 결과를 직접 적용하면 제한을 넘는다. [UX §0:49-50][explicit]의 자동 계획 확정 금지도 유지한다.

완료 주장은 **partial W1 supply bridge**만이다. LT/GLY 숫자 정책, 전체 목적/경험/종목의 첫 생성·저장본 일치, B06 catalog NEXT_FRAME, 운영/공개 확인은 남는다.

## 초기 finding 처리

- F01: 적용 후 다음 미연결 날짜의 질문이 자동으로 이어짐 → 화면 문맥 종료 상태와 applied-rerender 회귀로 범위 내 해소.
- F02: 오래된 진입 요청에 시작일/계정 범위 없음 → request fields와 소비 직전 검사, 날짜/계정/fingerprint stale 회귀로 범위 내 해소.

[cap-test]: <D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/catalog-condition-review.test.ts:41>
[pair-equality]: <D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/impl/src/plan-generator/support-only-candidate-pair.ts:61>
[helper-pair]: <D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/catalog-condition-review.ts:27>
[helper-cap]: <D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/catalog-condition-review.ts:44>
[binding-inputs]: <D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/impl/src/prescription/catalog-session-binding.ts:11>
[request-check]: <D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/CatalogWorkoutPicker.tsx:58>
[no-cascade]: <D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/PlanCandidates.tsx:163>
[scope]: <D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/specs/reconstruct/ALL_WORKOUT_CALCULATION_AND_BINDING_CONTRACT.md:30>
[caps]: <D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/specs/reconstruct/ALL_WORKOUT_CALCULATION_AND_BINDING_CONTRACT.md:54>
[w1]: <D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/WORK_ORDER_PERSONA_REVIEW_REMEDIATION_2026-09-30.md:25>
[manual]: <D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/docs/UX_UI_VISUAL_STANDARD.md:238>
[explicit]: <D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/docs/UX_UI_VISUAL_STANDARD.md:49>
[utc-report]: <D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/condition-detail-20261001/independent-focused-utc.json>
[kst-report]: <D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/condition-detail-20261001/independent-focused-kst.json>

## P2 후속 해결 (2026-10-01)

**판정: RESOLVED, 상한 반례의 선행 거절 사각에 한정.** 추가된 [정상 MATCHING A/B 반례:54](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/catalog-condition-review.test.ts:54>)와 [mutation-rpe.json](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/.scratch/condition-detail-20261001/mutation-rpe.json>)을 직접 읽었다.

- 새 RPE/시간 반례는 A/B 양쪽에 같은 상한을 적용하고, `candidates.every(isVerifiedPlanCandidate)`와 `isInitialCandidatePair(...candidates)`가 true임을 먼저 확인한 뒤 발견 결과의 null을 요구한다(61~64행). 이전처럼 불일치한 쌍의 선행 거절로 상한 검증을 대신하지 않는다.
- 기존 불일치-B 반례는 `rejects inconsistent A/B QUALITY ... envelopes`로 정확히 이름을 바꾸어 보존했다. 정상 쌍 상한 거절과 다른 경계를 검사한다.
- 부모의 메모리 내 RPE guard 제거 실행 JSON은 총 6개 중 5통과/1실패를 기록한다. 실패 이름은 `first-plan condition discovery rejects matching valid pairs whose rpe ceiling cannot fit any offered workout`이며 실패 위치는 64행의 null 단언이다. 두 유효성 단언이 아니라 금지되어야 할 비-null 발견 결과에서 실패했음을 확인했다. `P-ATP-T`가 반환됐다는 상세 구성명은 부모 보고이며 JSON 실패 메시지 자체는 객체를 축약 표시한다.
- 정상 domain 6/6은 부모의 실행 보고다. 본 후속 검수는 추가 소스와 mutation JSON의 근거 검토이며 별도 실행은 하지 않았다. 이전 독립 UTC/KST 각 25/25를 최신 27개 재실행이나 더 큰 고유 사례 수로 바꾸지 않는다.
- runtime 4파일(helper, PlanCandidates, CatalogWorkoutPicker, InstantPlanRecommendationView)의 SHA256은 이전 독립 검사 종료 시점과 모두 같음을 재확인했다. 추가 테스트가 들어간 것이며 처방·저장 권한을 확대한 변경은 아니다.

부모의 브라우저 3/3·스크린샷 및 precheck/pending/cascade 결함 주입 보고는 이번 후속 검수에서 다시 열거나 실행하지 않았다. 날짜 결속의 기존 한계, W1 수치 정책, B06 및 운영/공개 검증 경계는 그대로 유지한다. 이 제한된 리뷰의 미해소 actionable finding은 없다.
