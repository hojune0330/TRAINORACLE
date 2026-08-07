# D-05 — `status:` 통제 어휘 부재 조사

```yaml
packet: D-05
executor: DeepSeek
executed_at: "2026-08-06"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
files_examined: 56       # git ls-files 'specs/**/*.md' (전체 스코프) · 2폴더 40
findings_total: 3
owner_decision_required: 1
```

## 실행한 명령

```bash
cd /home/user/webapp
for f in $(git ls-files 'specs/**/*.md'); do
  s=$(grep -m1 -E '^status:' "$f" | sed 's/status: *//')
  printf '%s\t%s\n' "${s:-<없음>}" "$f"
done | sort > /tmp/d05_status.txt
wc -l /tmp/d05_status.txt                                     # → 56
cut -f1 /tmp/d05_status.txt | sort | uniq -c | sort -rn       # 값 종류 18 + <없음> 25
# 승인 플래그 교차표 (모순 탐지)
for f in $(git ls-files 'specs/**/*.md'); do
  st=$(grep -m1 '^status:' "$f" | sed 's/status: *//')
  cp=$(grep -m1 '^canonical_promotion_allowed:' "$f" | sed 's/.*: *//')
  ua=$(grep -m1 '^upload_allowed:' "$f" | sed 's/.*: *//')
  pe=$(grep -m1 '^production_execution_allowed:' "$f" | sed 's/.*: *//')
  printf '%s | %s | %s | %s | %s\n' "$(basename $f)" "${st:--}" "${cp:--}" "${ua:--}" "${pe:--}"
done > /tmp/d05_crosstab.txt
# 통제 어휘 정의 문서 프로브
grep -rn 'DRAFT_FOR_REVIEW\|READY_FOR_UPLOAD' --include='*.md' \
  AGENTS.md TRAINORACLE_SPEC_INDEX.md SPEC_DOCUMENTATION_REPORT.md SPEC_DOC_QUALITY_REPORT.md
```

## 결과

### 1. 값 사전 (전체 스코프: specs/ 추적 md 56건, status 보유 31 / 부재 25, 값 종류 18)

