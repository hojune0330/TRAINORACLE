# CURRENT_IMPLEMENTATION_HANDOFF_2026-07-27.md

> ⚠️ **이 문서는 2026-07-27 당시의 상세 구현 인계 기록입니다. 현재 공개 상태를
> 판단하는 문서가 아닙니다.** 현재 공개 기능, 닫힌 서버 기능, 최신 `main` 배포
> 영수증은 [`BETA_RELEASE_HANDOFF_2026-08-02.md`](./reports/operations/BETA_RELEASE_HANDOFF_2026-08-02.md)의
> `현재 배포 상태 갱신` 절에서 확인하십시오. 아래의 커밋·CI·AM/PM 설명은 당시
> 구현을 재현하는 근거로만 보존합니다. 이 문서만으로 기능 공개 여부를 추론하지
> 마십시오.

> ⚠️ **2026-08-06 사양 갱신 안내 (본문은 당시 기록이므로 고치지 않았다).**
> 이 문서가 인용한 `DSB-INV-002`(PM은 회복 전용)와 `DSB-INV-003`(같은 날 quality 짝 금지)은
> `specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md` **v0.2에서 은퇴하고 새 규칙으로
> 교체됐다.** 은퇴 원문은 그 문서 §10 변경 이력에 보존돼 있다.
> 아래 본문의 해당 인용은 **당시 시점의 판단 기록**으로 읽고, 현재 지침으로 쓰지 마라.
> 지금 유효한 규칙: 새 `DSB-INV-002`·`DSB-INV-003`·신설 `DSB-INV-009`(OD-SLOT-8).
> 근거: `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` §3.3, §4.10.

```yaml
handoff_metadata:
  doc_id: trainoracle-current-implementation-handoff-2026-07-27
  title: TrainOracle Current Implementation And Next Worker Handoff
  version: "1.0"
  status: CURRENT_IMPLEMENTATION_HANDOFF
  owner: COACH_HOJUNE
  recorded_at: "2026-07-27T11:33:00+09:00"
  source_of_truth: "committed local files, GitHub main, and recorded CI state only"
  main_head_at_record: "61eaf3cfdd245778a84718ec2e8e1d3757fdb1fa"
  canonical_promotion_allowed: false
  numeric_template_activation_authorized: false
  final_marker_required: "[DRAFT_COMPLETE]"
```

## 1. First Read: What This Document Is

This is a detailed product-implementation handoff recorded on 2026-07-27. It
describes the public plan beta that was merged into `main` at that time, the
decisions that shaped it, its verified local behavior, and the exact point at
which the next worker had to stop. Read the linked beta release handoff above
before treating any part of this historical record as current state.

It does not replace the formal SPEC layer. It does not promote a draft SPEC,
close a safety issue, authorize numeric personal prescriptions, or convert a
local beta `DAY n` label into a civil-date calendar plan.

`reports/work-harness/NEXT_WORKER_HANDOFF.md` is a preserved historical
handoff for an earlier, restricted formal-SPEC work harness. Do not use it as
the current public-plan implementation status.

## 2. Current Mainline State

| Item | Fact at the recorded time |
|---|---|
| Main commit | `61eaf3c` - merge of PR #132 |
| Preceding research gate | `27d0b91` - merge of PR #131 |
| Current feature commits | `6706481`, `141e56e`, `6fd6227` |
| Public-site workflow run | GitHub Actions `30232215464` on `main` |
| CI state at record time | `contract-tests` PASS, `app-quality` PASS, `app-browser` RUNNING |
| Pages deployment claim | Not yet made in this document; deployment is valid only after the same `main` run's browser and `deploy-pages` jobs succeed. |

The public URL remains <https://hojune0330.github.io/TRAINORACLE/>. A worker
must not claim that this URL contains the current AM/PM feature until the
`main` workflow has completed successfully and the deployed page has been
opened again in a browser.

### Post-Record CI Correction

After this handoff was first recorded, main Actions run `30232215464` failed
only in `app-browser`: `e2e/touch-targets.spec.ts` still searched for the old
accessible button name `강도 시스템 설명 보기`. The actual rendered button was
already `훈련 목적 설명 보기`, as shown by the failing Playwright page snapshot.
All four viewport projects timed out on that stale locator; this was a test
contract mismatch, not a user-facing plan-generation, AM/PM, D9, or storage
failure. The follow-up fix changes that one locator and must receive a fresh
main CI and Pages result before deployment is claimed.

