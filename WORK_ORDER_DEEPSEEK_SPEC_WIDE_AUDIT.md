# WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT — 저장소 전역 스펙 문서 감사 지시서 (읽기 전용)

```yaml
doc_id: TRAINORACLE_WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT
title: "딥시크 전역 스펙 감사 작업지시서 — 전수 조사 · 읽기 전용 · 판정 금지"
version: "1.0"
issued_at: "2026-08-06"
issued_by: "Claude (선행 감사자)"
executor: "DeepSeek"
status: DRAFT_FOR_EXECUTION
mode: READ_ONLY_AUDIT
write_scope: "reports/review/deepseek-audit/ 아래에만 새 파일 생성"
forbidden_scope: "specs/ · app/ · impl/ · runtime-evidence/ · .github/ 전부 수정 금지"
governing_docs:
  - AGENTS.md
  - PRODUCT_NORTH_STAR.md
  - TRAINORACLE_SPEC_INDEX.md
  - OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md
task_packets_total: 24
owner_decision_required_items: "딥시크가 만들지 않는다. 표시만 하고 §14로 올린다."
machine_validated: false
```

---

## §0. 이 지시서를 30초 안에 이해하는 법

**너(딥시크)가 하는 일:** 이 저장소의 문서 493건과 검증기 55개를 **전수로 훑어서 사실 대장을 만든다.**

**너가 하지 않는 일 (하나라도 하면 실패):**

1. **스펙 문서를 고치지 않는다.** 한 글자도.
2. **코드를 고치지 않는다.** `app/`, `impl/`, `runtime-evidence/` 전부.
3. **커밋하지 않는다. push하지 않는다. 브랜치를 만들지 않는다.**
4. **"괜찮아 보인다"고 판정하지 않는다.** 너는 사실을 수집하고, 판정은 오너가 한다.
5. **선행 감사자가 이미 공증한 것을 재판정하지 않는다.** (§2 목록)

**너의 산출물:** `reports/review/deepseek-audit/` 아래의 **보고서 마크다운 파일들.** 그게 전부다.

**왜 너에게 시키는가:** 이 일은 **넓지만 얕다.** grep 수천 번, 파일 수백 개 확인. 깊은 판단이 아니라 **빠짐 없는 전수**가 핵심이다. 너의 강점이 여기다.

---

## §1. 🔴 가장 중요한 규칙 — 근거 없는 문장 금지

**모든 주장에 `파일경로:행번호`를 붙인다. 예외 없다.**

| ✗ 쓰면 안 되는 문장 | ✓ 이렇게 쓴다 |
|---|---|
| "대체로 일관성이 있다" | "조사 45건 중 41건 일치, 4건 불일치 (목록 아래)" |
| "문제가 없어 보인다" | "이 항목에서 불일치 0건 검출. 검사 명령: `grep -c ...`" |
| "아마 의도된 것 같다" | "의도 여부 판단 불가. 근거 문서 미발견. §14로 올림" |
| "RPE 값이 다르다" | "`session-builder.ts:78` RPE 3-4 vs `PLAN_GENERATOR_SPEC.md:412` RPE 4-5 → 불일치" |

**모르면 "모른다"고 쓴다.** 추측을 사실처럼 쓰는 것이 이 프로젝트에서 가장 큰 죄다. 빈칸으로 남기고 `조사 불가 — 이유:` 를 적어라.

**"검출 0건"과 "조사 안 함"을 반드시 구분해서 표기한다.** 이 둘을 섞으면 보고서 전체가 무가치해진다.

---

## §2. 🔴 재판정 금지 목록 — 선행 감사자가 이미 실측·공증한 사실

아래는 선행 감사자(Claude)가 **코드를 직접 실행해서 측정**하고 오너에게 보고한 확정 사실이다.
**너는 이것을 다시 판정하지 않는다. 인용만 한다.** 만약 너의 조사가 이와 충돌하는 것처럼 보이면, **네 조사가 틀렸을 가능성을 먼저 의심하고, §14 정지 절차로 올려라. 스스로 수정하지 마라.**

| # | 공증된 사실 | 근거 위치 |
|---|---|---|
| C-1 | `DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md`는 **v0.2**다. v0.1의 `DSB-INV-002`(PM은 회복 전용)와 `DSB-INV-003`(같은 날 quality 짝 금지)은 **은퇴하고 새 규칙으로 교체됐다.** | 해당 스펙 §4, §10 |
| C-2 | 은퇴 원문은 **삭제되지 않고** 그 스펙 **§10 변경 이력에 그대로 보존**돼 있다. 과거 문서의 인용을 해석할 때 여기를 본다. | 해당 스펙 §10 |
| C-3 | `DSB-INV-009`(특별한 날 공개·수정 의무)는 **신설**됐고, 오너 결정 **OD-SLOT-8**에서 나왔다. | `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` §4.10 |
| C-4 | `DSB-INV-009`의 조건은 **현재 구현에서 충족돼 있지 않다.** 수정 화면 없음, `movePlanSession` 0건. 그래서 같은 날 quality 2회는 도달 불가로 남겨야 한다. | 같은 문서 §4.10.1 |
| C-5 | `DSB-INV-005`(회복 세션 프레임 상한 2회)는 **은퇴하지 않았다.** 여전히 유효하다. OD-SLOT-8은 "하루에 몇 회"의 축이고, DSB-INV-005는 "10일 프레임에 몇 건"의 **다른 축**이다. | 해당 스펙 §4, 결정 문서 §3.3 |
| C-6 | 짝(counterpart) 세션은 `RECOVERY_INTENT`다 (`WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md:208`). 따라서 **DSB-INV-005 상한을 공유한다.** "짝 세션은 상한 밖"이라는 과거 주장은 **오류로 철회됐다.** | C3A `:217` 철회 블록 |
| C-7 | 실측 결과 **420개 조합 중 300개(71%)가 상한 2를 초과**한다. 고강도 1일 → 회복 PM 3회, 고강도 2일 → 4회. | `WORK_ORDER_SLOT_INTENSITY_FULL_RUN.md` §3.1 |
| C-8 | 부하 증가 최악 케이스는 **"매일"이 아니라 "가능일수 4일"**이다. DEVELOPING 4일 = 220분→270분(+23%). EVERY_DAY는 +5~10%. | 같은 §3.1 |
| C-9 | **`DSB-INV-*` 규칙은 어떤 CI 잡도 검증하지 않는다.** 기계 검증 0건. 문서와 코드가 갈라져도 아무 알람이 울리지 않는다. | 해당 스펙 §0, `AGENTS.md` §7 |
| C-10 | `app/src/screens/plan-beta/labels.ts:166-190`은 **이미 올바르다**(role+intent에서 파생). **손대면 안 되는 파일**로 확정됐다. | 같은 스펙 §6 |
| C-11 | 상위 스펙은 이미 DOUBLE/FULL_DAY를 허용한다. `PLAN_GENERATOR_SPEC.md:752-756`, `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md:411`. 베타 계약을 푸는 방향은 상위 스펙 쪽으로 **되돌아가는** 방향이다. | 해당 스펙 §9 |
| C-12 | `DOCUMENT_MAP.md`는 SHA `7d9958a` 기준 **기계 생성 스냅샷**이다. 손으로 고치면 안 된다. 문서 3~5행에 명시돼 있다. | `DOCUMENT_MAP.md:3-9` |

---

## §3. 🔴 선행 감사자가 실측한 "이번 감사의 출발점" — 이 숫자에서 시작하라

아래는 이 지시서를 쓰기 위해 **방금 측정한 값**이다. 너의 첫 임무는 **이 숫자를 재현하는 것**이고, 재현되지 않으면 즉시 §14로 올려라 (저장소가 그 사이 바뀌었다는 뜻).

```bash
cd /home/user/webapp
git ls-files '*.md' | wc -l                                    # → 493
git ls-files 'specs/reconstruct/*.md' | wc -l                  # → 31
git ls-files 'specs/active/*.md' | wc -l                       # → 9
git ls-files 'specs/legacy-reference/*.md' | wc -l             # → 7
git ls-files 'reports/**/*.md' | wc -l                         # → 131
ls specs/test-packages/*.mjs specs/test-packages/*.sh | wc -l  # → 55
grep -rhoE '\bOI-[A-Z0-9-]{4,40}\b' --include='*.md' . | sort -u | wc -l   # → 224
```

### 3.1 이번 사전 조사에서 이미 드러난 중대 발견 3건 — 너의 최우선 조사 대상

| ID | 발견 | 측정값 | 너가 할 일 |
|---|---|---|---|
| **F-1** | **검증기 55개 중 CI가 부르는 것은 14개뿐. 41개가 고아다.** | 55 − 14 = 41 | D-06, D-07, D-08 |

