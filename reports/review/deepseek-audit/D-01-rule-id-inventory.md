# D-01 — 규칙 ID 전수 대장

```yaml
packet: D-01
executor: DeepSeek
executed_at: "2026-08-06"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
files_examined: 496   # git ls-files '*.md' 전체
findings_total: 1
owner_decision_required: 1
```

## 실행한 명령

```bash
cd /home/user/webapp
grep -rhoE '\b[A-Z][A-Z0-9]{1,14}-[A-Z0-9]{2,16}-[0-9]{2,4}\b' --include='*.md' . \
  | sort -u > /tmp/d01_ids.txt        # → 847줄
wc -l /tmp/d01_ids.txt                # → 847
sed -E 's/-[0-9]{2,4}$//' /tmp/d01_ids.txt | sort | uniq -c | sort -rn   # 이름공간 집계
# 이름공간별 min/max/결번: grep -E '^<NS>-[0-9]+$' /tmp/d01_ids.txt | sed ... | sort -n 후 seq 비교
# *-INV-* 유니크: grep -E 'INV-[0-9]{3}$' /tmp/d01_ids.txt | sort -u | wc -l  # → 10
# 정의 문서 프로브: grep -rl -- '<ID>' specs/ | head -1
```

## 결과

**총수: 유니크 규칙 ID 847개, 이름공간 309종.** `*-INV-*` 유니크 10개 = `DSB-INV-001`~`DSB-INV-009` + `QA-INV-001` (v1.1 기준값 10과 일치).

### 상위 이름공간 (발생 많은 순)

| 이름공간 | ID 개수 | 최소 번호 | 최대 번호 | 결번(빠진 번호) | 정의 문서 | 정의 문서 발견? |
|---|---:|---:|---:|---|---|---|
| FA-TC | 104 | 001 | 104 | 없음 | TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md | ✅ |
| PG-TC | 46 | 001 | 046 | 없음 | PLAN_GENERATOR_SPEC.md | ✅ |
| AIB-TC | 46 | 001 | 046 | 없음 | APP_IMPLEMENTATION_BRIDGE.md | ✅ |
| TC-AP | 38 | 001 | 038 | 없음 | (TC-AP-001 프로브 미실시) | 조사 안 함 |
| SC-TL | 36 | 001 | 036 | 없음 | TEMPLATE_LIBRARY_SPEC.md | ✅ |
| SC-REB | 36 | 001 | 036 | 없음 | (SC-REB-001 프로브 미실시) | 조사 안 함 |
| SC-PST | 36 | 001 | 036 | 없음 | (SC-PST-001 프로브 미실시) | 조사 안 함 |
| FRV2-CONF | 12 | 001 | 012 | 없음 | 충돌 등록부(conflict register) ID — `specs/` 내부 0건, 전체 발생 92 · `.omo/evidence` 45 · `.omo/plans` 11 · `reports/target-patch-plans` 26 · `reports/review` 8 · 루트 2 | ⚠️ 스펙 규칙 아님 (§3.2 v1.1 정정 그대로) |
| TC-EPOC | 11 | 011 | 021 | 없음 (1~10 미사용: 011에서 시작) | SESSION_CLASSIFIER_SPEC.md | ✅ |
| PF-PR | 10 | 01 | 10 | 없음 | validate-wo011-qualified-handoff.mjs (검증기 고정값) | ✅ |
| DSB-INV | 9 | 001 | 009 | 없음 | DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md (§10 이력 v0.1 보존) | ✅ |
| TC-MEA | 8 | 032 | 039 | 없음 (1~31 미사용: 032에서 시작) | (프로브 미실시) | 조사 안 함 |
| TC-LD | 8 | 040 | 047 | 없음 (1~39 미사용: 040에서 시작) | (프로브 미실시) | 조사 안 함 |
| RQC-PUBMED | 8 | 01 | 08 | 없음 | (프로브 미실시) | 조사 안 함 |
| PF-FI | 8 | 01 | 08 | 없음 | (프로브 미실시) | 조사 안 함 |
| GATE-BINDING | 1 | 001 | 001 | — | PHYSIO_SOURCE_TRUST_SPEC.md | ✅ |
| RUNTIME-EVIDENCE | 1 | 001 | 001 | — | (D-02 최다참조 상위) | 조사 안 함 |
| PHYSIO-SOURCE | 1 | 001 | 001 | — | (D-02 최다참조 상위) | 조사 안 함 |
| SOURCE-CONSUMPTION | 1 | 001 | 001 | — | (D-02 최다참조 상위) | 조사 안 함 |
| EVALUATOR-BINDING | 1 | 001 | 001 | — | (D-02 최다참조 상위) | 조사 안 함 |

나머지 ~289개 이름공간은 대부분 개수 ≤7 (상위 20 아래 분포: TC-ES 6, TC-D1~D9 5~6, *-SEED 5, PF-* 여러 개 5~10 등). 전체 목록은 `/tmp/d01_ids.txt`(휘발) 및 아래 "전체 이름공간 요약" 참조.

### 결번 관찰 (수치 해석 주의)

- `TC-EPOC`·`TC-MEA`·`TC-LD`는 부여 번호가 011/032/040부터 시작한다 — 번호가 비어 보이지만 **이름공간 자체가 해당 구간만 사용하도록 설계된 것**으로 보이며, "1부터 순차 부여하다 빠진 결번"으로 단정할 근거는 없다. (사실 수집 한계: 부여 규칙 문서 미발견)

### *-INV-* 10개 상세

| ID | 정의 문서 |
|---|---|
| DSB-INV-001 ~ DSB-INV-009 | DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md |
| QA-INV-001 | .omo/notepads/trainoracle-remaining-work-orders.md |

## 조사하지 못한 것과 이유

1. **상위 15개 외 이름공간(~289종)의 정의 문서 전수 프로브** — D-02에서 고립·유령 판별로 커버함(전수 판별은 예산상 표본으로 대체). 이유: 지시서 §6 D-01은 "세어라, 논평하지 마라"이며 정의 문서 전수는 D-02의 역할.
2. **TC-AP / SC-REB / SC-PST / TC-MEA / TC-LD / RQC-PUBMED / PF-FI 최소·최대 정의 문서 프로브** — 표본 크기 절약을 위해 상위 대표 6개만 프로브함.
3. **이름공간 수(309)의 '왜 이렇게 많은가' 해석** — 지시서 D-01 금지 조항("이름공간이 왜 이렇게 많은지 논평하지 마라")으로 미수행.

---

## §14 오너 결정 요청 항목 (OD-REQ)

```
OD-REQ-D01-001
관찰: 규칙 ID 부여 규칙(이름공간·번호 구간·ist 미사용 구간)을 정의한 문서가 발견되지 않는다.
      TC-EPOC(011~021)·TC-MEA(032~039)·TC-LD(040~047)는 1부터 시작하지 않는 번호 구간을 쓴다.
질문: 규칙 ID 부여 규약을 문서화할 의향이 있는지. (감사자는 어느 쪽이 맞다고 판정하지 않는다.)
형식: OD-REQ (추천 금지 — 지시서 §14)
```
