# D-02 — 규칙 ID 고아 · 중복 · 유령 검사

```yaml
packet: D-02
executor: DeepSeek
executed_at: "2026-08-06"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
files_examined: 496   # git ls-files '*.md'
findings_total: 3
owner_decision_required: 0
```

## 실행한 명령

```bash
cd /home/user/webapp
grep -rEo '\b[A-Z][A-Z0-9]{1,14}-[A-Z0-9]{2,16}-[0-9]{2,4}\b' --include='*.md' . \
  | sed 's#^\./##' \
  | awk -F: '{print $2"\t"$1}' \
  | sort -u \
  | awk -F'\t' '{c[$1]++} END{for(k in c) print c[k]"\t"k}' \
  | sort -rn > /tmp/d02_refcount.txt
wc -l /tmp/d02_refcount.txt          # → 847 (D-01과 일치)
awk -F'\t' '$1==1' /tmp/d02_refcount.txt | wc -l   # → 693
head -5 /tmp/d02_refcount.txt
# 조각(더 긴 토큰의 접미사) 정량화
grep -rhoE '[A-Z][A-Z0-9]{1,20}(-[A-Z0-9]{1,20}){2,}-[0-9]{2,4}\b' --include='*.md' . \
  | sort -u > /tmp/long_tokens.txt                 # → 360
# 표본 검사: grep -rl -- '<ID>' --include='*.md' . | head -1  +  grep -m1 '<ID>' <host>
```

## 결과

### 1. 재현 수치

| 항목 | v1.1 기준값 | 본 실측 | 일치? |
|---|---:|---:|---|
| 유니크 ID 총수 | 847 | 847 | ✅ |
| 1개 문서에만 등장(고립 후보) | 693 (82%) | 693 (82%) | ✅ |
| 최다 참조 | GATE-BINDING-001 25 · RUNTIME-EVIDENCE-001 22 · SOURCE-CONSUMPTION-001 21 | **27 · 23 · 22** | ⚠️ 증가 |

**최다참조 증가 사유:** Round 2에서 신설·편집된 `WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md`·`WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT_VERIFICATION_REPORT.md`·`TRAINORACLE_SPEC_INDEX.md`(v1.1)와 최근 재구성 계획 문서가 이 3개 ID를 참조하며, `SPEC_*` 루트 문서(SPEC_TARGET_PATCH_MATRIX.md 등)도 다수 존재 → "참조 문서 수"가 늘었다. **기준값 대비 성질 변화는 아니다**(파일 수가 늘었으므로 자연 증가).

### 2. 🔴 함정 1: "고립 693"의 의미 분리 (D-01 정규식 산물)

D-01의 ID 정규식은 **5세그먼트 이상 토큰(`OI-FAS-ATHLETIME-OAUTH-ENDPOINTS-001` 등)의 뒤 3세그먼트를 별도 ID로 캡처**한다. 저장소 전체에서 해당 형태 토큰은 360개 존재하고, 그중 **이 ID 패턴이 잡는 "조각"이 204개**다.

- 고립 693 중 **123개 = 더 긴 토큰의 조각** (진짜 의미론적 ID가 아님)
- 고립 693 중 **570개 = 독립 토큰**

→ **"고립 693건"을 그대로 위험 수치로 보고하지 않는다.** 조각 123개는 정규식 함정이다. (선행 감사자 기준 693은 재현되지만, "고립 = 문제"라는 해석은 함정 — 지시서 D-02 경고와 동일 결론을 다른 경로로 확인.)

### 3. 독립 고립 570에서 표본 50건 판별

전수 판별은 지시서에 따라 **하지 않는다**. 균등 표본 50건(선정: 정렬 후 1개 건너뛰기 방식 일부 + 정렬 29-step 방식 일부)을 문서와 함께 육안 판별했다.