> ⚠️ **F-1 집계 주의 — 선행 감사자가 실제로 빠진 오탐이다.** `.github/workflows/ci.yml`에서 `.mjs\|.sh` 파일명을 grep하면 **15개**가 나오지만, 그중 `github.sh` 는 `specs/test-packages/` 파일이 아니다(CI 자체 스크립트). 따라서 **실제 등록 검증기는 14개**다. 너도 같은 오탐을 밟을 것이므로, 반드시 `comm -12` 로 **실존 교집합**을 세라:
> ```bash
> comm -12 /tmp/ci_v.txt /tmp/all_v.txt | wc -l   # → 14 (실존 교집합)
> comm -23 /tmp/all_v.txt /tmp/ci_v.txt | wc -l   # → 41 (고아)
> ```
| **F-2** | **고아 검증기 중 `validate-latest-owner-decision.mjs`가 존재하고, 실행하면 통과하며 `conflicts=12`를 보고한다. 오너 결정 우선순위를 지키는 검증기가 CI에 없다.** | `FORMATION_OWNER_BASELINE_VALID conflicts=12 latest_decision=governs runtime=false` | D-08 (최우선) |
| **F-3** | **문서가 백틱으로 참조하는 유니크 경로 795개 중 112개(14%)가 저장소에서 해석되지 않는다.** | 795 / 112 | D-03 |
| **F-4** | **유니크 규칙 ID 847개 중 693개(82%)가 단 1개 문서에만 등장한다.** 대부분 정상(테스트케이스 ID)이지만, 그중 "정의 없이 인용만 되는 유령 ID"가 몇 건인지 아무도 모른다. | 847 / 693 | D-02 |

추가 기준값 (D-01·D-02 재현용):

```bash
# 유니크 규칙 ID 총수
grep -rhoE '\b[A-Z][A-Z0-9]{1,14}-[A-Z0-9]{2,16}-[0-9]{2,4}\b' --include='*.md' . \
  | sort -u | wc -l                                            # → 847
# 유니크 *-INV-* ID 총수 (DSB-INV 참조 57건과 혼동하지 마라 — T-18)
grep -rhoE '\b[A-Z][A-Z0-9]{1,14}-INV-[0-9]{3}\b' --include='*.md' . \
  | sort -u | wc -l                                            # → 10
```

### 3.2 규칙 ID 이름공간 실측 (specs/ 내부, 상위 15개)

```
FA-TC      104      DSB-INV     57      FRV2-CONF   55
PG-TC       46      AIB-TC      46      TC-AP       38
SC-TL       36      SC-REB      36      SC-PST      36
GATE-BINDING 16     RUNTIME-EVIDENCE 14 PHYSIO-SOURCE 13
SOURCE-CONSUMPTION 12  TC-EPOC  11      EVALUATOR-BINDING 10
```

### 3.3 문서 metadata 실측 — 스키마가 이원화돼 있다

```
status: 22개 문서      spec_id: 19개      version: 18개
document_metadata: 17  owner: 15          canonical_promotion_allowed: 13
doc_id: 12
```

**`spec_id`(19) 와 `doc_id`(12) 가 공존한다. 어느 쪽이 정본 규약인지 문서화돼 있지 않다.** → D-04

**`status` 값이 19종이고, 18개 문서는 status가 아예 없다.** 통제 어휘(controlled vocabulary)가 없다. → D-05

---

## §4. 토큰 절약 규율 — 반드시 이 방식으로 읽어라

너는 저렴하지만 **무한하지 않다.** 아래를 지키면 같은 예산으로 5~10배 더 많이 조사할 수 있다.

### 4.1 파일 전체를 읽지 마라

```bash
# ✗ 금지 — 500줄 문서를 통째로 읽는다
cat specs/active/PLAN_GENERATOR_SPEC.md

# ✓ 필수 — 먼저 grep으로 위치를 찾고, 그 주변만 창으로 읽는다
grep -n 'SessionSlot' specs/active/PLAN_GENERATOR_SPEC.md
sed -n '745,765p' specs/active/PLAN_GENERATOR_SPEC.md
```

### 4.2 집계는 셸이 하게 하고, 너는 결과만 본다

```bash
# ✗ 금지 — 파일 목록을 다 출력해서 눈으로 센다
grep -rn 'RPE' --include='*.md' specs/

# ✓ 필수 — 세고, 분류하고, 상위만 본다
grep -rhoE 'RPE ?[0-9]+([-~][0-9]+)?' --include='*.md' specs/ | sort | uniq -c | sort -rn
```

### 4.3 중간 결과를 파일에 적어라, 문맥에 담아두지 마라

```bash
grep -rn 'DSB-INV' --include='*.md' . > /tmp/dsb.txt
wc -l /tmp/dsb.txt          # 규모만 확인
head -5 /tmp/dsb.txt        # 형태만 확인
# 이후 분석은 /tmp/dsb.txt 를 셸로 가공한다
```

### 4.4 한 패킷을 끝내면 즉시 보고서 파일에 쓰고, 그 내용을 문맥에서 버려라

각 패킷의 산출물은 독립 파일이다. 다음 패킷은 이전 패킷의 본문을 몰라도 된다. **패킷 간 문맥 이월 금지.**

### 4.5 🔴 N번 grep 대신 1번 grep + awk 집계

**이건 토큰이 아니라 시간 문제이며, 선행 감사자가 실측했다.**

```bash
# ✗ 순진한 방법 — ID 847개 × 전체 grep = 약 87초
while read -r id; do grep -rl "$id" --include='*.md' . | wc -l; done < ids.txt

# ✓ 단일 패스 — 같은 결과가 0.16초. 540배
grep -rEo '<패턴>' --include='*.md' . | sed 's#^\./##' | awk -F: '{print $2"\t"$1}' \
  | sort -u | awk -F'\t' '{c[$1]++} END{for(k in c) print c[k]"\t"k}' | sort -rn
```

**원리:** 파일을 한 번만 읽고, `(ID, 파일)` 쌍을 만들어 `sort -u`로 중복을 제거한 뒤 awk가 센다.

**언제 순진한 방법이 괜찮은가:** 항목이 수백 개 이하이고 각 검사가 작은 파일만 볼 때(D-03의 795건 = 3초).
**항목이 저장소 전체를 재스캔한다면 무조건 단일 패스로 바꿔라.**

### 4.6 실패한 명령은 결과를 저장하지 말고, 명령만 기록하라

에러 스택 전체를 보고서에 붙이지 마라. `명령 / 종료코드 / 에러 첫 줄` 3개만 적는다.

---

## §5. 🔴 이 저장소의 함정 — 선행 감사자가 실제로 빠진 것 전부

**이건 이론이 아니다. 선행 감사자가 하나하나 직접 밟은 함정이다. 읽지 않으면 너도 밟는다.**

| # | 함정 | 증상 | 회피 |
|---|---|---|---|
| T-1 | **`npx tsc`는 가짜 컴파일러다** | `impl/node_modules` 없이 `npx tsc --noEmit`을 돌리면 `tsc@2.0.4`를 내려받아 **에러 없이 0으로 종료**한다 | 반드시 `./node_modules/.bin/tsc --noEmit`. `AGENTS.md` §5 |
| T-2 | **`app`에는 vitest 설정이 2개다** | `npm test` = `test:unit` + `test:unit:kst`. 후자는 `TZ=Asia/Seoul`. UTC에서 통과하고 KST에서 깨지는 결함이 실존한다 | 단일 설정으로 "통과"를 주장하지 마라 |
| T-3 | **Playwright는 낡은 `dist/`를 본다** | `webServer`가 `npm run preview`로 `dist/`를 띄운다. 빌드 안 하면 옛 코드를 테스트한다 | e2e 전 `npm run build` |
| T-4 | **샌드박스 Node 20 vs CI Node 24** | 샌드박스에서만 깨지는 실패가 있다 | 실패는 **개수가 아니라 이름으로** 비교 |
| T-5 | **필드명 `day`이지 `sessionDay`가 아니다** | 잘못 읽으면 `undefined`가 되고 **집계가 쓰레기인데 테스트는 통과한다** | 집계 전에 표본 1건을 눈으로 출력해 확인 |
| T-6 | **후보는 `out.generated.candidates`다** | `out.candidates`는 `undefined` → `cands.find is not a function` | 반환 형태를 먼저 `Object.keys()`로 찍어라 |
| T-7 | **판별자는 `c.kind`다** | `c.candidateKind`는 없다 | 위와 동일 |
| T-8 | **`generatePlanFromDraft`는 2번째 인자가 필수다** | `generatePlanFromDraft(draft, "NO_KNOWN_RISK")` | 시그니처를 `grep -n 'export function generatePlanFromDraft' -A3` |
| T-9 | **intent enum은 `GLY_INTENT`다** | `GLYCOLYTIC_INTENT`는 존재하지 않는다 | `plan-session-schema.ts:3-11` |
| T-10 | **모든 케이스가 "거부 기대"인 관문 테스트는 아무것도 증명하지 않는다** | 스키마가 전부 거부하도록 망가져도 통과한다 | **반드시 통과해야 하는 대조군 1건**을 넣어라 |
| T-11 | **`planBetaStateSchema`는 export되지 않는다** | `parsePlanBetaState()`만 공개 | 스키마 직접 import 시도 금지 |
| T-12 | **`.github/workflows/`는 쓰기 금지다** | 수정 시도가 차단된다 | CI 변경 제안은 **문서로만** 올린다 |
| T-13 | **`main`에 push하면 곧바로 운영 배포된다** | `gh-pages` 자동 배포 | 너는 애초에 push 금지다 |
| T-14 | **`specs/active/` 폴더에 있다고 활성 계약이 아니다** | 폴더명이 상태를 뜻하지 않는다 | `AGENTS.md` §2의 경고를 따르고, **문서 본문의 `status:`**를 봐라 |
| T-15 | **`/mnt/aidrive`는 매우 느리다** | 재귀 탐색하면 멈춘 것처럼 보인다 | 이 감사에서는 `/mnt/aidrive`를 **건드리지 마라** |
| T-16 | **grep으로 센 목록에는 오탐이 섞인다** | `ci.yml`에서 `.mjs\|.sh` 파일명을 grep하면 15개가 나오지만 그중 `github.sh`는 `specs/test-packages/` 파일이 아니다. 실제 등록 검증기는 14개. **선행 감사자가 이 지시서 초안에 15로 잘못 적었다** | 목록을 세기 전에 **`comm`으로 실존 교집합**을 구하라. 개수만 세지 말고 `comm -13`으로 **어느 항목이 오탐인지** 반드시 출력해서 눈으로 확인하라 |
| T-17 | **`grep -c`는 "일치 줄 수"이고 "일치 개수"가 아니다** | 한 줄에 `DSB-INV`가 3번 나오면 `grep -c`는 1을 센다 | 개수를 세려면 `grep -o … \| wc -l`. 줄 수인지 개수인지 보고서에 **단위를 명시**하라 |
| T-18 | **`sort -u`한 유니크 ID 수와 총 참조 수는 전혀 다른 값이다** | 이 두 개를 섞어 보고하면 "규칙이 10개뿐"처럼 읽힌다(실제 유니크 `*-INV-*` ID는 10개인데 `DSB-INV` 참조는 57건) | 표의 열 이름에 항상 `유니크 / 총참조`를 구분해 적어라 |

