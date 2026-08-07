# D-06 — 검증기 55개 전수 실행 대장 (F-1 대응)

```yaml
packet: D-06
executor: DeepSeek
executed_at: "2026-08-06"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
files_examined: 55       # specs/test-packages/*.mjs|*.sh 전체 + .github/workflows/ci.yml
findings_total: 4
owner_decision_required: 0
```

## 실행한 명령

```bash
cd /home/user/webapp
ls specs/test-packages/*.mjs specs/test-packages/*.sh | sed 's#.*/##' | sort > /tmp/all_v.txt
grep -oE '[a-z0-9._-]+\.(mjs|sh)' .github/workflows/ci.yml | sort -u > /tmp/ci_v.txt
echo "전체: $(wc -l < /tmp/all_v.txt)"                     # → 55
echo "ci.yml언급: $(wc -l < /tmp/ci_v.txt)"                # → 15 (오탐 포함)
echo "실존등록: $(comm -12 /tmp/ci_v.txt /tmp/all_v.txt | wc -l)"   # → 14
comm -23 /tmp/all_v.txt /tmp/ci_v.txt > /tmp/d06_orphan.txt        # → 41
comm -13 /tmp/all_v.txt /tmp/ci_v.txt                      # → github.sh (오탐/타위치)
git status --porcelain > /tmp/d06_git_before.txt           # 실행 전 스냅샷

# build-*/repair-* 쓰기 동작 검사 (실행 대신 첫 30줄 grep)
# 실행 대상 35종:
while read -r v; do
  f="specs/test-packages/$v"
  case "$v" in
    *.test.mjs) cmd="node --test $f" ;;
    *.mjs)      cmd="node $f" ;;
    *.sh)       cmd="bash $f" ;;
  esac
  out=$(timeout 60 $cmd 2>&1); rc=$?
  first=$(echo "$out" | head -1 | cut -c1-160)
  printf '%s\t%s\t%s\n' "$rc" "$v" "$first"
done < /tmp/d06_run.txt > /tmp/d06_result.txt
# 실행 후 정지 조건 검사
git status --porcelain | sort
```

## 결과

### 1. 재현 수치

| 항목 | v1.1 기준값 (F-1) | 본 실측 | 일치? |
|---|---:|---:|---|
| 검증기 전체 | 55 | 55 | ✅ |
| ci.yml 언급(오탐 포함) | 15 | 15 | ✅ |
| 실존 등록 | 14 | 14 | ✅ |
| 고아 | 41 | 41 | ✅ |
| ci.yml이 언급하지만 test-packages에 없음 | github.sh | github.sh | ✅ |

### 2. 고아 41종 실행 대장

- **실행 35종: 전부 종료코드 0 (통과)** — 방치된 검증기 중 "지금 실패 중"인 것은 0개.
- **실행보류 6종 (build-*/repair-*): 쓰기 동작 확인** — 아래 3절.

