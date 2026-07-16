# P1 Target Patch Plan 01: Coach Ruleset

```yaml
issue_id: OI-FA-COACH-RULESET-001
approved: false
state: READY_FOR_OWNER_APPROVAL
readiness_class: READY_AFTER_NAMED_APPROVAL
classification: COACH_POLICY_AND_FRAME_ACCOUNTING
runtime_authorized: false
canonical_spec_patch_authorized: false
owning_files:
  - `specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`
  - `specs/active/PLAN_GENERATOR_SPEC.md`
  - `specs/active/RULE_SPEC_D1_D9.md`
  - `specs/active/TEMPLATE_LIBRARY_SPEC.md`
owning_issues:
  - `OI-FA-COACH-RULESET-001`
  - `OI-PG-COMPETITION-TAPER-POLICY-001`
  - `OI-D2-MAIN-INTERVAL-001`
  - `PROPOSED-OI-PG-FORMATION-COACH-RULESET-BINDING-001`
```

## Classification

Coach-owned policy. The 9.5-day frame and MAIN 2-3 convention remain a pilot rule,
not a safety, efficacy, or physiological optimum claim.

## Governing Decision

`FORMATION_COACH_RULESET_ACCEPTANCE_DECISION.md` is the governing blocked decision.
The owner may approve this patch plan only after completing
`reports/review/WO012_COACH_OWNER_WALKTHROUGH.md` and recording every exception.

## Exact Targets

Patch the four listed files. Create `PROPOSED-OI-PG-FORMATION-COACH-RULESET-BINDING-001`
in `specs/active/PLAN_GENERATOR_SPEC.md` only after opening that file and recounting its
issue table; the creation gate is an owner-approved 30-case walkthrough.

## Prerequisites

- Order 011 qualified privacy result is recorded without open safety/privacy conflict.
- Coach accepts exposure classes, `[start,end)` boundary, no catch-up, and 2-3 MAIN range.
- Coach explicitly chooses progression, taper, recovery, re-anchor, and exception behavior.

## Forbidden Work

No automatic progression, catch-up, taper, recovery, re-anchor, classifier relabeling,
or “scientifically optimal” copy. Do not patch runtime or the Formation canonical draft.

## Impact

Schema: versioned coach registry references only. API: none in this patch. Runtime:
none. Future runtime must fail closed when no accepted registry version is supplied.

## Baseline

Ruleset and 30 fixtures are prepared, but `ruleset_accepted: false`; Plan Generator
has no Formation coach-ruleset target issue and D2 owns a separate MAIN interval issue.

## RED

Before patching, add target-local tests that fail for end-boundary double count,
unregistered automatic taper, missed-MAIN catch-up, and missing re-anchor disposition.

## Patch Order

1. Accept the registry choices in the Formation coach contract.
2. Recount and add the exact proposed Plan Generator issue.
3. Bind Plan Generator to the accepted registry version without embedding new rules.
4. Align D2 exposure inputs while preserving its namespace and safety authority.
5. Bind only accepted templates in Template Library; recount every changed issue table.

## GREEN

All 30 walkthrough fixtures pass; MAIN 2 and MAIN 3 succeed; boundary, no-catch-up,
no-auto-taper, and missing-disposition cases fail closed; target counts reconcile.

## Manual QA

Coach reviews one normal frame, one competition frame, one missed MAIN, one injury hold,
one DST boundary, and one re-anchor case and signs the exact registry version/hash.

## Migration, Rollback, And Kill Switch

No migration in this plan. Later rollout must store registry version, support rollback
to the previous accepted version, and expose `formationCoachRulesEnabled=false` as the
default kill switch.

## Privacy And Security Review

Qualified privacy reviewer confirms no note content, presence, reason, hash, or audit
trace enters coach rules; security reviewer confirms registry and target hashes bind.

## Closure Evidence

Owner-signed walkthrough, accepted registry hash, RED/GREEN logs, target diffs, issue
recounts, privacy/security sign-off, and a closure PR linking this canonical P1.

## Human Decision

`COACH_HOJUNE`: approve, revise, or reject the registry and patch order. Current answer:
NOT_RECORDED; therefore this plan remains unapproved and the P1 remains OPEN.