---

## §6. 작업 패킷 D-01 ~ D-24

각 패킷은 **독립 실행 가능**하다. 순서는 권장이며, 앞 패킷이 막히면 건너뛰고 다음으로 가라. 막힌 사실을 보고서에 남기면 그 자체가 성과다.

각 패킷 산출물은 `reports/review/deepseek-audit/D-NN-<이름>.md` 로 저장한다.

### 공통 보고서 머리말 (모든 패킷 파일 최상단에 그대로)

```markdown
# D-NN — <패킷 제목>

```yaml
packet: D-NN
executor: DeepSeek
executed_at: "<YYYY-MM-DD>"
repo_sha: "<git rev-parse --short HEAD 결과>"
mode: READ_ONLY
verdict_authority: NONE   # 판정 권한 없음. 사실 수집만.
files_examined: <숫자>
findings_total: <숫자>
owner_decision_required: <숫자>
```

## 실행한 명령
(그대로 복사 가능한 형태로)

## 결과
(표)

## 조사하지 못한 것과 이유
(빈칸이면 "없음"이라고 명시)
```

---

## PHASE 1 — 기계적 인벤토리

### D-01. 규칙 ID 전수 대장

**목적:** 이 저장소에 존재하는 모든 규칙/테스트케이스 ID를 하나도 빠짐없이 대장으로 만든다. 지금 아무도 전체 목록을 모른다.

```bash
cd /home/user/webapp
grep -rhoE '\b[A-Z][A-Z0-9]{1,14}-[A-Z0-9]{2,16}-[0-9]{2,4}\b' --include='*.md' . \
  | sort -u > /tmp/d01_ids.txt
wc -l /tmp/d01_ids.txt
sed -E 's/-[0-9]{2,4}$//' /tmp/d01_ids.txt | sort | uniq -c | sort -rn
```

**출력 형식:** 이름공간별 표.

| 이름공간 | ID 개수 | 최소 번호 | 최대 번호 | 결번(빠진 번호) | 정의 문서 | 정의 문서 발견? |
|---|---:|---:|---:|---|---|---|

**결번 찾는 방법:**
```bash
grep -E '^DSB-INV-' /tmp/d01_ids.txt | sed 's/.*-//' | sort -n
# 001..009 중 빠진 번호를 눈으로 확인
```

**판정 기준:**
- 정의 문서 = 그 ID를 **선언**하는 문서 (인용만 하는 문서와 구별). 선언은 보통 표의 행이나 제목에 있다.
- 정의 문서를 못 찾은 이름공간은 🔴 **고아 이름공간**으로 표시.

**금지:** 이름공간이 왜 이렇게 많은지 논평하지 마라. 세어라.

---

### D-02. 규칙 ID 고아 · 중복 · 유령 검사

**목적:** 정의는 있으나 아무도 인용하지 않는 규칙(죽은 규칙), 인용은 있으나 정의가 없는 규칙(유령 규칙)을 찾는다. **유령 규칙이 더 위험하다** — 구현자가 존재하지 않는 규칙을 따르려 한다.

**🔴 순진한 방법을 쓰지 마라 — 선행 감사자가 실측했다.**

ID 847개에 대해 `while read; do grep -rl; done` 루프를 돌리면 **약 87초**가 걸린다(20개 = 2.0초 실측).
아래 **단일 패스 방법은 0.16초에 같은 847행 결과를 낸다. 540배 빠르다.**

```bash
cd /home/user/webapp
# ID를 한 번만 스캔하고 (ID, 파일) 쌍을 만든 뒤 awk로 집계한다
grep -rEo '\b[A-Z][A-Z0-9]{1,14}-[A-Z0-9]{2,16}-[0-9]{2,4}\b' --include='*.md' . \
  | sed 's#^\./##' \
  | awk -F: '{print $2"\t"$1}' \
  | sort -u \
  | awk -F'\t' '{c[$1]++} END{for(k in c) print c[k]"\t"k}' \
  | sort -rn > /tmp/d02_refcount.txt
wc -l /tmp/d02_refcount.txt              # → 847 (D-01과 일치해야 한다)
head -5 /tmp/d02_refcount.txt
echo "--- 1개 문서에만 등장 (고립 후보) ---"
awk -F'\t' '$1==1' /tmp/d02_refcount.txt | wc -l
```

**선행 감사자 실측 결과 (재현 기준값):**

| 항목 | 값 |
|---|---:|
| 유니크 ID 총수 | **847** |
| 그중 **1개 문서에만 등장** | **693 (82%)** |
| 최다 참조 | `GATE-BINDING-001` 25문서, `RUNTIME-EVIDENCE-001` 22, `SOURCE-CONSUMPTION-001` 21 |

**🔴 693이라는 숫자를 그대로 "고립 693건"으로 보고하지 마라. 이건 함정이다.**

ID가 1개 문서에만 등장하는 것은 **대부분 정상**이다 — 테스트케이스 ID(`FA-TC-001` 등)는
자기 테스트 패키지 문서 안에서만 쓰이는 것이 당연하다. **"고립"은 문제가 아니라 분류일 뿐이다.**

**진짜 위험한 것은 "유령"(정의 없이 인용만 되는 ID)이다.** 693건 중에서 유령을 골라내려면
그 1개 문서가 **정의 문서인지 인용 문서인지** 판별해야 한다:

```bash
# 고립 ID가 등장하는 그 1개 문서를 뽑는다
awk -F'\t' '$1==1{print $2}' /tmp/d02_refcount.txt > /tmp/d02_lonely.txt
# 표본 30개만 문서와 함께 본다 (전수는 예산 낭비)
head -30 /tmp/d02_lonely.txt | while read -r id; do
  printf '%-28s %s\n' "$id" "$(grep -rl "$id" --include='*.md' . | head -1)"
done
```

**판별 기준:** 그 문서가 해당 ID를 **표의 행이나 제목으로 선언**하면 정의 문서(정상).
본문에서 `~를 따른다`, `~참조` 형태로만 쓰면 **유령 후보**다.

**전수 판별은 하지 마라. 표본 30~50개로 유령 비율을 추정하고, 그 비율을 보고하라.**
전수가 필요하다고 판단되면 §14로 올려라.

**출력 형식:**

| ID | 등장 문서 수 | 등장 문서 | 정의 있음? | 분류 |
|---|---:|---|---|---|

**분류 값은 다음 4개만 쓴다:** `정상` / `고립(정의만 있고 인용 0)` / `유령(인용만 있고 정의 0)` / `판정불가`

**🔴 `판정불가`를 쓰는 것을 부끄러워하지 마라.** 억지 분류가 더 나쁘다.

---

### D-03. 경로 참조 해석 실패 112건 분류 (F-3)

**목적:** 문서가 가리키는 파일이 실제로 없는 경우를 전수 분류한다. 구현자가 "그 파일을 읽어라"는 지시를 따를 수 없다는 뜻이다.

```bash
cd /home/user/webapp
git ls-files > /tmp/tracked.txt
grep -rhoE '`[A-Za-z0-9_./-]+\.(md|ts|tsx|mjs|sh|json|yml)`' --include='*.md' . \
  | tr -d '`' | sed 's#^\./##' | sort -u > /tmp/d03_refs.txt
: > /tmp/d03_miss.txt
while read -r p; do
  grep -qxF "$p" /tmp/tracked.txt || grep -qE "/${p}$" /tmp/tracked.txt || echo "$p" >> /tmp/d03_miss.txt
done < /tmp/d03_refs.txt
wc -l /tmp/d03_refs.txt /tmp/d03_miss.txt
```

각 실패 경로가 **어느 문서에서** 참조되는지 찾는다:
```bash
while read -r p; do
  echo "### $p"
  grep -rln -- "$p" --include='*.md' . | head -5
