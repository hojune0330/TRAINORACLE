# D-07. 검증기 공허성 실측 (결함 주입 검증)

```yaml
packet: D-07
executor: DeepSeek
executed_at: "2026-08-06"
repo_sha: "b4f5d99"
mode: READ_ONLY
verdict_authority: NONE
```

- 패킷: D-07 (`WORK_ORDER_DEEPSEEK_SPEC_WIDE_AUDIT.md` §6 D-07)
- 감사자: DeepSeek (지시서 v1.1 실행자) / Round 3
- 기준 커밋: b4f5d99 (감사 대상 워킹트리 = main HEAD = origin/main)
- 실행 환경: node v22.23.1, worktree 클린 상태에서만 실행
- pending: 없음 (전 항목 완료)

## 1. 개요

**목적:** "일부러 깨서 실패하는 것을 본 적이 없으면 그 검증기는 검증기가 아니다" (함정 T-10). 각 검증기가 실제로 결함을 이름으로 잡아내는지, 아니면 어떤 결함을 넣어도 통과하는지(공허)를 격리 사본에서 결함 주입 → 재실행 → 반응 기록으로 실측한다.

**대상 6종 (지시서 §6 최소 5+1 조건 충족):**
1. `reasoning-tier-harness.mjs` (CI 등록)
2. `validate-formal-approval-foundation.mjs` (CI 등록)
3. `validate-formation-p1-target-plans.mjs` (CI 등록)
4. `validate-detailed-prescription-catalog.mjs` (CI 등록)
5. `validate-journal-decoration-contract.mjs` (CI 등록)
6. `validate-latest-owner-decision.mjs` (F-2 고아, 최우선)

**격리 방법 (원본 무해):**
- 지시서 기준은 `cp -a /home/user/webapp /tmp/vac_repo`였으나, node_modules 383M 포함 총 526M로 비효율 → **`git worktree add --detach /tmp/vac_repo HEAD`** (b4f5d99, 경량·클린)로 격리. 스펙의 "원본을 건드리면 실패" 조건은 충족 (모든 주입/복원을 `/tmp/vac_repo`에서만 수행).
- 결함 주입 → 검증기 실행 → `git -C /tmp/vac_repo checkout -- <file>` 복원. 정지 조건("파일 수정 시 멈춤") 준수 — 감사 완료 후 `git status --porcelain` = **0건** 확인.

## 2. 결과 요약

**🔴 공허 0건 / 유효 5건 / 부분 유효 1건 / 검사 불가 0건.**

최상위 발견(🔴 완전 공허)은 **없음**. 다만 부분 유효 1건(§4)은 실질 리스크가 있어 이 감사 D-07의 핵심 발견으로 앞에 둔다.

| 판정 | 건수 | 검증기 |
|---|---|---|
| 유효 — 결함을 이름으로 잡아냄 | 5 | reasoning-tier-harness / p1-target-plans / detailed-prescription-catalog / journal-decoration-contract / latest-owner-decision |
| 부분 유효 — 일부 결함만 잡음 | 1 | formal-approval-foundation (§4) |
| 🔴 공허 — 결함을 넣어도 통과함 | 0 | — |
| 검사 불가 — 이유 명시 | 0 | — |

## 3. 결함 주입 결과 표 (지시서 §6 출력 형식)