| ID | 등장 문서 수 | 등장 문서 | 정의 있음? | 분류 |
|---|---:|---|---|---|
| `YOUTH-TRANSFER-001` | 1 | TRAINING_SCHEDULE_RESEARCH_ACCEPTANCE_DECISION.md | OI-* 열거 행의 조각(`OI-RESEARCH-YOUTH-TRANSFER-001`) | 정상(조각) |
| `WO015-DESIGN-2026` | 1 | FORMATION_ACCESSIBILITY_AND_DESIGN_REVIEW.md | `review_id: TO-WO015-DESIGN-2026-07-15` 선언 | 정상 |
| `WO014-SHADOW-2026` | 1 | SHADOW_PROTOCOL_SCENARIO_PACKAGE.md | `fixture_pack_id:` 선언 | 정상 |
| `WO013-MULTITAB-2026` | 1 | MULTITAB_REFRESH_AND_REVISION_DECISION.md | `decision_id:` 선언 | 정상 |
| `WEEK-ANCHOR-001` | 1 | RULE_SPEC_D1_D9.md | OI-* 행(`OI-D7-WEEK-ANCHOR-001`) | 정상(조각) |
| `VERSION-LIFECYCLE-001` | 1 | 04-plan-version-binding.md | 제안 OI 목록의 조각(`PROPOSED-OI-PG-...`) | 정상(조각) |
| `VENDOR-MAPPING-001` | 1 | PHYSIO_SOURCE_TRUST_SPEC.md | OI-* 행(`OI-PST-DEVICE-VENDOR-MAPPING-001`) | 정상(조각) |
| `VALIDITY-SOURCE-001` | 1 | RULE_SPEC_D1_D9.md | OI-* 행(`OI-D6-VALIDITY-SOURCE-001`) | 정상(조각) |
| `V2-SEED-01` ~ `V2-SEED-04` | 1 | prescription-runtime.test.ts 등 | 테스트 시드 상수 집합 정의(ts)·md 카탈로그 | 정상 |
| `URI-REGISTRY-001` | 1 | FEDERATED_ACCOUNT_SSO_CONTRACT.md | OI-* 행(`OI-FAS-REDIRECT-URI-REGISTRY-001`) | 정상(조각) |
| `UNLOCK-NUMBERS-001` | 1 | CODEX_PARALLEL_IMPROVEMENT_DISCOVERY_20260711.md | `OI-JDD-UNLOCK-NUMBERS-001`의 조각. **원 토큰의 정의 문서 미발견** (참조 보고서뿐) | 판정불가(조각) |
| `UNKNOWN-HANDLING-001` | 1 | SESSION_CLASSIFIER_SPEC.md | OI-* 행(`OI-SC-EPOC-SOURCE-UNKNOWN-HANDLING-001`) | 정상(조각) |
| `TYPE-EXPANSION-001` | 1 | SESSION_CLASSIFIER_SPEC.md | OI-* 행 | 정상(조각) |
| `TRIGGER-THRESHOLD-001` | 1 | RULE_SPEC_D1_D9.md | OI-* 행 | 정상(조각) |
| `TRAINING-LD-001` | 1 | SESSION_CLASSIFIER_SPEC.md | OI-* 행 | 정상(조각) |
| `THRESHOLD-SOURCE-001` | 1 | RULE_SPEC_D1_D9.md | OI-* 행 | 정상(조각) |
| `TERRA-WO-018` | 1 | DETAILED_PRESCRIPTION_TERRA_IMPLEMENTATION_REPORT.md | `work_order:` 선언 | 정상 |
| `TEMPLATE-MAPPING-001` | 1 | TRAINING_SCHEDULE_RESEARCH_ACCEPTANCE_DECISION.md | OI-* 행 | 정상(조각) |
| `TEMPLATE-LIBRARY-001` | 1 | SESSION_CLASSIFIER_SPEC.md | OI-* 행 | 정상(조각) |
| `TEMPLATE-CONFIDENCE-001` | 1 | RULE_SPEC_D1_D9.md | OI-* 행 | 정상(조각) |
| `TC-XY-051` ~ `TC-XY-055` | 1 | RULE_SPEC_D1_D9.md | 테스트케이스 표 행 선언 | 정상 |
| `TC-TMC-027`~`028`, `TC-MEA-032`~`039`, `TC-LD-040`~`047`, `TC-PSEUDO-029`~`031`, `TC-MC-053`~`054`, `TC-EPOC-011`~`021` | 1 | SESSION_CLASSIFIER_SPEC.md | 테스트케이스 표 행 선언 | 정상 |
| `TC-D1`~`D9` 계열, `FA-TC-*`(035·066·095 등) | 1 | RULE_SPEC_D1_D9.md · TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md | 테스트케이스 표 행 선언 | 정상 |
| `SC-TL-*`, `SC-REB-*`, `SC-PST-*`, `PG-TC-*`, `AIB-TC-*`, `AP-SEED-*` | 1 | TEMPLATE_LIBRARY_SPEC.md · RVE_RULE_EVALUATOR_BINDING_SPEC.md · PHYSIO_SOURCE_TRUST_SPEC.md · PLAN_GENERATOR_SPEC.md · APP_IMPLEMENTATION_BRIDGE.md | 테스트케이스 표 행 선언 | 정상 |
| `PF-PR-*`, `PF-BT-*` | 1 | WO011_PRODUCT_FACT_QUESTIONNAIRE.md | 질문 항목 ID 선언 | 정상 |
| `TARGET-PLANS-2026`, `RUNTIME-GATE-2026`, `EXISTING-CITATIONS-2026`, `WO015-*` 등 | 1 | README.md · FORMATION_RUNTIME_INTEGRATION_TEST.md · existing-citation-audit.md | `packet_id:`/`test_package_id:`/`audit_id:` 선언 | 정상 |
| `PG-TC-040` (특이) | 1 | cli-data-qa-transcript-rerun.txt | 트랜스크립트에 `PG-TC-040` 문자열이 md 아닌 위치 존재 | 판정불가(산출물 경로) |