done < /tmp/d03_miss.txt > /tmp/d03_where.txt
```

**출력 형식:**

| 참조 경로 | 참조하는 문서 | 분류 | 위험도 |
|---|---|---|---|

**분류는 다음 6개만:**
- `상대경로표기` — `../FOO.md` 처럼 문서 위치 기준. 실제로는 존재할 수 있다. **해석 시도해서 결과를 적어라.**
- `.omo내부` — `.omo/` 아래. git 추적 밖일 수 있다.
- `외부저장소` — 이 저장소 소유가 아닌 것 (`/doc/ws.md` 등)
- `예시코드조각` — `.test.ts` 처럼 확장자만 있는 조각. 실제 경로가 아니다.
- `과거삭제` — 있었다가 삭제된 것. `git log --diff-filter=D --name-only | grep -F "<경로>"` 로 확인.
- `진짜깨짐` — 위 어디에도 안 들어가며 현재 지침 문서가 가리키는 것. 🔴 **가장 위험**

**위험도:**
- 🔴 `높음` — 현재-길잡이/현재-스펙 문서가 참조
- 🟡 `중간` — 작업지시서가 참조
- ⚪ `낮음` — 과거 기록/보고서가 참조 (역사이므로 정상일 수 있다)

**🔴 주의:** 과거 보고서가 삭제된 파일을 가리키는 건 **정상**이다. 그때는 있었으니까. 이걸 "깨짐"으로 보고하면 보고서가 노이즈로 가득 찬다. **문서의 상태(현재/과거)를 반드시 함께 봐라.**

---

### D-04. 문서 metadata 스키마 이원화 조사 (`spec_id` vs `doc_id`)

**목적:** 문서 식별자 규약이 두 개다. 어느 쪽이 규약인지 아무도 모른다. 사실을 확정한다.

```bash
cd /home/user/webapp
echo "=== spec_id 쓰는 문서 ==="; grep -rln '^spec_id:' --include='*.md' . | sort
echo "=== doc_id 쓰는 문서 ==="; grep -rln '^doc_id:' --include='*.md' . | sort
echo "=== 둘 다 쓰는 문서 ==="
comm -12 <(grep -rln '^spec_id:' --include='*.md' . | sort) \
         <(grep -rln '^doc_id:' --include='*.md' . | sort)
echo "=== 둘 다 없는 specs/ 문서 ==="
for f in specs/active/*.md specs/reconstruct/*.md; do
  grep -qE '^(spec_id|doc_id):' "$f" || echo "$f"
done
```

**규약을 정의한 문서가 있는지 찾아라:**
```bash
grep -rn 'spec_id' --include='*.md' AGENTS.md TRAINORACLE_SPEC_INDEX.md PRODUCT_NORTH_STAR.md WORK_ORDER_C_DOC_CLEANUP.md
```

**출력 형식:**

| 항목 | 결과 |
|---|---|
| `spec_id`만 | N건 (목록) |
| `doc_id`만 | N건 (목록) |
| 둘 다 | N건 (목록) |
| 둘 다 없음 (specs/ 한정) | N건 (목록) |
| 규약 정의 문서 | 발견 / **미발견** |

**미발견이면 §14 오너 결정 항목으로 올린다.** 너가 "`spec_id`가 맞다" 같은 결정을 하지 마라.

---

### D-05. `status:` 통제 어휘 부재 조사

**목적:** status 값이 19종이고 18개 문서는 status가 없다. 어떤 값이 "승인됨"을 뜻하는지 기계가 알 수 없다.

```bash
cd /home/user/webapp
for f in $(git ls-files 'specs/**/*.md'); do
  s=$(grep -m1 -E '^status:' "$f" | sed 's/status: *//')
  printf '%s\t%s\n' "${s:-<없음>}" "$f"
done | sort > /tmp/d05_status.txt
cut -f1 /tmp/d05_status.txt | sort | uniq -c | sort -rn
```

**출력 형식 1 — 값 사전:**

| status 값 | 문서 수 | 문서 목록 | 이 값의 뜻이 어디에 정의됐나 |
|---|---:|---|---|

**출력 형식 2 — 승인 관련 플래그 교차표:**

```bash
for f in $(git ls-files 'specs/**/*.md'); do
  st=$(grep -m1 '^status:' "$f" | sed 's/status: *//')
  cp=$(grep -m1 '^canonical_promotion_allowed:' "$f" | sed 's/.*: *//')
  ua=$(grep -m1 '^upload_allowed:' "$f" | sed 's/.*: *//')
  pe=$(grep -m1 '^production_execution_allowed:' "$f" | sed 's/.*: *//')
  printf '%s | %s | %s | %s | %s\n' "$(basename $f)" "${st:--}" "${cp:--}" "${ua:--}" "${pe:--}"