| 검증기 | 읽는 대상 파일 | 주입한 결함 | 검증기 반응 | 판정 |
|---|---|---|---|---|
| `reasoning-tier-harness.mjs` | `reports/work-harness/TRAINORACLE_WORK_CATALOG.json` + tasks[].evidence 경로 (`:6, :189`) | `runtimeAuthority: false → true` 주입 | `E_RUNTIME_AUTHORITY: runtimeAuthority must remain false`, exit 1 | 유효 — 결함을 이름으로 잡아냄 |
| `validate-formal-approval-foundation.mjs` | EVIDENCE 8건 (git blob 기준), `reports/review/FORMATION_FORMAL_APPROVAL_ROSTER.md`, `reports/review/WO010_STRICT_REACCEPTANCE_HANDOFF.md`, `specs/reconstruct/EVIDENCE_MANIFEST_AND_SIGNATURE_CONTRACT.md` | **1차:** `.omo/evidence/work-order-010/verification.md`에 마커 추가 (sha256 변조) / **2차:** roster `actual_approver_count: 0 → 1` | **1차: PASS (exit 0) — 미검출** / 2차: `FORMAL_APPROVAL_FOUNDATION_INVALID: missing actual_approver_count: 0`, exit 1 | **부분 유효** — evidence 파일 작업트리 변조를 놓침 (§4) |
| `validate-formation-p1-target-plans.mjs` | `reports/target-patch-plans/*.md` 10건 + `README.md`, `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` (`:6~7`) | `01-coach-ruleset.md`의 `## Exact Targets` 아래 `TBD placeholder` 주입 | `AssertionError: 01-coach-ruleset.md contains an unresolved generic target`, exit 1 | 유효 — 결함을 이름으로 잡아냄 |
| `validate-detailed-prescription-catalog.mjs` | `specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md`, `specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md` (`:14~15`) | 첫 항목 `notationPattern: "30~45′ @E" → "30~45′ @E INJECTED-DEFECT"` | `FAIL BA-SEED-01 must preserve its canonical notationPattern`, exit 1 | 유효 — 결함을 이름으로 잡아냄 |
| `validate-journal-decoration-contract.mjs` | `specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md` (`:4~8`) | `[DRAFT_COMPLETE] → [DRAFT_INCOMPLETE]` 마커 변조 | `journal decoration contract validation failed: final marker must be the last nonempty line`, exit 1 | 유효 — 결함을 이름으로 잡아냄 |
| `validate-latest-owner-decision.mjs` | `reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md`, `reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md`, `.omo/plans/trainoracle-formation-followup-deep-research.md`, `reports/review/FORMATION_SPEC_CONFLICT_REGISTER.csv` (`:9~15`) | baseline의 `LATEST_EXPLICIT_OWNER_DECISION_GOVERNS → LATEST_EXPLICIT_OWNER_DECISION_REVERSED` 변조 | `FORMATION_OWNER_BASELINE_INVALID baseline missing LATEST_EXPLICIT_OWNER_DECISION_GOVERNS`, exit 1 | 유효 — 결함을 이름으로 잡아냄 |

복원 후 모든 검증기 baseline 재실행 rc=0 확인 (6종 × 주입 전 + 복원 후).

## 4. 핵심 발견 — `validate-formal-approval-foundation.mjs` 부분 공허 (EVIDENCE 작업트리 미검증)

**구체적으로 놓친 결함:** `EVIDENCE` 8건 증거 파일의 **작업트리 내용 변조** (미커밋 상태의 위조/변경)를 검증기가 감지하지 못함.

**재현 절차:**
1. `/tmp/vac_repo`에서 `.omo/evidence/work-order-010/verification.md` 끝에 `# DEFECT-INJECTED tail marker` 추가 (파일 sha256 변경됨)
2. `node specs/test-packages/validate-formal-approval-foundation.mjs` → **PASS (exit 0, evidence=8 approvals=0 keys=0 authority=false wo010=NOT_ACCEPTED)**
3. 동일 검증기 2차 주입 (roster `actual_approver_count: 0→1`) → **FAIL** — 즉 검증기는 유효하나 **그 특정 결함군만 놓침**

**원인 (파일:행 근거):**
- `validate-formal-approval-foundation.mjs:91~103` `readSourceBlob()`: `spawnSync("git", ["show", \`${SOURCE_SHA}:${path}\`])` — **git blob**(SOURCE_SHA = `a6857bcd…` 커밋 시점의 blob)을 읽음
- `:133~142` `verifyManifest()`: `sha256(sourceBlob) !== expectedHash` 비교 — **작업트리 파일은 `readNfc()`로 읽지 않고 git blob과만 비교** (작업트리 원본은 8건 중 어느 것도 해시 검증 대상이 아님)
- `:114~121` `verifySourceIsMergedMain()`: SOURCE_SHA가 origin/main의 조상인지만 확인 — 이후 커밋으로 evidence가 바뀌어도 검사 대상 blob은 SOURCE_SHA에 고정
- 따라서 **이 검증기는 "증거 파일의 현재 작업트리 무결성"을 검사하지 않음**. 검사하는 것은 ①그 blob이 하드코딩 해시와 일치하는지(고정 파기 방지), ②handoff manifest에 하드코딩 해시 행이 존재하는지(`:139~141`) — 기존 해시 목록 자체가 위조되는 경로는 차단하나, **작업트리 evidence 내용이 바뀌어도 통과**함

