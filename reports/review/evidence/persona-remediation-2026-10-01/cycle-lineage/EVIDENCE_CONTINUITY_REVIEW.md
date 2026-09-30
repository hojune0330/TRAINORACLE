# 현재 증거 연결 슬라이스 독립 코드 리뷰

- 기준: `codex/workout-choice-runtime-completion`, HEAD `bbbd36ade1ce2bcd2c0420607434a0c00ceeebc7`의 동시 작업 트리, 2026-10-01 KST.
- 범위: 요청한 5개 파일과 그 정확한 연결 판정기·호출부·관련 계약/테스트 소스만 정적 검토. B06 정책 탐색은 종료했다.
- 검증 경계: **이 리뷰는 테스트·브라우저 검증을 실행하지 않았고 제품 코드를 수정하지 않았다.** 환경·비밀·실사용자 기록·네트워크 접근 없음. 이 폴더의 보고서만 작성/정리했다.
- 부모 작업자가 전달한 focused tests 114개 및 component-browser 조합 6개 통과는 부모의 검증 결과이며, 독립 재실행·승인으로 주장하지 않는다.

## 상위 조치 1건

### [P2] 정확한 원본 연결이 있어도 실제 AM/PM 변경 기록을 상세에서 없는 일지로 표시

위치: [plan-method-observations.ts:137](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-method-observations.ts:137>), [session-explanation-evidence.ts:22](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/session-explanation-evidence.ts:22>), [SessionExplanation.tsx:208](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/SessionExplanation.tsx:208>).

반례는 원본 계획의 오전 세션에 정확히 연결된 일지를, 링크는 그대로 두고 오후에 `MODIFIED`로 수행한 경우다. 다른 미래 세션의 교체/재계획으로 후보 ID가 바뀌어도 해당 원본 세션이 영수증 계보 내내 동일하면 이번 복구 대상이다. 실제 슬롯 변경은 계획 링크 변조와 다르다. 기존 [JournalOriginalPlan.contract.test.tsx:85](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/journal/JournalOriginalPlan.contract.test.tsx:85>)도 전자는 원본 연결 성공, 계획 링크의 슬롯 변조는 실패로 구분한다. 여기서는 그 테스트를 읽었을 뿐 실행하지 않았다.

코드상 경로:

1. `collectPlanJournalEvidence`는 정확한 원본 연결을 통과한 이 기록을 버리지 않고 `CHANGED_SESSION`으로 보존한다. [plan-journal-evidence.ts:63](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-journal-evidence.ts:63>) 및 [동일 함수:97](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-journal-evidence.ts:97>).
2. 반면 방법 관찰 함수는 원본 연결을 성공적으로 복구한 뒤에도 실제 `activitySlot !== link.sessionSlot`이면 일지 전체를 제외한다. 현재 occurrence의 관찰은 `MISSING`으로 남는다. [plan-method-observations.ts:131](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-method-observations.ts:131>) 및 [동일 함수:148](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-method-observations.ts:148>).
3. 상세 증거는 비어 있지 않은 `rows`와 `MISSING` 방법 관찰을 함께 반환한다. UI는 방법 관찰을 먼저 렌더링하므로 [PlanMethodObservationDetails.tsx:5](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/PlanMethodObservationDetails.tsx:5>)의 “연결된 일지가 아직 없어요”가 나오고, 알려진 실제 기록과 변경 수행 비교 설명은 숨겨진다. 주기/Oracle의 연결 건수와도 모순된다.

이 슬롯 제외 조건 자체는 HEAD에도 있던 조건이다. **새 현재-세션 투영에서도 그대로 사용되어 남는 결함**이며, 이번 패치가 처음 만든 조건이라고 주장하지 않는다. 채택된 [증거 계약 §12:157](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/specs/reconstruct/PLAN_CYCLE_RESPONSE_AND_ADAPTATION_CONTRACT.md:157>)은 변경/부분 수행을 동일 처방 RPE 비교에서 제외하되 알려진 실제 사실을 버리지 않도록 한다.