done
```

| 문서 | status | canonical_promotion_allowed | upload_allowed | production_execution_allowed | 🔴 모순? |
|---|---|---|---|---|---|

**🔴 찾아야 하는 모순:** `status`가 초안류인데 `canonical_promotion_allowed: true`인 경우, 또는 그 반대. **이건 위험한 조합이다.** 발견 시 위험도 높음으로 표시하고 §14로.

---

## PHASE 2 — 검증기 감사 (F-1, F-2 대응, 최우선 구간)

### D-06. 검증기 55개 전수 실행 대장

**목적:** CI가 14개만 부르고 41개는 방치돼 있다. **방치된 것이 지금 통과하는지 실패하는지 아무도 모른다.**

```bash
cd /home/user/webapp
ls specs/test-packages/*.mjs specs/test-packages/*.sh | sed 's#.*/##' | sort > /tmp/all_v.txt
grep -oE '[a-z0-9._-]+\.(mjs|sh)' .github/workflows/ci.yml | sort -u > /tmp/ci_v.txt
echo "전체:      $(wc -l < /tmp/all_v.txt)"                       # → 55
echo "ci.yml언급: $(wc -l < /tmp/ci_v.txt)"                       # → 15 (오탐 포함)
echo "실존등록:   $(comm -12 /tmp/ci_v.txt /tmp/all_v.txt | wc -l)"  # → 14  ← 이게 진짜 값
comm -23 /tmp/all_v.txt /tmp/ci_v.txt > /tmp/d06_orphan.txt
wc -l /tmp/d06_orphan.txt                                        # → 41
# ci.yml이 언급하지만 test-packages에 없는 것 = 오탐 또는 다른 위치 스크립트
comm -13 /tmp/all_v.txt /tmp/ci_v.txt                            # → github.sh
```

**각 검증기를 실행한다. 하나씩. 반드시 타임아웃을 걸어라:**
```bash
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
done < /tmp/d06_orphan.txt | tee /tmp/d06_result.txt
```

**🔴 `build-*.mjs` 와 `repair-*.mjs` 는 실행하지 마라.** 이름이 생성/수정을 뜻한다. 파일을 써버릴 수 있다. **목록에는 넣되 `실행보류 — 쓰기 가능성`으로 표시**하고, 대신 첫 30줄만 읽어 무엇을 쓰는지 기록하라:
```bash
grep -nE 'writeFile|writeFileSync|mkdir|rm |unlink' specs/test-packages/build-formation-appraisal.mjs | head
```

**출력 형식:**

| 검증기 | CI 등록 | 종료코드 | 결과 | 출력 첫 줄 | 쓰기 동작 있음? |
|---|---|---:|---|---|---|

**결과는 다음 5개만:** `통과` / `실패` / `실행에러` / `타임아웃` / `실행보류(쓰기)`

**🔴 정지 조건:** 어떤 검증기가 파일을 수정한 흔적이 보이면 **즉시 멈추고** `git status --porcelain` 결과를 보고서에 적고 §14로 올려라. **`git checkout`으로 되돌리지 마라** — 오너가 봐야 한다.

---

### D-07. 검증기 공허성 검사 — 이게 이번 감사의 심장이다

**목적:** **통과하는 검증기가 실제로 무언가를 검증하는지 확인한다.** 아무것도 검사하지 않고 통과만 하는 검증기는 **가짜 안전감**을 준다. 이 프로젝트에서 가장 위험한 결함 유형이다.

**방법 — 반드시 사본에서 한다. 원본을 건드리면 실패다:**

```bash
cd /home/user/webapp
mkdir -p /tmp/vacuity && cp -r specs/test-packages /tmp/vacuity/tp
# 검증기가 읽는 대상 파일을 찾는다
grep -nE "readFile|readFileSync|resolve\(|join\(" specs/test-packages/<검증기>.mjs | head -20
```

**대상 파일을 /tmp에 복사하고, 그 사본을 의도적으로 망가뜨린 뒤, 검증기가 실패하는지 본다.**

원본 저장소를 절대 만지지 않으려면 이렇게 한다:
```bash
# 저장소 전체를 /tmp로 복제 (git 사용, 원본 무해)
cd /tmp && rm -rf vac_repo && git -C /home/user/webapp worktree list >/dev/null 2>&1
cp -a /home/user/webapp /tmp/vac_repo 2>/dev/null || true
cd /tmp/vac_repo
# 여기서만 망가뜨린다
```

**만약 `cp -a`가 너무 크거나 느리면, 그 검증기는 `공허성 검사 불가 — 이유: 대상 격리 실패`로 적고 넘어가라.** 억지로 원본에서 하지 마라.

**최소한 아래 5개는 반드시 공허성 검사하라 (CI에 등록된 것 중):**

1. `reasoning-tier-harness.mjs`
2. `validate-formal-approval-foundation.mjs`
3. `validate-formation-p1-target-plans.mjs`
4. `validate-detailed-prescription-catalog.mjs`
5. `validate-journal-decoration-contract.mjs`

**그리고 F-2의 `validate-latest-owner-decision.mjs` (고아이지만 최우선).**

**출력 형식:**

| 검증기 | 읽는 대상 파일 | 주입한 결함 | 검증기 반응 | 판정 |
|---|---|---|---|---|

**판정은 다음 4개만:**
- `유효 — 결함을 이름으로 잡아냄`
- 🔴 `공허 — 결함을 넣어도 통과함`
- `부분 유효 — 일부 결함만 잡음 (어느 것을 놓쳤는지 적어라)`
- `검사 불가 — 이유 명시`

**🔴 `공허`가 하나라도 나오면 그것은 이 감사의 최상위 발견이다.** 보고서 맨 앞에 올려라.

**🔴 함정 T-10 재확인:** "종료코드 0"을 "검증됨"으로 착각하지 마라. **일부러 깨서 실패하는 것을 본 적이 없으면 그 검증기는 검증기가 아니다.**

---

### D-08. 🔴 `validate-latest-owner-decision.mjs` 규명 (F-2, 최우선 패킷)

**왜 최우선인가:** 이 프로젝트의 최상위 판정 규칙은 **"최신 오너 결정이 이전 초안을 이긴다"**(`FORMATION_LATEST_OWNER_DECISION_BASELINE.md` 10항)이다. 그걸 검사하는 검증기가 **존재하고, 통과하며, 충돌 12건을 보고하는데, CI에 없다.**

```bash
cd /home/user/webapp
wc -l specs/test-packages/validate-latest-owner-decision.mjs
cat specs/test-packages/validate-latest-owner-decision.mjs     # 95줄이므로 전체 읽기 허용
node specs/test-packages/validate-latest-owner-decision.mjs
# 관측된 출력: FORMATION_OWNER_BASELINE_VALID conflicts=12 latest_decision=governs runtime=false
```

**답해야 하는 질문 6개. 각각 `파일:행` 근거를 붙여라:**

| # | 질문 | 답 | 근거 |
|---|---|---|---|
| Q1 | `conflicts=12`의 12개는 **구체적으로 무엇인가?** 검증기가 목록을 출력하나, 개수만 세나? | | |
| Q2 | 이 검증기는 어떤 파일을 읽는가? | | |
| Q3 | `conflicts`가 0이 아닌데 **왜 통과(VALID)로 끝나는가?** 충돌을 허용하도록 설계됐나? | | |
| Q4 | `runtime=false`는 무슨 뜻인가? 어느 문서가 이 어휘를 정의하나? | | |
| Q5 | 이 검증기가 `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md`(가장 최신 결정)를 **읽고 있나?** 아니면 그 이전 결정만 보나? | | |
| Q6 | 이게 CI에 없는 이유가 어딘가에 기록돼 있나? | | |

**Q5가 특히 중요하다.** 만약 검증기가 최신 결정 문서를 모른다면, 그것은 **"최신 결정이 이긴다"는 규칙 자체를 검사하지 못한다**는 뜻이다.

**충돌 12건의 정체를 알아내려면 검증기에 출력을 추가해야 할 수 있다. 원본 수정 금지이므로 사본에서 하라:**
```bash
cp specs/test-packages/validate-latest-owner-decision.mjs /tmp/vlod.mjs
# /tmp/vlod.mjs 에만 console.log 추가
cd /home/user/webapp && node /tmp/vlod.mjs
```
경로 해석이 깨지면 `cd`를 조정하거나, **"사본 실행 불가 — 상대경로 의존"**으로 적고 정적 읽기로 답하라.

**🔴 절대 금지:** 이 검증기를 CI에 추가하지 마라 (`.github/`는 쓰기 금지이며 T-12). **추가를 제안하는 문서만 써라.**

---

### D-09. 규칙 ID × 기계 검증 매트릭스

**목적:** 어떤 규칙이 실제로 기계 검증되고, 어떤 규칙이 문서에만 있는지 한 장으로 만든다. **C-9에서 `DSB-INV-*`는 검증 0건으로 이미 확정됐다. 나머지 이름공간은 아무도 확인한 적 없다.**

```bash
cd /home/user/webapp
# 각 이름공간이 코드/검증기/테스트에 등장하는지
for ns in FA-TC DSB-INV FRV2-CONF PG-TC AIB-TC TC-AP SC-TL SC-REB SC-PST \
          GATE-BINDING RUNTIME-EVIDENCE PHYSIO-SOURCE SOURCE-CONSUMPTION \
          TC-EPOC EVALUATOR-BINDING RATIONALE-PRIVACY CALENDAR-MAPPING \
          BRIDGE-BINDING VERSION-BINDING SURFACE-BINDING GUARDIAN-CONSENT COACH-RULESET; do
  md=$(grep -rl "$ns-" --include='*.md' . 2>/dev/null | wc -l)
  mjs=$(grep -rl "$ns-" specs/test-packages/ 2>/dev/null | wc -l)
  code=$(grep -rl "$ns-" app/src impl/src runtime-evidence 2>/dev/null | wc -l)
  printf '%-22s md=%-4s validator=%-3s code=%-3s\n' "$ns" "$md" "$mjs" "$code"
done
```

**출력 형식:**

| 이름공간 | md 문서 수 | 검증기에 등장 | 코드에 등장 | CI가 그 검증기를 부름? | 판정 |
|---|---:|---:|---:|---|---|

**판정은 다음 4개만:**
- `기계검증됨` — 검증기에 등장 + 그 검증기가 CI에 있음
- 🟡 `검증기 있으나 CI 밖` — 고아 검증기만 앎
- 🔴 `문서만 존재` — 검증기·코드 어디에도 없음
- `판정불가`

**이 표가 이번 감사의 최종 산출물 중 가장 실용적인 것이다. 꼼꼼히 만들어라.**

---

## PHASE 3 — 스펙 간 상호 모순

### D-10. 슬롯·시간 어휘 전수 대조

**목적:** 같은 개념을 문서마다 다른 이름으로 부르면 구현자가 잘못 짠다. C-11에서 상위 스펙 2곳은 이미 확인됐다. **나머지 전부를 훑는다.**

```bash
cd /home/user/webapp
grep -rnE '"(AM|PM|DOUBLE|FLEX|FULL_DAY|UNSPECIFIED|MORNING|EVENING|ANY)"' \
  --include='*.md' specs/ | tee /tmp/d10_slot.txt | wc -l
grep -rnoE 'SessionSlot|sessionSlot|slot *[:=]' --include='*.md' specs/ | head -40
# 코드 쪽 실제 값
grep -rn 'sessionSlotSchema\|SessionSlot' app/src impl/src | head -20
```

**출력 형식:**

| 문서 | 행 | 선언한 슬롯 값 집합 | 코드(`plan-session-schema.ts:12`)와 일치? |
|---|---:|---|---|

**코드의 확정값 (C-와 함정에서 이미 확인됨, 재확인만):** `app/src/domain/plan-session-schema.ts:12` → `z.enum(["AM","PM"])`

**🔴 상위 스펙이 4값(`AM|PM|DOUBLE|FLEX`)이고 앱 스키마가 2값(`AM|PM`)인 것은 C-11에서 이미 알려진 사실이다.** 이걸 새 발견처럼 쓰지 마라. **너의 임무는 이 4값/2값 외에 제3의 값 집합을 쓰는 문서가 또 있는지 찾는 것이다.**

---

### D-11. RPE 숫자 전수 대장

**목적:** RPE는 사용자에게 직접 보이는 숫자다. 문서마다 다르면 거짓 약속이 된다.

```bash
cd /home/user/webapp
grep -rnE 'RPE ?[0-9]' --include='*.md' . | tee /tmp/d11_rpe.txt | wc -l
grep -rhoE 'RPE ?[0-9]+ *[-~–] *[0-9]+' --include='*.md' . | tr -d ' ' | sort | uniq -c | sort -rn
```

**코드의 확정값 — 이것이 기준이다** (`impl/src/plan-generator/session-builder.ts:74-91`, `rpeForIntent()`):

| intent | RPE |
|---|---|
| `RECOVERY_INTENT` | 1-2 |
| `BASE_INTENT` | 3-4 |
| `LT_INTENT` | 5-6 |
| `VO2_INTENT` · `GLY_INTENT` | 7-8 |
| `ATP_PC_INTENT` | 8-9 |
| `MIXED_INTENT` | 6-7 |

**🔴 이 숫자는 오너 결정 OD-SLOT-5로 "불변"이 확정됐다. 바꾸자는 제안을 하지 마라.** 문서가 이와 다른 값을 쓰고 있으면 **문서 쪽이 틀린 것**으로 표시한다.

**출력 형식:**

| 문서 | 행 | 문서가 쓴 RPE | 그 문맥의 intent | 코드값 | 일치? |
|---|---:|---|---|---|---|

**주의:** RPE 범위가 intent와 무관한 문맥(예: 사용자 입력 스케일 1-10 설명)도 있다. 그건 `해당없음`으로 분류하고 불일치로 세지 마라. **노이즈를 불일치로 부풀리는 것은 보고서를 죽인다.**

---

### D-12. 경험 밴드 이름 전수 대조

```bash
cd /home/user/webapp
grep -rhoE '\b(NEW_TO_RUNNING|DEVELOPING|EXPERIENCED|BEGINNER|INTERMEDIATE|ADVANCED|NOVICE|ELITE)\b' \
  --include='*.md' . | sort | uniq -c | sort -rn
