# TRAINORACLE Session Intensity Assessment Plan

## TL;DR

Add a backward-compatible session-intensity record that keeps planned subjective intensity,
reported RPE, and modality-specific objective facts separate. Present them together with explicit
coverage and provenance, but do not invent a universal cross-modality fatigue score or silently
impute a missing subjective answer.

## Fixed Decisions

- A post-session record may contain an optional pre-session planned RPE and an optional post-session
  reported RPE. The existing `rpe` field remains the reported value for legacy compatibility.
- A session may contain multiple objective components so mixed sessions are not collapsed.
- Objective normalization remains modality-specific:
  - running: actual/reference pace and session/typical distance ratios;
  - intervals: repetitions, work/recovery density, and optional actual/reference pace ratio;
  - strength: exercise type, sets, reps, `%1RM`, and RIR;
  - plyometric: exercise type and actual/typical contact ratio;
  - hills: repetitions, work/recovery density, and grade;
  - cross-training: modality, duration, and `%HRmax` when available.
- Derived metrics are explanatory observations, not fatigue, readiness, safety, injury-risk, or
  plan-authority signals.
- Missing subjective input remains `MISSING`. When objective facts exist, the UI says that only
  objective records are available.
- `PRIVATE_SELF_ONLY` text, note presence, and note metadata never enter intensity assessment.
- Exact high-intensity cutoffs and one cross-modality score remain an explicit later research and
  owner-decision goal.

## Scope

### In Scope

- active intensity contract and deferred-decision record;
- Zod persistence boundary and provenance fields;
- pure modality-specific metric derivation;
- mixed-component capture UI and saved-entry summary;
- legacy entry compatibility, safe export compatibility, unit, component, and browser tests.

### Out Of Scope

- athlete ranking, injury prediction, recovery clearance, medical inference;
- use of memo text or race self-check fields;
- automatic plan change or Formation runtime authority;
- universal fatigue score or unsupported high/low thresholds;
- wearable integration and server synchronization.

## TODOs

- [x] 1. Freeze the active intensity contract and baseline behavior.
  - Add `specs/active/SESSION_INTENSITY_ASSESSMENT_SPEC.md` with the fixed decisions, schemas,
    missing-data rules, privacy boundary, and deferred decisions.
  - Pin the unchanged behavior that legacy post-session entries parse and save without an
    intensity-assessment payload.
  - Record RED tests for the new assessment parser and comparison coverage before production code.

- [x] 2. Implement the typed persistence boundary and pure assessment model.
  - Add `app/src/domain/intensity-assessment.ts` with readonly discriminated unions, Zod schemas,
    numeric boundary parsing, pace parsing, coverage classification, and modality-specific metrics.
  - Add `intensityAssessment?: SessionIntensityAssessment` to `PostSessionEntry` without changing
    legacy read behavior.
  - Register `plannedRpe` and `objectiveComponents` in entry provenance and reject invalid or
    unregistered derived provenance.
  - Prove malformed, zero, negative, out-of-range, and incomplete component payloads fail closed.

- [x] 3. Build accessible subjective and objective capture controls.
  - Add a compact planned-RPE control next to the existing reported RPE contract.
  - Add objective component selection and one editor per modality with native numeric controls,
    stable touch targets, explicit units, and removal controls.
  - Permit multiple components and show a live coverage summary.
  - Never require objective fields to save a basic journal entry.

- [x] 4. Persist provenance and show the combined saved summary.
  - Save planned RPE and validated components with explicit/missing provenance.
  - Render planned, reported, objective metrics, and coverage on reopened records.
  - Show `객관 기록으로만 표시` when subjective values are missing and components exist.
  - Keep private and analyzable memo behavior unchanged and outside the calculation path.

- [x] 5. Verify compatibility and adversarial boundaries.
  - Run unit/component tests, typecheck, build, and full existing Vitest suite.
  - Add Playwright happy path for a mixed session and an objective-only missing-subjective path.
  - Probe malformed input, stale local-storage records, repeated add/remove, save without optional
    fields, misleading score language, private-note leakage, and repeated save/navigation.
  - Capture browser screenshots at mobile and desktop widths and confirm no overlap or truncation.

- [x] 6. Review, document evidence, and publish a draft PR.
  - Run the project review workflow for goal, code quality, security/privacy, hands-on QA, and
    spec/user compatibility.
  - Resolve actionable findings, rerun checks, and append exact evidence and cleanup receipts to
    `.omo/start-work/ledger.jsonl`.
  - Commit, push `codex/intensity-assessment`, and open a draft PR to `main` with deferred decisions
    and non-claims stated clearly.

## Final Verification Wave

- [x] V1. `npm.cmd run typecheck`, `npm.cmd run typecheck:e2e`, `npm.cmd test`, and
  `npm.cmd run build` pass from `app/`.
- [x] V2. Targeted Playwright intensity scenarios pass against a live server and screenshots show
  no overlap at mobile and desktop viewports.
- [x] V3. Git diff contains no universal fatigue score, memo-derived signal, safety claim, race
  self-check reuse, or unrelated source change.

## Manual QA Channel

Use Chrome against the Vite dev server. Create a post-session record with planned RPE, reported RPE,
an interval component, and a strength component; save, reopen, and verify the exact two components
and normalized facts appear. Repeat with both subjective values missing and a plyometric component;
the binary PASS observable is visible `객관 기록으로만 표시` text with no fabricated RPE.

## Completion Definition

The feature is complete when typed persistence, live capture, saved display, legacy compatibility,
privacy boundaries, automated tests, real-browser QA, and the draft PR all exist. Scientific cutoff
selection and universal scoring remain unresolved by design and are not completion blockers.
