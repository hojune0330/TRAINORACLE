# TRAINORACLE Formal Gates And P1 Target Plans

## TL;DR

Complete every formal preparation step that does not require a real person's approval,
produce a non-production rendered prototype and executable evidence, give each canonical
P1 blocker an exact target-patch plan, and re-run the WO016 gate. Human approvals remain
open and runtime remains off.

## Current Baseline

```yaml
base_commit: a6857bcdcd9f2989799c505f52773256ce492e14
source_pr: 79
strict_acceptance: 0/6
canonical_p1_open: 10/10
approved_target_patch_plans: 0/10
runtime_authority: false
```

## Global Guardrails

- Never name an unverified person as a qualified reviewer or participant.
- Never translate packet completion, synthetic tests, or owner instruction to proceed
  into formal acceptance.
- `PRIVATE_SELF_ONLY` remains zero-signal. Local owner-directed full backup remains
  distinct from app recipient sharing.
- No hidden shadow, diagnostic claim, autonomous prescription, or real-plan mutation.
- Prototype assets must not be imported by `app/` or exposed as a production route.

## TODOs

- [x] 1. Build the formal approval roster, strict Order 010 re-acceptance handoff, and
  non-circular evidence-manifest contract.
  - Create one owner-readable status sheet covering WO011-015, required real roles,
    qualification evidence, exact decisions requested, prohibited inferences, and
    response states `APPROVE | APPROVE_WITH_REQUIRED_CHANGES | REJECT | NOT_REVIEWED`.
  - Create identity/key enrollment, revocation, conflict-of-interest, signature capture,
    supersession, and re-review procedures. Trusted keys bind real identity and role.
  - Define evidence hashing: UTF-8/NFC, sorted repository paths, source commit on merged
    `main`, generated artifact hashes, and exclusion of the acceptance record/signatures
    from their own manifest to avoid circularity.
  - Create a strict Order 010 handoff with source SHA, evidence manifest, remaining risks,
    owner response form, and independent human review form. Do not mark it accepted.
  - Acceptance: packet validator proves no fake name, signature, policy acceptance, or
    runtime authority; current WO011 decision remains blocked.

- [x] 2. Complete the WO011 qualified-review handoff packet.
  - Add launch-country/age scope, controller/processor facts, exact field/inference
    inventory, purpose/recipient/vendor/region matrix, retention/deletion/backup/key-
    erasure/legal-hold/breach/transfer facts, source versions, and reviewer response form.
  - Default unresolved facts to `UNASSIGNED`/`UNKNOWN`; mark templates
    `NOT_LEGAL_ADVICE` and `NOT_ACCEPTED`.
  - Acceptance: validator proves no fake reviewer/signature/policy acceptance/runtime
    authority and every WO011 P1 question has an answer slot or explicit owner fact gap.

- [x] 3. Build the WO012 coach-owner walkthrough and decision-ready registry packet.
  - Convert all 30 fixtures into a concise Korean walkthrough grouped by frame/count,
    race/competition, no-catch-up, taper/progression/recovery, composite load,
    re-anchor/boundary, privacy, and authorization.
  - Present exact options and recommended fail-closed default for every unresolved coach
    choice. Record no answer on the owner's behalf.
  - Acceptance: fixture IDs 30/30 mapped once; 9.5-day and 72-hour claims remain coach
    hypotheses; `ruleset_accepted:false` remains.

- [x] 4. Bind WO013 to repository targets without choosing a backend or migration.
  - Map current local journal, app storage, aggregate, calendar-view, safety, and future
    Formation seams to exact owning files and contracts.
  - Produce typed target schemas and patch order for identity/hash, CAS revision,
    subscription, offline conflict, tombstone/key-erasure, and DST behavior.
  - Acceptance: 36 fixtures map to a target or explicit `NO_TARGET_YET`; no backend,
    schema, sync, or migration authority is created.