| status 값 | 문서 수 | 문서 목록 | 이 값의 뜻이 어디에 정의됐나 |
|---|---:|---|---|
| `<없음>` | 25 | active 3(·PHYSIO_SOURCE_TRUST_SPEC ·RVE_RULE_EVALUATOR_BINDING_SPEC ·TEMPLATE_LIBRARY_SPEC) · legacy-reference 7 · reconstruct 15(ADVISORY_SESSION_EXAMPLE_RECOMMENDER ·COMPOSITION_BALANCE_BASELINE ·DAILY_LOG_AND_CHECKIN ·DOUBLE_SESSION_BETA_SAFETY ·ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG ·EXTERNAL_RECORD_INTEGRATION ·FEDERATED_ACCOUNT_SSO ·FORMATION_LOAD_AND_STATISTICAL_RULES ·JOURNAL_DELIGHT_AND_DECORATION ·LOCAL_FIRST_SYNC_AND_PROMOTION ·PLAN_SAFETY_GATE ·RULE_VALIDATION_ENGINE ·TRAINING_PLAN_FORMATION_AND_ADAPTATION ·TRAINING_SESSION_PRESCRIPTION ·README) | AGENTS.md:76 ("표기 없음" 해석만, 값 정의는 아님) |
| DRAFT_FOR_REVIEW | 12 | active 3(APP_IMPLEMENTATION_BRIDGE ·ATHLETE_PROFILE_SPEC ·PLAN_GENERATOR_SPEC) · reconstruct 7(ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT ·DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC ·MEDIA_AND_TRANSIENT_CAPTURE_SPEC ·METRIC_ALGORITHM_CONTRACT ·MICROCYCLE_AND_CALENDAR_MAPPING_SPEC ·PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC ·RACE_RECORD_AND_HISTORICAL_RECALL_SPEC) · test-packages 2(FORMATION_RESEARCH_CALCULATION_FIXTURES ·QUICK_LOG_TAP_BUDGET_TEST_PACKAGE) | AGENTS.md:77 (해석: 코드 변경 불가 — 값 정의가 아닌 해석표) |
| READY_FOR_UPLOAD | 2 | active RULE_SPEC_D1_D9 · SESSION_CLASSIFIER_SPEC | AGENTS.md:76 (동작 파악용 해석) |
| QUALIFIED_REVIEW_PENDING | 2 | reconstruct FORMATION_RECORD_GOVERNANCE_CONTRACT · NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT | AGENTS.md:77 |
| ACTIVE_IMPLEMENTATION_CONTRACT | 1 | active SESSION_INTENSITY_ASSESSMENT_SPEC | AGENTS.md:75 (구현 준수 해석) |
| DRAFT_NON_RUNTIME_CONTRACT | 1 | reconstruct OBJECTIVE_FATIGUE_EVIDENCE_CONTRACT | AGENTS.md:77 |
| DRAFT_FOR_QUALIFIED_REVIEW | 1 | test-packages FORMATION_PRIVACY_GOVERNANCE_FIXTURES | 미발견 |
| OWNER_RESPONSES_RECORDED_PENDING_INDEPENDENT_REVIEW | 1 | test-packages FORMATION_COACH_RULESET_FIXTURES | 미발견 |
| READINESS_DRAFT_BLOCKED_ON_011_012 | 1 | reconstruct CALENDAR_VERSION_AND_SYNC_CONTRACT | 미발견 |
| READINESS_DRAFT_BLOCKED_ON_011_012_013_AND_NAMED_REVIEW | 1 | reconstruct ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL | 미발견 |
| READINESS_DRAFT_BLOCKED_ON_011_014_AND_FEEDBACK | 1 | reconstruct FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT | 미발견 |
| READINESS_ONLY | 1 | test-packages FORMATION_PROJECTION_ACCESSIBILITY_TEST_PACKAGE | 미발견 |
| READINESS_ONLY_BLOCKED_ON_011_012 | 1 | test-packages CALENDAR_SYNC_CONCURRENCY_FIXTURE_PLAN | 미발견 |
| READINESS_ONLY_BLOCKED_ON_GOVERNANCE | 1 | reconstruct HUMAN_REVIEW_AND_SHARING_WORKFLOW | 미발견 |
| READINESS_ONLY_BLOCKED_ON_ORDER_011 | 1 | reconstruct FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT | 미발견 |
| READY_FOR_LOCAL_TEST | 1 | test-packages D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE | 미발견 |
| REVIEW_CONTRACT_NO_KEYS_OR_APPROVALS_ENROLLED | 1 | reconstruct EVIDENCE_MANIFEST_AND_SIGNATURE_CONTRACT | 미발견 |
| SYNTHETIC_GATE_VERIFIER_EXECUTED_RUNTIME_TESTS_DESIGN_ONLY | 1 | test-packages FORMATION_RUNTIME_INTEGRATION_TEST_PACKAGE | 미발견 |
| SYNTHETIC_READINESS_ONLY | 1 | test-packages SHADOW_PROTOCOL_SCENARIO_PACKAGE | 미발견 |

> **정의 상태:** AGENTS.md:73~77은 값 **3종(ACTIVE_IMPLEMENTATION_CONTRACT, READY_FOR_UPLOAD/표기없음, DRAFT_FOR_REVIEW·DRAFT_NON_RUNTIME_CONTRACT·QUALIFIED_REVIEW_PENDING)의 해석(코드 변경 가능성)만** 제시한다. 나머지 **13개 값(READINESS_*·SYNTHETIC_*·REVIEW_CONTRACT_* 등)의 의미와 18종 전체를 정의하는 통제 어휘 문서는 미발견**이다.
> **AGENTS.md:76은 "<없음> = 동작 파악용"으로 해석**하지만 이는 해석표이지 값 정의가 아니며, legacy-reference 7건 등에 적용할지는 문서로 확정돼 있지 않다.

### 2. 2폴더 스코프 재현 (active 9 + reconstruct 31 = 40) — §3.3 대조

| 항목 | §3.3 v1.1 기준값 | 본 실측 | 일치? |
|---|---:|---:|---|
| status 값 종류 (2폴더) | 11 | 11 (READINESS_* 계열 5 · DRAFT_FOR_REVIEW · QUALIFIED_REVIEW_PENDING · ACTIVE_IMPLEMENTATION_CONTRACT · DRAFT_NON_RUNTIME_CONTRACT · READY_FOR_UPLOAD · REVIEW_CONTRACT_NO_KEYS_OR_APPROVALS_ENROLLED) | ✅ |
| status 없음 (2폴더) | 18 (active 3 + reconstruct 15) | 18 | ✅ |
| 전체 스코프 값 종류(D-05 전체) | 18 | 18 | ✅ |

