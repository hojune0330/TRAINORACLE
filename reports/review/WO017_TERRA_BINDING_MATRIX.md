# WO017 Terra Very High Binding Matrix

```yaml
artifact_type: documentation_only_contract_binding
primary_worker: gpt-5.6-terra
reasoning_effort: xhigh
implementation_authorized: false
runtime_authority: false
controlling_issue_url: https://github.com/hojune0330/TRAINORACLE/issues/100
issuance_sha: 1941c6202231721a96ad45f9e3b9a15899f01722
issuance_branch_head_at_review: 0585390cc8f307385f1969b4d7ed2852c4f38ef9
fable_head_sha: f900793601aa6e1409efb5ee8f756c3924f45549
fable_pr_url: https://github.com/hojune0330/TRAINORACLE/pull/102
fable_base_relationship: DIVERGED_AHEAD_2_BEHIND_1
fable_provenance_rule: "Treat PR #102 as a bounded UX proposal only; do not treat its branch as current-main implementation evidence."
pr_title: [WO017] Bind onboarding UX to current contracts
pr_url: https://github.com/hojune0330/TRAINORACLE/pull/104
```

## Binding Rule

The Fable artifact is a documented proposal. `CURRENT_APP_EVIDENCE` identifies only
what a cited checked-in file already contains; it grants no new behavior. A
`DRAFT_REFERENCE_ONLY` source may guide a proposed state but cannot provide runtime,
medical, safety, plan, storage, consent, identity, synchronization, schema, or
deployment authority. Every future app change remains `NOT_AUTHORIZED`.

## State Binding Matrix

| UX state or copy | Source path | Authority | Allowed fact | Insufficient or error state | Implementation |
| --- | --- | --- | --- | --- | --- |
| First visit entry | `reports/review/WO017_FABLE_UX_FLOW.md` | DRAFT_REFERENCE_ONLY | Fable proposes one 375x667 welcome flow with an optional one-context router. | Existing `app/src/screens/home/FirstPage.tsx` is a current first surface, but it does not establish a first-visit router or a stored visit reason. | NOT_AUTHORIZED |
| Direct record | `app/src/screens/home/FirstPage.tsx:3-5,40-66`; `app/src/AppShell.tsx:61-84` | CURRENT_APP_EVIDENCE | A current first surface exposes a write-log callback and the shell can route to the existing log chooser. | This evidence does not authorize Fable's wording, a new route, or a new navigation state. | NOT_AUTHORIZED |
| Optional router, skip, and back | `reports/review/WO017_FABLE_UX_FLOW.md:33-76` | DRAFT_REFERENCE_ONLY | The proposal requires optional, transient direct-record, skip, and back actions. | No current source establishes those new router controls or persistence semantics; no answer may be stored. | NOT_AUTHORIZED |
| Returning-user rule | `reports/review/WO017_FABLE_UX_FLOW.md:79-92`; `reports/review/WO017_OWNER_DIRECTION.md:10-18` | DRAFT_REFERENCE_ONLY | A returning user is proposed to mean an existing local entry only. | Do not infer a visit-history flag, identity, synchronization state, or profile. With no local-entry fact, show the proposed new-user flow only after a separately authorized implementation. | NOT_AUTHORIZED |
| Plan-interest copy | `reports/review/WO017_FABLE_UX_FLOW.md:53-55`; `impl/src/plan-generator/generator.ts:3-12` | DRAFT_REFERENCE_ONLY plus CURRENT_APP_EVIDENCE | The only proposed copy is `서비스 준비 중`; the current generator is explicitly a `PLAN_GENERATOR_STUB`. | No request, waitlist, profile signal, candidate, personalized plan, or output exists. The only proposed actions are journal, back, and skip. | NOT_AUTHORIZED |
| Pain and mood receipt | `reports/review/WO017_FABLE_UX_FLOW.md:96-116`; `app/src/screens/Trends.tsx:20-67` | DRAFT_REFERENCE_ONLY plus CURRENT_APP_EVIDENCE | Fable specifies `evening_pain > evening_mood > post_session_distance > generic_local_save`; when both are present, pain leads and mood is confirmed saved. Trends already reads local evening/session facts for display. | Current code does not establish this post-save routing contract. Do not invent a score, threshold, readiness value, safety clearance, or diagnosis. | NOT_AUTHORIZED |
| Distance receipt | `reports/review/WO017_FABLE_UX_FLOW.md:102-109`; `app/src/screens/Trends.tsx:20-56` | DRAFT_REFERENCE_ONLY plus CURRENT_APP_EVIDENCE | A valid post-session distance may be shown as a factual weekly-distance view. | Missing, invalid, stale, or unverified source facts must fall back to a generic local-save receipt; missing is not zero. | NOT_AUTHORIZED |
| Generic receipt | `app/src/AppShell.tsx:30-57,77-82`; `reports/review/WO017_FABLE_UX_FLOW.md:102-109` | CURRENT_APP_EVIDENCE plus DRAFT_REFERENCE_ONLY | The shell already has local-save toast state; Fable proposes a generic local-save confirmation where no higher-priority structured fact exists. | No quantitative inference or claim about recovery, readiness, risk, compliance, or plan result is permitted. | NOT_AUTHORIZED |
| Accessible and reduced-motion flow | `reports/review/WO017_FABLE_UX_FLOW.md:146-156` | DRAFT_REFERENCE_ONLY | Fable proposes reduced-motion support, text labels, 44x44pt targets, and non-color-only meaning. | These are UX acceptance notes, not evidence that the current application meets them. | NOT_AUTHORIZED |
| Decoration | `reports/review/WO017_FABLE_UX_FLOW.md:158-168`; `specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md:155-176,301-313` | DRAFT_REFERENCE_ONLY | Decoration is proposal-only and excludes streak pressure. | No catalog, unlock, monetization, reward, safety-clearance, load, pace, weight, pain-free, or plan-compliance behavior is authorized. | NOT_AUTHORIZED |

## Factual and Insufficient-State Contract

```yaml
factual_analysis:
  authority: CURRENT_LOCAL_RECORDS_ONLY
  fabricated_threshold: false
  invented_score_or_readiness: false
  medical_or_safety_clearance: false
  plan_output: false
  source_reference_required: true
  insufficient_state: GENERIC_LOCAL_SAVE_RECEIPT_ONLY
source_classification:
  app_first_surface: CURRENT_APP_EVIDENCE
  app_entry_chooser: CURRENT_APP_EVIDENCE
  app_trends: CURRENT_APP_EVIDENCE
  plan_generator_stub: CURRENT_APP_EVIDENCE
  fable_ux_flow: DRAFT_REFERENCE_ONLY
  decoration_spec: DRAFT_REFERENCE_ONLY
```

`specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md:232-305` requires a
source reference or explicit insufficient state for a display fact and prohibits
invented values. Its numeric authority remains a boundary reference only; this
document neither copies nor implements a formula. Fable's branch relationship is
recorded above for provenance, not repaired or promoted here.

## Non-Authorization

This binding creates no app route, storage, consent, account, identity, sync, schema,
runtime evaluator, deployment configuration, canonical promotion, or implementation
approval. It records no human, owner, privacy, youth, medical, legal, or scientific
approval. The next document stage is a bounded Sol advisory; only the owner may decide
whether implementation is ever activated.

[DRAFT_COMPLETE]