grep -rn 'NEW_TO_RUNNING' app/src impl/src | head -10
```

**코드의 확정 3값:** `NEW_TO_RUNNING` / `DEVELOPING` / `EXPERIENCED` (`session-builder.ts:31-54`)

**출력:** 위와 다른 어휘(`BEGINNER` 등)를 쓰는 문서 목록 + 그것이 3값과 어떻게 대응되는지 문서에 매핑이 있는가.

**🔴 매핑이 없으면 그것이 발견이다.** "아마 BEGINNER=NEW_TO_RUNNING일 것"이라고 쓰지 마라. **"매핑 미발견"**이라고 써라.

---

### D-13. energy intent enum 전수 대조

```bash
cd /home/user/webapp
grep -rhoE '\b[A-Z_]+_INTENT\b' --include='*.md' . | sort | uniq -c | sort -rn
echo "=== 코드의 정본 ==="
sed -n '1,15p' app/src/domain/plan-session-schema.ts
```

**코드의 정본 (T-9):** `RECOVERY_INTENT`, `BASE_INTENT`, `LT_INTENT`, `VO2_INTENT`, **`GLY_INTENT`**, `ATP_PC_INTENT`, `MIXED_INTENT`

**출력:** 코드에 없는 intent 이름을 쓰는 문서 전수. 특히 **`GLYCOLYTIC_INTENT`** 를 찾아라 — 존재하지 않는 값이다.

---

### D-14. 상한·한계 숫자 전수 대장

**목적:** C-5, C-7에서 `DSB-INV-005`의 상한 2가 71% 케이스에서 깨지는 것이 확인됐다. **다른 상한들도 같은 상태일 수 있다.**

```bash
cd /home/user/webapp
grep -rnE '(상한|최대|최소|한계|limit|cap|max|min)[^0-9]{0,20}[0-9]+' --include='*.md' specs/ \
  | wc -l
grep -rnE '\b(limit|cap|maxS|MAX_|LIMIT_)' app/src impl/src | head -30
```

**출력 형식:**

| 문서:행 | 상한의 대상 | 문서상 값 | 코드 강제 지점 | 코드값 | 일치? | 기계 검증됨? |
|---|---|---|---|---|---|---|

**이미 확정된 항목 2개는 그대로 인용만 하고 재조사하지 마라:**
- `DSB-INV-005` 상한 2 → 코드 강제 지점 `session-builder.ts:165 const limit = 2`, 71% 초과 (C-5, C-7)
- 저장 관문에 프레임 상한 없음 → `plan-beta-schema.ts`에 `limit|length|count` grep 결과가 `:105` 하나뿐 (선행 감사 확정)

**너의 임무는 나머지 상한들이다.**

---

## PHASE 4 — 스펙 대 코드

### D-15. 스펙이 선언한 enum vs 코드 zod enum 전수 대조

```bash
cd /home/user/webapp
echo "=== 코드의 모든 z.enum ==="
grep -rn 'z\.enum(\[' app/src impl/src | tee /tmp/d15_enum.txt | wc -l
```

각 zod enum에 대해, 그 값 집합을 언급하는 스펙 문서를 찾고 대조한다.

**출력 형식:**

| 코드 위치 | enum 이름 | 코드 값 집합 | 이 enum을 다루는 스펙 문서 | 스펙 값 집합 | 차이 |
|---|---|---|---|---|---|

**차이는 3방향으로 적어라:** `코드에만 있음` / `스펙에만 있음` / `이름 다름`

**🔴 "스펙에만 있는 값"이 가장 위험하다.** 문서를 읽은 구현자가 없는 값을 쓰려 한다.

---

### D-16. 스펙 숫자 vs 코드 상수 대조

```bash
cd /home/user/webapp
echo "=== 시간 범위 상수 (확정 기준) ==="
sed -n '31,54p' impl/src/plan-generator/session-builder.ts
```

**코드의 확정 기준 (`rangesFor()`):**

| 밴드 | easy | recoverySupport | quality |
|---|---|---|---|
| `NEW_TO_RUNNING` | 20-35 | 10-20 | 20-30 |
| `DEVELOPING` | 30-45 | 15-25 | 25-40 |
| `EXPERIENCED` | 35-60 | 20-30 | 30-50 |

**훈련일 분산의 확정값 (`spreadTrainingDays`, `plan-beta-flow.ts:232-245`):**
`3→[1,5,9]` / `4→[1,4,7,10]` / `5→[1,3,5,7,9]` / `6→[1,3,5,6,8,10]` / `EVERY_DAY→[1..10]`
프레임은 항상 9.5일 (`LOCAL_CIVIL_9_5`, `slotCount: 19`)

**출력:** 이 숫자들과 다른 값을 적어둔 문서 전수. `문서:행 / 문서값 / 코드값 / 차이`

---

### D-17. 🔴 사용자에게 보이는 거짓 약속 전수 스캔

**목적:** C-1에서 "PM은 회복 전용"이 은퇴했다. **그런데 UI 문구가 아직 그렇게 약속하고 있는 곳이 있다.** 선행 감사가 3곳을 찾았다. **네 임무는 4번째, 5번째를 찾는 것이다.**

**이미 발견된 3곳 (재조사 불필요, 인용만):**

| # | 위치 | 문구 |
|---|---|---|
| 1 | `app/src/screens/plan-beta/PlanIntake.tsx:201` | `"오전 기본 훈련과 오후 RPE 1~2 회복 운동만 나눠 보여줘요"` |
| 2 | `app/src/screens/plan-beta/PlanIntake.tsx:84` | `"…오후 운동은 RPE 1~2이고, 고강도 두 번이나 놓친 운동 보충은 만들지 않아요."` |
| 3 | `app/src/domain/glossary.ts:144` | `"오전 기본 훈련과 오후 RPE 1~2 회복 운동을 보여줘요. 오후 운동은 고강도 훈련…아니며"` |

**추가 1곳 (테스트가 그 약속을 못 박고 있다):**
`app/e2e/launch-ready.spec.ts:97` → `expect(...).toMatch(/오후 회복/)`

**절대 손대면 안 되는 곳 (C-10):** `app/src/screens/plan-beta/labels.ts:166-190` — 이미 올바르다.

**너의 스캔:**
```bash
cd /home/user/webapp
grep -rn '오후' app/src app/e2e --include='*.ts' --include='*.tsx' | grep -vn 'labels.ts'
grep -rn 'RPE 1' app/src app/e2e
grep -rn '회복' app/src app/e2e --include='*.ts' --include='*.tsx' | wc -l
grep -rnE '오전|아침|저녁|밤' app/src --include='*.tsx'
```

**출력 형식:**

| 파일:행 | 문구 (원문 그대로) | 어떤 규칙에 어긋나나 | 이미 알려진 4곳 중 하나? | 분류 |
|---|---|---|---|---|

**분류는 3개만:**
- 🔴 `거짓 약속` — 은퇴한 v0.1 규칙을 사용자에게 약속
- ✅ `참` — 여전히 유효한 규칙을 말함 (예: "직접 선택했을 때만" = `DSB-INV-001`, "놓친 운동 보충 아니며" = `DSB-INV-007`)
- `무관`

**🔴 매우 중요:** 문구 하나 안에 **참인 부분과 거짓인 부분이 섞여 있다.** glossary.ts:144가 그렇다. **문구를 통째로 "거짓"으로 분류하면 유효한 안전 문구까지 지워질 위험이 있다. 반드시 문구를 절로 쪼개서 각각 판정하라.**

---

### D-18. `DSB-INV-001`~`009` 코드 강제 지점 대장

**목적:** C-9에서 기계 검증 0건이 확정됐다. **하지만 "검증기 없음"과 "코드에 강제 로직 없음"은 다르다.** 코드가 실제로 막고 있는지 각 규칙별로 확인한다.

**읽을 곳은 두 군데뿐이다:**
```bash
cd /home/user/webapp
sed -n '64,124p' app/src/domain/plan-beta-schema.ts     # 저장 관문 superRefine
sed -n '152,174p' impl/src/plan-generator/session-builder.ts  # recoverySecondSessionDays
```

**출력 형식:**

| 규칙 | 규칙 요지(스펙에서 1줄 인용) | 코드 강제 지점 | 강제 방식 | 검증기 | 판정 |
|---|---|---|---|---|---|
| DSB-INV-001 | | | | 없음(C-9) | |
| … 009까지 | | | | | |

**강제 방식은 4개만:** `저장관문 거부` / `생성기가 애초에 안 만듦` / `UI 문구만` / **`강제 없음`**

**🔴 `강제 없음`이면서 스펙이 "반드시"라고 쓴 규칙이 이번 감사의 핵심 산출물이다.** 목록을 따로 뽑아라.

**주의:** `DSB-INV-005`는 **저장 관문에 없는 것이 의도된 것**이다 (선행 감사가 "저장 관문에 넣지 마라"고 지시했다 — 넣으면 사용자가 고칠 수 없는 `PLAN_STORAGE_WRITE_FAILED`가 난다). 이걸 "결함"으로 보고하지 마라. `의도된 미강제 — 근거: FULL_RUN §4.6b`로 적어라.

---

## PHASE 5 — 미해결 이슈

### D-19. `OI-*` 224건 전수 대장

**D-02와 같은 단일 패스 방식을 써라.** 224건 루프는 약 23초, 단일 패스는 0.1초 미만이다.

```bash
cd /home/user/webapp
grep -rhoE '\bOI-[A-Z0-9-]{4,40}\b' --include='*.md' . | sort -u > /tmp/d19_oi.txt
wc -l /tmp/d19_oi.txt                    # → 224 (§3 기준값과 일치해야 한다)

