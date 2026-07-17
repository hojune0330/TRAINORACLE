# Formation 보충 연구 최종 목표·제약 독립 검토 V3

## 최종 판정

**전체 패키지 판정: FAIL.**

연구 내용, 최신 책임자 방향, 보충 18개 후보의 격리, 런타임 비활성 경계, 실제 검증
결과는 모두 요구사항을 충족한다. 그러나 현재 “최종 준비 검증” 정본 역할을 하는
`.omo/evidence/formation-research-v2/task-09.md`와 마지막 실행 ledger 이벤트가 보충 작업
전 수치인 `23/23`, `10/10`, 결정 패킷 2개, 충돌 10개를 여전히 최종 상태로 기록한다.
실제 현재 상태는 `24/24`, `11/11`, 정본 패킷 2개 + 보충 패킷 1개, 충돌 12개다.
이 불일치는 열린 차단을 과소 보고하므로 “완전히 충족” PASS를 줄 수 없다.

층별 판정:

```yaml
research_content_and_constraints: PASS
supplemental_preparation: PASS
final_package_state_accounting: FAIL_STALE_CLOSURE_RECORD
scientific_acceptance: NOT_ACCEPTED_EXPECTED
canonical_patch_authority: false
runtime_activation_authority: false
```

## 요구사항별 판정

| 요구사항 | 판정 | 근거 |
|---|---|---|
| 최신 명시적 책임자 선택 우선 | **ACHIEVED** | `FORMATION_LATEST_OWNER_DECISION_BASELINE.md`가 `LATEST_EXPLICIT_OWNER_DECISION_GOVERNS`; validator는 `conflicts=12 latest_decision=governs runtime=false` |
| `9_5_DAY_FORMATION` 제품 정체성 | **ACHIEVED** | 최신 baseline, protocol, owner brief, technical annex에서 고정; 과학적 우월성·안전성과 분리 |
| `DEFAULT_AUTOMATED_PRESCRIPTION` | **ACHIEVED** | 최신 baseline과 보충 문서 모두 정확한 최신 target을 사용; protocol의 frozen historical target과 최신 target을 validator가 별도 출력 |
| 적격 입력에서 deterministic primary 1개 | **ACHIEVED** | baseline의 “기본 계획 1개”; annex의 `one deterministic primary plan`; 2-3은 계획 수가 아니라 MAIN exposure event 수로 명시 |
| 부적격이면 현재 코치 계획 유지 | **ACHIEVED** | `NO_AUTOMATED_PLAN -> KEEP_CURRENT_COACH_AUTHORED_PLAN`; 새 예외 계획·다른 주기·catch-up debt 금지 |
| 72시간은 clearance가 아님 | **ACHIEVED** | frame review, claim B-002, competition supplement/packet, teach-back U-09 모두 target/elapsed only; recovery/safety/readiness 허가 금지 |
| `PRIVATE_SELF_ONLY` zero-signal | **ACHIEVED** | 내용과 존재·길이·시각·빈도 등 metadata를 분석·계획·보상·telemetry·안전 신호에서 제외 |
| 사용자 백업·선택 공유 | **ACHIEVED** | `OWNER_FULL_LOCAL_BACKUP` 및 `USER_DIRECTED_FILE_OPERATION`; 분석 동의·상시 코치 접근과 분리; preview·수신자·필드·기간·철회 보존 |
| 경기 자기점검 향후 분석 방향 | **ACHIEVED** | `CURRENT_DISPLAY_ONLY_FUTURE_ANALYSIS_INTENDED`; 현재는 수집·표시 전용, 후속 provenance/결측/방법/불확실성/설명/owner gate 전 분석 금지 |
| 대회 다중 bout는 승인 전 후보 | **ACHIEVED** | baseline은 `MULTI_BOUT_RECORD_IDENTITY_UNRESOLVED`; supplement는 `CANDIDATE_SYNTHESIS_PENDING_HUMAN_REVIEW`; packet은 `NOT_REVIEWED`; canonical claim matrix 불변 |
| runtime 및 정본 구현 비활성 | **ACHIEVED** | `runtime_authority=false`; git status에서 app/impl/canonical active/reconstruct/root decision 변경 0건 |
| 정본 167과 보충 18 분리 | **ACHIEVED** | 정본 167, 보충 18, ID overlap 0, 보충 ID의 정본 claim 참조 0; DOI 중복 5건은 모두 `LIKELY_CANONICAL_DUPLICATE`로 격리 |
| 24 tests 직접 재현 | **ACHIEVED** | 지정 Node suite `24/24` PASS |
| 11 validators 직접 재현 | **ACHIEVED** | 준비/owner/supplemental/P1 validator `11/11` exit 0 |
| 인간 gate 정직성 | **ACHIEVED** | attestations 0, reviewers 0/6, 보충 human screening 0/18; accepted screening/extraction/appraisal 모두 exit 1 |
| 최종 상태 기록의 현재성 | **MISSED** | `task-09.md`와 마지막 ledger 이벤트가 23/23·10/10·패킷 2·충돌 10으로 보충 전 상태를 최종값처럼 기록 |