- [x] 5. Complete WO014 participant and independent-review materials.
  - Create athlete-friendly disclosure/consent/withdrawal/stop copy, baseline checklist,
    four monitoring checkpoints, reviewer sampling sheet, adjudicator conflict form,
    and post-pilot disposition form.
  - Use no real athlete data or identity. Explain stickers as neutral journal marks that
    reward rest and honest reporting equally and never reward continued participation.
  - Watermark every page `NOT_VALID_FOR_ENROLLMENT`; include a synthetic-only rehearsal
    form and no-penalty wording.
  - Acceptance: all 37 scenarios trace to a form/control; participant and protocol
    acceptance remain false; document validator passes.

- [x] 6. Build an isolated WO015 Formation projection prototype and render evidence.
  - Read `emil-design-eng` before implementation.
  - Create `prototypes/formation-projection/` as a disposable static, synthetic-data-only
    surface with no network, persistence, generator, or mutation capability.
    It must show athlete/coach audience switching, five explanation levels, structured
    composite session facts, visible non-executing status, neutral progress, uncertainty,
    freshness, source state, and a disabled human-review path.
  - Use fatigue as separated facts, never a scalar. Preserve text/icon/pattern semantics;
    color is secondary. No dominant purple, beige, slate, or single-hue palette.
  - Include composite, missing, stale, unknown, conflict, paused, withdrawn, stopped,
    athlete, journal-only, coach, and permitted-guardian views.
  - Add an automated fixture/accessibility validator and Playwright render tests for
    320x700, 375x667, 1440x900, 200% zoom, keyboard order, reduced motion, contrast metadata,
    44x44 controls, no overlap, and unchanged fact hashes across levels.
  - Acceptance: screenshots and test reports exist; production app imports/routes remain
    zero; `projection_accepted:false` remains because named feedback and real AT review
    are absent.

- [x] 7. Write owner-approval-ready target-patch plans for all ten canonical P1 blockers.
  - One plan per P1 ID must name owning files, exact patch sequence, dependency gate,
    baseline characterization, RED test, GREEN test, manual QA, rollback, security and
    privacy checks, evidence path, and remaining human decision.
  - Set every plan to `READY_FOR_OWNER_APPROVAL` and `approved:false`; additionally
    classify as `READY_AFTER_NAMED_APPROVAL`, `REQUIRES_HIGH_ACCURACY_RESEARCH`,
    `REQUIRES_RUNTIME_TARGET`, or `RUNTIME_EVIDENCE_ONLY`.
  - Acceptance: exactly 10 unique P1 IDs, no generic placeholder target, and no row marked
    approved.

- [x] 8. Reconcile canonical decisions, deferred register, and the WO016 gate.
  - Link the new handoff/prototype/target-plan artifacts from WO011-015 decision records
    while keeping their acceptance booleans false.
  - Recount the canonical P1 table. Preparation may change `approved_target_patch_plans`
    only if an actual owner approval is recorded; otherwise it stays 0.
  - Run the strict gate verifier and require the current real repository to remain
    `ENTRY_GATE_FAILED_RUNTIME_NOT_STARTED`.

- [x] 9. Run final five-lane review, CI-equivalent QA, commit, push, and open a PR.
  - Goal/constraint, hands-on QA, code/contract quality, security/privacy, and repository
    context must all pass after corrections.
  - Run app unit/type/build/browser regressions plus prototype validators and screenshots.
  - Acceptance: no running server/process remains; evidence ledger is complete; PR says
    plainly which materials are prepared and which real approvals are still missing.

## Final Verification Wave

- [x] `FV-01`: exact outputs and P1 count inventory pass with no duplicates.
- [x] `FV-02`: private-note zero-signal, raw-note exclusion, local-backup distinction,
  no-hidden-shadow, and no-plan-mutation scans pass.
- [x] `FV-03`: prototype desktop/mobile/zoom/reduced-motion screenshots and pixel checks
  pass with no production app import.
- [x] `FV-04`: WO016 synthetic gate suite and real blocked-state validator pass.
- [x] `FV-05`: Git diff contains only declared packets, prototype, validators, evidence,
  and status-link updates; no backend/schema/migration/runtime activation.

## Non-Claims

- This plan cannot produce a legal opinion, qualified privacy approval, athlete consent,
  independent human review, accessibility certification, coach acceptance, or pilot
  authorization.
- Passing synthetic and rendered tests demonstrates preparation quality only.