# (OI, 파일) 쌍 → 문서 수 집계, 단일 패스
grep -rEo '\bOI-[A-Z0-9-]{4,40}\b' --include='*.md' . \
  | sed 's#^\./##' | awk -F: '{print $2"\t"$1}' | sort -u \
  | awk -F'\t' '{c[$1]++} END{for(k in c) print c[k]"\t"k}' | sort -rn > /tmp/d19_count.txt

# 상태 표기는 OI가 등장하는 줄을 한 번만 긁어서 분류한다
grep -rhoE '\bOI-[A-Z0-9-]{4,40}\b[^\n]{0,200}' --include='*.md' . > /tmp/d19_lines.txt
grep -cE '(OPEN|미해결)' /tmp/d19_lines.txt
grep -cE '(CLOSED|RESOLVED|해결됨)' /tmp/d19_lines.txt
```

**🔴 상태 판별 주의:** 같은 OI가 문서 A에서는 `OPEN`, 문서 B에서는 `RESOLVED`로 적혀 있을 수 있다.
그건 **불일치이며 그 자체가 발견이다.** 하나로 합치지 말고 **양쪽 다 기록하고 `상태 충돌`로 표시하라.**

**출력 형식:**

| OI ID | 등장 문서 수 | 상태 표기 | 소속 스펙 | canonical blocker? |
|---|---:|---|---|---|

**🔴 상태가 표기되지 않은 OI를 따로 집계하라.** 상태 없는 미해결 이슈는 영원히 미해결이다.

**이미 알려진 1건 (인용만):** `OI-DSB-FRAME-LOAD-CAP-001` — OPEN, canonical blocker 아님, `DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md` §8

---

### D-20. `open_issues_total` / `canonical_blocking_count` 자기신고 vs 실측 대조

**목적:** 문서 metadata가 "미해결 3건"이라고 적어놨는데 본문에 5건 있으면, 그 metadata를 신뢰한 모든 판단이 틀린다.

```bash
cd /home/user/webapp
for f in $(grep -rl '^open_issues_total:' --include='*.md' . ); do
  claimed=$(grep -m1 '^open_issues_total:' "$f" | sed 's/.*: *//')
  actual=$(grep -oE '\bOI-[A-Z0-9-]{4,40}\b' "$f" | sort -u | wc -l)
  printf '%s | 신고=%s | 실측유니크OI=%s\n' "$f" "$claimed" "$actual"
done
```

동일하게 `canonical_blocking_count`, `executed_tests_total`, `test_cases_total`도 대조한다.

**출력 형식:**

| 문서 | 필드 | 신고값 | 실측값 | 일치? | 비고 |
|---|---|---:|---:|---|---|

**🔴 주의 — 과소 판정 위험:** 문서가 다른 문서의 OI를 인용하면 실측이 신고보다 커진다. 이건 **불일치가 아니다.** 반드시 "자기 스펙의 OI"와 "인용된 OI"를 구분하라. 구분이 불가능하면 `대조 불가 — 인용 혼입`으로 적어라. **억지로 불일치로 몰지 마라.**

---

### D-21. 백로그 `B-NN` ↔ `OI-*` 매핑 누락

```bash
cd /home/user/webapp
grep -nE '^\s*[-*|].*\bB-[0-9]{2}\b' INCOMPLETE_WORK_BACKLOG.md | wc -l
grep -ohE '\bB-[0-9]{2}\b' INCOMPLETE_WORK_BACKLOG.md | sort -u
```

**출력 형식:**

| B-NN | 제목 | 대응 OI | 대응 스펙 | 대응 오너결정 | 매핑 상태 |
|---|---|---|---|---|---|

**이미 확정된 것 (인용만):** `B-17`은 `DSB-INV-009`의 **스펙 수준 전제조건**으로 승격됐다 (C-3, C-4). `B-12`는 계정 잠금 해제 화면.

**🔴 매핑이 없는 B-NN은 "언제 끝났다고 볼지 아무도 모르는 작업"이다.** 목록을 뽑아라.

---

## PHASE 6 — 종합

### D-22. 종합 대장 + 우선순위

`reports/review/deepseek-audit/D-22-SUMMARY.md`

**필수 구성 5개:**

**(1) 발견 총괄표** — 위험도 내림차순

| # | 발견 | 근거 `파일:행` | 위험도 | 왜 위험한가 (1줄) | 나온 패킷 |
|---|---|---|---|---|---|

**위험도 4단계:**
- 🔴 `사용자 피해 가능` — 잘못된 훈련 처방, 데이터 소실, 거짓 안전 약속
- 🟠 `구현자 오도 가능` — 문서를 믿고 짜면 틀린 코드가 나온다
- 🟡 `추적성 손실` — 지금 문제는 없으나 나중에 무엇이 옳은지 알 수 없게 된다
- ⚪ `정리 사항`

**(2) 🔴 오너 결정이 필요한 항목** — 너가 결정하지 않은 것들. 각 항목에 반드시:
- 무엇을 결정해야 하는가 (한 문장)
- 선택지 (2~3개)
- 각 선택지의 결과
- **너의 추천은 쓰지 마라.** 사실만.

**(3) 조사하지 못한 것과 이유** — 이게 비어 있으면 보고서를 의심한다. 반드시 채워라.

**(4) 선행 감사 공증 사실과 충돌한 지점** — 없으면 "없음". 있으면 **네 조사가 틀렸을 가능성부터 적어라.**

**(5) 자기검증 체크리스트** — §12를 그대로 복사해서 각 항목에 실제 결과를 적어라.

---

### D-23. 다음 작업자를 위한 인계

`reports/review/deepseek-audit/D-23-HANDOFF.md`

- 재현 명령 모음 (복사 붙여넣기 가능하게)
- 네가 만든 `/tmp` 중간 파일 목록과 각각의 뜻 (**`/tmp`는 날아간다는 사실을 명시**)
- 다음에 이 감사를 이어받는 사람이 **가장 먼저 볼 것 3개**
- 네가 새로 밟은 함정 (§5에 없던 것) — **이게 가장 값진 인계다.** 있으면 반드시 적어라.

---

### D-24. 제안서 (실행하지 않는다)

`reports/review/deepseek-audit/D-24-PROPOSALS.md`

**너는 제안만 하고 실행하지 않는다.** 특히:

- CI에 추가하면 좋을 검증기 목록 (`.github/`는 쓰기 금지, T-12)
- 만들면 좋을 새 검증기 (예: `DSB-INV-*` 기계 검증기 — C-9의 공백을 메우는 것)
- 통제 어휘로 확정하면 좋을 `status` 값 집합 (D-05 결과 기반)
- `spec_id`/`doc_id` 일원화 방안 (D-04 결과 기반)

**각 제안에 반드시 붙일 것:**

| 제안 | 근거 발견 | 영향 범위(파일 수) | 위험 | 오너 결정 필요? |
|---|---|---:|---|---|

**🔴 "이렇게 하는 게 낫다"고 단정하지 마라. "이 선택지가 있고, 결과는 이렇다"로 써라.**

---

## §7. 실행 순서 권고

```
1일차: §0~§5 숙독 → D-08(최우선) → D-06 → D-07
2일차: D-01 → D-02 → D-09
3일차: D-03 → D-04 → D-05
4일차: D-10 → D-11 → D-12 → D-13 → D-14
5일차: D-15 → D-16 → D-17 → D-18
6일차: D-19 → D-20 → D-21
7일차: D-22 → D-23 → D-24
```

**왜 D-08이 1번인가:** 그것이 "최신 오너 결정이 이긴다"는 **이 프로젝트 최상위 규칙의 검증 여부**를 다루기 때문이다. 그게 검증되지 않고 있다면 다른 모든 조사의 전제가 흔들린다.

**막히면 건너뛰어라.** 한 패킷에서 막혀 전체가 멈추는 것이 최악이다. 막힌 사실을 적는 것이 성과다.

---

## §8. 🔴 절대 하지 말 것 — 위반 시 이 작업은 실패로 처리된다

| # | 금지 | 이유 |
|---|---|---|
| 1 | `specs/` 아래 어떤 파일이든 수정 | 선행 감사가 v0.2로 확정한 계약이다 |
| 2 | `app/`, `impl/`, `runtime-evidence/` 수정 | 이 감사는 읽기 전용이다 |
| 3 | `.github/workflows/` 수정 | 쓰기 차단돼 있고, CI가 배포를 건다 (T-12) |
| 4 | `git commit` / `git push` / 브랜치 생성 | `main` push = 즉시 운영 배포 (T-13) |
| 5 | `git checkout` / `git restore` / `git stash` | 다른 사람의 미커밋 작업을 날린다 |
| 6 | `DOCUMENT_MAP.md` 수정 | 기계 생성 스냅샷이다 (C-12) |
| 7 | `labels.ts` 수정 제안 | 이미 올바르다 (C-10) |
| 8 | `rpeForIntent()` 숫자 변경 제안 | OD-SLOT-5로 불변 확정 |
| 9 | `DSB-INV-005`를 저장 관문에 넣자는 제안 | 사용자가 고칠 수 없는 저장 실패를 만든다 |
| 10 | 같은 날 quality 2회 입구를 만들자는 제안 | B-17 없이는 OD-SLOT-8 위반 (C-4) |
| 11 | `/mnt/aidrive` 탐색 | 극도로 느려 세션이 멈춘다 (T-15) |
| 12 | `build-*.mjs`, `repair-*.mjs` 실행 | 파일을 쓴다 (D-06) |
| 13 | 오너 결정을 대신 내리기 | 너의 권한이 아니다 |
| 14 | 선행 감사 공증 사실 재판정 | §2 |
| 15 | 추측을 사실처럼 쓰기 | §1 |

---

## §9. 정지 조건 — 아래를 만나면 즉시 멈추고 보고하라

| # | 상황 | 행동 |
|---|---|---|
| 1 | `git status --porcelain`에 네가 만들지 않은 변경이 보인다 | **아무것도 되돌리지 말고** 그 출력을 그대로 적고 정지 |
| 2 | 어떤 검증기가 저장소 파일을 수정했다 | 정지. 수정된 파일 목록 보고 |
| 3 | 네 조사 결과가 §2 공증 사실과 충돌한다 | 정지. **네 조사가 틀렸을 가능성을 먼저 적어라** |
| 4 | 사용자에게 잘못된 훈련 강도가 전달될 수 있는 결함 발견 | 정지. 최우선 보고 |
| 5 | 기존 사용자의 저장된 계획이 파괴될 수 있는 결함 발견 | 정지. 최우선 보고 |
| 6 | §3의 기준 숫자(493 / 55 / 224 등)가 재현되지 않는다 | 정지. 저장소가 바뀌었다 |
| 7 | 어떤 파일을 수정해야만 조사가 가능하다 | 정지. **수정하지 말고** 그 사실을 보고 |
| 8 | 예산이 30% 남았다 | D-22 종합 보고서 작성으로 전환. 미완 패킷은 "미실행"으로 명시 |

**정지는 실패가 아니다. 이 프로젝트에서는 밀고 나가서 망가뜨리는 것보다 멈추는 것이 항상 낫다.**

---

## §10. 산출물 목록 (이것만 만든다)

```
reports/review/deepseek-audit/
├── D-01-rule-id-inventory.md
├── D-02-rule-id-orphans.md
├── D-03-broken-path-references.md
├── D-04-metadata-schema-split.md
├── D-05-status-vocabulary.md
├── D-06-validator-inventory.md
├── D-07-validator-vacuity.md          ← 🔴 가장 중요
├── D-08-latest-owner-decision.md      ← 🔴 최우선 실행
├── D-09-rule-machine-validation-matrix.md
├── D-10-slot-vocabulary.md
├── D-11-rpe-numbers.md
├── D-12-experience-bands.md
├── D-13-intent-enums.md
├── D-14-limits-and-caps.md
├── D-15-enum-spec-vs-code.md
├── D-16-numbers-spec-vs-code.md
├── D-17-false-user-promises.md        ← 🔴 사용자 영향
├── D-18-dsb-inv-enforcement.md
├── D-19-open-issue-inventory.md
├── D-20-selfreported-vs-measured.md
├── D-21-backlog-mapping.md
├── D-22-SUMMARY.md
├── D-23-HANDOFF.md
└── D-24-PROPOSALS.md
```

**커밋하지 마라.** 파일만 만들어두면 선행 감사자가 검토 후 커밋한다.

---

## §11. 보고서 품질 기준 — 이걸 못 넘으면 반환된다

| # | 기준 | 자동 확인 방법 |
|---|---|---|
| 1 | 모든 사실 주장에 `파일:행` 또는 실행 명령이 붙었다 | 근거 없는 단정문을 `grep -nE '것 같다\|보인다\|아마\|추정'` 로 자가 검색 |
| 2 | "검출 0건"과 "조사 안 함"이 구분돼 있다 | 각 표에 두 표기가 다르게 나타나는지 확인 |
| 3 | 판정 어휘가 지시서에 정의된 값만 쓰였다 | 각 패킷의 "다음 N개만" 목록과 대조 |
| 4 | 조사 못 한 것 절이 비어 있지 않다 | 비었으면 의심하고 다시 봐라 |
| 5 | 위험도가 4단계 중 하나로 붙었다 | |
| 6 | 오너 결정 필요 항목에 **너의 추천이 없다** | `추천\|권장\|해야 한다` 자가 검색 |
| 7 | §2 공증 사실을 재판정하지 않았다 | C-1~C-12 각각을 인용했는지, 재판정했는지 확인 |
| 8 | 표의 모든 칸이 채워졌다 (빈칸 대신 `조사불가 — 이유`) | |

---

## §12. 자기검증 체크리스트 — D-22에 결과를 적어라

```markdown
- [ ] `git status --porcelain` 결과가 내가 만든 reports/review/deepseek-audit/ 파일뿐이다
      실제 출력: (붙여라)