### Verified Resolution

PR #134 merged that one-line test correction into `main` as `843c90e`.
GitHub Actions run `30233240200` then completed successfully: `contract-tests`,
`app-quality`, `app-browser`, and `deploy-pages` all passed. The deployed
public site was opened in a real browser after that run. At mobile width, the
live flow `5km -> VO2 -> EVERY_DAY -> 9 days -> explicit AM/PM -> clear check`
showed two PM `RPE 1-2` sessions, two `RPE 7-8` quality sessions, a selectable
`DAY 4` PM progress control, no horizontal overflow, and no browser console
errors. This verified result supersedes the conditional deployment warning
above for commit `843c90e`; a later commit still requires its own CI check.

## 3. What Users Can Do After The Main Deployment Succeeds

The plan beta remains deliberately bounded, but it is no longer limited to
only a generic easy-running candidate.

1. An athlete may choose a goal/event group, experience band, training intent,
   available days, a 7-, 9-, or 10-day frame, and a current safety answer.
2. Available-day choices are `3`, `4`, `5`, `6`, or `EVERY_DAY`. Recovery
   movement counts as an available day; a fully off day does not.
3. `EVERY_DAY` does not create more quality days. It only gives the candidate
   more places to put existing easy or recovery work.
4. The athlete may explicitly choose either one session per beta day or a
   limited AM/PM option.
5. The AM/PM option means an AM primary session plus PM recovery support only:
   PM is `EASY`, `RECOVERY_INTENT`, and `RPE 1-2`; it is not a second hard
   session, a make-up session, or a medical recovery decision.
6. The Balanced candidate can contain at most one PM recovery session in a
   7-day frame and two in a 9- or 10-day frame. The Conservative candidate
   contains no PM session. A PM session cannot share a day with `QUALITY`.
7. Progress is stored by `DAY n + AM/PM`, so an afternoon record cannot
   overwrite the morning record. Older locally stored plans load as AM-only
   single-session plans and never receive inferred consent.
8. Users can select BASE, LT, VO2, GLY, ATP-PC, or recovery intent in the
   current beta. The result is still an RPE-and-duration range with a plain
   explanation, not a target pace, rep count, distance, interval recovery, or
   individualized physiological prescription.

The RPE help is intentionally concrete:

- `RPE 1-2`: brisk walking, very easy jogging, easy cycling, or gentle uphill
  walking with comfortable breathing.
- `RPE 3-4`: basic aerobic work where sweat is possible and conversation or a
  phone call remains possible.

## 4. Owner Decisions Already Reflected In Code

- A self-selecting athlete may see high-intent candidates. Coach connection is
  not a prerequisite for this bounded RPE beta.
- Minors may use the same RPE-only beta boundary. This is not permission to
  activate numeric templates for minors.
- Dedicated 100m, 200m, and 400m planning remains deferred.
- Daily availability must be described as days on which the athlete can move,
  including recovery movement, rather than the vague phrase "days you can
  train."
- A double session is a deliberate choice. It must never be inferred from
  `EVERY_DAY` or from a missed session.
- The product goal remains a useful plan candidate that encourages return
  visits and journal use, not a system that rewards unsafe training volume.

## 5. Safety And Data Boundaries That Remain Non-Negotiable

```yaml
must_remain_true:
  D9_ACTIVE: blocks_plan_generation
  D9_UNKNOWN: blocks_or_requires_human_review
  D9_CLEARED: not_medical_clearance
  raw_memo_symptom_or_evidence_clause_in_plan_audit: forbidden
  free_text: may_raise_risk_but_cannot_clear_it
  good_physio_or_template_data: cannot_clear_D9
  explicit_PM_recovery: never_quality_and_never_catch_up
  numeric_template_catalog: 30_of_30_inert_draft_entries
  research_index_runtime_authority: disabled
```

The unresolved local AM/PM boundaries are recorded in
[`specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md`](./specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md):

- `OI-DSB-CALENDAR-CROSSWALK-001`: no accepted `DOUBLE`/`FLEX` or civil-date
  mapping exists yet.
