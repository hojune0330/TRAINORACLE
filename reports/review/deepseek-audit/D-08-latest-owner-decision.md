# D-08. `validate-latest-owner-decision.mjs` 규명 (F-2, 최우선 패킷)

```yaml
packet: D-08
executor: DeepSeek
executed_at: "2026-08-06"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
```

- 패킷: D-08 (`WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md` §6 D-08)
- 감사자: DeepSeek (지시서 v1.1 실행자) / Round 3
- 기준 커밋: b4f5d99 (main HEAD = origin/main)
- 대상: `specs/test-packages/validate-latest-owner-decision.mjs` (95줄)
- pending: 없음

## 1. 배경 (왜 최우선인가)

최상위 판정 규칙 = **"최신 오너 결정이 이전 초안을 이긴다"** (`reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md` 헤더 yaml `decision_precedence: LATEST_EXPLICIT_OWNER_DECISION_GOVERNS`). 이를 검사하는 검증기가 존재·통과·`conflicts=12` 보고하나 **CI에 없다**. 지시서 지시: CI 추가 금지(쓰기 금지 구역), **제안 문서만**.

## 2. Q1~Q6 답변 표 (지시서 §6 형식)

| # | 질문 | 답 | 근거 |
|---|---|---|---|
| Q1 | `conflicts=12`의 12개는 구체적으로 무엇인가? 검증기가 목록을 출력하나, 개수만 세나? | **FRV2-CONF-001 ~ FRV2-CONF-012** (12건 전부 `reports/review/FORMATION_SPEC_CONFLICT_REGISTER.csv`의 행). 검증기는 개수만 세지 않고 **하드코딩된 `expectedConflictIds` 셋 12개와 1:1 비교**(missing 1건이라도 `errors` → exit 1). 상세 목록(conflict_id·status)은 **출력하지 않음** — 성공 시 `conflicts=12` 개수만. 사본 계측(/tmp/vlod.mjs)으로 12개 ID·status 전수 재현 확인. | 검증기 L16~29(expectedConflictIds 12개), L63~70(actualConflictIds.size·셋 비교), L90~95(출력 `conflicts=12`). 사본 실행 출력: Q1_ROW FRV2-CONF-001…012 + status 5종 |
| Q2 | 이 검증기는 어떤 파일을 읽는가? | **4개 파일 + 1개 모듈**: ①`reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md` ②`reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md` ③`.omo/plans/trainoracle-formation-followup-deep-research.md` ④`reports/review/FORMATION_SPEC_CONFLICT_REGISTER.csv`(parseCsv) + `specs/test-packages/formation-csv.mjs`(모듈 의존). **최신 결정 문서 `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md`는 읽지 않음(→Q5).** | 검증기 L9~15(read 4건), L4~5(import parseCsv). 사본 실행으로 경로 해석 성공 확인 |
| Q3 | `conflicts`가 0이 아닌데 왜 통과(VALID)로 끝나는가? 충돌을 허용하도록 설계됐나? | **"충돌 존재"를 실패 요인으로 보지 않도록 설계됨.** 이 검증기의 판정 대상은 "충돌이 없다"가 아니라 **"충돌 레지스터가 baseline(최신 오너 결정)과 정합하게 기록·유지되는가"**다. 12건은 각각 고정 `status`가 지정된 진행 중 항목(예: FRV2-CONF-012=OWNER_DECISION_REQUIRED)이며, 검증기는 ①12건 전부 존재 ②`expectedStatusByConflict` 12개 맵과 status 1:1 일치 ③`required_patch`/`user_impact` 비어있지 않음 ④FRV2-CONF-008·010 특수 요구 충족을 확인한다. **퇴역이 필요한 초안 대비 항목이기에 존재 자체는 정상 상태** — 그래서 통과(VALID)다. 단, `PATCH_REQUIRED` 4건(<001·002·003·011)을 "앞으로 고쳐야 함"으로 보고만 하고 실패시키지 않음도 설계 의도. | 검증기 L30~43(상태 맵), L71~76(status 비교), L78~89(008/010 특수). CSV 전수: FRV2-CONF-001=PATCH_REQUIRED … 012=OWNER_DECISION_REQUIRED |
| Q4 | `runtime=false`는 무슨 뜻인가? 어느 문서가 이 어휘를 정의하나? | **"런타임 권한 비활성 — 제품 실행 코드가 아직 이 결정을 따르지 않음."** 정본 정의는 baseline 헤더 `runtime_authority: false_until_named_gates_pass` (L14) — "이름 있는 게이트(supersedes 충돌 목록)가 전부 닫힐 때까지 런타임 권한 없음". 출력의 `runtime=false`는 검증기가 정의 구문 8종 중 `runtime_authority: false`(L53)를 baseline에서 확인한 결과. 하위 계약들도 동일 어휘 반복(specs/reconstruct/*.md 각 L6~17 `runtime_authority: false`) — 별도 용어집 문서는 없고 baseline이 정본. | baseline L14·L92; 검증기 L53; specs/reconstruct/CALENDAR_VERSION_AND_SYNC_CONTRACT.md:7 등 12개 파일 |
| Q5 | 이 검증기가 `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md`(가장 최신 결정)를 읽고 있나? | **아니오 — 미참조.** baseline·protocol·plan·CSV·검증기 어디에도 `SESSION_SLOT_INTENSITY` / `TO-OWNER-SLOT-INTENSITY` / `2026_08_06` 언급이 없음(전역 grep 빈 결과). 검증기는 2026-07-17 결정(baseline `decision_id: TO-OWNER-FORMATION-2026-07-17-01`)만 안다. **"최신 결정이 이긴다" 원칙 텍스트**(8구문 + protocol/plan 2문장)는 확인하지만, **가장 최신 결정 문서가 무엇이고 반영됐는지는 아예 모름** — 지시서가 우려한 구멍이 실재한다. 또한 최신 결정 문서(2026-08-06)는 자기 자신에 `supersedes_draft: DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md (DSB-INV-002, DSB-INV-003)` "은퇴" 목록을 갖고 있어, 검증기가 그 은퇴 상태도 알지 못한다. | 전역 grep `SESSION_SLOT_INTENSITY|TO-OWNER-SLOT-INTENSITY|2026_08_06` → 0건; 검증기 L9~15; 최신 결정 문서 L12, L124~125(DSB-INV-002/003 은퇴) |
| Q6 | 이게 CI에 없는 이유가 어딘가에 기록돼 있나? | **아니오 — 이유 기록 없음.** `.github/workflows/ci.yml` L33~47은 contract-tests에서 9개 `.mjs`만 실행하며 `latest-owner`/`spec-reconciliation` 모두 **0 등록**(grep -c = 0). `.omo/plans/trainoracle-formation-latest-decision-spec-reconciliation.md` §6에 "fail-closed reconciliation validator 추가"를 계획(L341 Existing 목록에 포함, L450~462 로컬 실행 나열)하지만 **CI 등록 단계는 명시하지 않음**. F-2 발견 사실 자체는 `INCOMPLETE_WORK_BACKLOG.md:52`·`D-06:119`에 기록 — "왜 CI에 없는가"의 사유 문장은 어디에도 없다. 근사 사유: reconciliation plan이 실행 대기 상태라 CI 반영이 후속 작업으로 남아 있음. | ci.yml grep -c = 0; plan L341·L450~462; INCOMPLETE_WORK_BACKLOG.md:52 |

## 3. 부가 관찰

1. **Q5의 실질 함의 (지시서 강조점):** 검증기가 최신 결정(2026-08-06, `runtime_authority: true`)을 모르는 채 baseline(2026-07-17, `runtime_authority: false_until_named_gates_pass`)만 보고 `runtime=false`를 출력한다. **출력값이 "전체 최신 의사결정 상태"가 아니라 "검증기가 아는 문서만의 상태"임**을 D-08 발견으로서 명시한다.
2. **double-validator 동조:** D-06에서 `validate-formation-spec-reconciliation.mjs`도 `conflicts=12` 출력 — 두 검증기가 같은 CSV를 같은 방식으로 읽어 같은 답을 낸다(동조는 검증 독립성 관점에서 참고).
3. **사본 실행 성공:** `formation-csv.mjs`가 무의존라 `/tmp/vlod.mjs`(import 절대화) 실행 성공 — "사본 실행 불가" 항목은 해당 없음.

## 4. OD-REQ

**OD-REQ-D08-001 (사실관계):** 검증기가 가장 최신 오너 결정 문서(`OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md`)를 읽지 않으므로, "최신 결정이 이긴다"는 최상위 규칙이 **결정 문서 레벨에서 기계검증되지 않는** 상태다.

- 사실: Q5 (미참조 전역 grep 0건)
- 왜 내가 결정하지 않는가: 이 검증기가 어떤 문서를 "최신 기준"으로 삼을 것인지(단일 정본? 결정 문서 목록?)는 제품 문서 체계의 설계 결정. 그리고 이 검증기 자체를 어디에 등록·실행할지는 CI/프로세스 소유자의 결정.
- 선택지 A: 다음 감사에서 "최신 결정 문서 목록 인덱스"를 정의하고 이 검증기에 그 인덱스 읽기·은퇴 상태 확인을 추가한다 (제안 문서로만).
- 선택지 B: 최신 결정 문서가 자기 `supersedes_draft`로 baseline에 합류되는 절차 문서를 만들고, 이 검증기는 baseline·CSV 하위 정합만 유지한다.
- 어느 문서를 함께 봐야 하나: `INCOMPLETE_WORK_BACKLOG.md`(F-2), `.omo/plans/trainoracle-formation-latest-decision-spec-reconciliation.md` §6, `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md`, `reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md`.

## 5. 한계

- CI 부재 사유는 "기록 없음"으로 판정 — 기록이 실제로 없음을 전역 grep으로 확인했으나, git history에서 삭제된 사유가 있을 가능성은 확인하지 못함(범위 외).
- 최신 결정 문서의 내용 전체(슬롯 배치 규칙)를 D-08에서 심층 판독하진 않음 — D-10(슬롯 어휘)에서 상세 취급.