| 검증기 | CI 등록 | 종료코드 | 결과 | 출력 첫 줄 | 쓰기 동작 있음? |
|---|---|---:|---|---|---|
| formation-attestations.mjs | 아니오 | 0 | 통과 | (무출력) | 아니오 |
| formation-attestations.test.mjs | 아니오 | 0 | 통과 | TAP version 13 | 아니오 |
| formation-csv.mjs | 아니오 | 0 | 통과 | (무출력) | 아니오 |
| formation-csv.test.mjs | 아니오 | 0 | 통과 | TAP version 13 | 아니오 |
| formation-owner-direction-binding.test.mjs | 아니오 | 0 | 통과 | TAP version 13 | 아니오 |
| formation-research-integrity.test.mjs | 아니오 | 0 | 통과 | TAP version 13 | 아니오 |
| formation-spec-reconciliation.test.mjs | 아니오 | 0 | 통과 | TAP version 13 | 아니오 |
| validate-formation-appraisal.mjs | 아니오 | 0 | 통과 | FORMATION_APPRAISAL_PREPARED sources=167 conflicts=208 pending_human=167 | 아니오 |
| validate-formation-decision-packets.mjs | 아니오 | 0 | 통과 | FORMATION_PACKETS_PREPARED load_fields=16 … runtime=false | 아니오 |
| validate-formation-extraction.mjs | 아니오 | 0 | 통과 | FORMATION_EXTRACTION_PREPARED sources=167 conflicts=2824 pending_rows=167 | 아니오 |
| validate-formation-final-review-preparation.mjs | 아니오 | 0 | 통과 | FORMATION_FINAL_PREPARED reviews=5/5 … runtime=false | 아니오 |
| validate-formation-p1-target-plans-newlines.test.mjs | 아니오 | 0 | 통과 | TAP version 13 | 아니오 |
| validate-formation-research-v2.mjs | 아니오 | 0 | 통과 | FORMATION_RESEARCH_V2_VALID rqs=7 … | 아니오 |
| validate-formation-screening.mjs | 아니오 | 0 | 통과 | FORMATION_SCREENING_PREPARED sources=167 … | 아니오 |
| validate-formation-source-audit.mjs | 아니오 | 0 | 통과 | FORMATION_SOURCE_AUDIT_VALID sources=167 occurrences=75 rqs=7 | 아니오 |
| validate-formation-spec-reconciliation.mjs | 아니오 | 0 | 통과 | FORMATION_SPEC_RECONCILIATION_PREPARED **conflicts=12** … | 아니오 |
| validate-formation-supplemental-evidence.mjs | 아니오 | 0 | 통과 | FORMATION_SUPPLEMENTAL_PREPARED candidates=18 … | 아니오 |
| validate-formation-synthesis-boundaries.test.mjs | 아니오 | 0 | 통과 | TAP version 13 | 아니오 |
| validate-formation-synthesis.mjs | 아니오 | 0 | 통과 | FORMATION_SYNTHESIS_PREPARED reports=5 claims=22 rqs=7 | 아니오 |
| validate-latest-owner-decision.mjs | 아니오 | 0 | 통과 | FORMATION_OWNER_BASELINE_VALID **conflicts=12** latest_decision=governs runtime=false | 아니오 |
| validate-remaining-open-pr-reconciliation.mjs | 아니오 | 0 | 통과 | legacyPrCount=18 terminalDispositionCount=17 pendingRebuildCount=1 | 아니오 |
| validate-remaining-open-pr-reconciliation.test.mjs | 아니오 | 0 | 통과 | TAP version 13 | 아니오 |
| validate-shadow-protocol-readiness.sh | 아니오 | 0 | 통과 | PASS files=4 fixtures=37 unique=37 groups=SP:18,SH:10,HR:9 | 아니오 |
| validate-training-schedule-research-acceptance.mjs | 아니오 | 0 | 통과 | … passed: 60 public rows, 24 paper candidates, runtime authority remains disabled | 아니오 |
| validate-training-schedule-research-acceptance.test.mjs | 아니오 | 0 | 통과 | TAP version 13 | 아니오 |
| validate-wo011-qualified-handoff.mjs | 아니오 | 0 | 통과 | WO011 qualified handoff validation: PASS (product_fact_rows=49) | 아니오 |
| validate-wo012-coach-walkthrough.mjs | 아니오 | 0 | 통과 | WO012 coach owner-response validation passed: 30/30 rows … | 아니오 |
| validate-wo012-coach-walkthrough.test.mjs | 아니오 | 0 | 통과 | TAP version 13 | 아니오 |
| validate-wo012-spec-linkage.mjs | 아니오 | 0 | 통과 | WO012 spec linkage validation passed: 30/30 rows, runtime=false | 아니오 |
| validate-wo012-spec-linkage.test.mjs | 아니오 | 0 | 통과 | TAP version 13 | 아니오 |
| validate-wo013-target-binding.mjs | 아니오 | 0 | 통과 | WO013 target binding PASS fixtures=36 current=2 future=5 noTarget=29 | 아니오 |
| validate-wo014-participant-materials.mjs | 아니오 | 0 | 통과 | WO014 … 37/37 scenarios once, all pages watermarked … | 아니오 |
| validate-wo015-review-handoff.mjs | 아니오 | 0 | 통과 | WO015 review handoff validation passed: roles=5 approvals=0 renders=4 | 아니오 |
| validate-work-orders-012-016-readiness.sh | 아니오 | 0 | 통과 | PASS WO012 fixtures=30 unique=30 | 아니오 |
| wo016-gate-verifier.mjs | 아니오 | 0 | 통과 | (무출력) | 아니오 |
| build-existing-citation-fragments.mjs | 아니오 | — | 실행보류(쓰기) | — | ✅ writeFileSync 2회 → .omo/evidence/formation-research-v2/*.csv |
| build-formation-appraisal.mjs | 아니오 | — | 실행보류(쓰기) | — | ✅ writeFileSync → reports/research/evidence/FORMATION_APPRAISAL_LEDGER.csv |
| build-formation-extraction.mjs | 아니오 | — | 실행보류(쓰기) | — | ✅ writeFileSync → reports/research/evidence/FORMATION_EVIDENCE_EXTRACTION.csv |
| build-formation-screening-ledgers.mjs | 아니오 | — | 실행보류(쓰기) | — | ✅ writeFileSync 2회 → screening/source ledger 계열 |
| build-formation-source-ledgers.mjs | 아니오 | — | 실행보류(쓰기) | — | ✅ writeFileSync 3회 → FORMATION_SOURCE_LEDGER.csv · CITATION_AUDIT.csv · SEARCH_LOG.md |
| repair-formation-extraction-preparation.mjs | 아니오 | — | 실행보류(쓰기) | — | ✅ writeCsv(writeFileSync) → screening ledger 수정 |

### 3. build-*/repair-* 읽기 동작 요약 (첫 30줄 grep)