### 3. 승인 관련 플래그 교차표 — 모순 0건

56건 전수 교차표(`canonical_promotion_allowed` / `upload_allowed` / `production_execution_allowed`):
- `status` 초안류(DRAFT_FOR_REVIEW·DRAFT_NON_RUNTIME_CONTRACT·QUALIFIED_REVIEW_PENDING·READINESS_*·SYNTHETIC_*) 중 **`canonical_promotion_allowed: true`인 문서 0건**
- `READY_FOR_UPLOAD` 2건(RULE_SPEC_D1_D9·SESSION_CLASSIFIER_SPEC)은 `upload_allowed: true` — **일치**
- 값이 있는 나머지 문서는 `canonical_promotion_allowed: false` · `upload_allowed: false` — **모순 없음**
- `production_execution_allowed` 값 보유 문서: **0건**(전부 —) — "승인됨"을 기계가 아는 채널은 status와 cp/ua 두 개뿐

**모순 후보 0건** (지시서 D-05가 찾으라는 🔴 "초안 + promotion true" 조합은 발견되지 않았다).

## 발견 요약

| # | 발견 | 근거 |
|---|---|---|
| 1 | **status 통제 어휘 정의 문서 미발견** — 18종 값 중 13종은 어디에도 의미 정의 없음, AGENTS.md:73는 5종 해석만 | AGENTS.md:73-77 · 전역 프로브 |
| 2 | **"승인됨"을 나타내는 단일 값이 없다** — status(READY_FOR_UPLOAD 등)와 cp/ua 플래그(교차표)가 분산, `production_execution_allowed`는 전수 — | 교차표 56건 |
| 3 | **모순 0건** — 초안+promotion 조합 미검출 (안전 측면 긍정 신호) | 교차표 |

## 조사하지 못한 것과 이유

1. **13개 미정의 값의 의도 파악** — READINESS_DRAFT_BLOCKED_ON_011_012 등이 "무엇에 막혔는지"는 각 문서 본문에서 유추 가능하지만, 유추는 판정이며 이 패킷의 목적은 "정의가 있는가"다. 정의 문서만 조사했다.
2. **status 없음 25건이 "미정"인지 "의도적 무표기"인지 판정** — AGENTS.md:76 해석만 존재. 폴더(legacy-reference 등)에 따라 의도가 다를 수 있으나 판정은 오너 몫.
3. **`canonical_promotion_allowed` 등 플래그가 실제로 코드/검증기에 소비되는지** — D-15/D-16(enum/숫자 spec vs code)과 D-18(강제 지점)에서 다룰 범위다.

---

## §14 오너 결정 요청 항목 (OD-REQ)

### OD-REQ-D05-001. `status:` 통제 어휘(18종)와 "승인됨" 판정 규칙을 문서화할 것인가

- **사실:** specs/ 추적 md 56건 중 status 보유 31건(값 18종)·부재 25건. 값 정의 문서 미발견(AGENTS.md:73~77은 5종 해석만). `production_execution_allowed` 보유 0건.
- **왜 내가 결정하지 않는가:** status 어휘는 "이 문서로 코드를 바꿔도 되는가"의 근거이며, 기계 검증이 소비할 입력이다. 어느 값을 "승인"으로 볼지는 사용자 안전(훈련 계획)에 직결되는 오너 정책 사항이다.
- **선택지 A:** 18종 값을 통제 어휘로 정의 문서(예: AGENTS.md §8 또는 별도 STATUS_VOCABULARY.md)에 열거하고 "승인" 판정 규칙(예: READY_FOR_UPLOAD + cp:true)을 명시 → 결과: 기계 검증(스키마 검사)이 가능해짐, legacy-reference 등 구분 필요
- **선택지 B:** 현행 유지(해석표만) → 결과: "승인됨" 여부는 사람 판독에만 의존, D-05 발견 2의 상태 지속
- **어느 문서를 함께 봐야 하나:** AGENTS.md:73-77 · TRAINORACLE_SPEC_INDEX.md · SPEC_DOCUMENTATION_REPORT.md · WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md §3.3 · .omo/evidence/statuses 관련 게이트 리뷰(있는 경우)