좁은 권고: 원본 링크의 날짜·계획 슬롯·내용·영수증 검증은 그대로 유지하고, 실제 슬롯 차이만으로 방법 관찰의 연결 자체를 버리지 않는다. 알려진 명시적 실제 값과 `MODIFIED` 관계는 보존하되 `CHANGED_SESSION`으로 동일 처방 강도 비교를 제외한다. 실제 슬롯을 계획 슬롯으로 덮어쓰거나 숫자를 추정하지 않는다. 회귀 반례는 위 AM→PM 기록의 현재 직접 연결과 변경 전 원본 연결 두 가지이며, 상세/주기/Oracle이 연결 존재와 비교 제외에 동의해야 한다.

## 요청한 나머지 경계

- **잘못된 링크 수용:** 추가 상위 결함을 발견하지 않았다. V3은 날짜로 연결을 만들지 않고 정확한 B03 원본 판정을 먼저 수행하며, 이후에만 동일 occurrence를 묶는다. [plan-journal-evidence.ts:95](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-journal-evidence.ts:95>), [execution-replan-source.ts:54](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/execution-replan-source.ts:54>).
- **A→B→A ID 재등장:** 현재 직접 연결의 활성화 시각 조건과 중간 세션 불변 검사로 옛 링크를 제외한다. [execution-replan-source.ts:37](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/execution-replan-source.ts:37>) 및 [동일 파일:60](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/execution-replan-source.ts:60>). 기존 [왕복 ID 테스트:47](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/execution-replan-lineage.test.ts:47>)의 소스도 이를 명시한다. 이번 리뷰가 런타임 통과를 재증명한 것은 아니다.
- **버전 간 중복:** 정확히 해결된 동일 날짜/day/계획 슬롯 그룹에 대해 서로 다른 일지 ID 또는 충돌 복사본을 한 충돌 occurrence로 처리한다. 동일 사본만 한 번 집계하는 코드 경로에 추가 상위 결함을 발견하지 않았다. [plan-journal-evidence.ts:106](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-journal-evidence.ts:106>) 및 [동일 파일:116](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-journal-evidence.ts:116>).
- **읽기 불가와 미기록:** `unavailable` 변경 이력은 직접 검증 가능한 기록을 남기면서 별도 불완전 상태를 전달하고, 상세/Oracle이 “없음” 대신 확인 불가를 설명한다. [plan-journal-evidence.ts:82](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-journal-evidence.ts:82>), [SessionExplanation.tsx:205](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/SessionExplanation.tsx:205>), [oracle-personal-result.ts:284](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/oracle-personal-result.ts:284>).
- **개인정보:** 검토한 연결·중복·실제 수치 투영은 허용된 구조화 필드만 읽는다. 원문 메모·제목·메모 존재 여부를 새 비교 지문으로 넣는 경로는 발견하지 않았다. [plan-journal-evidence.ts:46](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-journal-evidence.ts:46>), [plan-method-observations.ts:40](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-method-observations.ts:40>). 실사용자 자료는 확인하지 않았다.

## 잔여 위험과 종료 경계

- 읽기는 성공했지만 정확한 원본이 없는 legacy 요약은 `loaded`와 `missingOriginals`로 반환된다. [plan-beta-store.ts:560](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/domain/plan-beta-store.ts:560>). 이는 읽기 실패와 다른 상태이며 원본을 추정해서는 안 된다. 그 요약만 남은 실제 호출 경로의 화면 표현은 이번 정적 리뷰에서 실행 검증하지 않았다.
- 링크 활성화 시각은 ID 재등장 방어의 일부다. 동일 시각 링크의 보수적 제외와 시각 정합성은 기존 불변 링크 경계를 전제로 읽었다. 부모 테스트 통과를 저장 경계 전체의 신규 보안 승인으로 확장하지 않는다.
- 최초 일지 진입의 실제 기록 영역 스크롤은 [SessionExplanation.tsx:98](<D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921/app/src/screens/plan-beta/SessionExplanation.tsx:98>)에 추가된 것을 확인했다. 기존 탭별 스크롤 복원과 분리되어 있다. 브라우저 도달성/레이아웃 성공 여부는 부모 검증에 남겨 둔다.
- 이것은 요청한 증거 슬라이스의 좁은 리뷰다. B06 완료, 새 catalog successor 권한, W1 수치, 과학·효능, 배포·사용자 전달을 승인하지 않는다.