전부 읽기 소스는 `.omo/evidence/formation-research-v2/*.csv`·`reports/research/evidence/FORMATION_*.csv`를 소비하고, 쓰기 대상은 `reports/research/evidence/`와 `.omo/evidence/formation-research-v2/`다. **실행하면 추적/비추적 산출물 CSV를 덮어쓸 가능성이 있다** — 실행보류가 지시서 의도와 일치.

### 4. 🔴 정지 조건 확인 (지시서 §6 D-06)

실행 전/후 `git status --porcelain` 비교 → **변경 0건**. 신규 파일 5건(D-01~D-05 보고서)뿐이고 검증기 실행에 의한 수정·생성은 없다. `git checkout`으로 되돌리지 않음(필요 없었음).

## 발견 요약

| # | 발견 | 근거 |
|---|---|---|
| 1 | **방치된 검증기 41개 중 실행 가능 35개는 전부 통과(rc=0)** — "지금 실패하는 방치 검증기" 0개 | 실행 대장 rc 전부 0 |
| 2 | **F-2 재현: `validate-latest-owner-decision.mjs`가 `conflicts=12`를 보고** — CI에 등록돼 있지 않다 | 출력 첫 줄 conflicts=12 · ci 등록 아님 |
| 3 | **`conflicts=12`가 두 검증기에서 동시 보고** — validate-latest-owner-decision.mjs(CI 없음)와 validate-formation-spec-reconciliation.mjs(CI 없음) 둘 다 conflicts=12 | D-06 실행 출력 |
| 4 | **build-*/repair-* 6종은 전부 쓰기 동작 보유** — 실행보류(쓰기) 판정 | writeFileSync grep |

## 조사하지 못한 것과 이유

1. **build-*/repair-* 6종의 실제 실행(함수 동작 검증)** — 지시서가 명시적으로 "실행하지 마라"(쓰기 가능성). 첫 30줄 grep만 수행.
2. **"통과"로 나온 검증기가 실제로 무언가를 검증하는지(공허성)** — D-06의 범위는 "실행 대장"이며 D-07(공허성, 사본 결함 주입)이 전담한다.
3. **`conflicts=12`의 의미와 해상 필요 여부** — D-08(latest-owner-decision 6문항)에서 다룬다. 여기서는 존재만 기록.
4. **CI 등록 14개 검증기의 실행** — CI가 이미 실행하며 이 패킷 스코프는 "방치된 41개"다.

---

## §14 오너 결정 요청 항목 (OD-REQ)

이 패킷에서는 OD-REQ를 제출하지 않는다(owner_decision_required: 0). 단 발견 2·3(conflicts=12)은 D-08에서 OD-REQ 후보로 다룬다.