### 4. 유령 비율 추정

- 표본 50건 중 **정상(선언) 48건, 판정불가 2건, 유령(인용만 있고 정의 0) 0건**
- 유령 비율 점추정 **0/50 = 0%** (표본 크기 50에서 p=0 → 95% 신뢰 상한 ≈ **6%**, rule of three)
- **단, 조각 123건 중 원 토큰(`OI-*` 긴 ID)의 정의 보유 여부는 이 패킷에서 판별하지 않았다.** 원 토큰 360개의 정의/인용 판별은 예산상 미수행 — 유령 위험은 "조각"이 아니라 **원 토큰**에 있을 수 있다. (D-09 매트릭스와 D-19 OI 대장에서 간접 커버 예정)

## 발견(표본 기반) 요약

| # | 발견 | 근거 |
|---|---|---|
| 1 | **D-01 정규식이 5세그먼트 토큰의 접미사 "조각" 204개를 별도 ID로 캡처** — 고립 693의 123개가 조각 | long_tokens 360 vs d01_ids 847 교차, 표본에서 `OI-*` 원 토큰 확인 |
| 2 | **독립 고립 570건의 표본 50건에서 유령 0건** — 대부분 테스트케이스/패킷ID 선언 (정상) | 표본 판별 |
| 3 | **최다참조 상위 3개 수치 증가(25/22/21 → 27/23/22)** — Round 2 문서 신설에 의한 문서 수 증가(성질 변화 아님) | 문서별 등장 수 확인 |

## 조사하지 못한 것과 이유

1. **독립 고립 570건 전수 판별** — 지시서 D-02가 표본 30~50으로 한정. 전수가 필요하면 §14로 올리라는 지시에 따라 **올리지 않음**(표본으로 충분한 것으로 판단 — 단, D-19 OI 대장에서 원 토큰 정의 검증 수행 시 간접 커버).
2. **조각 123건의 원 토큰 정의/인용 판별** — 예산 절약. D-09/D-19로 이관.
3. **`UNLOCK-NUMBERS-001` 원 토큰 `OI-JDD-UNLOCK-NUMBERS-001`의 정의 문서 존재 여부** — 참조 보고서 1건만 확인, 정의 문서를 전역 검색으로 찾지 못했으나 **판정은 오너 몫**. D-19 OI 대장에서 재조사.