- `OI-DSB-SAFETY-HOLD-INTEGRATION-001`: no accepted dated-calendar hold and
  recheck flow exists yet.
- `OI-DSB-TEMPLATE-ELIGIBILITY-001`: no accepted source, eligibility, youth
  policy, and anchor binding exists for numeric PM or other template output.

## 6. Verification Already Performed

These are execution facts from the committed feature branch before merge. They
are not proof that an upstream formal SPEC is canonical.

| Scope | Result |
|---|---|
| `impl` typecheck | PASS |
| `impl` tests | PASS, 92 tests |
| `app` typecheck and production build | PASS |
| `app` unit tests | PASS, 299 tests |
| Full Playwright run | PASS locally; 164 cross-viewport test invocations with no failure artifacts |
| Detailed prescription catalog validator | PASS, `30/30` inert draft entries |
| Training research acceptance validator | PASS, 60 public rows and 24 paper candidates; runtime authority disabled |
| Manual production-build visual checks | PASS at 375x812 and 1280x900; no horizontal overflow; AM/PM labels, high-intent RPE, and RPE help visible |

The mainline CI state is intentionally separate from this table. Check it
again before stating that the website is updated.

## 7. Files That Explain The Implementation

| Need | Read these files |
|---|---|
| Core AM/PM safety boundary | `specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md` |
| What was implemented and locally verified | `reports/implementation/DAILY_AVAILABILITY_AND_DOUBLE_SESSION_BETA_IMPLEMENTATION_REPORT_2026-07-27.md` |
| Plan engine types and candidate rules | `impl/src/plan-generator/types.ts`, `impl/src/plan-generator/candidates.ts`, `impl/src/plan-generator/progress.ts` |
| App intake, local store, and AM/PM presentation | `app/src/screens/plan-beta/PlanIntake.tsx`, `app/src/domain/plan-beta-store.ts`, `app/src/screens/plan-beta/PlanCandidates.tsx`, `app/src/screens/plan-beta/ActivePlan.tsx` |
| Regression coverage | `impl/test/plan-energy-intent.test.ts`, `impl/test/plan-beta-selection.test.ts`, `app/src/domain/plan-beta-store.test.ts`, `app/e2e/launch-ready.spec.ts` |
| Formal SPEC inventory | `TRAINORACLE_SPEC_INDEX.md` |
| Public-beta product direction | `PLAN_BETA_PRODUCT_DECISION_2026_07_24.md` |

## 8. First Five Actions For The Next Worker

1. Start from a clean worktree on current `origin/main`; do not trust an old
   worktree or a conversation summary.
2. Check the latest `main` Actions run before touching code:

   ```powershell
   git fetch origin main
   gh run list --branch main --limit 5
   gh run view 30232215464
   ```

3. If `app-browser` or `deploy-pages` failed, inspect its logs and fix the
   smallest demonstrated failure. Do not claim the live site has the feature.
4. If the full main run succeeded, open the public site and manually verify:
   one-session flow, explicit two-a-day flow, a PM progress record, RPE `?`,
   375px no-overflow view, and no console error. Record that runtime evidence
   separately.
5. Only after the deployment check, choose the next task from Section 9. Do
   not silently turn on a numeric template while doing visual or wording work.

## 9. Next Safe Product Work

The next meaningful plan-quality task is **one non-sprint detailed-template
activation packet**, not a bulk activation of the 30 draft templates. The
packet must name one event and experience scope and include all of the
following before an owner decision:

1. exact source extraction and source-trust tier;
2. Template Library ID and version;
3. event, experience, and youth eligibility;
4. freshness/provenance of the performance anchor;
5. warm-up, cool-down, downshift, and stop conditions;
6. D9/RVE/Safety Gate behavior;
7. human reviewer evidence; and
8. an explicit owner activation decision.

Separate follow-on work is needed for a real dated calendar and the formal
`DOUBLE`/`FLEX` crosswalk. Do not represent the current local AM/PM labels as
that solution.

## 10. Handoff Completion Rule

This document is sufficient only when a next worker can reproduce the current
state from `main`, identify whether GitHub Pages deployed it, and know which
next actions are blocked by formal safety or source evidence. If any of those
facts differ in the repository, update this document with the observed file
and CI evidence instead of copying old counts or status from memory.

[DRAFT_COMPLETE]