- [ ] specs/ 아래 수정 0건       → `git diff --stat specs/` 출력: (붙여라)
- [ ] app/ impl/ 수정 0건        → `git diff --stat app impl` 출력: (붙여라)
- [ ] .github/ 수정 0건          → `git diff --stat .github` 출력: (붙여라)
- [ ] 커밋 0건                   → `git log --oneline -1` 이 지시서 발행 시점과 같다
- [ ] §3 기준 숫자 전부 재현됨   → md=___ (493) / 검증기=___ (55) / CI등록=___ (14)
      / 고아=___ (41) / OI=___ (224) / 유니크규칙ID=___ (847) / 고립=___ (693)
      / 경로참조=___ (795) / 해석실패=___ (112)
      🔴 하나라도 다르면 §9-6 정지 조건이다. 진행하지 말고 보고하라.
- [ ] 추측 표현 자가 검색 완료   → 검출 건수: ___ (0이어야 한다)
- [ ] 추천 표현 자가 검색 완료   → 검출 건수: ___ (0이어야 한다)
- [ ] 모든 패킷 파일에 머리말 yaml 있음
- [ ] 공허성 검사(D-07) 최소 6개 수행 → 실제 수행: ___개
- [ ] 정지 조건 발동 여부: 없음 / 있음(어느 것)
```

---

## §13. 왜 이 감사가 필요한가 — 한 문단

이 저장소에는 문서 493건, 규칙 ID 이름공간 20개 이상, 검증기 55개가 있다. 그런데 **CI는 검증기 14개만 부르고, 규칙 이름공간 중 최소 하나(`DSB-INV`)는 기계 검증이 0건이며, 문서가 가리키는 경로 795개 중 112개가 해석되지 않는다.** 즉 **문서와 코드가 갈라져도 아무 알람이 울리지 않는 구간이 넓다.** 선행 감사자는 그 구간 중 한 곳(하루 두 번 훈련 계약)을 깊게 파서 v0.2를 확정했고, 그 과정에서 **자기 자신의 이전 결론이 틀렸음을 발견했다**(C-6). 좁게 깊게 파면 이런 오류를 잡을 수 있지만, **넓은 면적은 여전히 미조사다.** 너의 일은 그 면적을 전부 훑어서, **다음에 깊게 파야 할 곳을 근거와 함께 지목하는 것**이다. 결론을 내리는 것이 아니다.

---

## §14. 오너에게 올려야 하는 것 — 이렇게 형식을 지켜라

D-22의 (2)절에 아래 형식으로만 적는다.

```markdown
### OD-REQ-<번호>. <한 문장으로 결정해야 할 것>

- **사실:** (파일:행 근거와 함께)
- **왜 내가 결정하지 않는가:** (예: 사용자 안전에 영향 / 오너가 다룬 적 없는 축)
- **선택지 A:** … → 결과: …
- **선택지 B:** … → 결과: …
- **어느 문서를 함께 봐야 하나:** …
```

**이미 알려진 오너 결정 대기 항목 1건 (중복 제출하지 마라):**

> `DSB-INV-005` 상한 2를 유지할지 올릴지. 유지하면 짝 세션과 예산을 나눠야 하고(회복 PM이 거의 사라짐), 올리면 오너 결정이 필요하다. 이건 OD-SLOT-8과 **다른 축**이다 (C-5, C-7).

---

## §15. 마지막 — 너에게 기대하는 것

**우리가 너에게 기대하는 것은 "문제 없음"이라는 답이 아니다.**

이 저장소는 이미 여러 차례 자기 오류를 발견해 왔다. 선행 감사자도 **자기가 어제 내린 "정정"이 오늘 틀렸음을 발견하고 스스로 보고했다.** 이 프로젝트의 문화는 그것이다.

따라서:

- **"대체로 괜찮다"는 보고서는 무가치하다.** 세어라.
- **불확실한 것은 불확실하다고 써라.** 그것이 가장 값진 정보다.
- **네가 못 한 일을 숨기지 마라.** 숨긴 공백이 나중에 사용자에게 잘못된 훈련을 준다.
- **네가 밟은 새 함정을 반드시 §5에 추가할 형태로 남겨라.** 다음 작업자를 구한다.

이 저장소는 사람의 몸에 부하를 주는 훈련 계획을 만든다. 문서 한 줄의 오류가 누군가의 부상이 된다. 그래서 이렇게 까다롭게 요구한다.

---

[DRAFT_COMPLETE]