**판정:** `부분 유효 — 일부 결함만 잡음` (놓친 것 = EVIDENCE 8건의 작업트리 내용 변조; 잡은 것 = REQUIRED_DOCUMENTS 마커 위조, authority=true 성문화, manifest 경로·해시 고정 무결성, 서명 성문화 등)

**참고 (설계 의도와의 관계):** "SOURCE_SHA 시점 blob이 하드코딩 해시와 일치"를 보증하는 자체는 설계 의도로 보임(검토가 끝난 스냅샷 고정). 다만 이 검증기의 **현재 작업트리에 대한 실효 검증 범위는 REQUIRE_DOCUMENTS 마커와 authority 성문화 금지에 국한**되며, "증거 파일 내용 무결성"을 주장·보고(`PASS formal approval foundation: evidence=8`)하는 것에 비해 검사 범위가 좁음 — 이 점은 사실관계로 기록한다.

## 5. 유효 판정 5건의 검증 강도 메모

- `reasoning-tier-harness`: CATALOG.json `runtimeAuthority` 반전을 **이름으로 직접** 오류(E_RUNTIME_AUTHORITY)로 응답. evidence 존재·마커 검사도 별도 보유.
- `p1-target-plans`: TBD 1건 삽입을 `contains an unresolved generic target`으로 명명. 15개 헤딩·금지 플레이스홀더 5종·`runtime_authorized: false` 등 연쇄 검사.
- `detailed-prescription-catalog`: 표기 1자 변조를 `BA-SEED-01 must preserve its canonical notationPattern`으로 명명. intentCounts 6×5·30블록 exact match.
- `journal-decoration-contract`: 마커 1자 변조를 문장으로 실패. 8개 카탈로그 행·4개 슬롯 행·7필드 state shape·금지 패턴 다수.
- `latest-owner-decision`: baseline 구문 1개 변조를 `FORMATION_OWNER_BASELINE_INVALID`로 명명. 충돌 12건 정체·상태값 12종·CSV 1:1 검사 (D-08에서 심화).

## 6. 함정 T-10 재확인 (종료코드 0 ≠ 검증됨)

- 6종 모두 "일부러 깨서 실패하는 것"을 **최소 1회 이상 목격** (위 표). 전부 실패 경로 확인됨.
- 단, formal-approval-foundation은 깨뜨리는 것에 성공한 주입(EVIDENCE 변조)도 있었음 → 부분 유효로 기록 (§4). **"한 결함을 잡으면 검증기가 아니다"가 아니라 "어느 결함을 잡고 어느 것을 놓치는지"를 종류별로 세어야 함** — 이 패킷은 그 방식으로 실측했다.

## 7. OD-REQ

- OD-REQ: **0건** (D-07은 판정 실측만 수행. "evidence 검사를 작업트리 기준으로 바꿀지" 등은 결정 사항이므로 도출하지 않음 — D-22 종합 패킷에서 의사결정 블록으로 이관 대상 참조만 남김)

## 8. 한계

- 주입 대상은 지시서 요구 최소 6종에 한정. 나머지 49종(55-6)은 D-06에서 rc=0 확인만 하고 주입 미실시 — 전수 주입은 범위 외 (후속 패킷 제안 대상, D-24 참조).
- 주입 결함은 각 검증기의 주된 검사 축 1종씩. 다중 축(예: evidence 없음 + authority 동시) 조합은 미실시.
- 격리는 `git worktree`로 수행 (지시서 기준 `cp -a` 대체). 깊이(디렉터리 순회)는 노드모듈 미포함이라 `cp`와 동일한 경량·물리 격리 수준은 아니나, 결함 주입·복원·클린성 검증 모두 worktree 내에서 완결.