## 최신 선택 우선성 검토

과거 문구는 현재 규칙으로 우선되지 않는다. 검색된 `coach-only`, `coach final selection`,
`no automatic plan`, 메모 절대 export 금지는 다음 중 하나로만 나타난다.

1. `FORMATION_SPEC_CONFLICT_REGISTER.csv`의 `current_clause`로 등록된 과거 충돌.
2. 최신 gap/alignment review가 패치해야 할 과거 문구를 인용한 부분.
3. 과거 검토 스냅샷.

현재 방향 문서들은 모두 최신 결정을 사용한다.

- `reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md`
- `reports/review/FORMATION_LATEST_DECISION_AND_USER_GAP_AUDIT_V2.md`
- `reports/review/FORMATION_RESEARCH_OWNER_BRIEF_KO.md`
- `reports/review/FORMATION_RESEARCH_TECHNICAL_ANNEX.md`
- `reports/research/FORMATION_FRAME_RECOVERY_EVIDENCE_REVIEW_V2.md`
- `reports/research/FORMATION_COMPETITION_ANCHOR_EVIDENCE_SUPPLEMENT.md`
- `reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md`

다중 bout 권고도 최신 결정으로 위장하지 않는다. baseline의 정확한 문구는 다음과 같다.

> `MULTI_BOUT_RECORD_IDENTITY_UNRESOLVED`

packet의 정확한 상태는 다음과 같다.

```yaml
owner_decision: NOT_REVIEWED
sport_science_decision: NOT_REVIEWED
runtime_authority: false
```

따라서 앵커 1개 + bout N개 모델은 연구·사용자 시나리오 후보일 뿐 정본 counting rule이나
실행 권한이 아니다.

## 실행 검증

### 11 validators

실행 명령:

```powershell
node specs/test-packages/validate-formation-research-v2.mjs
node specs/test-packages/validate-formation-source-audit.mjs
node specs/test-packages/validate-formation-screening.mjs
node specs/test-packages/validate-formation-extraction.mjs
node specs/test-packages/validate-formation-appraisal.mjs
node specs/test-packages/validate-formation-synthesis.mjs
node specs/test-packages/validate-formation-decision-packets.mjs
node specs/test-packages/validate-latest-owner-decision.mjs
node specs/test-packages/validate-formation-final-review-preparation.mjs
node specs/test-packages/validate-formation-supplemental-evidence.mjs
node specs/test-packages/validate-formation-p1-target-plans.mjs
```

관찰 결과: **11/11 exit 0**.

```text
FORMATION_RESEARCH_V2_VALID rqs=7 owner_identity=9_5_DAY_FORMATION frozen_protocol_target=AUTOMATED_PRESCRIPTION latest_target=DEFAULT_AUTOMATED_PRESCRIPTION runtime=false
FORMATION_SOURCE_AUDIT_VALID sources=167 occurrences=75 rqs=7
FORMATION_SCREENING_PREPARED sources=167 excluded=2 deferred=2 pending_human=167
FORMATION_EXTRACTION_PREPARED sources=167 conflicts=2824 pending_rows=167
FORMATION_APPRAISAL_PREPARED sources=167 conflicts=208 pending_human=167
FORMATION_SYNTHESIS_PREPARED reports=5 claims=22 rqs=7 runtime=false
FORMATION_PACKETS_PREPARED load_fields=16 minimum_fields=17 competition_fields=14 collisions=0 decisions=NOT_REVIEWED runtime=false
FORMATION_OWNER_BASELINE_VALID conflicts=12 latest_decision=governs runtime=false
FORMATION_FINAL_PREPARED reviewers=0/6 manual=0/5 user_scenarios=0/12 user_improvements=15 runtime=false
FORMATION_SUPPLEMENTAL_PREPARED candidates=18 canonical_duplicates=5 human_screening=0 runtime=false
PASS: exactly 10 unique owner-approval-ready P1 target patch plans validated
```

### 24 tests

실행 명령:

```powershell
node --test specs/test-packages/formation-attestations.test.mjs specs/test-packages/formation-csv.test.mjs specs/test-packages/formation-research-integrity.test.mjs specs/test-packages/validate-formation-synthesis-boundaries.test.mjs specs/test-packages/validate-formation-p1-target-plans-newlines.test.mjs
```

