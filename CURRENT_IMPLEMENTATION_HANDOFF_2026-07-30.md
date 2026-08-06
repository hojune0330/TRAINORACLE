# CURRENT_IMPLEMENTATION_HANDOFF_2026-07-30.md

> ⚠️ **2026-08-06 사양 갱신 안내 (본문은 당시 기록이므로 고치지 않았다).**
> 이 문서가 인용한 `DSB-INV-002`(PM은 회복 전용)와 `DSB-INV-003`(같은 날 quality 짝 금지)은
> `specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md` **v0.2에서 은퇴하고 새 규칙으로
> 교체됐다.** 은퇴 원문은 그 문서 §10 변경 이력에 보존돼 있다.
> 아래 본문의 해당 인용은 **당시 시점의 판단 기록**으로 읽고, 현재 지침으로 쓰지 마라.
> 지금 유효한 규칙: 새 `DSB-INV-002`·`DSB-INV-003`·신설 `DSB-INV-009`(OD-SLOT-8).
> 근거: `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` §3.3, §4.10.

```yaml
handoff_metadata:
  doc_id: trainoracle-current-implementation-handoff-2026-07-30
  title: TrainOracle Current Product And Execution Handoff
  version: "1.0"
  status: CURRENT_IMPLEMENTATION_HANDOFF
  owner: COACH_HOJUNE
  recorded_at: "2026-07-30T00:00:00+09:00"
  main_head_at_record: "40c264025a30b4a3707f06ae5f7d9c29777f35b9"
  source_of_truth: "current GitHub main, pull request metadata, CI output, and committed files observed on 2026-07-30"
  canonical_promotion_allowed: false
  numeric_template_activation_authorized: false
```

## 1. First Read

This is the execution handoff for the currently shipped TrainOracle product.
It is not a replacement for the formal SPEC layer, a medical clearance, or an
authorization to activate numeric training templates.

Read in this order:

1. this document;
2. `CURRENT_IMPLEMENTATION_HANDOFF_2026-07-27.md` for the detailed plan-beta boundary;
3. `reports/review/REMAINING_OPEN_PR_RECONCILIATION_2026-07-29.md` for legacy PR dispositions;
4. `TRAINORACLE_SPEC_INDEX.md` before changing a SPEC document.

`HANDOFF_NEXT_CHAT.md` is retained only as a June design-history record. It is
not current product status and must not be used to restart completed design work.

## 2. Current Main And Deployment Evidence

| Item | Observed fact |
| --- | --- |
| Current main commit | `40c2640` - past journal revisit flow from PR #148 |
| Main CI | [run 30465250070](https://github.com/hojune0330/TRAINORACLE/actions/runs/30465250070) completed successfully |
| Contract checks | PASS |
| App quality checks | PASS |
| Browser regression | PASS: 161 passed, 35 conditionally skipped |
| GitHub Pages publish | PASS in the same main run |
| Public URL | <https://hojune0330.github.io/TRAINORACLE/> |

The Pages job proves that the verified main build was published. A later code
change still requires its own CI and deployment check before anyone claims it
is live.

## 3. What A User Can Actually Do

### Journal

- Write local post-session, evening, and race records without an account.
- See recent records and structured summaries from saved local data.
- Reopen a past local record, edit it in place, or add another record to that
  same past date.
- Export structured data with private memo text excluded by default.

PR #148 is the current past-journal implementation. Its update path preserves
the existing record's id, kind, date, saved time, and sync state. Imported
records do not expose the edit path, and editing cannot silently turn a legacy
record into explicit provenance.

### Plan Beta

- Choose an event group, experience band, training intent, available movement
  days, a 7-, 9-, or 10-day frame, and a current safety answer.
- Compare two candidates and select one for local progress tracking.
- Choose BASE, LT, VO2, GLY, ATP-PC, or recovery intent.
- Explicitly choose limited AM/PM support. PM is only RPE 1-2 recovery support;
  it is never a second high-intensity session or missed-work catch-up.
- Open the notation reader for a structured expression such as
  `2x(10x400m) @5000m RP r60\" R3'` and see sets, repetitions, distance, and
  recovery totals.

## 4. Training-Plan Truth Boundary

The current plan beta is real and selectable, but it is not yet a personalized
numeric prescription engine.

| Present now | Not present now |
| --- | --- |
| Candidate purpose, RPE range, duration range, local DAY n sequence, and limited AM/PM recovery display | Personal target pace, repetition count, distance dose, interval recovery prescription, or automatic calendar write |
| Parser that explains an entered notation | Runtime use of that notation to prescribe a personal session |
| 30 detailed research/template records with strong fail-closed validation | Active numeric templates: all 30 remain `DRAFT` and `REVIEW_REQUIRED` |
| Advisory recommender contract and validator | User-visible advisory runtime candidates: current count is 0 |

Do not describe the notation reader or the inert catalog as a generated
individual workout. Do not activate a catalog entry in a wording, UI, or
cleanup task.

## 5. Non-Negotiable Safety And Privacy Rules

```yaml
must_remain_true:
  D9_ACTIVE: blocks_plan_generation
  D9_UNKNOWN: blocks_or_requires_human_review
  D9_CLEARED: not_medical_clearance
  raw_private_memo_or_symptom_clause_in_plan_or_audit: forbidden
  free_text: may_raise_risk_but_cannot_clear_it
  good_template_or_physio_data: cannot_clear_D9
  EVERY_DAY: does_not_add_quality_days
  PM_recovery: explicit_only_and_never_quality
  numeric_template_catalog: 30_inert_draft_entries
```

For the full beta boundary, read
`CURRENT_IMPLEMENTATION_HANDOFF_2026-07-27.md` and
`specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md`.

## 6. PR And Issue Reality

| Item | Current disposition | What a worker must do |
| --- | --- | --- |
| PR #148 | Merged and deployed | Treat as the source of truth for past-date revisit behavior. |
| PR #114 | Closed as superseded by #148 | Do not rebase, cherry-pick, or revive it. |
| PR #126 | Still open, draft, and based on a non-main lineage | Do not merge it. Its local archive idea needs a fresh-main, provenance-safe replacement first. |
| PR #103 | Closed as superseded by #116 and #118 | Do not revive its backend, migration, CI, or API code. |
| Issue #125 / PR #127 | Runtime notation work was merged through #127 | Do not mistake the merged parser/display work for numeric template activation. |
| Issue #146 | Open dev-only dependency advisory review | Keep it separate from product feature work. |

Historical WO017 and older design/spec PRs are preserved for traceability but
are not executable product authority. Check current `main`, not an old branch
or a conversation ledger, before accepting any work order.

## 7. Next Safe Work

1. A fresh-main, provenance-safe archive replacement may be planned for the
   still-open legacy PR #126. It is not authorized to copy or merge #126.
2. One non-sprint numeric-template activation packet may be prepared only when
   it contains source extraction, event and experience scope, youth policy,
   performance-anchor provenance/freshness, warm-up/cool-down, downshift and
   stop conditions, qualified review evidence, and an explicit owner decision.
3. Before any new implementation, inspect open PRs and all registered
   worktrees to avoid duplicating a worker already in that area.

## 8. Handoff Completion Check

Before starting work, a new worker must verify all of the following from live
repository evidence:

```bash
git fetch origin --prune
git log -1 --oneline origin/main
gh pr list --repo hojune0330/TRAINORACLE --state open
gh run list --repo hojune0330/TRAINORACLE --branch main --limit 5
git worktree list --porcelain
```

If these facts differ, update this handoff from the observed repository state
instead of copying its counts, branch names, or status claims forward.

[DRAFT_COMPLETE]