관찰 결과: **24 tests, 24 pass, 0 fail**.

추가된 경계 테스트는 보충 후보가 인간 선별 완료를 가장하지 못하도록 검증한다. 기존
테스트는 서명 신뢰, 위조된 acceptance marker, conflict 삭제, cross-stage non-independence,
추출 재생성 결정성, strict CSV, abstract-only claim support, packet field ownership, CRLF를
검증한다.

### fail-closed acceptance

```text
screening accepted: exit 1, pending_human=167, deferred=2
extraction accepted: exit 1, pending_rows=167, pending_conflicts=2824
appraisal accepted: exit 1, pending_human=167, pending_conflicts=208
human attestations: 0
named reviewers: NOT_REVIEWED=6
```

### 정본·보충 분리

직접 CSV join 결과:

```text
CORPUS_SEPARATION canonical=167 supplemental=18 id_overlap=0 supplemental_claim_refs=0 labeled_duplicate_dois=5 actual_duplicate_dois=5
SUPPORTING_SOURCE_CHECK linked=34 prohibited=0
```

보충 후보의 공통 상태는 인간 중복 확인/선별 전이며 extraction/appraisal은 `PENDING`이다.
보충 search log는 다음을 고정한다.

```yaml
canonical_source_ledger_changed: false
canonical_claim_matrix_changed: false
runtime_authority: false
```

## 차단 이슈

### B1. 최종 준비 검증 파일이 보충 후 상태를 과소 보고한다

파일: `.omo/evidence/formation-research-v2/task-09.md`

현재 잘못된 문구:

```text
23/23 Node regression tests passed
10/10 prepared-state validators passed
manual_user_scenarios: 0/5
decision_packets: 2_NOT_REVIEWED
canonical_conflict_targets: 10
```

현재 실제 상태:

```text
24/24 Node regression tests passed
11/11 validators passed
manual_challenges: 0/5
teach_back_user_scenarios: 0/12
canonical_decision_packets: 2_NOT_REVIEWED
supplemental_decision_packets: 1_NOT_REVIEWED
canonical_conflict_targets: 12
supplemental_candidates: 18, human_screening=0
```

이 파일은 제목이 `Final Preparation Verification`이므로 단순 역사 스냅샷으로 보기 어렵다.
현재 실제 검증과 열린 gate를 반영해야 한다.

### B2. append-only 실행 ledger의 마지막 final 이벤트도 보충 전 상태다

파일: `.omo/start-work/ledger.jsonl`

현재 마지막 관련 이벤트의 정확한 문구:

```json
"event":"final-preparation-verification"
"node":"23/23 PASS"
"prepared_validators":"10/10 PASS"
```

보충 검색, Competition Anchor packet, 충돌 011/012, 12개 teach-back scenario, 24/11
재검증을 기록한 후속 append-only 이벤트가 없다. 기존 이벤트를 고치지 말고, 현재 수치와
새 산출물·열린 gate를 담은 새 verification 이벤트를 append해야 한다.

### B3. 과거 PASS 리뷰들이 현재 수치로 supersede됐다는 인덱스가 없다

다음 파일들은 생성 당시에는 유효했지만 현재 최종 수치보다 오래됐다.

- `.omo/evidence/formation-research-v2/final-goal-remediation-review-v2.md`: `23/23`, `conflicts=10`
- `.omo/evidence/formation-research-v2/final-qa-remediation-review-v2.md`: `23/23`, `10/10`
- `.omo/evidence/formation-research-v2/final-quality-remediation-review-v3.md`: `23/23`, `10/10`

이들은 내용 오류라기보다 시점이 지난 스냅샷이지만, 현재 final artifact를 찾는 독자가
오래된 PASS를 최신으로 오인할 수 있다. `task-09.md` 또는 별도 final index에서 현재 리뷰와
보충 후 검증을 명시적으로 최신 권위로 연결해야 한다.

## PASS 전환 조건

1. `task-09.md`를 24 tests, 11 validators, 정본 2 + 보충 1 packet, 충돌 12,
   manual 0/5 + teach-back 0/12, 보충 18/0 screened 상태로 갱신한다.
2. `.omo/start-work/ledger.jsonl`에 보충 후 final verification 이벤트를 append한다.
3. 현재 final index가 오래된 review snapshot을 supersede하도록 링크한다.
4. 11 validators, 24 tests, accepted-mode negative checks를 다시 실행한다.
5. 인간 선별·추출·평가·전문가·owner·사용자 gate는 계속 열린 채로 두고
   `runtime_authority=false`를 유지한다.

